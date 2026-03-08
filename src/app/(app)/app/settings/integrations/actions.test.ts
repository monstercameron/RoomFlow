import assert from "node:assert/strict";
import test from "node:test";

import {
  CalendarSyncProvider,
  IntegrationAuthState,
  IntegrationCategory,
  IntegrationProvider,
  IntegrationSyncStatus,
  LeadSourceType,
  MessageChannel,
  Prisma,
  ScreeningChargeMode,
  ScreeningConnectionAuthState,
  ScreeningProvider,
  TourSchedulingMode,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import type {
  UpdateCsvImportIntegrationActionDependencies,
  UpdateInboundWebhookIntegrationActionDependencies,
  UpdateListingFeedIntegrationActionDependencies,
  UpdateMessagingChannelIntegrationActionDependencies,
  UpdateOperatorSchedulingAvailabilityActionDependencies,
  UpdateMetaLeadAdsIntegrationActionDependencies,
  UpdateOutboundWebhookIntegrationActionDependencies,
  UpdateS3IntegrationActionDependencies,
  UpdateSlackIntegrationActionDependencies,
  UpdateWorkspaceCalendarConnectionActionDependencies,
  UpdateWorkspaceScreeningConnectionActionDependencies,
  UpdateWorkspaceTourSchedulingSettingsActionDependencies,
  UpdateWorkspaceMessagingThrottleSettingsActionDependencies,
  UpdateWorkspaceQuietHoursActionDependencies,
} from "./actions";

function getIntegrationsActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./actions") as typeof import("./actions");
}

function createWorkspaceMembership(
  overrides: Partial<{
    enabledCapabilities: WorkspaceCapability[];
    id: string;
    workspaceId: string;
  }> = {},
) {
  return {
    id: "membership-1",
    workspaceId: "workspace-1",
    workspace: {
      enabledCapabilities: [WorkspaceCapability.CALENDAR_SYNC],
    },
    ...overrides,
  };
}

function createWorkspaceState(
  overrides: Partial<{
    id: string;
    name: string | null;
  }> = {},
) {
  return {
    user: {
      id: "user-1",
      name: "Jordan Agent",
      ...overrides,
    },
  };
}

function createQuietHoursDependencies(
  overrides: Partial<UpdateWorkspaceQuietHoursActionDependencies> = {},
): UpdateWorkspaceQuietHoursActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateWorkspace: async () => undefined,
    validateQuietHoursConfig: (config) => ({
      ...config,
      startMinutes: 0,
      endMinutes: 1,
    }),
    ...overrides,
  };
}

function createMessagingThrottleDependencies(
  overrides: Partial<UpdateWorkspaceMessagingThrottleSettingsActionDependencies> = {},
): UpdateWorkspaceMessagingThrottleSettingsActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateWorkspace: async () => undefined,
    ...overrides,
  };
}

function createSchedulingAvailabilityDependencies(
  overrides: Partial<UpdateOperatorSchedulingAvailabilityActionDependencies> = {},
): UpdateOperatorSchedulingAvailabilityActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    serializeAvailabilityWindowConfig: () => Prisma.DbNull,
    updateMembership: async () => undefined,
    validateAvailabilityWindowConfig: (config) => ({
      ...config,
      days: [...config.days],
      timeZone: config.timeZone.trim(),
    }),
    ...overrides,
  };
}

