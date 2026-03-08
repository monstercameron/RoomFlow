"use server";

import {
  CalendarSyncProvider,
  IntegrationAuthState,
  IntegrationCategory,
  IntegrationProvider,
  IntegrationSyncStatus,
  LeadSourceType,
  MessageChannel,
  ScreeningChargeMode,
  ScreeningConnectionAuthState,
  ScreeningProvider,
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
  buildCsvImportPreview,
  integrationCatalog,
  outboundWebhookEventDefinitions,
  parseInboundWebhookIntegrationConfig,
  parseListingFeedIntegrationConfig,
  parseMessagingChannelIntegrationConfig,
  parseMetaLeadAdsIntegrationConfig,
  parseOutboundWebhookIntegrationConfig,
  resolveIntegrationHealthState,
  serializeListingFeedIntegrationConfig,
  serializeMessagingChannelIntegrationConfig,
  serializeMetaLeadAdsIntegrationConfig,
  serializeInboundWebhookIntegrationConfig,
  serializeOutboundWebhookIntegrationConfig,
  serializeS3CompatibleIntegrationConfig,
  serializeSlackIntegrationConfig,
  serializeIntegrationFieldMappings,
  parseSlackIntegrationConfig,
  parseS3CompatibleIntegrationConfig,
} from "@/lib/integrations";
import {
  calendarConnectionStatusOptions,
  serializeCalendarConnectionsConfig,
  serializeTourReminderSequence,
  parseCalendarConnectionsConfig,
} from "@/lib/tour-scheduling";
import { serializeScreeningPackageConfig } from "@/lib/screening";
import { workspaceHasCapability } from "@/lib/workspace-plan";

function resolveIntegrationDisplayName(provider: IntegrationProvider) {
  return (
    integrationCatalog.find((catalogEntry) => catalogEntry.provider === provider)?.label ??
    provider
  );
}

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

type IntegrationActionWorkspaceMembership = {
  id: string;
  workspaceId: string;
  workspace: {
    calendarConnections?: unknown;
    enabledCapabilities: WorkspaceCapability[];
  };
};

type IntegrationActionWorkspaceState = {
  user: {
    id: string;
    name?: string | null;
  };
};

export type UpdateWorkspaceQuietHoursActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateWorkspace: (input: {
    workspaceId: string;
    quietHoursEndLocal: string | null;
    quietHoursStartLocal: string | null;
    quietHoursTimeZone: string | null;
  }) => Promise<unknown>;
  validateQuietHoursConfig: typeof validateQuietHoursConfig;
};

export type UpdateWorkspaceMessagingThrottleSettingsActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateWorkspace: (input: {
    workspaceId: string;
    dailyAutomatedSendCap: number;
    missingInfoPromptThrottleMinutes: number;
  }) => Promise<unknown>;
};

export type UpdateOperatorSchedulingAvailabilityActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  serializeAvailabilityWindowConfig: typeof serializeAvailabilityWindowConfig;
  updateMembership: (input: {
    membershipId: string;
    schedulingAvailability: ReturnType<typeof serializeAvailabilityWindowConfig>;
  }) => Promise<unknown>;
  validateAvailabilityWindowConfig: typeof validateAvailabilityWindowConfig;
};

export type UpdateWorkspaceTourSchedulingSettingsActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  serializeTourReminderSequence: typeof serializeTourReminderSequence;
  updateWorkspace: (input: {
    workspaceId: string;
    tourReminderSequence: ReturnType<typeof serializeTourReminderSequence>;
    tourSchedulingMode: TourSchedulingMode;
  }) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

export type UpdateWorkspaceCalendarConnectionActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  parseCalendarConnectionsConfig: typeof parseCalendarConnectionsConfig;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateWorkspace: (input: {
    workspaceId: string;
    calendarConnections: ReturnType<typeof serializeCalendarConnectionsConfig>;
  }) => Promise<unknown>;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateWorkspaceScreeningConnectionActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertScreeningProviderConnection: (input: {
    authState: ScreeningConnectionAuthState;
    chargeMode: ScreeningChargeMode;
    connectedAccount: string | null;
    defaultPackageKey: string | null;
    defaultPackageLabel: string | null;
    disclosureStrategy: string | null;
    lastError: string | null;
    packageConfig: ReturnType<typeof serializeScreeningPackageConfig>;
    provider: ScreeningProvider;
    workspaceId: string;
  }) => Promise<unknown>;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
  workspaceHasCapability: typeof workspaceHasCapability;
};

export type UpdateInboundWebhookIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateCsvImportIntegrationActionDependencies = {
  buildCsvImportPreview: typeof buildCsvImportPreview;
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateOutboundWebhookIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateMetaLeadAdsIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateMessagingChannelIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateListingFeedIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateSlackIntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

export type UpdateS3IntegrationActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<IntegrationActionWorkspaceMembership>;
  getCurrentWorkspaceState: () => Promise<IntegrationActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  upsertWorkspaceIntegrationConnection: typeof upsertWorkspaceIntegrationConnection;
};

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

function parseScreeningProvider(value: FormDataEntryValue | null) {
  if (
    value === ScreeningProvider.CHECKR ||
    value === ScreeningProvider.TRANSUNION ||
    value === ScreeningProvider.ZUMPER
  ) {
    return value;
  }

  throw new Error("A valid screening provider is required.");
}

function parseScreeningConnectionAuthState(value: FormDataEntryValue | null) {
  if (
    value === ScreeningConnectionAuthState.DISCONNECTED ||
    value === ScreeningConnectionAuthState.CONFIGURED ||
    value === ScreeningConnectionAuthState.ACTIVE ||
    value === ScreeningConnectionAuthState.ERROR
  ) {
    return value;
  }

  throw new Error("A valid screening auth state is required.");
}

