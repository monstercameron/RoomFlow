import { Prisma } from "@/generated/prisma/client";
import {
  CalendarSyncProvider,
  CalendarSyncStatus,
  TourSchedulingMode,
} from "@/generated/prisma/client";

export const calendarProviderOptions = [
  { label: "Manual only", value: "MANUAL" },
  { label: "Google Calendar", value: CalendarSyncProvider.GOOGLE },
  { label: "Outlook Calendar", value: CalendarSyncProvider.OUTLOOK },
] as const;

export const calendarConnectionStatusOptions = [
  { label: "Disconnected", value: "DISCONNECTED" },
  { label: "Configured", value: "CONFIGURED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Error", value: "ERROR" },
] as const;

export const tourSchedulingModeOptions = [
  { label: "Direct assignment", value: TourSchedulingMode.DIRECT },
  { label: "Manual team assignment", value: TourSchedulingMode.TEAM_MANUAL },
  { label: "Round robin shared coverage", value: TourSchedulingMode.ROUND_ROBIN },
] as const;

export type CalendarConnectionStatusValue =
  (typeof calendarConnectionStatusOptions)[number]["value"];

export type CalendarConnectionConfig = {
  connectedAccount: string;
  errorMessage: string | null;
  status: CalendarConnectionStatusValue;
  syncEnabled: boolean;
};

export type CalendarConnectionsConfig = Record<
  CalendarSyncProvider,
  CalendarConnectionConfig
>;

export type TourReminderStepConfig = {
  id: string;
  label: string;
  minutesBefore: number;
};

export type TourReminderStateEntry = {
  id: string;
  scheduledFor: string;
  sentAt: string | null;
};

export type EligibleCoverageMembership = {
  createdAt: Date;
  id: string;
  lastTourAssignedAt: Date | null;
  sharedTourCoverageEnabled: boolean;
};

const defaultCalendarConnectionConfig: CalendarConnectionConfig = {
  connectedAccount: "",
  errorMessage: null,
  status: "DISCONNECTED",
  syncEnabled: false,
};

export const defaultCalendarConnectionsConfig: CalendarConnectionsConfig = {
  [CalendarSyncProvider.GOOGLE]: { ...defaultCalendarConnectionConfig },
  [CalendarSyncProvider.OUTLOOK]: { ...defaultCalendarConnectionConfig },
};

export const defaultTourReminderSequence: ReadonlyArray<TourReminderStepConfig> = [
  {
    id: "day_before",
    label: "24 hours before",
    minutesBefore: 24 * 60,
  },
  {
    id: "hour_before",
    label: "1 hour before",
    minutesBefore: 60,
  },
];

function isCalendarConnectionStatusValue(
  value: string,
): value is CalendarConnectionStatusValue {
  return calendarConnectionStatusOptions.some((option) => option.value === value);
}

function normalizeCalendarConnectionConfig(
  value: Partial<CalendarConnectionConfig> | null | undefined,
): CalendarConnectionConfig {
  return {
    connectedAccount:
      typeof value?.connectedAccount === "string" ? value.connectedAccount.trim() : "",
    errorMessage:
      typeof value?.errorMessage === "string" && value.errorMessage.trim().length > 0
        ? value.errorMessage.trim()
        : null,
    status:
      typeof value?.status === "string" && isCalendarConnectionStatusValue(value.status)
        ? value.status
        : "DISCONNECTED",
    syncEnabled: value?.syncEnabled === true,
  };
}

export function parseCalendarConnectionsConfig(value: unknown): CalendarConnectionsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultCalendarConnectionsConfig };
  }

  const rawRecord = value as Record<string, unknown>;

  return {
    [CalendarSyncProvider.GOOGLE]: normalizeCalendarConnectionConfig(
      rawRecord[CalendarSyncProvider.GOOGLE] as Partial<CalendarConnectionConfig> | undefined,
    ),
    [CalendarSyncProvider.OUTLOOK]: normalizeCalendarConnectionConfig(
      rawRecord[CalendarSyncProvider.OUTLOOK] as Partial<CalendarConnectionConfig> | undefined,
    ),
  };
}

export function serializeCalendarConnectionsConfig(
  config: CalendarConnectionsConfig,
): Prisma.InputJsonValue {
  const normalizedConfig = parseCalendarConnectionsConfig(config);

  return {
    [CalendarSyncProvider.GOOGLE]: normalizedConfig[CalendarSyncProvider.GOOGLE],
    [CalendarSyncProvider.OUTLOOK]: normalizedConfig[CalendarSyncProvider.OUTLOOK],
  };
}

