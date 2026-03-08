"use server";

import {
  CalendarSyncProvider,
  TourSchedulingMode,
  WorkspaceCapability,
} from "@/generated/prisma/client";
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
import {
  calendarConnectionStatusOptions,
  serializeCalendarConnectionsConfig,
  serializeTourReminderSequence,
  parseCalendarConnectionsConfig,
} from "@/lib/tour-scheduling";
import { workspaceHasCapability } from "@/lib/workspace-plan";

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

function parseOptionalPositiveInteger(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldLabel} must be a positive whole number.`);
  }

  return parsedValue;
}

function parseCalendarSyncProvider(value: FormDataEntryValue | null) {
  if (value === CalendarSyncProvider.GOOGLE || value === CalendarSyncProvider.OUTLOOK) {
    return value;
  }

  throw new Error("A valid calendar provider is required.");
}

function parseCalendarConnectionStatus(value: FormDataEntryValue | null) {
  if (
    typeof value === "string" &&
    calendarConnectionStatusOptions.some((option) => option.value === value)
  ) {
    return value as (typeof calendarConnectionStatusOptions)[number]["value"];
  }

  throw new Error("A valid calendar connection status is required.");
}

function parseTourSchedulingMode(value: FormDataEntryValue | null) {
  if (
    value === TourSchedulingMode.DIRECT ||
    value === TourSchedulingMode.TEAM_MANUAL ||
    value === TourSchedulingMode.ROUND_ROBIN
  ) {
    return value;
  }

  throw new Error("A valid tour scheduling mode is required.");
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

export async function updateWorkspaceCalendarConnectionAction(formData: FormData) {
  const workspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const provider = parseCalendarSyncProvider(formData.get("provider"));
  const connectedAccount = parseOptionalQuietHoursText(formData.get("connectedAccount")) ?? "";
  const status = parseCalendarConnectionStatus(formData.get("status"));
  const syncEnabled = formData.get("syncEnabled") === "on";
  const errorMessage = parseOptionalQuietHoursText(formData.get("errorMessage"));
  const existingCalendarConnections = parseCalendarConnectionsConfig(
    workspaceMembership.workspace.calendarConnections,
  );

  if (syncEnabled && status !== "DISCONNECTED" && connectedAccount.length === 0) {
    throw new Error("A connected account is required when calendar sync is enabled.");
  }

  const nextCalendarConnections = {
    ...existingCalendarConnections,
    [provider]: {
      connectedAccount,
      errorMessage,
      status,
      syncEnabled,
    },
  };

  await prisma.workspace.update({
    where: {
      id: workspaceMembership.workspaceId,
    },
    data: {
      calendarConnections: serializeCalendarConnectionsConfig(nextCalendarConnections),
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "workspace_calendar_connection_updated",
      payload: {
        connectedAccount,
        errorMessage,
        provider,
        status,
        syncEnabled,
      },
    },
  });

  revalidatePath("/app/calendar");
  revalidatePath("/app/properties");
  revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  redirect(redirectTarget);
}

export async function updateWorkspaceTourSchedulingSettingsAction(
  formData: FormData,
) {
  const workspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const tourSchedulingMode = parseTourSchedulingMode(formData.get("tourSchedulingMode"));
  const firstReminderMinutes = parseOptionalPositiveInteger(
    formData.get("firstReminderMinutes"),
    "First reminder offset",
  );
  const secondReminderMinutes = parseOptionalPositiveInteger(
    formData.get("secondReminderMinutes"),
    "Second reminder offset",
  );

  if (
    tourSchedulingMode !== TourSchedulingMode.DIRECT &&
    !workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Org teammate controls are required for shared tour scheduling.");
  }

  const reminderSequence = [
    firstReminderMinutes
      ? {
          id: "first_reminder",
          label: `${firstReminderMinutes} minutes before`,
          minutesBefore: firstReminderMinutes,
        }
      : null,
    secondReminderMinutes
      ? {
          id: "second_reminder",
          label: `${secondReminderMinutes} minutes before`,
          minutesBefore: secondReminderMinutes,
        }
      : null,
  ].filter((entry): entry is { id: string; label: string; minutesBefore: number } => Boolean(entry));

  await prisma.workspace.update({
    where: {
      id: workspaceMembership.workspaceId,
    },
    data: {
      tourReminderSequence: serializeTourReminderSequence(reminderSequence),
      tourSchedulingMode,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "workspace_tour_scheduling_updated",
      payload: {
        reminderSequence,
        tourSchedulingMode,
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