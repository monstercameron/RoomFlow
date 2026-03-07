"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditActorType,
  DeclineReason,
  LeadStatus,
  MembershipRole,
  MessageChannel,
  MessageDirection,
  MessageOrigin,
  QualificationFit,
} from "@/generated/prisma/client";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import {
  isLeadWorkflowError,
  LeadWorkflowError,
} from "@/lib/lead-workflow-errors";
import {
  applyLeadEvaluation,
  evaluateLeadQualification,
  getLeadWorkflowContext,
  performLeadWorkflowAction,
} from "@/lib/lead-workflow";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import {
  canMembershipRolePerformLeadAction,
  type LeadActionPermissionKey,
} from "@/lib/membership-role-permissions";
import { prisma } from "@/lib/prisma";
import { assertLeadStatusTransitionIsAllowed } from "@/lib/lead-status-machine";
import { workflowEventTypes } from "@/lib/workflow-events";
import { appendWorkflowErrorCodeToPath } from "@/lib/workflow-error-routing";

async function getActionContext(leadId: string) {
  const workspaceState = await getCurrentWorkspaceState();

  return {
    actorUserId: workspaceState.user.id,
    leadId,
    membershipRole: workspaceState.membership.role,
    workspaceId: workspaceState.workspace.id,
  };
}

function refreshLeadWorkflow(leadId: string) {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/leads/${leadId}`);
}

function getLeadDetailPath(leadId: string) {
  return `/app/leads/${leadId}`;
}

function redirectToWorkflowErrorPath(
  redirectPath: string,
  workflowErrorCode: Parameters<typeof appendWorkflowErrorCodeToPath>[1],
) {
  redirect(appendWorkflowErrorCodeToPath(redirectPath, workflowErrorCode));
}

async function executeWorkflowActionWithErrorRedirect(params: {
  leadId: string;
  redirectPath?: string;
  executeAction: () => Promise<void>;
}) {
  const fallbackLeadDetailPath = getLeadDetailPath(params.leadId);
  const redirectPath = params.redirectPath ?? fallbackLeadDetailPath;

  try {
    await params.executeAction();
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(params.leadId);
  redirect(redirectPath);
}

async function assertLeadActionPermission(params: {
  workspaceId: string;
  leadId: string;
  actorUserId: string;
  membershipRole: MembershipRole;
  leadActionPermissionKey: LeadActionPermissionKey;
}) {
  const canPerformLeadAction = canMembershipRolePerformLeadAction(
    params.membershipRole,
    params.leadActionPermissionKey,
  );

  if (canPerformLeadAction) {
    return;
  }

  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      actorUserId: params.actorUserId,
      actorType: AuditActorType.USER,
      eventType: "lead.action_denied",
      payload: {
        membershipRole: params.membershipRole,
        permission: params.leadActionPermissionKey,
      },
    },
  });

  throw new LeadWorkflowError(
    "ACTION_FORBIDDEN_BY_ROLE",
    `Role ${params.membershipRole} cannot perform ${params.leadActionPermissionKey}.`,
  );
}

export async function evaluateLeadAction(leadId: string, formData?: FormData) {
  const actionContext = await getActionContext(leadId);
  const redirectTargetValue = formData?.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "evaluateFit",
      });
      await applyLeadEvaluation(actionContext);
    },
  });
}

export async function requestInfoAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "requestInfo",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "request_info",
      });
    },
  });
}

export async function scheduleTourAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "scheduleTour",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "schedule_tour",
      });
    },
  });
}

export async function sendApplicationAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "sendApplication",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "send_application",
      });
    },
  });
}

export async function assignLeadPropertyAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const propertyIdFormValue = formData.get("propertyId");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "assignProperty",
    });

    if (
      typeof propertyIdFormValue !== "string" ||
      propertyIdFormValue.length === 0
    ) {
      throw new LeadWorkflowError(
        "PROPERTY_SELECTION_REQUIRED",
        "Property selection is required before assignment.",
      );
    }

    const matchingProperty = await prisma.property.findFirst({
      where: {
        id: propertyIdFormValue,
        workspaceId: actionContext.workspaceId,
      },
    });

    if (!matchingProperty) {
      throw new LeadWorkflowError(
        "PROPERTY_NOT_FOUND",
        `Property ${propertyIdFormValue} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    await prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        propertyId: matchingProperty.id,
        lastActivityAt: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        workspaceId: actionContext.workspaceId,
        leadId,
        propertyId: matchingProperty.id,
        actorUserId: actionContext.actorUserId,
        actorType: AuditActorType.USER,
        eventType: `Lead assigned to ${matchingProperty.name}`,
        payload: {
          propertyId: matchingProperty.id,
          propertyName: matchingProperty.name,
        },
      },
    });

    if (shouldRecomputeFitForTrigger("property_reassigned")) {
      await applyLeadEvaluation(actionContext);
    }
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}

