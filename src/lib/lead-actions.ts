"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadStatus, MembershipRole } from "@/generated/prisma/client";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import {
  isLeadWorkflowError,
  LeadWorkflowError,
} from "@/lib/lead-workflow-errors";
import {
  applyLeadEvaluation,
  performLeadWorkflowAction,
} from "@/lib/lead-workflow";
import {
  canMembershipRolePerformLeadAction,
  type LeadActionPermissionKey,
} from "@/lib/membership-role-permissions";
import { prisma } from "@/lib/prisma";
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
  executeAction: () => Promise<void>;
}) {
  const leadDetailPath = getLeadDetailPath(params.leadId);

  try {
    await params.executeAction();
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(leadDetailPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(params.leadId);
  redirect(leadDetailPath);
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

export async function evaluateLeadAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
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
        eventType: `Lead assigned to ${matchingProperty.name}`,
        payload: {
          propertyId: matchingProperty.id,
          propertyName: matchingProperty.name,
        },
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