export function formatCalendarConnectionSummary(config: CalendarConnectionConfig) {
  if (!config.syncEnabled || config.status === "DISCONNECTED") {
    return "Not connected";
  }

  const accountSummary = config.connectedAccount.length > 0 ? config.connectedAccount : "Account pending";

  if (config.status === "ERROR" && config.errorMessage) {
    return `${accountSummary} · Error: ${config.errorMessage}`;
  }

  return `${accountSummary} · ${config.status.toLowerCase()}`;
}

export function resolveCalendarSyncProvider(
  providerValue: string | null | undefined,
): CalendarSyncProvider | null {
  if (!providerValue) {
    return null;
  }

  const normalizedValue = providerValue.trim().toUpperCase();

  if (normalizedValue.includes("GOOGLE")) {
    return CalendarSyncProvider.GOOGLE;
  }

  if (normalizedValue.includes("OUTLOOK") || normalizedValue.includes("MICROSOFT")) {
    return CalendarSyncProvider.OUTLOOK;
  }

  return null;
}

export function buildCalendarSyncState(params: {
  existingExternalCalendarId?: string | null;
  propertyCalendarTargetExternalId: string | null;
  propertyCalendarTargetProvider: string | null;
  tourEventId: string;
  workspaceCalendarConnections: CalendarConnectionsConfig;
}) {
  const provider = resolveCalendarSyncProvider(params.propertyCalendarTargetProvider);

  if (!provider) {
    return {
      calendarSyncError: null,
      calendarSyncProvider: null,
      calendarSyncStatus: null,
      calendarSyncedAt: null,
      externalCalendarId: params.existingExternalCalendarId ?? null,
    };
  }

  const connectionConfig = params.workspaceCalendarConnections[provider];

  if (!connectionConfig.syncEnabled || connectionConfig.status !== "ACTIVE") {
    return {
      calendarSyncError: `${provider} calendar connection is not active for sync.`,
      calendarSyncProvider: provider,
      calendarSyncStatus: CalendarSyncStatus.FAILED,
      calendarSyncedAt: null,
      externalCalendarId: params.existingExternalCalendarId ?? null,
    };
  }

  if (!params.propertyCalendarTargetExternalId) {
    return {
      calendarSyncError: `${provider} calendar target is missing an external calendar ID.`,
      calendarSyncProvider: provider,
      calendarSyncStatus: CalendarSyncStatus.FAILED,
      calendarSyncedAt: null,
      externalCalendarId: params.existingExternalCalendarId ?? null,
    };
  }

  return {
    calendarSyncError: null,
    calendarSyncProvider: provider,
    calendarSyncStatus: CalendarSyncStatus.SYNCED,
    calendarSyncedAt: new Date(),
    externalCalendarId:
      params.existingExternalCalendarId ??
      `${provider.toLowerCase()}:${params.propertyCalendarTargetExternalId}:${params.tourEventId}`,
  };
}

function normalizeTourReminderStep(
  value: Partial<TourReminderStepConfig> | null | undefined,
) {
  const id = typeof value?.id === "string" ? value.id.trim() : "";
  const label = typeof value?.label === "string" ? value.label.trim() : "";
  const minutesBefore =
    typeof value?.minutesBefore === "number" && Number.isFinite(value.minutesBefore)
      ? Math.floor(value.minutesBefore)
      : -1;

  if (!id || !label || minutesBefore <= 0) {
    return null;
  }

  return {
    id,
    label,
    minutesBefore,
  };
}

export function parseTourReminderSequence(value: unknown) {
  if (!Array.isArray(value)) {
    return [...defaultTourReminderSequence];
  }

  const normalizedSteps = value
    .map((entry) =>
      normalizeTourReminderStep(
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Partial<TourReminderStepConfig>)
          : null,
      ),
    )
    .filter((entry): entry is TourReminderStepConfig => Boolean(entry))
    .sort((leftStep, rightStep) => rightStep.minutesBefore - leftStep.minutesBefore);

  return normalizedSteps.length > 0
    ? normalizedSteps
    : [...defaultTourReminderSequence];
}

export function serializeTourReminderSequence(
  steps: ReadonlyArray<TourReminderStepConfig>,
): Prisma.InputJsonValue {
  return parseTourReminderSequence(steps).map((step) => ({
    id: step.id,
    label: step.label,
    minutesBefore: step.minutesBefore,
  }));
}