function parseScreeningChargeMode(value: FormDataEntryValue | null) {
  if (
    value === ScreeningChargeMode.APPLICANT_PAY ||
    value === ScreeningChargeMode.LANDLORD_PAY ||
    value === ScreeningChargeMode.PASS_THROUGH
  ) {
    return value;
  }

  throw new Error("A valid screening charge mode is required.");
}

function parseLeadSourceType(value: FormDataEntryValue | null) {
  if (typeof value === "string" && Object.values(LeadSourceType).includes(value as LeadSourceType)) {
    return value as LeadSourceType;
  }

  throw new Error("A valid lead source type is required.");
}

function parseMessageChannel(value: FormDataEntryValue | null) {
  if (typeof value === "string" && Object.values(MessageChannel).includes(value as MessageChannel)) {
    return value as MessageChannel;
  }

  throw new Error("A valid message channel is required.");
}

function parseIntegrationFieldMappingsFromFormData(formData: FormData) {
  return [1, 2, 3, 4]
    .map((index) => ({
      required: formData.get(`fieldMapping${index}Required`) === "on",
      sourceField: parseOptionalQuietHoursText(formData.get(`fieldMapping${index}Source`)) ?? "",
      targetField: parseOptionalQuietHoursText(formData.get(`fieldMapping${index}Target`)) ?? "",
    }))
    .filter((entry) => entry.sourceField.length > 0 && entry.targetField.length > 0);
}

function parseOutboundWebhookEventTypesFromFormData(formData: FormData) {
  return outboundWebhookEventDefinitions
    .map((eventDefinition) => formData.getAll(`eventType:${eventDefinition.value}`))
    .flat()
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

function parseIntegrationProvider(value: FormDataEntryValue | null) {
  if (typeof value === "string" && Object.values(IntegrationProvider).includes(value as IntegrationProvider)) {
    return value as IntegrationProvider;
  }

  throw new Error("A valid integration provider is required.");
}

function resolveIntegrationProviderForCalendar(provider: CalendarSyncProvider) {
  return provider === CalendarSyncProvider.GOOGLE
    ? IntegrationProvider.GOOGLE_CALENDAR
    : IntegrationProvider.OUTLOOK_CALENDAR;
}

function resolveIntegrationProviderForScreening(provider: ScreeningProvider) {
  switch (provider) {
    case ScreeningProvider.CHECKR:
      return IntegrationProvider.CHECKR;
    case ScreeningProvider.TRANSUNION:
      return IntegrationProvider.TRANSUNION;
    case ScreeningProvider.ZUMPER:
      return IntegrationProvider.ZUMPER;
  }
}

async function upsertWorkspaceIntegrationConnection(params: {
  authState: IntegrationAuthState;
  category: IntegrationCategory;
  config?: import("@/generated/prisma/client").Prisma.InputJsonValue | null;
  enabled: boolean;
  healthMessage?: string | null;
  lastAuthorizedAt?: Date | null;
  lastSyncAt?: Date | null;
  lastSyncMessage?: string | null;
  mappingConfig?: import("@/generated/prisma/client").Prisma.InputJsonValue | null;
  metadata?: import("@/generated/prisma/client").Prisma.InputJsonValue | null;
  payload?: import("@/generated/prisma/client").Prisma.InputJsonValue | null;
  provider: IntegrationProvider;
  summary: string;
  syncStatus: IntegrationSyncStatus;
  workspaceId: string;
}) {
  const healthState = resolveIntegrationHealthState({
    authState: params.authState,
    enabled: params.enabled,
    healthMessage: params.healthMessage ?? null,
    syncStatus: params.syncStatus,
  });
  const now = new Date();
  const integrationConnection = await prisma.integrationConnection.upsert({
    where: {
      workspaceId_provider: {
        workspaceId: params.workspaceId,
        provider: params.provider,
      },
    },
    update: {
      authState: params.authState,
      category: params.category,
      config: params.config ?? undefined,
      displayName: resolveIntegrationDisplayName(params.provider),
      enabled: params.enabled,
      healthMessage: params.healthMessage ?? null,
      healthState,
      lastAuthorizedAt: params.lastAuthorizedAt ?? undefined,
      lastHealthCheckAt: now,
      lastSyncAt: params.lastSyncAt ?? undefined,
      lastSyncMessage: params.lastSyncMessage ?? null,
      mappingConfig: params.mappingConfig ?? undefined,
      metadata: params.metadata ?? undefined,
      syncStatus: params.syncStatus,
    },
    create: {
      authState: params.authState,
      category: params.category,
      config: params.config ?? undefined,
      displayName: resolveIntegrationDisplayName(params.provider),
      enabled: params.enabled,
      healthMessage: params.healthMessage ?? null,
      healthState,
      lastAuthorizedAt: params.lastAuthorizedAt ?? undefined,
      lastHealthCheckAt: now,
      lastSyncAt: params.lastSyncAt ?? undefined,
      lastSyncMessage: params.lastSyncMessage ?? null,
      mappingConfig: params.mappingConfig ?? undefined,
      metadata: params.metadata ?? undefined,
      provider: params.provider,
      syncStatus: params.syncStatus,
      workspaceId: params.workspaceId,
    },
  });

  await prisma.integrationSyncEvent.create({
    data: {
      detail: params.healthMessage ?? params.lastSyncMessage ?? null,
      direction: params.category === IntegrationCategory.LEAD_SOURCE ? "inbound" : "outbound",
      integrationConnectionId: integrationConnection.id,
      payload: params.payload ?? undefined,
      status: params.syncStatus,
      summary: params.summary,
    },
  });
}

const defaultUpdateWorkspaceQuietHoursActionDependencies: UpdateWorkspaceQuietHoursActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateWorkspace: ({ workspaceId, quietHoursEndLocal, quietHoursStartLocal, quietHoursTimeZone }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        quietHoursStartLocal,
        quietHoursEndLocal,
        quietHoursTimeZone,
      },
    }),
  validateQuietHoursConfig,
};

