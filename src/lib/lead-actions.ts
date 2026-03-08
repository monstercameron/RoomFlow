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
  NotificationType,
  PropertyLifecycleStatus,
  QualificationFit,
  ScreeningConnectionAuthState,
  ScreeningRequestStatus,
  TourSchedulingMode,
  TourEventStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import {
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
} from "@/lib/app-data";
import {
  isDateTimeWithinAvailabilityWindow,
  parseAvailabilityWindowConfig,
} from "@/lib/availability-windows";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import {
  buildLeadChannelOptOutUpdate,
  formatMessageChannelLabel,
  isLeadChannelOptedOut,
} from "@/lib/lead-channel-opt-outs";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import { scheduleReminderSend } from "@/lib/jobs";
import {
  isLeadWorkflowError,
  LeadWorkflowError,
} from "@/lib/lead-workflow-errors";
import {
  applyLeadEvaluation,
  appendNotificationEvent,
  evaluateLeadQualification,
  getLeadWorkflowContext,
  performLeadWorkflowAction,
  queueOutboundWorkflowWebhook,
} from "@/lib/lead-workflow";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import {
  canMembershipRolePerformLeadAction,
  type LeadActionPermissionKey,
} from "@/lib/membership-role-permissions";
import { resolveInternalNoteMentions } from "@/lib/internal-note-mentions";
import { propertyAcceptsNewLeads } from "@/lib/property-lifecycle";
import { prisma } from "@/lib/prisma";
import { assertLeadStatusTransitionIsAllowed } from "@/lib/lead-status-machine";
import {
  sendTourCanceledNotification,
  sendTourRescheduledNotification,
  sendTourScheduledConfirmation,
} from "@/lib/tour-communications";
import {
  buildCalendarSyncState,
  buildInitialTourReminderState,
  parseCalendarConnectionsConfig,
  parseTourReminderSequence,
  resolveAssignedTourMembershipId,
  resolveTourReminderDelays,
} from "@/lib/tour-scheduling";
import {
  buildScreeningStatusTimestampUpdate,
  resolveScreeningStatusTransitionGuard,
  resolveScreeningWebhookEventType,
  resolveScreeningWorkflowEventType,
} from "@/lib/screening";
import { workspaceHasCapability } from "@/lib/workspace-plan";
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

