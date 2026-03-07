"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceState } from "@/lib/app-data";
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
