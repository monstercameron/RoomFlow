"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isAvailabilityDay,
  serializeAvailabilityWindowConfig,
  validateAvailabilityWindowConfig,
} from "@/lib/availability-windows";
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

function parseAvailabilityDayValues(values: FormDataEntryValue[]) {
  return values.filter(
    (value): value is import("@/lib/availability-windows").AvailabilityDay =>
      typeof value === "string" && isAvailabilityDay(value),
  );
}

function parsePositiveInteger(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const normalizedValue = value.trim();
  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldLabel} must be a positive whole number.`);
  }

  return parsedValue;
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

export async function updateWorkspaceMessagingThrottleSettingsAction(
  formData: FormData,
) {
  const workspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const dailyAutomatedSendCap = parsePositiveInteger(
    formData.get("dailyAutomatedSendCap"),
    "Daily automated send cap",
  );
  const missingInfoPromptThrottleMinutes = parsePositiveInteger(
    formData.get("missingInfoPromptThrottleMinutes"),
    "Missing-info throttle window",
  );

  await prisma.workspace.update({
    where: {
      id: workspaceMembership.workspaceId,
    },
    data: {
      dailyAutomatedSendCap,
      missingInfoPromptThrottleMinutes,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "workspace_messaging_throttle_settings_updated",
      payload: {
        dailyAutomatedSendCap,
        missingInfoPromptThrottleMinutes,
      },
    },
  });

  revalidatePath("/app/settings/integrations");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  redirect(redirectTarget);
}

export async function updateOperatorSchedulingAvailabilityAction(
  formData: FormData,
) {
  const workspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const availabilityEnabled = formData.get("availabilityEnabled") === "on";
  const startLocal = parseOptionalQuietHoursText(formData.get("availabilityStartLocal"));
  const endLocal = parseOptionalQuietHoursText(formData.get("availabilityEndLocal"));
  const timeZone = parseOptionalQuietHoursText(formData.get("availabilityTimeZone"));
  const days = parseAvailabilityDayValues(formData.getAll("availabilityDays"));

  if (availabilityEnabled && (!startLocal || !endLocal || !timeZone)) {
    throw new Error("Operator availability start, end, and time zone are required when availability is enabled.");
  }

  const validatedSchedulingAvailability = availabilityEnabled
    ? validateAvailabilityWindowConfig({
        days,
        endLocal: endLocal ?? "",
        startLocal: startLocal ?? "",
        timeZone: timeZone ?? "",
      })
    : null;
  const schedulingAvailability = serializeAvailabilityWindowConfig(validatedSchedulingAvailability);

  await prisma.membership.update({
    where: {
      id: workspaceMembership.id,
    },
    data: {
      schedulingAvailability,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "operator_scheduling_availability_updated",
      payload: {
        availabilityEnabled,
        membershipId: workspaceMembership.id,
        schedulingAvailability: validatedSchedulingAvailability,
        userName: workspaceState.user.name,
      },
    },
  });

  revalidatePath("/app/calendar");
  revalidatePath("/app/leads");
  revalidatePath("/app/settings/integrations");
  revalidatePath("/app/settings/members");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  redirect(redirectTarget);
}