export async function createManualTourAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
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

    const scheduledAt = parseScheduledAtFromFormValue(formData.get("scheduledAt"));
    const explicitAssignedMembershipId = parseAssignedMembershipIdFromFormValue(
      formData.get("assignedMembershipId"),
    );
    const notifyProspect = formData.get("notifyProspect") === "on";
    const workspaceMembership = await getCurrentWorkspaceMembership();
    const lead = await getLeadWorkflowContext(actionContext.workspaceId, leadId);

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (!lead.propertyId || !lead.property) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_PROPERTY",
        "A lead must be assigned to an active property before manual tour scheduling.",
      );
    }

    if (!propertyAcceptsNewLeads(lead.property.lifecycleStatus)) {
      throw new LeadWorkflowError(
        "PROPERTY_NOT_ACTIVE",
        `Property ${lead.property.id} is not active for manual scheduling.`,
      );
    }

    const evaluation = evaluateLeadQualification(lead);

    if (evaluation.fitResult === QualificationFit.MISMATCH) {
      throw new LeadWorkflowError(
        "ACTION_NOT_ALLOWED_FOR_MISMATCH",
        "Mismatched leads cannot be manually scheduled for tours.",
      );
    }

    if (evaluation.recommendedStatus === LeadStatus.INCOMPLETE) {
      throw new LeadWorkflowError(
        "ACTION_BLOCKED_MISSING_INFO",
        "This lead is still missing required qualification data.",
      );
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        `Lead ${lead.id} must be qualified before a manual tour can be created.`,
      );
    }

    const propertyCalendarSettings = await prisma.property.findFirst({
      where: {
        id: lead.propertyId,
        workspaceId: actionContext.workspaceId,
      },
      select: {
        calendarTargetExternalId: true,
        calendarTargetProvider: true,
      },
    });
    const eligibleTourCoverageMemberships = workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
      ? await getEligibleTourCoverageMemberships(actionContext.workspaceId)
      : [];
    const assignedMembershipId = resolveAssignedTourMembershipId({
      currentMembershipId: workspaceMembership.id,
      eligibleMemberships: eligibleTourCoverageMemberships,
      explicitAssignedMembershipId,
      workspaceSchedulingMode: workspaceMembership.workspace.tourSchedulingMode,
    });
    const reminderSequence = parseTourReminderSequence(
      workspaceMembership.workspace.tourReminderSequence,
    );
    const reminderSequenceState = buildInitialTourReminderState({
      reminderSequence,
      scheduledAt,
    });
    assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: parseAvailabilityWindowConfig(
        workspaceMembership.schedulingAvailability,
      ),
      label: "Operator",
      scheduledAt,
    });
    assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: parseAvailabilityWindowConfig(
        lead.property.schedulingAvailability,
      ),
      label: "Property",
      scheduledAt,
    });

    const existingScheduledTour = lead.tours.find(
      (tour) => tour.status === TourEventStatus.SCHEDULED,
    );

    if (existingScheduledTour) {
      throw new LeadWorkflowError(
        "ACTIVE_TOUR_ALREADY_EXISTS",
        `Lead ${lead.id} already has an active scheduled tour.`,
      );
    }

    assertLeadStatusTransitionIsAllowed(lead.status, LeadStatus.TOUR_SCHEDULED);

    const now = new Date();
    const { nextTour, calendarSyncState } = await prisma.$transaction(async (transactionClient) => {
      const createdTour = await transactionClient.tourEvent.create({
        data: {
          assignedMembershipId,
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          reminderSequenceState,
          status: TourEventStatus.SCHEDULED,
          scheduledAt,
        },
      });
      const calendarSyncState = buildCalendarSyncState({
        propertyCalendarTargetExternalId:
          propertyCalendarSettings?.calendarTargetExternalId ?? null,
        propertyCalendarTargetProvider: propertyCalendarSettings?.calendarTargetProvider ?? null,
        tourEventId: createdTour.id,
        workspaceCalendarConnections: parseCalendarConnectionsConfig(
          workspaceMembership.workspace.calendarConnections,
        ),
      });

      await transactionClient.tourEvent.update({
        where: {
          id: createdTour.id,
        },
        data: {
          calendarSyncError: calendarSyncState.calendarSyncError,
          calendarSyncProvider: calendarSyncState.calendarSyncProvider,
          calendarSyncStatus: calendarSyncState.calendarSyncStatus,
          calendarSyncedAt: calendarSyncState.calendarSyncedAt,
          externalCalendarId: calendarSyncState.externalCalendarId,
        },
      });

      if (assignedMembershipId) {
        await transactionClient.membership.update({
          where: {
            id: assignedMembershipId,
          },
          data: {
            lastTourAssignedAt: now,
          },
        });
      }

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: LeadStatus.TOUR_SCHEDULED,
          lastActivityAt: now,
        },
      });

      await transactionClient.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: LeadStatus.TOUR_SCHEDULED,
          reason: "Manual tour scheduled by operator.",
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.tourScheduled,
          payload: {
            assignedMembershipId,
            calendarSyncStatus: calendarSyncState.calendarSyncStatus,
            scheduledAt: scheduledAt.toISOString(),
            schedulingMethod: "manual",
            source: "operator",
          },
        },
      });

      return {
        calendarSyncState,
        nextTour: createdTour,
      };
    });

    try {
      await scheduleTourReminderJobs({
        leadId: lead.id,
        reminderSequence,
        scheduledAt,
        tourEventId: nextTour.id,
      });
    } catch {
      // Reminder enqueue is best-effort and should not block tour scheduling.
    }

    if (notifyProspect) {
      const prospectNotificationSent = await sendTourScheduledConfirmation({
        leadId: lead.id,
        propertyName: lead.property.name,
        scheduledAt,
      });

      if (prospectNotificationSent) {
        await prisma.tourEvent.update({
          where: {
            id: nextTour.id,
          },
          data: {
            prospectNotificationSentAt: new Date(),
          },
        });
      }
    }

    await appendNotificationEvent({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      type: NotificationType.TOUR_SCHEDULED,
      title: "Manual tour scheduled",
      body: `${lead.fullName} is scheduled for ${lead.property.name} on ${scheduledAt.toLocaleString()}.`,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        tourEventId: nextTour.id,
        scheduledAt: scheduledAt.toISOString(),
      },
    });

    await queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.scheduled",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        workspaceId: actionContext.workspaceId,
        scheduledAt: scheduledAt.toISOString(),
        schedulingMethod: "manual",
      },
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

