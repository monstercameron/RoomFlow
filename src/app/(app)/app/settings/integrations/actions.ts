"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
} from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { validateQuietHoursConfig } from "@/lib/quiet-hours";

function parseOptionalQuietHoursText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export async function updateWorkspaceQuietHoursAction(formData: FormData) {
  const workspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const quietHoursEnabled = formData.get("quietHoursEnabled") === "on";
  const quietHoursStartLocal = parseOptionalQuietHoursText(
    formData.get("quietHoursStartLocal"),
  );
  const quietHoursEndLocal = parseOptionalQuietHoursText(
    formData.get("quietHoursEndLocal"),
  );
  const quietHoursTimeZone = parseOptionalQuietHoursText(
    formData.get("quietHoursTimeZone"),
  );

  if (quietHoursEnabled) {
    if (!quietHoursStartLocal || !quietHoursEndLocal || !quietHoursTimeZone) {
      throw new Error("Quiet hours start, end, and time zone are required when enabled.");
    }

    validateQuietHoursConfig({
      startLocal: quietHoursStartLocal,
      endLocal: quietHoursEndLocal,
      timeZone: quietHoursTimeZone,
    });
  }

  await prisma.workspace.update({
    where: {
      id: workspaceMembership.workspaceId,
    },
    data: {
      quietHoursStartLocal: quietHoursEnabled ? quietHoursStartLocal : null,
      quietHoursEndLocal: quietHoursEnabled ? quietHoursEndLocal : null,
      quietHoursTimeZone: quietHoursEnabled ? quietHoursTimeZone : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "workspace_quiet_hours_updated",
      payload: {
        quietHoursEnabled,
        quietHoursStartLocal: quietHoursEnabled ? quietHoursStartLocal : null,
        quietHoursEndLocal: quietHoursEnabled ? quietHoursEndLocal : null,
        quietHoursTimeZone: quietHoursEnabled ? quietHoursTimeZone : null,
      },
    },
  });

  revalidatePath("/app/settings/integrations");
  revalidatePath("/app/properties");
  revalidatePath("/app/leads");
  revalidatePath("/app/inbox");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  redirect(redirectTarget);
}