export async function confirmDuplicateLeadAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const candidateLeadIdFormValue = formData.get("candidateLeadId");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "archiveLead",
    });

    if (
      typeof candidateLeadIdFormValue !== "string" ||
      candidateLeadIdFormValue.length === 0
    ) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_REQUIRED",
        "Duplicate candidate id is required.",
      );
    }

    if (candidateLeadIdFormValue === leadId) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_INVALID",
        "Lead cannot be marked as a duplicate of itself.",
      );
    }

    const [duplicateLead, canonicalLead] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId: actionContext.workspaceId,
        },
      }),
      prisma.lead.findFirst({
        where: {
          id: candidateLeadIdFormValue,
          workspaceId: actionContext.workspaceId,
        },
      }),
    ]);

    if (!duplicateLead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (!canonicalLead) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_NOT_FOUND",
        `Duplicate candidate ${candidateLeadIdFormValue} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const duplicateConfirmationReason = `Confirmed duplicate of ${canonicalLead.fullName}.`;
    const statusAfterConfirmation = LeadStatus.ARCHIVED;

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: duplicateLead.id,
        },
        data: {
          status: statusAfterConfirmation,
          lastActivityAt: new Date(),
        },
      });

      if (duplicateLead.status !== statusAfterConfirmation) {
        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: duplicateLead.id,
            fromStatus: duplicateLead.status,
            toStatus: statusAfterConfirmation,
            reason: duplicateConfirmationReason,
          },
        });
      }

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: duplicateLead.id,
          propertyId: duplicateLead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: "duplicate_confirmed",
          payload: {
            canonicalLeadId: canonicalLead.id,
            canonicalLeadName: canonicalLead.fullName,
            reason: duplicateConfirmationReason,
          },
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: canonicalLead.id,
          propertyId: canonicalLead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: "duplicate_linked",
          payload: {
            duplicateLeadId: duplicateLead.id,
            duplicateLeadName: duplicateLead.fullName,
          },
        },
      });
    });

  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  refreshLeadWorkflow(
    typeof candidateLeadIdFormValue === "string" ? candidateLeadIdFormValue : leadId,
  );
  redirect(redirectPath);
}

function parseLeadStatusFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(LeadStatus).includes(value as LeadStatus)
    ? (value as LeadStatus)
    : null;
}

function parseQualificationFitFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(QualificationFit).includes(value as QualificationFit)
    ? (value as QualificationFit)
    : null;
}

function parseDeclineReasonFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(DeclineReason).includes(value as DeclineReason)
    ? (value as DeclineReason)
    : null;
}

function parseMessageChannelFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (value === MessageChannel.EMAIL) {
    return MessageChannel.EMAIL;
  }

  if (value === MessageChannel.SMS) {
    return MessageChannel.SMS;
  }

  if (value === MessageChannel.INTERNAL_NOTE) {
    return MessageChannel.INTERNAL_NOTE;
  }

  return null;
}

export async function overrideLeadRoutingAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const overrideStatus = parseLeadStatusFromFormValue(formData.get("overrideStatus"));
  const overrideFit = parseQualificationFitFromFormValue(formData.get("overrideFit"));
  const overrideReason = formData.get("overrideReason");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "overrideFit",
    });

    if (!overrideStatus) {
      throw new LeadWorkflowError(
        "OVERRIDE_STATUS_REQUIRED",
        "Override status is required.",
      );
    }

    if (!overrideFit) {
      throw new LeadWorkflowError(
        "OVERRIDE_FIT_REQUIRED",
        "Override fit result is required.",
      );
    }

    if (typeof overrideReason !== "string" || overrideReason.trim().length === 0) {
      throw new LeadWorkflowError(
        "OVERRIDE_REASON_REQUIRED",
        "Override reason is required.",
      );
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        conversation: {
          include: {
            messages: true,
          },
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    try {
      assertLeadStatusTransitionIsAllowed(lead.status, overrideStatus);
    } catch {
      throw new LeadWorkflowError(
        "INVALID_STATUS_TRANSITION",
        `Lead status transition is not allowed: ${lead.status} -> ${overrideStatus}`,
      );
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: overrideStatus,
          fitResult: overrideFit,
          lastActivityAt: new Date(),
        },
      });

      if (lead.status !== overrideStatus) {
        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: overrideStatus,
            reason: `Manual override: ${overrideReason}`,
          },
        });
      }

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.overrideApplied,
          payload: {
            reason: overrideReason,
            previousStatus: lead.status,
            nextStatus: overrideStatus,
            previousFitResult: lead.fitResult,
            nextFitResult: overrideFit,
          },
        },
      });
    });

    if (shouldRecomputeFitForTrigger("override_confirmed")) {
      const leadAfterOverride = await getLeadWorkflowContext(
        actionContext.workspaceId,
        leadId,
      );

      if (leadAfterOverride) {
        const recomputedEvaluation = evaluateLeadQualification(leadAfterOverride);

        await prisma.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: leadAfterOverride.id,
            propertyId: leadAfterOverride.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.fitComputed,
            payload: {
              triggerType: "override_confirmed",
              previousFitResult: overrideFit,
              recomputedFitResult: recomputedEvaluation.fitResult,
              recommendedStatus: recomputedEvaluation.recommendedStatus,
              summary: recomputedEvaluation.summary,
            },
          },
        });
      }
    }
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}

export async function sendManualOutboundMessageAction(
  leadId: string,
  formData: FormData,
) {
  const actionContext = await getActionContext(leadId);
  const outboundMessageChannel = parseMessageChannelFromFormValue(
    formData.get("manualChannel"),
  );
  const outboundMessageSubjectValue = formData.get("manualSubject");
  const outboundMessageBodyValue = formData.get("manualBody");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "requestInfo",
    });

    if (!outboundMessageChannel) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_CONTACT_CHANNEL",
        "A manual outbound channel is required.",
      );
    }

    if (
      typeof outboundMessageBodyValue !== "string" ||
      outboundMessageBodyValue.trim().length === 0
    ) {
      throw new LeadWorkflowError(
        "ACTION_BLOCKED_MISSING_INFO",
        "Manual outbound body is required.",
      );
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        contact: true,
        conversation: true,
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const resolvedContactEmailAddress = lead.contact?.email ?? lead.email;
    const resolvedContactPhoneNumber = lead.contact?.phone ?? lead.phone;

    if (outboundMessageChannel === MessageChannel.EMAIL && !resolvedContactEmailAddress) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_CONTACT_CHANNEL",
        "Lead is missing an email address for manual outbound.",
      );
    }

    if (outboundMessageChannel === MessageChannel.SMS && !resolvedContactPhoneNumber) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_CONTACT_CHANNEL",
        "Lead is missing a phone number for manual outbound.",
      );
    }

    const conversation =
      lead.conversation ??
      (await prisma.conversation.create({
        data: {
          leadId: lead.id,
          subject:
            typeof outboundMessageSubjectValue === "string" &&
            outboundMessageSubjectValue.trim().length > 0
              ? outboundMessageSubjectValue.trim()
              : null,
        },
      }));

    const isInternalNoteChannel =
      outboundMessageChannel === MessageChannel.INTERNAL_NOTE;
    const messageRecord = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        origin: MessageOrigin.OUTBOUND_MANUAL,
        channel: outboundMessageChannel,
        subject:
          typeof outboundMessageSubjectValue === "string" &&
          outboundMessageSubjectValue.trim().length > 0
            ? outboundMessageSubjectValue.trim()
            : null,
        body: outboundMessageBodyValue.trim(),
        deliveryStatus: serializeDeliveryStatus({
          state: isInternalNoteChannel ? "sent" : "queued",
          provider: outboundMessageChannel,
          retryCount: 0,
        }),
        sentAt: isInternalNoteChannel ? new Date() : null,
      },
    });

    if (!isInternalNoteChannel) {
      try {
        await sendQueuedMessage(messageRecord.id, 0);
      } catch (error) {
        const deliveryErrorMessage =
          error instanceof Error ? error.message : "Manual outbound delivery failed";

        if (isProviderConfigurationError(deliveryErrorMessage)) {
          await markMessageProviderUnresolved({
            messageId: messageRecord.id,
            error: deliveryErrorMessage,
          });
        } else {
          await markMessageDeliveryFailure({
            messageId: messageRecord.id,
            retryCount: 0,
            error: deliveryErrorMessage,
          });
        }
      }
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: "manual_outbound_sent",
          payload: {
            messageId: messageRecord.id,
            channel: outboundMessageChannel,
            optOutAt: lead.optOutAt?.toISOString() ?? null,
          },
        },
      });
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}

export async function declineLeadAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const declineReason = parseDeclineReasonFromFormValue(formData.get("declineReason"));
  const declineNoteValue = formData.get("declineNote");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "declineLead",
    });

    if (!declineReason) {
      throw new LeadWorkflowError(
        "DECLINE_REASON_REQUIRED",
        "Decline reason is required.",
      );
    }

    if (!Object.values(DeclineReason).includes(declineReason)) {
      throw new LeadWorkflowError(
        "DECLINE_REASON_INVALID",
        "Decline reason is invalid.",
      );
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        conversation: {
          include: {
            messages: {
              where: {
                direction: MessageDirection.OUTBOUND,
                sentAt: null,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    try {
      assertLeadStatusTransitionIsAllowed(lead.status, LeadStatus.DECLINED);
    } catch {
      throw new LeadWorkflowError(
        "INVALID_STATUS_TRANSITION",
        `Lead status transition is not allowed: ${lead.status} -> ${LeadStatus.DECLINED}`,
      );
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: LeadStatus.DECLINED,
          declineReason,
          declinedAt: new Date(),
          isSoftDeclined: true,
          lastActivityAt: new Date(),
        },
      });

      await transactionClient.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: LeadStatus.DECLINED,
          reason: `Declined (${declineReason})`,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.declineRecorded,
          payload: {
            reason: declineReason,
            note: typeof declineNoteValue === "string" ? declineNoteValue : null,
            previousStatus: lead.status,
            nextStatus: LeadStatus.DECLINED,
          },
        },
      });

      if (lead.conversation?.messages.length) {
        for (const queuedOutboundMessage of lead.conversation.messages) {
          await transactionClient.message.update({
            where: {
              id: queuedOutboundMessage.id,
            },
            data: {
              deliveryStatus: serializeDeliveryStatus({
                state: "failed",
                provider: null,
                retryCount: 0,
                error: "Lead declined; automation stopped.",
              }),
            },
          });
        }
      }
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}

export async function cancelTourAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const cancelReasonValue = formData.get("cancelReason");
  const normalizedCancelReason =
    typeof cancelReasonValue === "string" && cancelReasonValue.trim().length > 0
      ? cancelReasonValue.trim()
      : "Canceled by operator";
  const routeToStatus = parseLeadStatusFromFormValue(formData.get("routeToStatus"));
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "scheduleTour",
    });

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        tours: {
          where: {
            status: "SCHEDULED",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const activeTour = lead.tours[0] ?? null;

    if (!activeTour) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    const fallbackRouteStatus = LeadStatus.QUALIFIED;
    const targetStatus =
      routeToStatus === LeadStatus.UNDER_REVIEW ? LeadStatus.UNDER_REVIEW : fallbackRouteStatus;

    assertLeadStatusTransitionIsAllowed(lead.status, targetStatus);

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          cancelReason: normalizedCancelReason,
        },
      });

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: targetStatus,
          lastActivityAt: new Date(),
        },
      });

      await transactionClient.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: targetStatus,
          reason: "Tour canceled and rerouted.",
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.tourCanceled,
          payload: {
            tourEventId: activeTour.id,
            cancelReason: normalizedCancelReason,
            reroutedStatus: targetStatus,
          },
        },
      });
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}

export async function rescheduleTourAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const scheduledAtValue = formData.get("scheduledAt");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "scheduleTour",
    });

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        tours: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const previousTourEvent = lead.tours[0] ?? null;
    const scheduledAtDate =
      typeof scheduledAtValue === "string" && scheduledAtValue.length > 0
        ? new Date(scheduledAtValue)
        : new Date();

    await prisma.$transaction(async (transactionClient) => {
      if (previousTourEvent) {
        await transactionClient.tourEvent.update({
          where: {
            id: previousTourEvent.id,
          },
          data: {
            status: "RESCHEDULED",
          },
        });
      }

      const nextTourEvent = await transactionClient.tourEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          status: "SCHEDULED",
          scheduledAt: scheduledAtDate,
          previousTourEventId: previousTourEvent?.id ?? null,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.tourRescheduled,
          payload: {
            previousTourEventId: previousTourEvent?.id ?? null,
            nextTourEventId: nextTourEvent.id,
            scheduledAt: scheduledAtDate.toISOString(),
          },
        },
      });
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(leadId);
  redirect(redirectPath);
}
