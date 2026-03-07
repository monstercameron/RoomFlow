"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import { applyLeadEvaluation } from "@/lib/lead-workflow";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import { prisma } from "@/lib/prisma";

function parseSchedulingUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Scheduling links must use http or https.");
    }

    return parsed.toString();
  } catch {
    throw new Error("A valid scheduling URL is required.");
  }
}

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.toLowerCase() === "true";
}

export async function updatePropertySchedulingLinkAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const schedulingUrl = parseSchedulingUrl(formData.get("schedulingUrl"));
  const redirectTargetValue = formData.get("redirectTo");

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      schedulingUrl,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceState.workspace.id,
      propertyId: property.id,
      actorUserId: workspaceState.user.id,
      eventType: schedulingUrl
        ? "Property scheduling link updated"
        : "Property scheduling link cleared",
      payload: {
        propertyName: property.name,
        schedulingUrl,
      },
    },
  });

  revalidatePath("/app/properties");
  revalidatePath("/app/calendar");
  revalidatePath("/app/leads");
  revalidatePath(`/app/properties/${property.id}/rules`);
  revalidatePath(`/app/properties/${property.id}/questions`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}/rules`;

  redirect(redirectTarget);
}

export async function togglePropertyRuleActiveAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const propertyRuleIdValue = formData.get("propertyRuleId");
  const nextActiveValue = formData.get("nextActive");
  const redirectTargetValue = formData.get("redirectTo");

  if (typeof propertyRuleIdValue !== "string" || propertyRuleIdValue.length === 0) {
    throw new Error("Property rule id is required.");
  }

  const propertyRule = await prisma.propertyRule.findFirst({
    where: {
      id: propertyRuleIdValue,
      propertyId,
      property: {
        workspaceId: workspaceState.workspace.id,
      },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!propertyRule) {
    throw new Error("Property rule not found.");
  }

  const nextActive = parseBooleanFormValue(nextActiveValue);

  await prisma.propertyRule.update({
    where: {
      id: propertyRule.id,
    },
    data: {
      active: nextActive,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceState.workspace.id,
      propertyId: propertyRule.property.id,
      actorUserId: workspaceState.user.id,
      eventType: nextActive
        ? "property_rule_activated"
        : "property_rule_deactivated",
      payload: {
        propertyRuleId: propertyRule.id,
        propertyRuleLabel: propertyRule.label,
        nextActive,
      },
    },
  });

  if (shouldRecomputeFitForTrigger("rule_changed")) {
    const leadsForProperty = await prisma.lead.findMany({
      where: {
        workspaceId: workspaceState.workspace.id,
        propertyId: propertyRule.property.id,
      },
      select: {
        id: true,
      },
      take: 200,
    });

    for (const leadForProperty of leadsForProperty) {
      try {
        await applyLeadEvaluation({
          workspaceId: workspaceState.workspace.id,
          leadId: leadForProperty.id,
          actorUserId: workspaceState.user.id,
        });
      } catch {
        await prisma.auditEvent.create({
          data: {
            workspaceId: workspaceState.workspace.id,
            leadId: leadForProperty.id,
            propertyId: propertyRule.property.id,
            actorUserId: workspaceState.user.id,
            eventType: "fit_recompute_failed_after_rule_change",
            payload: {
              propertyRuleId: propertyRule.id,
            },
          },
        });
      }
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${propertyId}/rules`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${propertyId}/rules`;

  redirect(redirectTarget);
}