const defaultUpdateWorkspaceMessagingThrottleSettingsActionDependencies: UpdateWorkspaceMessagingThrottleSettingsActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateWorkspace: ({ workspaceId, dailyAutomatedSendCap, missingInfoPromptThrottleMinutes }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        dailyAutomatedSendCap,
        missingInfoPromptThrottleMinutes,
      },
    }),
};

const defaultUpdateOperatorSchedulingAvailabilityActionDependencies: UpdateOperatorSchedulingAvailabilityActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  serializeAvailabilityWindowConfig,
  updateMembership: ({ membershipId, schedulingAvailability }) =>
    prisma.membership.update({
      where: {
        id: membershipId,
      },
      data: {
        schedulingAvailability,
      },
    }),
  validateAvailabilityWindowConfig,
};

const defaultUpdateWorkspaceTourSchedulingSettingsActionDependencies: UpdateWorkspaceTourSchedulingSettingsActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  serializeTourReminderSequence,
  updateWorkspace: ({ workspaceId, tourReminderSequence, tourSchedulingMode }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        tourReminderSequence,
        tourSchedulingMode,
      },
    }),
  workspaceHasCapability,
};

const defaultUpdateWorkspaceCalendarConnectionActionDependencies: UpdateWorkspaceCalendarConnectionActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  parseCalendarConnectionsConfig,
  redirect,
  revalidatePath,
  updateWorkspace: ({ workspaceId, calendarConnections }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        calendarConnections,
      },
    }),
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateWorkspaceScreeningConnectionActionDependencies: UpdateWorkspaceScreeningConnectionActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertScreeningProviderConnection: ({
    authState,
    chargeMode,
    connectedAccount,
    defaultPackageKey,
    defaultPackageLabel,
    disclosureStrategy,
    lastError,
    packageConfig,
    provider,
    workspaceId,
  }) =>
    prisma.screeningProviderConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider,
        },
      },
      update: {
        authState,
        chargeMode,
        connectedAccount,
        defaultPackageKey,
        defaultPackageLabel,
        disclosureStrategy,
        lastAuthorizedAt:
          authState === ScreeningConnectionAuthState.ACTIVE ? new Date() : null,
        lastError,
        packageConfig,
      },
      create: {
        authState,
        chargeMode,
        connectedAccount,
        defaultPackageKey,
        defaultPackageLabel,
        disclosureStrategy,
        lastAuthorizedAt:
          authState === ScreeningConnectionAuthState.ACTIVE ? new Date() : null,
        lastError,
        packageConfig,
        provider,
        workspaceId,
      },
    }),
  upsertWorkspaceIntegrationConnection,
  workspaceHasCapability,
};

const defaultUpdateInboundWebhookIntegrationActionDependencies: UpdateInboundWebhookIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateCsvImportIntegrationActionDependencies: UpdateCsvImportIntegrationActionDependencies = {
  buildCsvImportPreview,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateOutboundWebhookIntegrationActionDependencies: UpdateOutboundWebhookIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateMetaLeadAdsIntegrationActionDependencies: UpdateMetaLeadAdsIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateMessagingChannelIntegrationActionDependencies: UpdateMessagingChannelIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateListingFeedIntegrationActionDependencies: UpdateListingFeedIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateSlackIntegrationActionDependencies: UpdateSlackIntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

const defaultUpdateS3IntegrationActionDependencies: UpdateS3IntegrationActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  upsertWorkspaceIntegrationConnection,
};