export async function launchScreeningAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "launchScreening",
    });

    const workspaceMembership = await getCurrentWorkspaceMembership();

    if (
      !workspaceHasCapability(
        workspaceMembership.workspace.enabledCapabilities,
        WorkspaceCapability.SCREENING,
      )
    ) {
      throw new LeadWorkflowError(
        "ACTION_FORBIDDEN_BY_ROLE",
        "Screening is not enabled for this workspace.",
      );
    }

    const screeningConnectionId = parseRequiredFormText(
      formData.get("screeningConnectionId"),
      "Screening connection",
    );
    const packageKey = parseRequiredFormText(formData.get("packageKey"), "Package key");
    const packageLabel = parseRequiredFormText(
      formData.get("packageLabel"),
      "Package label",
    );
    const providerReference = parseOptionalFormText(formData.get("providerReference"));

    const [lead, screeningConnection] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId: actionContext.workspaceId,
        },
        include: {
          property: {
            select: {
              name: true,
            },
          },
          workspace: {
            select: {
              webhookSigningSecret: true,
            },
          },
          screeningRequests: {
            where: {
              status: {
                notIn: [
                  ScreeningRequestStatus.REVIEWED,
                  ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
                ],
              },
            },
            take: 1,
          },
        },
      }),
      prisma.screeningProviderConnection.findFirst({
        where: {
          id: screeningConnectionId,
          workspaceId: actionContext.workspaceId,
        },
      }),
    ]);

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "Only qualified leads can start screening.",
      );
    }

    if (lead.screeningRequests.length > 0) {
      throw new LeadWorkflowError(
        "ACTIVE_SCREENING_ALREADY_EXISTS",
        `Lead ${lead.id} already has an active screening request.`,
      );
    }

    if (!screeningConnection) {
      throw new LeadWorkflowError(
        "SCREENING_CONNECTION_REQUIRED",
        "Select a configured screening provider before launching screening.",
      );
    }

    if (screeningConnection.authState !== ScreeningConnectionAuthState.ACTIVE) {
      throw new LeadWorkflowError(
        "SCREENING_CONNECTION_INACTIVE",
        "The selected screening provider connection is not active.",
      );
    }

    const screeningRequest = await prisma.$transaction(async (transactionClient) => {
      const screeningRequest = await transactionClient.screeningRequest.create({
        data: {
          chargeMode: screeningConnection.chargeMode,
          inviteSentAt: new Date(),
          leadId: lead.id,
          packageKey,
          packageLabel,
          propertyId: lead.propertyId,
          providerReference,
          requestedAt: new Date(),
          screeningProviderConnectionId: screeningConnection.id,
          status: ScreeningRequestStatus.INVITE_SENT,
          workspaceId: actionContext.workspaceId,
        },
      });

      await transactionClient.screeningStatusEvent.createMany({
        data: [
          {
            screeningRequestId: screeningRequest.id,
            status: ScreeningRequestStatus.REQUESTED,
            detail: `Screening requested for ${packageLabel}.`,
          },
          {
            screeningRequestId: screeningRequest.id,
            status: ScreeningRequestStatus.INVITE_SENT,
            detail: `Provider-hosted invite launched with ${packageLabel}.`,
          },
        ],
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.screeningRequested,
          payload: {
            packageKey,
            packageLabel,
            provider: screeningConnection.provider,
            screeningRequestId: screeningRequest.id,
          },
        },
      });

      return screeningRequest;
    });

    await appendNotificationEvent({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      type: NotificationType.TOUR_SCHEDULED,
      title: "Screening launched",
      body: `${lead.fullName} started ${packageLabel} screening through ${screeningConnection.provider}.`,
      payload: {
        screeningRequestId: screeningRequest.id,
      },
    });

    await queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "screening.requested",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        leadId: lead.id,
        packageKey,
        packageLabel,
        provider: screeningConnection.provider,
        screeningRequestId: screeningRequest.id,
        workspaceId: actionContext.workspaceId,
      },
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

