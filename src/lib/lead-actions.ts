"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import {
  applyLeadEvaluation,
  performLeadWorkflowAction,
} from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";

async function getActionContext(leadId: string) {
  const workspaceState = await getCurrentWorkspaceState();

  return {
    actorUserId: workspaceState.user.id,
    leadId,
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

export async function evaluateLeadAction(leadId: string) {
  const context = await getActionContext(leadId);
  await applyLeadEvaluation(context);
  refreshLeadWorkflow(leadId);
  redirect(`/app/leads/${leadId}`);
}

export async function requestInfoAction(leadId: string) {
  const context = await getActionContext(leadId);
  await performLeadWorkflowAction({
    ...context,
    action: "request_info",
  });
  refreshLeadWorkflow(leadId);
  redirect(`/app/leads/${leadId}`);
}

export async function scheduleTourAction(leadId: string) {
  const context = await getActionContext(leadId);
  await performLeadWorkflowAction({
    ...context,
    action: "schedule_tour",
  });
  refreshLeadWorkflow(leadId);
  redirect(`/app/leads/${leadId}`);
}

export async function sendApplicationAction(leadId: string) {
  const context = await getActionContext(leadId);
  await performLeadWorkflowAction({
    ...context,
    action: "send_application",
  });
  refreshLeadWorkflow(leadId);
  redirect(`/app/leads/${leadId}`);
}

export async function assignLeadPropertyAction(leadId: string, formData: FormData) {
  const context = await getActionContext(leadId);
  const propertyIdValue = formData.get("propertyId");
  const redirectTargetValue = formData.get("redirectTo");

  if (typeof propertyIdValue !== "string" || propertyIdValue.length === 0) {
    throw new Error("Property selection is required.");
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyIdValue,
      workspaceId: context.workspaceId,
    },
  });

  if (!property) {
    throw new Error("Selected property was not found.");
  }

  await prisma.lead.update({
    where: {
      id: leadId,
    },
    data: {
      propertyId: property.id,
      lastActivityAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: context.workspaceId,
      leadId,
      propertyId: property.id,
      actorUserId: context.actorUserId,
      eventType: `Lead assigned to ${property.name}`,
      payload: {
        propertyId: property.id,
        propertyName: property.name,
      },
    },
  });

  refreshLeadWorkflow(leadId);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/leads/${leadId}`;

  redirect(redirectTarget);
}