export function formatTourReminderSequenceSummary(
  steps: ReadonlyArray<TourReminderStepConfig>,
) {
  const normalizedSteps = parseTourReminderSequence(steps);

  return normalizedSteps.map((step) => step.label).join(" · ");
}

export function buildInitialTourReminderState(params: {
  reminderSequence: ReadonlyArray<TourReminderStepConfig>;
  scheduledAt: Date;
}) {
  return parseTourReminderSequence(params.reminderSequence).map((step) => ({
    id: step.id,
    scheduledFor: new Date(
      params.scheduledAt.getTime() - step.minutesBefore * 60 * 1000,
    ).toISOString(),
    sentAt: null,
  }));
}

export function parseTourReminderState(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as TourReminderStateEntry[];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const rawRecord = entry as Record<string, unknown>;
      const id = typeof rawRecord.id === "string" ? rawRecord.id.trim() : "";
      const scheduledFor =
        typeof rawRecord.scheduledFor === "string" ? rawRecord.scheduledFor.trim() : "";
      const sentAt =
        typeof rawRecord.sentAt === "string" && rawRecord.sentAt.trim().length > 0
          ? rawRecord.sentAt.trim()
          : null;

      if (!id || !scheduledFor) {
        return null;
      }

      return {
        id,
        scheduledFor,
        sentAt,
      };
    })
    .filter((entry): entry is TourReminderStateEntry => Boolean(entry));
}

export function markTourReminderSent(params: {
  reminderState: ReadonlyArray<TourReminderStateEntry>;
  reminderStepId: string;
  sentAt?: Date;
}) {
  const sentAtValue = (params.sentAt ?? new Date()).toISOString();

  return parseTourReminderState(params.reminderState).map((entry) =>
    entry.id === params.reminderStepId
      ? {
          ...entry,
          sentAt: sentAtValue,
        }
      : entry,
  );
}

export function resolveTourReminderDelays(params: {
  now?: Date;
  reminderSequence: ReadonlyArray<TourReminderStepConfig>;
  scheduledAt: Date;
}) {
  const referenceNow = params.now ?? new Date();

  return parseTourReminderSequence(params.reminderSequence)
    .map((step) => {
      const sendAt = new Date(params.scheduledAt.getTime() - step.minutesBefore * 60 * 1000);
      const delaySeconds = Math.floor((sendAt.getTime() - referenceNow.getTime()) / 1000);

      if (delaySeconds <= 0) {
        return null;
      }

      return {
        delaySeconds,
        id: step.id,
        label: step.label,
        minutesBefore: step.minutesBefore,
        sendAt,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        delaySeconds: number;
        id: string;
        label: string;
        minutesBefore: number;
        sendAt: Date;
      } => Boolean(entry),
    );
}

export function resolveAssignedTourMembershipId(params: {
  currentMembershipId: string;
  eligibleMemberships: ReadonlyArray<EligibleCoverageMembership>;
  explicitAssignedMembershipId: string | null;
  workspaceSchedulingMode: TourSchedulingMode;
}) {
  const eligibleSharedCoverageMemberships = params.eligibleMemberships
    .filter((membership) => membership.sharedTourCoverageEnabled)
    .sort((leftMembership, rightMembership) => {
      const leftLastAssignedAt = leftMembership.lastTourAssignedAt?.getTime() ?? 0;
      const rightLastAssignedAt = rightMembership.lastTourAssignedAt?.getTime() ?? 0;

      if (leftLastAssignedAt !== rightLastAssignedAt) {
        return leftLastAssignedAt - rightLastAssignedAt;
      }

      if (leftMembership.createdAt.getTime() !== rightMembership.createdAt.getTime()) {
        return leftMembership.createdAt.getTime() - rightMembership.createdAt.getTime();
      }

      return leftMembership.id.localeCompare(rightMembership.id);
    });

  if (
    params.explicitAssignedMembershipId &&
    params.eligibleMemberships.some(
      (membership) => membership.id === params.explicitAssignedMembershipId,
    )
  ) {
    return params.explicitAssignedMembershipId;
  }

  if (params.workspaceSchedulingMode === TourSchedulingMode.ROUND_ROBIN) {
    return eligibleSharedCoverageMemberships[0]?.id ?? params.currentMembershipId;
  }

  return params.currentMembershipId;
}

export function formatTourSchedulingMode(mode: TourSchedulingMode) {
  return tourSchedulingModeOptions.find((option) => option.value === mode)?.label ?? mode;
}