export async function updateScreeningRequestStatusAction(
  leadId: string,
  screeningRequestId: string,
  formData: FormData,
) {
  const actionContext = await getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "launchScreening",
    });

    const nextStatus = parseScreeningRequestStatusFromFormValue(formData.get("status"));
    const detail = parseOptionalFormText(formData.get("detail"));
    const providerReference = parseOptionalFormText(formData.get("providerReference"));
    const providerReportId = parseOptionalFormText(formData.get("providerReportId"));
    const providerReportUrl = parseOptionalFormText(formData.get("providerReportUrl"));
    const providerTimestamp = parseOptionalFormDateTime(formData.get("providerTimestamp"));
    const consentSource = parseOptionalFormText(formData.get("consentSource"));
    const disclosureVersion = parseOptionalFormText(formData.get("disclosureVersion"));
    const chargeAmountCents = parseOptionalFormCurrencyAmountToCents(
      formData.get("chargeAmount"),
    );
    const chargeCurrency = parseOptionalFormCurrencyCode(formData.get("chargeCurrency"));
    const chargeReference = parseOptionalFormText(formData.get("chargeReference"));
    const reviewNotes = parseOptionalFormText(formData.get("reviewNotes"));
    const adverseActionNotes = parseOptionalFormText(formData.get("adverseActionNotes"));
    const attachmentLabel = parseOptionalFormText(formData.get("attachmentLabel"));
    const attachmentUrl = parseOptionalFormText(formData.get("attachmentUrl"));
    const attachmentExternalId = parseOptionalFormText(formData.get("attachmentExternalId"));
    const attachmentContentType = parseOptionalFormText(formData.get("attachmentContentType"));

    const screeningRequest = await prisma.screeningRequest.findFirst({
      where: {
        id: screeningRequestId,
        leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        lead: {
          include: {
            workspace: {
              select: {
                webhookSigningSecret: true,
              },
            },
          },
        },
        consentRecords: {
          select: {
            id: true,
          },
        },
        screeningProviderConnection: true,
      },
    });

    if (!screeningRequest) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Screening request ${screeningRequestId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const now = new Date();
    const effectiveProviderTimestamp = providerTimestamp ?? now;
    const transitionGuard = resolveScreeningStatusTransitionGuard({
      completedAt: screeningRequest.completedAt,
      consentCompletedAt: screeningRequest.consentCompletedAt,
      currentStatus: screeningRequest.status,
      nextStatus,
      reviewedAt: screeningRequest.reviewedAt,
    });

    if (!transitionGuard.allowed) {
      throw new LeadWorkflowError(
        transitionGuard.reason === "consent_required"
          ? "SCREENING_CONSENT_REQUIRED"
          : "SCREENING_STATUS_TRANSITION_INVALID",
        `Screening request ${screeningRequest.id} cannot transition from ${screeningRequest.status} to ${nextStatus}.`,
      );
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.screeningRequest.update({
        where: {
          id: screeningRequest.id,
        },
        data: {
          ...buildScreeningStatusTimestampUpdate(nextStatus, effectiveProviderTimestamp),
          adverseActionNotes: adverseActionNotes ?? screeningRequest.adverseActionNotes,
          chargeAmountCents: chargeAmountCents ?? screeningRequest.chargeAmountCents,
          chargeCurrency:
            chargeCurrency ??
            screeningRequest.chargeCurrency ??
            (chargeAmountCents !== null ? "USD" : null),
          chargeReference: chargeReference ?? screeningRequest.chargeReference,
          providerReference: providerReference ?? screeningRequest.providerReference,
          providerReportId: providerReportId ?? screeningRequest.providerReportId,
          providerReportUrl: providerReportUrl ?? screeningRequest.providerReportUrl,
          providerUpdatedAt: effectiveProviderTimestamp,
          reviewNotes: reviewNotes ?? screeningRequest.reviewNotes,
          status: nextStatus,
        },
      });

      await transactionClient.screeningStatusEvent.create({
        data: {
          screeningRequestId: screeningRequest.id,
          status: nextStatus,
          detail,
          providerTimestamp: effectiveProviderTimestamp,
          payload: {
            attachmentExternalId,
            attachmentLabel,
            attachmentUrl,
            chargeAmountCents,
            chargeCurrency,
            chargeReference,
            providerReference,
            providerReportId,
            providerReportUrl,
          },
        },
      });

      if (
        nextStatus === ScreeningRequestStatus.CONSENT_COMPLETED &&
        screeningRequest.consentRecords.length === 0
      ) {
        await transactionClient.screeningConsentRecord.create({
          data: {
            screeningRequestId: screeningRequest.id,
            consentedAt: effectiveProviderTimestamp,
            disclosureVersion,
            providerReference: providerReference ?? screeningRequest.providerReference,
            source: consentSource,
          },
        });
      }

      if (attachmentLabel || attachmentUrl || attachmentExternalId) {
        await transactionClient.screeningAttachmentReference.create({
          data: {
            contentType: attachmentContentType,
            externalId: attachmentExternalId,
            label:
              attachmentLabel ??
              providerReportId ??
              providerReference ??
              "Screening report reference",
            screeningRequestId: screeningRequest.id,
            url: attachmentUrl,
          },
        });
      }

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: screeningRequest.leadId,
          propertyId: screeningRequest.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes[resolveScreeningWorkflowEventType(nextStatus)],
          payload: {
            chargeAmountCents,
            chargeCurrency,
            chargeReference,
            nextStatus,
            screeningRequestId: screeningRequest.id,
          },
        },
      });
    });

    if (nextStatus === ScreeningRequestStatus.COMPLETED) {
      await appendNotificationEvent({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        type: NotificationType.TOUR_SCHEDULED,
        title: "Screening completed",
        body: `${screeningRequest.lead.fullName} has a completed screening result ready for review.`,
        payload: {
          screeningRequestId: screeningRequest.id,
        },
      });

      await queueOutboundWorkflowWebhook({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        eventType: resolveScreeningWebhookEventType(nextStatus),
        signingSecret: screeningRequest.lead.workspace?.webhookSigningSecret ?? null,
        payload: {
          leadId: screeningRequest.leadId,
          provider: screeningRequest.screeningProviderConnection.provider,
          screeningRequestId: screeningRequest.id,
          status: nextStatus,
          workspaceId: actionContext.workspaceId,
        },
      });
    } else {
      await queueOutboundWorkflowWebhook({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        eventType: resolveScreeningWebhookEventType(nextStatus),
        signingSecret: screeningRequest.lead.workspace?.webhookSigningSecret ?? null,
        payload: {
          leadId: screeningRequest.leadId,
          provider: screeningRequest.screeningProviderConnection.provider,
          screeningRequestId: screeningRequest.id,
          status: nextStatus,
          workspaceId: actionContext.workspaceId,
        },
      });
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
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      },
    });

    if (!matchingProperty) {
      const existingProperty = await prisma.property.findFirst({
        where: {
          id: propertyIdFormValue,
          workspaceId: actionContext.workspaceId,
        },
        select: {
          lifecycleStatus: true,
        },
      });

      if (
        existingProperty &&
        !propertyAcceptsNewLeads(existingProperty.lifecycleStatus)
      ) {
        throw new LeadWorkflowError(
          "PROPERTY_NOT_ACTIVE",
          `Property ${propertyIdFormValue} is not active for new lead assignment.`,
        );
      }

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

function parseScheduledAtFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_REQUIRED",
      "A scheduled date and time is required.",
    );
  }

  const scheduledAt = new Date(value);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_INVALID",
      `Scheduled date ${value} is invalid.`,
    );
  }

  return scheduledAt;
}