function createTourSchedulingDependencies(
  overrides: Partial<UpdateWorkspaceTourSchedulingSettingsActionDependencies> = {},
): UpdateWorkspaceTourSchedulingSettingsActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership({
      enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
    }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    serializeTourReminderSequence: (sequence) => sequence,
    updateWorkspace: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createCalendarConnectionDependencies(
  overrides: Partial<UpdateWorkspaceCalendarConnectionActionDependencies> = {},
): UpdateWorkspaceCalendarConnectionActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    parseCalendarConnectionsConfig: () => ({
      [CalendarSyncProvider.GOOGLE]: {
        connectedAccount: "existing@example.com",
        errorMessage: null,
        status: "ACTIVE",
        syncEnabled: true,
      },
      [CalendarSyncProvider.OUTLOOK]: {
        connectedAccount: "",
        errorMessage: null,
        status: "DISCONNECTED",
        syncEnabled: false,
      },
    }),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateWorkspace: async () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createScreeningConnectionDependencies(
  overrides: Partial<UpdateWorkspaceScreeningConnectionActionDependencies> = {},
): UpdateWorkspaceScreeningConnectionActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership({
      enabledCapabilities: [WorkspaceCapability.SCREENING],
    }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertScreeningProviderConnection: async () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createInboundWebhookDependencies(
  overrides: Partial<UpdateInboundWebhookIntegrationActionDependencies> = {},
): UpdateInboundWebhookIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createCsvImportDependencies(
  overrides: Partial<UpdateCsvImportIntegrationActionDependencies> = {},
): UpdateCsvImportIntegrationActionDependencies {
  return {
    buildCsvImportPreview: async () => ({
      headerFields: [],
      invalidRowCount: 0,
      rows: [],
      sampleRowCount: 0,
      validRowCount: 0,
    }),
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createOutboundWebhookDependencies(
  overrides: Partial<UpdateOutboundWebhookIntegrationActionDependencies> = {},
): UpdateOutboundWebhookIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createMetaLeadAdsDependencies(
  overrides: Partial<UpdateMetaLeadAdsIntegrationActionDependencies> = {},
): UpdateMetaLeadAdsIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createMessagingChannelDependencies(
  overrides: Partial<UpdateMessagingChannelIntegrationActionDependencies> = {},
): UpdateMessagingChannelIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createListingFeedDependencies(
  overrides: Partial<UpdateListingFeedIntegrationActionDependencies> = {},
): UpdateListingFeedIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createSlackDependencies(
  overrides: Partial<UpdateSlackIntegrationActionDependencies> = {},
): UpdateSlackIntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

function createS3Dependencies(
  overrides: Partial<UpdateS3IntegrationActionDependencies> = {},
): UpdateS3IntegrationActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertWorkspaceIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

test("handleUpdateWorkspaceQuietHoursAction requires a complete quiet-hours configuration when enabled", async () => {
  const { handleUpdateWorkspaceQuietHoursAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("quietHoursEnabled", "on");
  formData.set("quietHoursStartLocal", "22:00");
  formData.set("quietHoursEndLocal", "06:00");

  await assert.rejects(
    handleUpdateWorkspaceQuietHoursAction(formData, createQuietHoursDependencies()),
    /Quiet hours start, end, and time zone are required when enabled/,
  );
});

test("handleUpdateWorkspaceQuietHoursAction validates, persists, audits, and redirects", async () => {
  const { handleUpdateWorkspaceQuietHoursAction } = getIntegrationsActionsModule();
  const validatedConfigs: unknown[] = [];
  const workspaceUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("quietHoursEnabled", "on");
  formData.set("quietHoursStartLocal", " 22:00 ");
  formData.set("quietHoursEndLocal", " 06:30 ");
  formData.set("quietHoursTimeZone", " America/Chicago ");
  formData.set("redirectTo", "/app/settings/integrations?tab=messaging");

  await handleUpdateWorkspaceQuietHoursAction(
    formData,
    createQuietHoursDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
      validateQuietHoursConfig: (input) => {
        validatedConfigs.push(input);
        return {
          ...input,
          startMinutes: 1320,
          endMinutes: 390,
        };
      },
    }),
  );

  assert.deepEqual(validatedConfigs, [
    {
      startLocal: "22:00",
      endLocal: "06:30",
      timeZone: "America/Chicago",
    },
  ]);
  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      quietHoursStartLocal: "22:00",
      quietHoursEndLocal: "06:30",
      quietHoursTimeZone: "America/Chicago",
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_quiet_hours_updated",
      payload: {
        quietHoursEnabled: true,
        quietHoursStartLocal: "22:00",
        quietHoursEndLocal: "06:30",
        quietHoursTimeZone: "America/Chicago",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings/integrations",
    "/app/properties",
    "/app/leads",
    "/app/inbox",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=messaging"]);
});

test("handleUpdateWorkspaceQuietHoursAction clears quiet hours when disabled", async () => {
  const { handleUpdateWorkspaceQuietHoursAction } = getIntegrationsActionsModule();
  const workspaceUpdates: unknown[] = [];
  const redirects: string[] = [];

  await handleUpdateWorkspaceQuietHoursAction(
    new FormData(),
    createQuietHoursDependencies({
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      quietHoursStartLocal: null,
      quietHoursEndLocal: null,
      quietHoursTimeZone: null,
    },
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations"]);
});

test("handleUpdateWorkspaceMessagingThrottleSettingsAction enforces positive integer inputs", async () => {
  const { handleUpdateWorkspaceMessagingThrottleSettingsAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("dailyAutomatedSendCap", "0");
  formData.set("missingInfoPromptThrottleMinutes", "15");

  await assert.rejects(
    handleUpdateWorkspaceMessagingThrottleSettingsAction(
      formData,
      createMessagingThrottleDependencies(),
    ),
    /Daily automated send cap must be a positive whole number/,
  );
});

test("handleUpdateWorkspaceMessagingThrottleSettingsAction persists settings, audits, and redirects", async () => {
  const { handleUpdateWorkspaceMessagingThrottleSettingsAction } = getIntegrationsActionsModule();
  const workspaceUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("dailyAutomatedSendCap", " 250 ");
  formData.set("missingInfoPromptThrottleMinutes", " 45 ");

  await handleUpdateWorkspaceMessagingThrottleSettingsAction(
    formData,
    createMessagingThrottleDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      dailyAutomatedSendCap: 250,
      missingInfoPromptThrottleMinutes: 45,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_messaging_throttle_settings_updated",
      payload: {
        dailyAutomatedSendCap: 250,
        missingInfoPromptThrottleMinutes: 45,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings/integrations",
    "/app/inbox",
    "/app/leads",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations"]);
});

test("handleUpdateOperatorSchedulingAvailabilityAction requires complete availability inputs when enabled", async () => {
  const { handleUpdateOperatorSchedulingAvailabilityAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("availabilityEnabled", "on");
  formData.set("availabilityStartLocal", "09:00");
  formData.set("availabilityDays", "MONDAY");

  await assert.rejects(
    handleUpdateOperatorSchedulingAvailabilityAction(
      formData,
      createSchedulingAvailabilityDependencies(),
    ),
    /Operator availability start, end, and time zone are required when availability is enabled/,
  );
});

test("handleUpdateOperatorSchedulingAvailabilityAction validates, serializes, persists, audits, and redirects", async () => {
  const { handleUpdateOperatorSchedulingAvailabilityAction } = getIntegrationsActionsModule();
  const validatedConfigs: unknown[] = [];
  const serializedConfigs: unknown[] = [];
  const membershipUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const serializedAvailability = {
    days: ["MONDAY", "WEDNESDAY"],
    endLocal: "17:00",
    startLocal: "09:00",
    timeZone: "America/New_York",
  };
  const formData = new FormData();
  formData.set("availabilityEnabled", "on");
  formData.set("availabilityStartLocal", " 09:00 ");
  formData.set("availabilityEndLocal", " 17:00 ");
  formData.set("availabilityTimeZone", " America/New_York ");
  formData.set("availabilityDays", "MONDAY");
  formData.append("availabilityDays", "WEDNESDAY");
  formData.set("redirectTo", "/app/settings/integrations?tab=scheduling");

  await handleUpdateOperatorSchedulingAvailabilityAction(
    formData,
    createSchedulingAvailabilityDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      serializeAvailabilityWindowConfig: (input) => {
        serializedConfigs.push(input);
        return serializedAvailability;
      },
      updateMembership: async (input) => {
        membershipUpdates.push(input);
      },
      validateAvailabilityWindowConfig: (input) => {
        validatedConfigs.push(input);
        return {
          ...input,
          days: [...input.days],
        };
      },
    }),
  );

  assert.deepEqual(validatedConfigs, [
    {
      days: ["MONDAY", "WEDNESDAY"],
      endLocal: "17:00",
      startLocal: "09:00",
      timeZone: "America/New_York",
    },
  ]);
  assert.deepEqual(serializedConfigs, [
    {
      days: ["MONDAY", "WEDNESDAY"],
      endLocal: "17:00",
      startLocal: "09:00",
      timeZone: "America/New_York",
    },
  ]);
  assert.deepEqual(membershipUpdates, [
    {
      membershipId: "membership-1",
      schedulingAvailability: serializedAvailability,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "operator_scheduling_availability_updated",
      payload: {
        availabilityEnabled: true,
        membershipId: "membership-1",
        schedulingAvailability: {
          days: ["MONDAY", "WEDNESDAY"],
          endLocal: "17:00",
          startLocal: "09:00",
          timeZone: "America/New_York",
        },
        userName: "Jordan Agent",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/calendar",
    "/app/leads",
    "/app/settings/integrations",
    "/app/settings/members",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=scheduling"]);
});

test("handleUpdateOperatorSchedulingAvailabilityAction clears availability when disabled", async () => {
  const { handleUpdateOperatorSchedulingAvailabilityAction } = getIntegrationsActionsModule();
  const membershipUpdates: Array<{
    membershipId: string;
    schedulingAvailability: unknown;
  }> = [];

  await handleUpdateOperatorSchedulingAvailabilityAction(
    new FormData(),
    createSchedulingAvailabilityDependencies({
      updateMembership: async (input) => {
        membershipUpdates.push(input);
      },
    }),
  );

  assert.equal(membershipUpdates.length, 1);
  assert.equal(membershipUpdates[0]?.membershipId, "membership-1");
  assert.equal(membershipUpdates[0]?.schedulingAvailability, Prisma.DbNull);
});

test("handleUpdateWorkspaceTourSchedulingSettingsAction requires Org teammate controls for shared scheduling", async () => {
  const { handleUpdateWorkspaceTourSchedulingSettingsAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("tourSchedulingMode", TourSchedulingMode.ROUND_ROBIN);

  await assert.rejects(
    handleUpdateWorkspaceTourSchedulingSettingsAction(
      formData,
      createTourSchedulingDependencies({
        getCurrentWorkspaceMembership: async () => createWorkspaceMembership({
          enabledCapabilities: [],
        }),
        workspaceHasCapability: () => false,
      }),
    ),
    /Org teammate controls are required for shared tour scheduling/,
  );
});

test("handleUpdateWorkspaceTourSchedulingSettingsAction persists reminder settings, audits, and redirects", async () => {
  const { handleUpdateWorkspaceTourSchedulingSettingsAction } = getIntegrationsActionsModule();
  const serializedSequences: unknown[] = [];
  const workspaceUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const serializedReminderSequence = [
    {
      id: "first_reminder",
      label: "90 minutes before",
      minutesBefore: 90,
    },
    {
      id: "second_reminder",
      label: "30 minutes before",
      minutesBefore: 30,
    },
  ];
  const formData = new FormData();
  formData.set("tourSchedulingMode", TourSchedulingMode.ROUND_ROBIN);
  formData.set("firstReminderMinutes", "90");
  formData.set("secondReminderMinutes", "30");
  formData.set("redirectTo", "/app/settings/integrations?tab=tours");

  await handleUpdateWorkspaceTourSchedulingSettingsAction(
    formData,
    createTourSchedulingDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      serializeTourReminderSequence: (sequence) => {
        serializedSequences.push(sequence);
        return serializedReminderSequence;
      },
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(serializedSequences, [
    [
      {
        id: "first_reminder",
        label: "90 minutes before",
        minutesBefore: 90,
      },
      {
        id: "second_reminder",
        label: "30 minutes before",
        minutesBefore: 30,
      },
    ],
  ]);
  assert.deepEqual(workspaceUpdates, [
    {
      workspaceId: "workspace-1",
      tourReminderSequence: serializedReminderSequence,
      tourSchedulingMode: TourSchedulingMode.ROUND_ROBIN,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_tour_scheduling_updated",
      payload: {
        reminderSequence: [
          {
            id: "first_reminder",
            label: "90 minutes before",
            minutesBefore: 90,
          },
          {
            id: "second_reminder",
            label: "30 minutes before",
            minutesBefore: 30,
          },
        ],
        tourSchedulingMode: TourSchedulingMode.ROUND_ROBIN,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/calendar",
    "/app/leads",
    "/app/settings/integrations",
    "/app/settings/members",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=tours"]);
});

test("handleUpdateWorkspaceCalendarConnectionAction requires a connected account when sync is active", async () => {
  const { handleUpdateWorkspaceCalendarConnectionAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("provider", CalendarSyncProvider.GOOGLE);
  formData.set("status", "ACTIVE");
  formData.set("syncEnabled", "on");

  await assert.rejects(
    handleUpdateWorkspaceCalendarConnectionAction(
      formData,
      createCalendarConnectionDependencies(),
    ),
    /A connected account is required when calendar sync is enabled/,
  );
});

test("handleUpdateWorkspaceCalendarConnectionAction persists merged connections, audits, and upserts integration state", async () => {
  const { handleUpdateWorkspaceCalendarConnectionAction } = getIntegrationsActionsModule();
  const workspaceUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("provider", CalendarSyncProvider.OUTLOOK);
  formData.set("connectedAccount", " calendar@example.com ");
  formData.set("status", "ACTIVE");
  formData.set("syncEnabled", "on");
  formData.set("errorMessage", " Token refreshed ");
  formData.set("redirectTo", "/app/settings/integrations?tab=calendar");

  await handleUpdateWorkspaceCalendarConnectionAction(
    formData,
    createCalendarConnectionDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(workspaceUpdates.length, 1);
  assert.equal((workspaceUpdates[0] as { workspaceId: string }).workspaceId, "workspace-1");
  assert.deepEqual(
    (workspaceUpdates[0] as { calendarConnections: Record<string, unknown> }).calendarConnections,
    {
      GOOGLE: {
        connectedAccount: "existing@example.com",
        errorMessage: null,
        status: "ACTIVE",
        syncEnabled: true,
      },
      OUTLOOK: {
        connectedAccount: "calendar@example.com",
        errorMessage: "Token refreshed",
        status: "ACTIVE",
        syncEnabled: true,
      },
    },
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_calendar_connection_updated",
      payload: {
        connectedAccount: "calendar@example.com",
        errorMessage: "Token refreshed",
        provider: CalendarSyncProvider.OUTLOOK,
        status: "ACTIVE",
        syncEnabled: true,
      },
    },
  ]);
  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.OUTLOOK_CALENDAR,
  );
  assert.equal(
    (integrationUpserts[0] as { category: IntegrationCategory }).category,
    IntegrationCategory.CALENDAR,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(revalidatedPaths, [
    "/app/calendar",
    "/app/properties",
    "/app/settings/integrations",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=calendar"]);
});

test("handleUpdateWorkspaceScreeningConnectionAction requires the screening capability", async () => {
  const { handleUpdateWorkspaceScreeningConnectionAction } = getIntegrationsActionsModule();
  const formData = new FormData();
  formData.set("provider", ScreeningProvider.CHECKR);
  formData.set("authState", ScreeningConnectionAuthState.ACTIVE);
  formData.set("chargeMode", ScreeningChargeMode.APPLICANT_PAY);

  await assert.rejects(
    handleUpdateWorkspaceScreeningConnectionAction(
      formData,
      createScreeningConnectionDependencies({
        getCurrentWorkspaceMembership: async () => createWorkspaceMembership({
          enabledCapabilities: [],
        }),
        workspaceHasCapability: () => false,
      }),
    ),
    /Screening connections require the screening capability/,
  );
});

test("handleUpdateWorkspaceScreeningConnectionAction persists screening state, audits, and mirrors the integration record", async () => {
  const { handleUpdateWorkspaceScreeningConnectionAction } = getIntegrationsActionsModule();
  const connectionUpserts: unknown[] = [];
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("provider", ScreeningProvider.CHECKR);
  formData.set("authState", ScreeningConnectionAuthState.ACTIVE);
  formData.set("chargeMode", ScreeningChargeMode.APPLICANT_PAY);
  formData.set("connectedAccount", " checkr-account ");
  formData.set("defaultPackageKey", " basic ");
  formData.set("defaultPackageLabel", " Basic Package ");
  formData.set("secondaryPackageKey", " premium ");
  formData.set("secondaryPackageLabel", " Premium Package ");
  formData.set("disclosureStrategy", " embedded ");
  formData.set("lastError", " Needs reconnect ");
  formData.set("redirectTo", "/app/settings/integrations?tab=screening");

  await handleUpdateWorkspaceScreeningConnectionAction(
    formData,
    createScreeningConnectionDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertScreeningProviderConnection: async (input) => {
        connectionUpserts.push(input);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(connectionUpserts.length, 1);
  assert.equal(
    (connectionUpserts[0] as { provider: ScreeningProvider }).provider,
    ScreeningProvider.CHECKR,
  );
  assert.equal(
    (connectionUpserts[0] as { authState: ScreeningConnectionAuthState }).authState,
    ScreeningConnectionAuthState.ACTIVE,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_screening_connection_updated",
      payload: {
        authState: ScreeningConnectionAuthState.ACTIVE,
        chargeMode: ScreeningChargeMode.APPLICANT_PAY,
        connectedAccount: "checkr-account",
        defaultPackageKey: "basic",
        defaultPackageLabel: "Basic Package",
        disclosureStrategy: "embedded",
        provider: ScreeningProvider.CHECKR,
      },
    },
  ]);
  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.CHECKR,
  );
  assert.equal(
    (integrationUpserts[0] as { category: IntegrationCategory }).category,
    IntegrationCategory.SCREENING,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(revalidatedPaths, ["/app/leads", "/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=screening"]);
});

test("handleUpdateInboundWebhookIntegrationAction persists pending webhook config without a signing secret hint", async () => {
  const { handleUpdateInboundWebhookIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("webhookEnabled", "on");
  formData.set("sourceLabel", " Leasing webhook ");
  formData.set("defaultLeadSourceId", "source-1");
  formData.set("defaultLeadSourceType", LeadSourceType.WEB_FORM);
  formData.set("defaultMessageChannel", MessageChannel.EMAIL);
  formData.set("fieldMapping1Source", " email ");
  formData.set("fieldMapping1Target", "email");
  formData.set("fieldMapping1Required", "on");
  formData.set("redirectTo", "/app/settings/integrations?tab=inbound");

  await handleUpdateInboundWebhookIntegrationAction(
    formData,
    createInboundWebhookDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.GENERIC_INBOUND_WEBHOOK,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.CONFIGURED,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.PENDING,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_inbound_webhook_integration_updated",
      payload: {
        defaultLeadSourceId: "source-1",
        defaultLeadSourceType: LeadSourceType.WEB_FORM,
        defaultMessageChannel: MessageChannel.EMAIL,
        fieldMappings: [
          {
            required: true,
            sourceField: "email",
            targetField: "email",
          },
        ],
        signingHeader: "x-roomflow-signature",
        sourceLabel: "Leasing webhook",
        webhookEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings/integrations",
    "/app/leads",
    "/app/inbox",
  ]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=inbound"]);
});

test("handleUpdateCsvImportIntegrationAction builds preview state, audits counts, and stores an active import config", async () => {
  const { handleUpdateCsvImportIntegrationAction } = getIntegrationsActionsModule();
  const previewCalls: unknown[] = [];
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const preview = {
    headerFields: ["name", "email"],
    invalidRowCount: 0,
    rows: [],
    sampleRowCount: 2,
    validRowCount: 2,
  };
  const formData = new FormData();
  formData.set("importEnabled", "on");
  formData.set("sourceLabel", " CSV feed ");
  formData.set("defaultLeadSourceId", "source-2");
  formData.set("sampleCsv", "name,email\nTaylor,taylor@example.com");
  formData.set("fieldMapping1Source", " name ");
  formData.set("fieldMapping1Target", "fullName");
  formData.set("fieldMapping2Source", " email ");
  formData.set("fieldMapping2Target", "email");
  formData.set("redirectTo", "/app/settings/integrations?tab=csv");

  await handleUpdateCsvImportIntegrationAction(
    formData,
    createCsvImportDependencies({
      buildCsvImportPreview: async (input) => {
        previewCalls.push(input);
        return preview;
      },
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.deepEqual(previewCalls, [
    {
      csvText: "name,email\nTaylor,taylor@example.com",
      defaultSourceName: "CSV feed",
      fieldMappings: [
        {
          required: false,
          sourceField: "name",
          targetField: "fullName",
        },
        {
          required: false,
          sourceField: "email",
          targetField: "email",
        },
      ],
      workspaceId: "workspace-1",
    },
  ]);
  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.CSV_IMPORT,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_csv_import_integration_updated",
      payload: {
        defaultLeadSourceId: "source-2",
        fieldMappings: [
          {
            required: false,
            sourceField: "name",
            targetField: "fullName",
          },
          {
            required: false,
            sourceField: "email",
            targetField: "email",
          },
        ],
        importEnabled: true,
        previewInvalidRowCount: 0,
        previewValidRowCount: 2,
        sourceLabel: "CSV feed",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations", "/app/leads"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=csv"]);
});

test("handleUpdateOutboundWebhookIntegrationAction stores active destinations and subscribed event types", async () => {
  const { handleUpdateOutboundWebhookIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("automationEnabled", "on");
  formData.set("secretHint", " outbound-secret ");
  formData.set("destination1Enabled", "on");
  formData.set("destination1Label", " CRM sink ");
  formData.set("destination1Url", " https://example.test/webhooks/roomflow ");
  formData.set("eventType:lead.created", "lead.created");
  formData.set("eventType:tour.scheduled", "tour.scheduled");
  formData.set("redirectTo", "/app/settings/integrations?tab=outbound");

  await handleUpdateOutboundWebhookIntegrationAction(
    formData,
    createOutboundWebhookDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.OUTBOUND_WEBHOOK,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_outbound_webhook_integration_updated",
      payload: {
        automationEnabled: true,
        destinations: [
          {
            enabled: true,
            label: "CRM sink",
            url: "https://example.test/webhooks/roomflow",
          },
        ],
        eventTypes: ["lead.created", "tour.scheduled"],
        secretHint: "outbound-secret",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=outbound"]);
});

test("handleUpdateMetaLeadAdsIntegrationAction stores an active Meta webhook configuration", async () => {
  const { handleUpdateMetaLeadAdsIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("webhookEnabled", "on");
  formData.set("sourceLabel", " Meta Ads ");
  formData.set("defaultLeadSourceId", "source-meta");
  formData.set("pageId", " page-123 ");
  formData.set("formId", " form-999 ");
  formData.set("verifyToken", " verify-me ");
  formData.set("campaignTag", " spring-campaign ");
  formData.set("fieldMapping1Source", "email");
  formData.set("fieldMapping1Target", "email");
  formData.set("redirectTo", "/app/settings/integrations?tab=meta");

  await handleUpdateMetaLeadAdsIntegrationAction(
    formData,
    createMetaLeadAdsDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.META_LEAD_ADS,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_meta_lead_ads_integration_updated",
      payload: {
        campaignTag: "spring-campaign",
        defaultLeadSourceId: "source-meta",
        fieldMappings: [
          {
            required: false,
            sourceField: "email",
            targetField: "email",
          },
        ],
        formId: "form-999",
        pageId: "page-123",
        sourceLabel: "Meta Ads",
        webhookEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=meta"]);
});

test("handleUpdateMessagingChannelIntegrationAction stores an active messaging integration and audits the provider-specific event", async () => {
  const { handleUpdateMessagingChannelIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("provider", IntegrationProvider.WHATSAPP);
  formData.set("webhookEnabled", "on");
  formData.set("accountLabel", " Leasing bot ");
  formData.set("senderIdentifier", " +15551234567 ");
  formData.set("defaultLeadSourceId", "source-wa");
  formData.set("verifyToken", " verify-wa ");
  formData.set("allowInboundSync", "on");
  formData.set("allowOutboundSend", "on");
  formData.set("redirectTo", "/app/settings/integrations?tab=whatsapp");

  await handleUpdateMessagingChannelIntegrationAction(
    formData,
    createMessagingChannelDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.WHATSAPP,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_whatsapp_integration_updated",
      payload: {
        accountLabel: "Leasing bot",
        allowInboundSync: true,
        allowOutboundSend: true,
        senderIdentifier: "+15551234567",
        webhookEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=whatsapp"]);
});

test("handleUpdateListingFeedIntegrationAction stores an active listing feed configuration and audits it", async () => {
  const { handleUpdateListingFeedIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("provider", IntegrationProvider.ZILLOW);
  formData.set("feedEnabled", "on");
  formData.set("feedLabel", " Zillow Feed ");
  formData.set("destinationName", " Zillow Export ");
  formData.set("destinationPath", " /exports/zillow.xml ");
  formData.set("includeOnlyActiveProperties", "on");
  formData.set("redirectTo", "/app/settings/integrations?tab=feeds");

  await handleUpdateListingFeedIntegrationAction(
    formData,
    createListingFeedDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.ZILLOW,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_zillow_feed_updated",
      payload: {
        destinationName: "Zillow Export",
        destinationPath: null,
        feedEnabled: true,
        feedLabel: "Zillow Feed",
        includeOnlyActiveProperties: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations", "/app/properties"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=feeds"]);
});

test("handleUpdateSlackIntegrationAction stores active Slack notification settings and audits enabled triggers", async () => {
  const { handleUpdateSlackIntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("webhookEnabled", "on");
  formData.set("webhookUrl", " https://hooks.slack.test/services/AAA/BBB/CCC ");
  formData.set("channelLabel", " Leasing Ops ");
  formData.set("notifyOnNewLead", "on");
  formData.set("notifyOnTourScheduled", "on");
  formData.set("redirectTo", "/app/settings/integrations?tab=slack");

  await handleUpdateSlackIntegrationAction(
    formData,
    createSlackDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.SLACK,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_slack_integration_updated",
      payload: {
        channelLabel: "Leasing Ops",
        notifyOnApplicationInviteStale: false,
        notifyOnNewLead: true,
        notifyOnReviewAlerts: false,
        notifyOnTourScheduled: true,
        webhookEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=slack"]);
});

test("handleUpdateS3IntegrationAction stores active storage settings and audits the storage payload", async () => {
  const { handleUpdateS3IntegrationAction } = getIntegrationsActionsModule();
  const auditEvents: unknown[] = [];
  const integrationUpserts: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("storageEnabled", "on");
  formData.set("endpointUrl", " https://s3.example.test ");
  formData.set("region", " us-east-1 ");
  formData.set("bucket", " roomflow-assets ");
  formData.set("basePath", " archive/ ");
  formData.set("accessKeyIdHint", " AKIA... ");
  formData.set("secretAccessKeyHint", " secret... ");
  formData.set("redirectTo", "/app/settings/integrations?tab=storage");

  await handleUpdateS3IntegrationAction(
    formData,
    createS3Dependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertWorkspaceIntegrationConnection: async (input) => {
        integrationUpserts.push(input);
      },
    }),
  );

  assert.equal(integrationUpserts.length, 1);
  assert.equal(
    (integrationUpserts[0] as { provider: IntegrationProvider }).provider,
    IntegrationProvider.S3_COMPATIBLE,
  );
  assert.equal(
    (integrationUpserts[0] as { authState: IntegrationAuthState }).authState,
    IntegrationAuthState.ACTIVE,
  );
  assert.equal(
    (integrationUpserts[0] as { syncStatus: IntegrationSyncStatus }).syncStatus,
    IntegrationSyncStatus.SUCCESS,
  );
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_s3_integration_updated",
      payload: {
        basePath: "archive",
        bucket: "roomflow-assets",
        endpointUrl: "https://s3.example.test/",
        region: "us-east-1",
        storageEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/app/settings/integrations"]);
  assert.deepEqual(redirects, ["/app/settings/integrations?tab=storage"]);
});