export async function handleUpdateWorkspaceQuietHoursAction(
  formData: FormData,
  dependencies: UpdateWorkspaceQuietHoursActionDependencies = defaultUpdateWorkspaceQuietHoursActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
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

    dependencies.validateQuietHoursConfig({
      startLocal: quietHoursStartLocal,
      endLocal: quietHoursEndLocal,
      timeZone: quietHoursTimeZone,
    });
  }

  await dependencies.updateWorkspace({
    workspaceId: workspaceMembership.workspaceId,
    quietHoursStartLocal: quietHoursEnabled ? quietHoursStartLocal : null,
    quietHoursEndLocal: quietHoursEnabled ? quietHoursEndLocal : null,
    quietHoursTimeZone: quietHoursEnabled ? quietHoursTimeZone : null,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_quiet_hours_updated",
    payload: {
      quietHoursEnabled,
      quietHoursStartLocal: quietHoursEnabled ? quietHoursStartLocal : null,
      quietHoursEndLocal: quietHoursEnabled ? quietHoursEndLocal : null,
      quietHoursTimeZone: quietHoursEnabled ? quietHoursTimeZone : null,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/inbox");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateWorkspaceQuietHoursAction(formData: FormData) {
  return handleUpdateWorkspaceQuietHoursAction(formData);
}

export async function handleUpdateWorkspaceMessagingThrottleSettingsAction(
  formData: FormData,
  dependencies: UpdateWorkspaceMessagingThrottleSettingsActionDependencies = defaultUpdateWorkspaceMessagingThrottleSettingsActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const dailyAutomatedSendCap = parsePositiveInteger(
    formData.get("dailyAutomatedSendCap"),
    "Daily automated send cap",
  );
  const missingInfoPromptThrottleMinutes = parsePositiveInteger(
    formData.get("missingInfoPromptThrottleMinutes"),
    "Missing-info throttle window",
  );

  await dependencies.updateWorkspace({
    workspaceId: workspaceMembership.workspaceId,
    dailyAutomatedSendCap,
    missingInfoPromptThrottleMinutes,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_messaging_throttle_settings_updated",
    payload: {
      dailyAutomatedSendCap,
      missingInfoPromptThrottleMinutes,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/inbox");
  dependencies.revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateWorkspaceMessagingThrottleSettingsAction(
  formData: FormData,
) {
  return handleUpdateWorkspaceMessagingThrottleSettingsAction(formData);
}

export async function handleUpdateOperatorSchedulingAvailabilityAction(
  formData: FormData,
  dependencies: UpdateOperatorSchedulingAvailabilityActionDependencies = defaultUpdateOperatorSchedulingAvailabilityActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
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
    ? dependencies.validateAvailabilityWindowConfig({
        days,
        endLocal: endLocal ?? "",
        startLocal: startLocal ?? "",
        timeZone: timeZone ?? "",
      })
    : null;
  const schedulingAvailability = dependencies.serializeAvailabilityWindowConfig(validatedSchedulingAvailability);

  await dependencies.updateMembership({
    membershipId: workspaceMembership.id,
    schedulingAvailability,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "operator_scheduling_availability_updated",
    payload: {
      availabilityEnabled,
      membershipId: workspaceMembership.id,
      schedulingAvailability: validatedSchedulingAvailability,
      userName: workspaceState.user.name,
    },
  });

  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/settings/members");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateOperatorSchedulingAvailabilityAction(
  formData: FormData,
) {
  return handleUpdateOperatorSchedulingAvailabilityAction(formData);
}

export async function handleUpdateWorkspaceCalendarConnectionAction(
  formData: FormData,
  dependencies: UpdateWorkspaceCalendarConnectionActionDependencies = defaultUpdateWorkspaceCalendarConnectionActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const provider = parseCalendarSyncProvider(formData.get("provider"));
  const connectedAccount = parseOptionalQuietHoursText(formData.get("connectedAccount")) ?? "";
  const status = parseCalendarConnectionStatus(formData.get("status"));
  const syncEnabled = formData.get("syncEnabled") === "on";
  const errorMessage = parseOptionalQuietHoursText(formData.get("errorMessage"));
  const existingCalendarConnections = dependencies.parseCalendarConnectionsConfig(
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

  await dependencies.updateWorkspace({
    workspaceId: workspaceMembership.workspaceId,
    calendarConnections: serializeCalendarConnectionsConfig(nextCalendarConnections),
  });

  await dependencies.createAuditEvent({
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
  });

  const integrationProvider = resolveIntegrationProviderForCalendar(provider);
  const integrationAuthState =
    status === "DISCONNECTED"
      ? IntegrationAuthState.NOT_CONNECTED
      : status === "ACTIVE"
        ? IntegrationAuthState.ACTIVE
        : status === "ERROR"
          ? IntegrationAuthState.ERROR
          : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState: integrationAuthState,
    category: IntegrationCategory.CALENDAR,
    config: {
      connectedAccount,
      provider,
      syncEnabled,
    },
    enabled: syncEnabled,
    healthMessage: errorMessage,
    lastAuthorizedAt: integrationAuthState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: syncEnabled && integrationAuthState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncMessage: syncEnabled
      ? `${resolveIntegrationDisplayName(integrationProvider)} sync ${status.toLowerCase()}.`
      : `${resolveIntegrationDisplayName(integrationProvider)} sync disabled.`,
    mappingConfig: {
      provider,
      syncEnabled,
      targetType: "calendar_events",
    },
    provider: integrationProvider,
    summary: `${resolveIntegrationDisplayName(integrationProvider)} connection updated.`,
    syncStatus:
      integrationAuthState === IntegrationAuthState.ERROR
        ? IntegrationSyncStatus.FAILED
        : integrationAuthState === IntegrationAuthState.ACTIVE && syncEnabled
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.IDLE,
    workspaceId: workspaceMembership.workspaceId,
  });

  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateWorkspaceCalendarConnectionAction(formData: FormData) {
  return handleUpdateWorkspaceCalendarConnectionAction(formData);
}

export async function handleUpdateWorkspaceTourSchedulingSettingsAction(
  formData: FormData,
  dependencies: UpdateWorkspaceTourSchedulingSettingsActionDependencies = defaultUpdateWorkspaceTourSchedulingSettingsActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
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
    !dependencies.workspaceHasCapability(
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

  const serializedReminderSequence = dependencies.serializeTourReminderSequence(
    reminderSequence,
  );

  await dependencies.updateWorkspace({
    workspaceId: workspaceMembership.workspaceId,
    tourReminderSequence: serializedReminderSequence,
    tourSchedulingMode,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_tour_scheduling_updated",
    payload: {
      reminderSequence,
      tourSchedulingMode,
    },
  });

  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/settings/members");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateWorkspaceTourSchedulingSettingsAction(
  formData: FormData,
) {
  return handleUpdateWorkspaceTourSchedulingSettingsAction(formData);
}

export async function handleUpdateWorkspaceScreeningConnectionAction(
  formData: FormData,
  dependencies: UpdateWorkspaceScreeningConnectionActionDependencies = defaultUpdateWorkspaceScreeningConnectionActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const provider = parseScreeningProvider(formData.get("provider"));
  const authState = parseScreeningConnectionAuthState(formData.get("authState"));
  const chargeMode = parseScreeningChargeMode(formData.get("chargeMode"));
  const connectedAccount = parseOptionalQuietHoursText(formData.get("connectedAccount"));
  const defaultPackageKey = parseOptionalQuietHoursText(formData.get("defaultPackageKey"));
  const defaultPackageLabel = parseOptionalQuietHoursText(formData.get("defaultPackageLabel"));
  const secondaryPackageKey = parseOptionalQuietHoursText(formData.get("secondaryPackageKey"));
  const secondaryPackageLabel = parseOptionalQuietHoursText(formData.get("secondaryPackageLabel"));
  const disclosureStrategy = parseOptionalQuietHoursText(formData.get("disclosureStrategy"));
  const lastError = parseOptionalQuietHoursText(formData.get("lastError"));

  if (
    !dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.SCREENING,
    )
  ) {
    throw new Error("Screening connections require the screening capability.");
  }

  if (
    authState === ScreeningConnectionAuthState.ACTIVE &&
    (!connectedAccount || !defaultPackageKey || !defaultPackageLabel)
  ) {
    throw new Error(
      "An active screening connection requires a connected account and default package.",
    );
  }

  const packageConfig = [
    defaultPackageKey && defaultPackageLabel
      ? { isDefault: true, key: defaultPackageKey, label: defaultPackageLabel }
      : null,
    secondaryPackageKey && secondaryPackageLabel
      ? { isDefault: false, key: secondaryPackageKey, label: secondaryPackageLabel }
      : null,
  ].filter(
    (entry): entry is { isDefault: boolean; key: string; label: string } => Boolean(entry),
  );

  const serializedPackageConfig = serializeScreeningPackageConfig(packageConfig);

  await dependencies.upsertScreeningProviderConnection({
    authState,
    chargeMode,
    connectedAccount,
    defaultPackageKey,
    defaultPackageLabel,
    disclosureStrategy,
    lastError,
    packageConfig: serializedPackageConfig,
    provider,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_screening_connection_updated",
    payload: {
      authState,
      chargeMode,
      connectedAccount,
      defaultPackageKey,
      defaultPackageLabel,
      disclosureStrategy,
      provider,
    },
  });

  const integrationProvider = resolveIntegrationProviderForScreening(provider);
  const integrationAuthState =
    authState === ScreeningConnectionAuthState.DISCONNECTED
      ? IntegrationAuthState.NOT_CONNECTED
      : authState === ScreeningConnectionAuthState.ACTIVE
        ? IntegrationAuthState.ACTIVE
        : authState === ScreeningConnectionAuthState.ERROR
          ? IntegrationAuthState.ERROR
          : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState: integrationAuthState,
    category: IntegrationCategory.SCREENING,
    config: {
      chargeMode,
      connectedAccount,
      defaultPackageKey,
      defaultPackageLabel,
      disclosureStrategy,
      provider,
    },
    enabled: authState !== ScreeningConnectionAuthState.DISCONNECTED,
    healthMessage: lastError,
    lastAuthorizedAt:
      integrationAuthState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: integrationAuthState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncMessage:
      integrationAuthState === IntegrationAuthState.ACTIVE
        ? `${resolveIntegrationDisplayName(integrationProvider)} ready for screening launch.`
        : `${resolveIntegrationDisplayName(integrationProvider)} setup saved.`,
    mappingConfig: serializedPackageConfig,
    provider: integrationProvider,
    summary: `${resolveIntegrationDisplayName(integrationProvider)} connection updated.`,
    syncStatus:
      integrationAuthState === IntegrationAuthState.ERROR
        ? IntegrationSyncStatus.FAILED
        : integrationAuthState === IntegrationAuthState.ACTIVE
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.IDLE,
    workspaceId: workspaceMembership.workspaceId,
  });

  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateWorkspaceScreeningConnectionAction(formData: FormData) {
  return handleUpdateWorkspaceScreeningConnectionAction(formData);
}

export async function handleUpdateInboundWebhookIntegrationAction(
  formData: FormData,
  dependencies: UpdateInboundWebhookIntegrationActionDependencies = defaultUpdateInboundWebhookIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const webhookEnabled = formData.get("webhookEnabled") === "on";
  const sourceLabel =
    parseOptionalQuietHoursText(formData.get("sourceLabel")) ?? "Generic webhook source";
  const signingHeader =
    parseOptionalQuietHoursText(formData.get("signingHeader")) ?? "x-roomflow-signature";
  const secretHint = parseOptionalQuietHoursText(formData.get("secretHint"));
  const defaultLeadSourceId = parseOptionalQuietHoursText(formData.get("defaultLeadSourceId"));
  const defaultLeadSourceType = parseLeadSourceType(formData.get("defaultLeadSourceType"));
  const defaultMessageChannel = parseMessageChannel(formData.get("defaultMessageChannel"));
  const fieldMappings = parseIntegrationFieldMappingsFromFormData(formData);
  const config = parseInboundWebhookIntegrationConfig({
    defaultLeadSourceId,
    defaultLeadSourceType,
    defaultMessageChannel,
    fieldMappings,
    secretHint,
    signingHeader,
    sourceLabel,
  });
  const authState = !webhookEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : secretHint
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.LEAD_SOURCE,
    config: serializeInboundWebhookIntegrationConfig(config),
    enabled: webhookEnabled,
    healthMessage: webhookEnabled && !secretHint ? "Signing secret hint is still missing." : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      webhookEnabled
        ? `${sourceLabel} mapping saved for inbound webhook ingestion.`
        : "Inbound webhook ingestion disabled.",
    mappingConfig: serializeIntegrationFieldMappings(fieldMappings),
    provider: IntegrationProvider.GENERIC_INBOUND_WEBHOOK,
    summary: `${sourceLabel} inbound webhook configuration updated.`,
    syncStatus:
      webhookEnabled && secretHint
        ? IntegrationSyncStatus.SUCCESS
        : webhookEnabled
          ? IntegrationSyncStatus.PENDING
          : IntegrationSyncStatus.IDLE,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_inbound_webhook_integration_updated",
    payload: {
      defaultLeadSourceId,
      defaultLeadSourceType,
      defaultMessageChannel,
      fieldMappings,
      signingHeader,
      sourceLabel,
      webhookEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/inbox");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateInboundWebhookIntegrationAction(formData: FormData) {
  return handleUpdateInboundWebhookIntegrationAction(formData);
}

export async function handleUpdateCsvImportIntegrationAction(
  formData: FormData,
  dependencies: UpdateCsvImportIntegrationActionDependencies = defaultUpdateCsvImportIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const importEnabled = formData.get("importEnabled") === "on";
  const sourceLabel = parseOptionalQuietHoursText(formData.get("sourceLabel")) ?? "CSV import";
  const defaultLeadSourceId = parseOptionalQuietHoursText(formData.get("defaultLeadSourceId"));
  const sampleCsv = parseOptionalQuietHoursText(formData.get("sampleCsv"));
  const fieldMappings = parseIntegrationFieldMappingsFromFormData(formData);
  const preview = sampleCsv
    ? await dependencies.buildCsvImportPreview({
        csvText: sampleCsv,
        defaultSourceName: sourceLabel,
        fieldMappings,
        workspaceId: workspaceMembership.workspaceId,
      })
    : null;
  const hasPreviewErrors = (preview?.invalidRowCount ?? 0) > 0;
  const authState = !importEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : fieldMappings.length > 0
      ? preview && !hasPreviewErrors
        ? IntegrationAuthState.ACTIVE
        : IntegrationAuthState.CONFIGURED
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.LEAD_SOURCE,
    config: {
      defaultLeadSourceId,
      sourceLabel,
      supportsPreview: true,
    },
    enabled: importEnabled,
    healthMessage:
      hasPreviewErrors && preview
        ? `${preview.invalidRowCount} preview row${preview.invalidRowCount === 1 ? "" : "s"} need attention.`
        : null,
    lastAuthorizedAt: null,
    lastSyncAt: preview ? new Date() : null,
    lastSyncMessage:
      preview
        ? `${preview.validRowCount} valid preview row${preview.validRowCount === 1 ? "" : "s"}, ${preview.invalidRowCount} invalid.`
        : importEnabled
          ? "CSV mapping saved. Paste a sample file to preview rows."
          : "CSV import disabled.",
    mappingConfig: serializeIntegrationFieldMappings(fieldMappings),
    metadata: preview
      ? {
          preview,
        }
      : null,
    payload: preview
      ? {
          headerFields: preview.headerFields,
          invalidRowCount: preview.invalidRowCount,
          validRowCount: preview.validRowCount,
        }
      : null,
    provider: IntegrationProvider.CSV_IMPORT,
    summary: `${sourceLabel} CSV import configuration updated.`,
    syncStatus:
      !importEnabled
        ? IntegrationSyncStatus.IDLE
        : preview
          ? hasPreviewErrors
            ? IntegrationSyncStatus.FAILED
            : IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_csv_import_integration_updated",
    payload: {
      defaultLeadSourceId,
      fieldMappings,
      importEnabled,
      previewInvalidRowCount: preview?.invalidRowCount ?? 0,
      previewValidRowCount: preview?.validRowCount ?? 0,
      sourceLabel,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateCsvImportIntegrationAction(formData: FormData) {
  return handleUpdateCsvImportIntegrationAction(formData);
}

export async function handleUpdateOutboundWebhookIntegrationAction(
  formData: FormData,
  dependencies: UpdateOutboundWebhookIntegrationActionDependencies = defaultUpdateOutboundWebhookIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const automationEnabled = formData.get("automationEnabled") === "on";
  const secretHint = parseOptionalQuietHoursText(formData.get("secretHint"));
  const destinations = [1, 2]
    .map((index) => ({
      enabled: formData.get(`destination${index}Enabled`) === "on",
      label: parseOptionalQuietHoursText(formData.get(`destination${index}Label`)) ?? "",
      url: parseOptionalQuietHoursText(formData.get(`destination${index}Url`)) ?? "",
    }))
    .filter((destination) => destination.label.length > 0 || destination.url.length > 0);
  const eventTypes = parseOutboundWebhookEventTypesFromFormData(formData);
  const config = parseOutboundWebhookIntegrationConfig({
    destinations,
    eventTypes,
    secretHint,
  });
  const enabledDestinationCount = config.destinations.filter((destination) => destination.enabled).length;
  const authState = !automationEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : enabledDestinationCount > 0 && config.eventTypes.length > 0
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.CRM_WORKFLOW,
    config: serializeOutboundWebhookIntegrationConfig(config),
    enabled: automationEnabled,
    healthMessage:
      automationEnabled && enabledDestinationCount === 0
        ? "Enable at least one outbound destination URL."
        : automationEnabled && config.eventTypes.length === 0
          ? "Select at least one outbound event type."
          : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      automationEnabled
        ? `${enabledDestinationCount} destination${enabledDestinationCount === 1 ? "" : "s"} subscribed to ${config.eventTypes.length} event type${config.eventTypes.length === 1 ? "" : "s"}.`
        : "Outbound automation webhooks disabled.",
    mappingConfig: {
      eventTypes: config.eventTypes,
    },
    payload: {
      destinationCount: enabledDestinationCount,
      eventTypes: config.eventTypes,
    },
    provider: IntegrationProvider.OUTBOUND_WEBHOOK,
    summary: "Outbound automation webhook configuration updated.",
    syncStatus:
      !automationEnabled
        ? IntegrationSyncStatus.IDLE
        : enabledDestinationCount > 0 && config.eventTypes.length > 0
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_outbound_webhook_integration_updated",
    payload: {
      automationEnabled,
      destinations: config.destinations,
      eventTypes: config.eventTypes,
      secretHint: config.secretHint,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateOutboundWebhookIntegrationAction(formData: FormData) {
  return handleUpdateOutboundWebhookIntegrationAction(formData);
}

export async function handleUpdateMetaLeadAdsIntegrationAction(
  formData: FormData,
  dependencies: UpdateMetaLeadAdsIntegrationActionDependencies = defaultUpdateMetaLeadAdsIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const webhookEnabled = formData.get("webhookEnabled") === "on";
  const sourceLabel = parseOptionalQuietHoursText(formData.get("sourceLabel")) ?? "Meta Lead Ads";
  const defaultLeadSourceId = parseOptionalQuietHoursText(formData.get("defaultLeadSourceId"));
  const pageId = parseOptionalQuietHoursText(formData.get("pageId"));
  const formId = parseOptionalQuietHoursText(formData.get("formId"));
  const verifyToken = parseOptionalQuietHoursText(formData.get("verifyToken"));
  const appSecret = parseOptionalQuietHoursText(formData.get("appSecret"));
  const campaignTag = parseOptionalQuietHoursText(formData.get("campaignTag"));
  const fieldMappings = parseIntegrationFieldMappingsFromFormData(formData);
  const config = parseMetaLeadAdsIntegrationConfig({
    appSecret,
    campaignTag,
    defaultLeadSourceId,
    fieldMappings,
    formId,
    pageId,
    sourceLabel,
    verifyToken,
  });
  const authState = !webhookEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : config.pageId && config.verifyToken
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.LEAD_SOURCE,
    config: serializeMetaLeadAdsIntegrationConfig(config),
    enabled: webhookEnabled,
    healthMessage:
      webhookEnabled && !config.pageId
        ? "Meta page ID is required."
        : webhookEnabled && !config.verifyToken
          ? "Meta webhook verify token is required."
          : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      webhookEnabled
        ? `${config.sourceLabel} webhook ready for page ${config.pageId ?? "unassigned"}.`
        : "Meta Lead Ads ingestion disabled.",
    mappingConfig: serializeIntegrationFieldMappings(fieldMappings),
    payload: {
      campaignTag: config.campaignTag,
      pageId: config.pageId,
      sourceLabel: config.sourceLabel,
    },
    provider: IntegrationProvider.META_LEAD_ADS,
    summary: "Meta Lead Ads configuration updated.",
    syncStatus:
      !webhookEnabled
        ? IntegrationSyncStatus.IDLE
        : authState === IntegrationAuthState.ACTIVE
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_meta_lead_ads_integration_updated",
    payload: {
      campaignTag: config.campaignTag,
      defaultLeadSourceId: config.defaultLeadSourceId,
      fieldMappings: config.fieldMappings,
      formId: config.formId,
      pageId: config.pageId,
      sourceLabel: config.sourceLabel,
      webhookEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateMetaLeadAdsIntegrationAction(formData: FormData) {
  return handleUpdateMetaLeadAdsIntegrationAction(formData);
}

export async function handleUpdateMessagingChannelIntegrationAction(
  formData: FormData,
  dependencies: UpdateMessagingChannelIntegrationActionDependencies = defaultUpdateMessagingChannelIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const provider = parseIntegrationProvider(formData.get("provider"));
  const webhookEnabled = formData.get("webhookEnabled") === "on";
  const accountLabel = parseOptionalQuietHoursText(formData.get("accountLabel")) ?? "";
  const senderIdentifier = parseOptionalQuietHoursText(formData.get("senderIdentifier"));
  const defaultLeadSourceId = parseOptionalQuietHoursText(formData.get("defaultLeadSourceId"));
  const verifyToken = parseOptionalQuietHoursText(formData.get("verifyToken"));
  const allowInboundSync = formData.get("allowInboundSync") === "on";
  const allowOutboundSend = formData.get("allowOutboundSend") === "on";
  const config = parseMessagingChannelIntegrationConfig({
    accountLabel,
    allowInboundSync,
    allowOutboundSend,
    defaultLeadSourceId,
    senderIdentifier,
    verifyToken,
  });
  const authState = !webhookEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : config.accountLabel && (config.allowInboundSync || config.allowOutboundSend)
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.MESSAGING,
    config: serializeMessagingChannelIntegrationConfig(config),
    enabled: webhookEnabled,
    healthMessage:
      webhookEnabled && !config.accountLabel
        ? "Account label is required."
        : webhookEnabled && config.allowOutboundSend && !config.senderIdentifier
          ? "Sender identifier is required for outbound delivery."
          : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      webhookEnabled
        ? `${config.accountLabel || resolveIntegrationDisplayName(provider)} saved with ${config.allowInboundSync ? "inbound" : "no inbound"}${config.allowOutboundSend ? " and outbound" : ""} messaging.`
        : `${resolveIntegrationDisplayName(provider)} disabled.`,
    payload: {
      accountLabel: config.accountLabel,
      allowInboundSync: config.allowInboundSync,
      allowOutboundSend: config.allowOutboundSend,
      senderIdentifier: config.senderIdentifier,
    },
    provider,
    summary: `${resolveIntegrationDisplayName(provider)} integration updated.`,
    syncStatus:
      !webhookEnabled
        ? IntegrationSyncStatus.IDLE
        : authState === IntegrationAuthState.ACTIVE
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: `workspace_${provider.toLowerCase()}_integration_updated`,
    payload: {
      accountLabel: config.accountLabel,
      allowInboundSync: config.allowInboundSync,
      allowOutboundSend: config.allowOutboundSend,
      senderIdentifier: config.senderIdentifier,
      webhookEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateMessagingChannelIntegrationAction(formData: FormData) {
  return handleUpdateMessagingChannelIntegrationAction(formData);
}

export async function handleUpdateListingFeedIntegrationAction(
  formData: FormData,
  dependencies: UpdateListingFeedIntegrationActionDependencies = defaultUpdateListingFeedIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const provider = parseIntegrationProvider(formData.get("provider"));
  const feedEnabled = formData.get("feedEnabled") === "on";
  const feedLabel = parseOptionalQuietHoursText(formData.get("feedLabel")) ?? resolveIntegrationDisplayName(provider);
  const destinationName = parseOptionalQuietHoursText(formData.get("destinationName"));
  const destinationPath = parseOptionalQuietHoursText(formData.get("destinationPath"));
  const includeOnlyActiveProperties = formData.get("includeOnlyActiveProperties") === "on";
  const config = parseListingFeedIntegrationConfig({
    destinationName,
    destinationPath,
    feedLabel,
    includeOnlyActiveProperties,
  });
  const authState = !feedEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : config.feedLabel
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.LEAD_SOURCE,
    config: serializeListingFeedIntegrationConfig(config),
    enabled: feedEnabled,
    healthMessage: null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      feedEnabled
        ? `${config.feedLabel} feed ready for ${config.includeOnlyActiveProperties ? "active" : "all"} properties.`
        : `${resolveIntegrationDisplayName(provider)} feed disabled.`,
    payload: {
      destinationName: config.destinationName,
      destinationPath: config.destinationPath,
      includeOnlyActiveProperties: config.includeOnlyActiveProperties,
    },
    provider,
    summary: `${resolveIntegrationDisplayName(provider)} feed configuration updated.`,
    syncStatus: feedEnabled ? IntegrationSyncStatus.SUCCESS : IntegrationSyncStatus.IDLE,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: `workspace_${provider.toLowerCase()}_feed_updated`,
    payload: {
      destinationName: config.destinationName,
      destinationPath: config.destinationPath,
      feedEnabled,
      feedLabel: config.feedLabel,
      includeOnlyActiveProperties: config.includeOnlyActiveProperties,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/properties");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateListingFeedIntegrationAction(formData: FormData) {
  return handleUpdateListingFeedIntegrationAction(formData);
}

export async function handleUpdateSlackIntegrationAction(
  formData: FormData,
  dependencies: UpdateSlackIntegrationActionDependencies = defaultUpdateSlackIntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const webhookEnabled = formData.get("webhookEnabled") === "on";
  const webhookUrl = parseOptionalQuietHoursText(formData.get("webhookUrl"));
  const channelLabel = parseOptionalQuietHoursText(formData.get("channelLabel"));
  const config = parseSlackIntegrationConfig({
    channelLabel,
    notifyOnApplicationInviteStale: formData.get("notifyOnApplicationInviteStale") === "on",
    notifyOnNewLead: formData.get("notifyOnNewLead") === "on",
    notifyOnReviewAlerts: formData.get("notifyOnReviewAlerts") === "on",
    notifyOnTourScheduled: formData.get("notifyOnTourScheduled") === "on",
    webhookUrl,
  });
  const enabledNotificationCount = [
    config.notifyOnApplicationInviteStale,
    config.notifyOnNewLead,
    config.notifyOnReviewAlerts,
    config.notifyOnTourScheduled,
  ].filter(Boolean).length;
  const authState = !webhookEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : config.webhookUrl && enabledNotificationCount > 0
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.CRM_WORKFLOW,
    config: serializeSlackIntegrationConfig(config),
    enabled: webhookEnabled,
    healthMessage:
      webhookEnabled && !config.webhookUrl
        ? "Slack incoming webhook URL is required."
        : webhookEnabled && enabledNotificationCount === 0
          ? "Select at least one Slack notification trigger."
          : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      webhookEnabled
        ? `Slack notifications armed for ${enabledNotificationCount} trigger${enabledNotificationCount === 1 ? "" : "s"}.`
        : "Slack notifications disabled.",
    payload: {
      channelLabel: config.channelLabel,
      enabledNotificationCount,
    },
    provider: IntegrationProvider.SLACK,
    summary: "Slack notification configuration updated.",
    syncStatus:
      !webhookEnabled
        ? IntegrationSyncStatus.IDLE
        : authState === IntegrationAuthState.ACTIVE
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_slack_integration_updated",
    payload: {
      channelLabel: config.channelLabel,
      notifyOnApplicationInviteStale: config.notifyOnApplicationInviteStale,
      notifyOnNewLead: config.notifyOnNewLead,
      notifyOnReviewAlerts: config.notifyOnReviewAlerts,
      notifyOnTourScheduled: config.notifyOnTourScheduled,
      webhookEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateSlackIntegrationAction(formData: FormData) {
  return handleUpdateSlackIntegrationAction(formData);
}

export async function handleUpdateS3IntegrationAction(
  formData: FormData,
  dependencies: UpdateS3IntegrationActionDependencies = defaultUpdateS3IntegrationActionDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const storageEnabled = formData.get("storageEnabled") === "on";
  const endpointUrl = parseOptionalQuietHoursText(formData.get("endpointUrl"));
  const region = parseOptionalQuietHoursText(formData.get("region"));
  const bucket = parseOptionalQuietHoursText(formData.get("bucket"));
  const basePath = parseOptionalQuietHoursText(formData.get("basePath"));
  const accessKeyIdHint = parseOptionalQuietHoursText(formData.get("accessKeyIdHint"));
  const secretAccessKeyHint = parseOptionalQuietHoursText(formData.get("secretAccessKeyHint"));
  const config = parseS3CompatibleIntegrationConfig({
    accessKeyIdHint,
    basePath,
    bucket,
    endpointUrl,
    region,
    secretAccessKeyHint,
  });
  const authState = !storageEnabled
    ? IntegrationAuthState.NOT_CONNECTED
    : config.bucket && config.endpointUrl
      ? IntegrationAuthState.ACTIVE
      : IntegrationAuthState.CONFIGURED;

  await dependencies.upsertWorkspaceIntegrationConnection({
    authState,
    category: IntegrationCategory.FILE_STORAGE,
    config: serializeS3CompatibleIntegrationConfig(config),
    enabled: storageEnabled,
    healthMessage:
      storageEnabled && !config.bucket
        ? "Bucket name is required."
        : storageEnabled && !config.endpointUrl
          ? "Endpoint URL is required."
          : null,
    lastAuthorizedAt: authState === IntegrationAuthState.ACTIVE ? new Date() : null,
    lastSyncAt: null,
    lastSyncMessage:
      storageEnabled
        ? `S3-compatible storage mapped to bucket ${config.bucket ?? "unassigned"}.`
        : "S3-compatible storage disabled.",
    payload: {
      basePath: config.basePath,
      bucket: config.bucket,
      endpointUrl: config.endpointUrl,
      region: config.region,
    },
    provider: IntegrationProvider.S3_COMPATIBLE,
    summary: "S3-compatible storage configuration updated.",
    syncStatus:
      !storageEnabled
        ? IntegrationSyncStatus.IDLE
        : authState === IntegrationAuthState.ACTIVE
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.PENDING,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_s3_integration_updated",
    payload: {
      basePath: config.basePath,
      bucket: config.bucket,
      endpointUrl: config.endpointUrl,
      region: config.region,
      storageEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/integrations";

  dependencies.redirect(redirectTarget);
}

export async function updateS3IntegrationAction(formData: FormData) {
  return handleUpdateS3IntegrationAction(formData);
}