function parseOptionalFormText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseOptionalFormDateTime(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date value: ${normalizedValue}`);
  }

  return parsedDate;
}

function parseOptionalFormCurrencyAmountToCents(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedAmount = Number(normalizedValue);

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error(`Invalid screening charge amount: ${normalizedValue}`);
  }

  return Math.round(parsedAmount * 100);
}

function parseOptionalFormCurrencyCode(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.toUpperCase();
}

function parseRequiredFormText(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return value.trim();
}

function parseAssignedMembershipIdFromFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseScreeningRequestStatusFromFormValue(value: FormDataEntryValue | null) {
  if (
    value === ScreeningRequestStatus.REQUESTED ||
    value === ScreeningRequestStatus.INVITE_SENT ||
    value === ScreeningRequestStatus.CONSENT_COMPLETED ||
    value === ScreeningRequestStatus.IN_PROGRESS ||
    value === ScreeningRequestStatus.COMPLETED ||
    value === ScreeningRequestStatus.REVIEWED ||
    value === ScreeningRequestStatus.ADVERSE_ACTION_RECORDED
  ) {
    return value;
  }

  throw new Error("A valid screening status is required.");
}

async function getEligibleTourCoverageMemberships(workspaceId: string) {
  const workspaceMemberships = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return workspaceMemberships.filter((workspaceMembership) =>
    canMembershipRolePerformLeadAction(workspaceMembership.role, "scheduleTour"),
  );
}

async function scheduleTourReminderJobs(params: {
  leadId: string;
  reminderSequence: ReturnType<typeof parseTourReminderSequence>;
  scheduledAt: Date;
  tourEventId: string;
}) {
  const reminderDelays = resolveTourReminderDelays({
    reminderSequence: params.reminderSequence,
    scheduledAt: params.scheduledAt,
  });

  await Promise.all(
    reminderDelays.map((reminderDelay) =>
      scheduleReminderSend(
        {
          leadId: params.leadId,
          reminderLabel: reminderDelay.label,
          reminderStepId: reminderDelay.id,
          scheduledFor: reminderDelay.sendAt.toISOString(),
          tourEventId: params.tourEventId,
        },
        reminderDelay.delaySeconds,
      ),
    ),
  );
}

function assertScheduledAtWithinAvailabilityWindow(params: {
  availabilityWindow: ReturnType<typeof parseAvailabilityWindowConfig>;
  label: string;
  scheduledAt: Date;
}) {
  if (!params.availabilityWindow) {
    return;
  }

  if (
    !isDateTimeWithinAvailabilityWindow({
      availabilityWindow: params.availabilityWindow,
      referenceTime: params.scheduledAt,
    })
  ) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_OUTSIDE_AVAILABILITY",
      `${params.label} availability does not include ${params.scheduledAt.toISOString()}.`,
    );
  }
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

  if (value === MessageChannel.WHATSAPP) {
    return MessageChannel.WHATSAPP;
  }

  if (value === MessageChannel.INSTAGRAM) {
    return MessageChannel.INSTAGRAM;
  }

  return null;
}

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
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

    if (isLeadChannelOptedOut(lead, outboundMessageChannel)) {
      throw new LeadWorkflowError(
        "ACTION_BLOCKED_OPT_OUT",
        `Lead has opted out of ${formatMessageChannelLabel(outboundMessageChannel)} messaging.`,
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
    const normalizedManualBody = isInternalNoteChannel
      ? (
          await (async () => {
            const workspaceMembers = await prisma.membership.findMany({
              where: {
                workspaceId: actionContext.workspaceId,
                userId: {
                  not: actionContext.actorUserId,
                },
              },
              include: {
                user: {
                  select: {
                    email: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            });

            // Only internal notes get mention normalization so outbound copy stays untouched.
            return resolveInternalNoteMentions({
              noteBody: outboundMessageBodyValue.trim(),
              workspaceMembers: workspaceMembers.map((workspaceMember) => ({
                userId: workspaceMember.userId,
                name: workspaceMember.user.name,
                emailAddress: workspaceMember.user.email,
                membershipRole: workspaceMember.role,
              })),
            }).normalizedNoteBody;
          })()
        )
      : outboundMessageBodyValue.trim();
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
        body: normalizedManualBody,
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

export async function updateLeadChannelOptOutAction(
  leadId: string,
  formData: FormData,
) {
  const actionContext = await getActionContext(leadId);
  const channel = parseMessageChannelFromFormValue(formData.get("channel"));
  const isOptedOut = parseBooleanFormValue(formData.get("isOptedOut"));
  const reasonValue = formData.get("reason");
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  try {
    await assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "requestInfo",
    });

    if (
      !channel ||
      channel === MessageChannel.INTERNAL_NOTE ||
      isOptedOut === null
    ) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_CONTACT_CHANNEL",
        "A valid contact channel is required for opt-out updates.",
      );
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      select: {
        id: true,
        propertyId: true,
        optOutAt: true,
        optOutReason: true,
        emailOptOutAt: true,
        emailOptOutReason: true,
        smsOptOutAt: true,
        smsOptOutReason: true,
        whatsappOptOutAt: true,
        whatsappOptOutReason: true,
        instagramOptOutAt: true,
        instagramOptOutReason: true,
      },
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const changedAt = new Date();
    const updateData = buildLeadChannelOptOutUpdate({
      lead,
      channel,
      isOptedOut,
      changedAt,
      reason: typeof reasonValue === "string" ? reasonValue : null,
    });

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          ...updateData,
          lastActivityAt: changedAt,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: isOptedOut ? "lead_opted_out" : "lead_opted_in",
          payload: {
            channel,
            reason:
              typeof reasonValue === "string" && reasonValue.trim().length > 0
                ? reasonValue.trim()
                : null,
            source: "operator_control",
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
  const operatorCancelReason =
    parseOptionalFormText(formData.get("operatorCancelReason")) ?? "Canceled by operator";
  const notifyProspect = formData.get("notifyProspect") === "on";
  const prospectMessage = parseOptionalFormText(formData.get("prospectMessage"));
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

    const workspaceMembership = await getCurrentWorkspaceMembership();

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        property: {
          select: {
            calendarTargetExternalId: true,
            calendarTargetProvider: true,
            name: true,
          },
        },
        workspace: {
          select: {
            webhookSigningSecret: true,
          },
        },
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

    const calendarSyncState = buildCalendarSyncState({
      existingExternalCalendarId: activeTour.externalCalendarId,
      propertyCalendarTargetExternalId: lead.property?.calendarTargetExternalId ?? null,
      propertyCalendarTargetProvider: lead.property?.calendarTargetProvider ?? null,
      tourEventId: activeTour.id,
      workspaceCalendarConnections: parseCalendarConnectionsConfig(
        workspaceMembership.workspace.calendarConnections,
      ),
    });

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          calendarSyncError: calendarSyncState.calendarSyncError,
          calendarSyncProvider: calendarSyncState.calendarSyncProvider,
          calendarSyncStatus: calendarSyncState.calendarSyncStatus,
          calendarSyncedAt: calendarSyncState.calendarSyncedAt,
          status: "CANCELED",
          canceledAt: new Date(),
          cancelReason: operatorCancelReason,
          operatorCancelReason,
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
            cancelReason: operatorCancelReason,
            notifyProspect,
            reroutedStatus: targetStatus,
          },
        },
      });
    });

    if (notifyProspect && lead.property?.name) {
      const prospectNotificationSent = await sendTourCanceledNotification({
        leadId: lead.id,
        propertyName: lead.property.name,
        prospectMessage,
      });

      if (prospectNotificationSent) {
        await prisma.tourEvent.update({
          where: {
            id: activeTour.id,
          },
          data: {
            prospectNotificationSentAt: new Date(),
          },
        });
      }
    }

    await queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.canceled",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        leadId: lead.id,
        operatorCancelReason,
        reroutedStatus: targetStatus,
        tourEventId: activeTour.id,
        workspaceId: actionContext.workspaceId,
      },
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
  const redirectTargetValue = formData.get("redirectTo");
  const explicitAssignedMembershipId = parseAssignedMembershipIdFromFormValue(
    formData.get("assignedMembershipId"),
  );
  const notifyProspect = formData.get("notifyProspect") === "on";
  const prospectMessage = parseOptionalFormText(formData.get("prospectMessage"));
  const operatorRescheduleReason =
    parseOptionalFormText(formData.get("operatorRescheduleReason")) ??
    "Rescheduled by operator";
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

    const scheduledAtDate = parseScheduledAtFromFormValue(formData.get("scheduledAt"));
    const workspaceMembership = await getCurrentWorkspaceMembership();
    const reminderSequence = parseTourReminderSequence(
      workspaceMembership.workspace.tourReminderSequence,
    );

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: actionContext.workspaceId,
      },
      include: {
        property: {
          select: {
            calendarTargetExternalId: true,
            calendarTargetProvider: true,
            name: true,
            schedulingAvailability: true,
          },
        },
        workspace: {
          select: {
            webhookSigningSecret: true,
          },
        },
        tours: {
          where: {
            status: TourEventStatus.SCHEDULED,
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

    const previousTourEvent = lead.tours[0] ?? null;

    if (!previousTourEvent) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: parseAvailabilityWindowConfig(
        workspaceMembership.schedulingAvailability,
      ),
      label: "Operator",
      scheduledAt: scheduledAtDate,
    });

    const propertyAvailability = lead.propertyId
      ? await prisma.property.findFirst({
          where: {
            id: lead.propertyId,
            workspaceId: actionContext.workspaceId,
          },
          select: {
            schedulingAvailability: true,
          },
        })
      : null;

    assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: parseAvailabilityWindowConfig(
        propertyAvailability?.schedulingAvailability ?? lead.property?.schedulingAvailability,
      ),
      label: "Property",
      scheduledAt: scheduledAtDate,
    });

    const eligibleTourCoverageMemberships = workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
      ? await getEligibleTourCoverageMemberships(actionContext.workspaceId)
      : [];
    const assignedMembershipId = resolveAssignedTourMembershipId({
      currentMembershipId: workspaceMembership.id,
      eligibleMemberships: eligibleTourCoverageMemberships,
      explicitAssignedMembershipId,
      workspaceSchedulingMode: workspaceMembership.workspace.tourSchedulingMode,
    });
    const reminderSequenceState = buildInitialTourReminderState({
      reminderSequence,
      scheduledAt: scheduledAtDate,
    });

    const { calendarSyncState, nextTourEvent } = await prisma.$transaction(async (transactionClient) => {
      if (previousTourEvent) {
        await transactionClient.tourEvent.update({
          where: {
            id: previousTourEvent.id,
          },
          data: {
            operatorRescheduleReason,
            status: "RESCHEDULED",
          },
        });
      }

      const nextTourEvent = await transactionClient.tourEvent.create({
        data: {
          assignedMembershipId,
          operatorRescheduleReason,
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          reminderSequenceState,
          status: "SCHEDULED",
          scheduledAt: scheduledAtDate,
          previousTourEventId: previousTourEvent?.id ?? null,
        },
      });
      const calendarSyncState = buildCalendarSyncState({
        existingExternalCalendarId: previousTourEvent?.externalCalendarId ?? null,
        propertyCalendarTargetExternalId:
          lead.property?.calendarTargetExternalId ?? null,
        propertyCalendarTargetProvider: lead.property?.calendarTargetProvider ?? null,
        tourEventId: nextTourEvent.id,
        workspaceCalendarConnections: parseCalendarConnectionsConfig(
          workspaceMembership.workspace.calendarConnections,
        ),
      });

      await transactionClient.tourEvent.update({
        where: {
          id: nextTourEvent.id,
        },
        data: {
          calendarSyncError: calendarSyncState.calendarSyncError,
          calendarSyncProvider: calendarSyncState.calendarSyncProvider,
          calendarSyncStatus: calendarSyncState.calendarSyncStatus,
          calendarSyncedAt: calendarSyncState.calendarSyncedAt,
          externalCalendarId: calendarSyncState.externalCalendarId,
        },
      });

      if (assignedMembershipId) {
        await transactionClient.membership.update({
          where: {
            id: assignedMembershipId,
          },
          data: {
            lastTourAssignedAt: new Date(),
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
          eventType: workflowEventTypes.tourRescheduled,
          payload: {
            assignedMembershipId,
            calendarSyncStatus: calendarSyncState.calendarSyncStatus,
            notifyProspect,
            operatorRescheduleReason,
            previousTourEventId: previousTourEvent?.id ?? null,
            nextTourEventId: nextTourEvent.id,
            scheduledAt: scheduledAtDate.toISOString(),
          },
        },
      });

      return {
        calendarSyncState,
        nextTourEvent,
      };
    });

    try {
      await scheduleTourReminderJobs({
        leadId: lead.id,
        reminderSequence,
        scheduledAt: scheduledAtDate,
        tourEventId: nextTourEvent.id,
      });
    } catch {
      // Reminder enqueue is best-effort and should not block tour rescheduling.
    }

    if (notifyProspect && lead.property?.name) {
      const prospectNotificationSent = await sendTourRescheduledNotification({
        leadId: lead.id,
        propertyName: lead.property.name,
        prospectMessage,
        scheduledAt: scheduledAtDate,
      });

      if (prospectNotificationSent) {
        await prisma.tourEvent.update({
          where: {
            id: nextTourEvent.id,
          },
          data: {
            prospectNotificationSentAt: new Date(),
          },
        });
      }
    }

    await queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.rescheduled",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        nextTourEventId: nextTourEvent.id,
        operatorRescheduleReason,
        scheduledAt: scheduledAtDate.toISOString(),
        workspaceId: actionContext.workspaceId,
      },
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

export async function completeTourAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

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
            status: TourEventStatus.SCHEDULED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError("LEAD_NOT_FOUND", `Lead ${leadId} was not found.`);
    }

    const activeTour = lead.tours[0] ?? null;

    if (!activeTour) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          completedAt: new Date(),
          status: TourEventStatus.COMPLETED,
        },
      });

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: LeadStatus.QUALIFIED,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: actionContext.actorUserId,
          eventType: "tour_completed",
          leadId: lead.id,
          payload: {
            leadId: lead.id,
            tourEventId: activeTour.id,
          },
          propertyId: lead.propertyId,
          workspaceId: actionContext.workspaceId,
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

export async function markTourNoShowAction(leadId: string, formData: FormData) {
  const actionContext = await getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const operatorNoShowReason =
    parseOptionalFormText(formData.get("operatorNoShowReason")) ?? "Prospect did not attend.";
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

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
            status: TourEventStatus.SCHEDULED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new LeadWorkflowError("LEAD_NOT_FOUND", `Lead ${leadId} was not found.`);
    }

    const activeTour = lead.tours[0] ?? null;

    if (!activeTour) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          completedAt: new Date(),
          operatorNoShowReason,
          status: TourEventStatus.NO_SHOW,
        },
      });

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: LeadStatus.UNDER_REVIEW,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: actionContext.actorUserId,
          eventType: "tour_no_show_recorded",
          leadId: lead.id,
          payload: {
            leadId: lead.id,
            operatorNoShowReason,
            tourEventId: activeTour.id,
          },
          propertyId: lead.propertyId,
          workspaceId: actionContext.workspaceId,
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
