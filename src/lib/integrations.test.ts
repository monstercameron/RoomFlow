import assert from "node:assert/strict";
import test from "node:test";
import {
  IntegrationAuthState,
  IntegrationHealthState,
  IntegrationProvider,
  IntegrationSyncStatus,
  LeadSourceType,
  MessageChannel,
} from "@/generated/prisma/client";
import {
  buildListingFeedPayload,
  buildStorageManifestPreview,
  buildCsvDocument,
  buildCsvExportFileName,
  buildCsvImportPreview,
  extractAuditEventChannel,
  extractAuditEventReason,
  formatIntegrationConnectionSummary,
  formatCsvExportTimestamp,
  parseListingFeedIntegrationConfig,
  parseMetaLeadAdsIntegrationConfig,
  parseMessagingChannelIntegrationConfig,
  parseOutboundWebhookIntegrationConfig,
  parseS3CompatibleIntegrationConfig,
  parseSlackIntegrationConfig,
  parseCsvText,
  parseInboundWebhookIntegrationConfig,
  parseIntegrationFieldMappings,
  resolveOutboundWebhookDestinationsForEvent,
  resolveIntegrationHealthState,
  resolveIntegrationSetupState,
  serializeInboundWebhookIntegrationConfig,
  serializeListingFeedIntegrationConfig,
  serializeMetaLeadAdsIntegrationConfig,
  serializeMessagingChannelIntegrationConfig,
  serializeOutboundWebhookIntegrationConfig,
  serializeS3CompatibleIntegrationConfig,
  serializeSlackIntegrationConfig,
  serializeAuditEventPayloadSummary,
} from "./integrations";

test("parseIntegrationFieldMappings ignores malformed entries", () => {
  const mappings = parseIntegrationFieldMappings([
    { required: true, sourceField: "email", targetField: "email" },
    { sourceField: "", targetField: "phone" },
    null,
  ]);

  assert.deepEqual(mappings, [
    { required: true, sourceField: "email", targetField: "email" },
  ]);
});

test("parseInboundWebhookIntegrationConfig falls back to webhook defaults", () => {
  const config = parseInboundWebhookIntegrationConfig({
    defaultLeadSourceType: LeadSourceType.CSV_IMPORT,
    fieldMappings: [{ required: false, sourceField: "full_name", targetField: "fullName" }],
    signingHeader: "x-provider-signature",
    sourceLabel: "Meta backup relay",
  });

  assert.deepEqual(config, {
    defaultLeadSourceId: null,
    defaultLeadSourceType: LeadSourceType.CSV_IMPORT,
    defaultMessageChannel: MessageChannel.EMAIL,
    fieldMappings: [
      { required: false, sourceField: "full_name", targetField: "fullName" },
    ],
    payloadFormat: "json",
    secretHint: null,
    signingHeader: "x-provider-signature",
    sourceLabel: "Meta backup relay",
  });

  assert.deepEqual(
    serializeInboundWebhookIntegrationConfig(config),
    {
      defaultLeadSourceId: null,
      defaultLeadSourceType: LeadSourceType.CSV_IMPORT,
      defaultMessageChannel: MessageChannel.EMAIL,
      fieldMappings: [
        { required: false, sourceField: "full_name", targetField: "fullName" },
      ],
      payloadFormat: "json",
      secretHint: null,
      signingHeader: "x-provider-signature",
      sourceLabel: "Meta backup relay",
    },
  );
});

test("resolveIntegrationHealthState marks active healthy connections", () => {
  assert.equal(
    resolveIntegrationHealthState({
      authState: IntegrationAuthState.ACTIVE,
      enabled: true,
      healthMessage: null,
      syncStatus: IntegrationSyncStatus.SUCCESS,
    }),
    IntegrationHealthState.HEALTHY,
  );
});

test("integration summary and setup state reflect incomplete webhook setup", () => {
  assert.equal(
    formatIntegrationConnectionSummary({
      authState: IntegrationAuthState.CONFIGURED,
      enabled: true,
      healthMessage: null,
      lastSyncMessage: null,
      syncStatus: IntegrationSyncStatus.IDLE,
    }),
    "Configured",
  );

  assert.deepEqual(
    resolveIntegrationSetupState({
      authState: IntegrationAuthState.ACTIVE,
      enabled: true,
      hasMappingConfig: false,
      healthState: IntegrationHealthState.DEGRADED,
      provider: IntegrationProvider.GENERIC_INBOUND_WEBHOOK,
    }),
    {
      currentStep: 3,
      label: "Mapping",
      totalSteps: 5,
    },
  );
});

test("parseCsvText handles quoted fields and multiple rows", () => {
  assert.deepEqual(parseCsvText('full_name,email,notes\n"Avery Mason",avery@example.com,"Needs parking, near transit"'), [
    ["full_name", "email", "notes"],
    ["Avery Mason", "avery@example.com", "Needs parking, near transit"],
  ]);
});

test("buildCsvImportPreview validates mapped rows through normalization", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const preview = await buildCsvImportPreview({
    csvText: [
      "full_name,email,phone,notes",
      "Avery Mason,avery@example.com,5551112222,Qualified lead",
      ",missing-name@example.com,5559990000,Bad row",
    ].join("\n"),
    defaultSourceName: "CSV import",
    fieldMappings: [
      { required: true, sourceField: "full_name", targetField: "fullName" },
      { required: false, sourceField: "email", targetField: "email" },
      { required: false, sourceField: "phone", targetField: "phone" },
      { required: false, sourceField: "notes", targetField: "notes" },
    ],
    workspaceId: "workspace_123",
  });

  process.env.DATABASE_URL = previousDatabaseUrl;

  assert.equal(preview.headerFields[0], "full_name");
  assert.equal(preview.validRowCount, 1);
  assert.equal(preview.invalidRowCount, 1);
  assert.equal(preview.rows[0]?.status, "valid");
  assert.equal(preview.rows[1]?.status, "invalid");
});

test("buildCsvDocument escapes quotes, commas, and newlines", () => {
  assert.equal(
    buildCsvDocument({
      headers: ["name", "notes"],
      rows: [["Avery \"Ace\" Mason", "Needs parking, near transit\nPrefers email"]],
    }),
    [
      "name,notes",
      '"Avery ""Ace"" Mason","Needs parking, near transit\nPrefers email"',
    ].join("\n"),
  );
});

test("CSV export helpers generate stable filenames and payload summaries", () => {
  assert.equal(
    buildCsvExportFileName({
      dataset: "activity",
      now: new Date("2026-03-08T14:22:33.456Z"),
      workspaceSlug: "Shared Housing Ops",
    }),
    "shared-housing-ops-activity-2026-03-08T14-22-33-456Z.csv",
  );
  assert.equal(formatCsvExportTimestamp(new Date("2026-03-08T14:22:33.456Z")), "2026-03-08T14:22:33.456Z");
  assert.equal(extractAuditEventReason({ reason: "Lead requested email only" }), "Lead requested email only");
  assert.equal(extractAuditEventChannel({ channel: "SMS" }), "SMS");
  assert.equal(serializeAuditEventPayloadSummary({ channel: "SMS", reason: "Lead requested email only" }), '{"channel":"SMS","reason":"Lead requested email only"}');
});

test("parseOutboundWebhookIntegrationConfig keeps valid destinations and events", () => {
  const config = parseOutboundWebhookIntegrationConfig({
    destinations: [
      { enabled: true, label: "Zapier", url: "https://hooks.zapier.com/hooks/catch/123" },
      { enabled: false, label: "Bad", url: "ftp://invalid.example.com" },
    ],
    eventTypes: ["lead.created", "application.sent", "unknown.event"],
    secretHint: "Stored in 1Password",
  });

  assert.deepEqual(config, {
    destinations: [
      {
        enabled: true,
        label: "Zapier",
        url: "https://hooks.zapier.com/hooks/catch/123",
      },
    ],
    eventTypes: ["lead.created", "application.sent"],
    secretHint: "Stored in 1Password",
  });

  assert.deepEqual(serializeOutboundWebhookIntegrationConfig(config), {
    destinations: [
      {
        enabled: true,
        label: "Zapier",
        url: "https://hooks.zapier.com/hooks/catch/123",
      },
    ],
    eventTypes: ["lead.created", "application.sent"],
    secretHint: "Stored in 1Password",
  });
});

test("resolveOutboundWebhookDestinationsForEvent filters by configured subscriptions", () => {
  const destinations = resolveOutboundWebhookDestinationsForEvent({
    config: {
      destinations: [
        { enabled: true, label: "Zapier", url: "https://hooks.zapier.com/hooks/catch/123" },
        { enabled: false, label: "Make", url: "https://hook.us1.make.com/abc" },
      ],
      eventTypes: ["lead.created"],
      secretHint: null,
    },
    eventType: "lead.created",
  });

  assert.deepEqual(destinations, [
    { enabled: true, label: "Zapier", url: "https://hooks.zapier.com/hooks/catch/123" },
  ]);
  assert.deepEqual(
    resolveOutboundWebhookDestinationsForEvent({
      config: {
        destinations,
        eventTypes: ["lead.created"],
        secretHint: null,
      },
      eventType: "screening.requested",
    }),
    [],
  );
});

test("remaining integration config parsers normalize structured payloads", () => {
  assert.deepEqual(
    parseMetaLeadAdsIntegrationConfig({
      pageId: "123",
      formId: "456",
      sourceLabel: "Meta move-in campaign",
      verifyToken: "token",
      appSecret: "secret",
      fieldMappings: [{ required: true, sourceField: "full_name", targetField: "fullName" }],
    }),
    {
      appSecret: "secret",
      campaignTag: null,
      defaultLeadSourceId: null,
      fieldMappings: [{ required: true, sourceField: "full_name", targetField: "fullName" }],
      formId: "456",
      pageId: "123",
      sourceLabel: "Meta move-in campaign",
      verifyToken: "token",
    },
  );
  assert.deepEqual(
    parseMessagingChannelIntegrationConfig({
      accountLabel: "Meta inbox",
      allowInboundSync: true,
      allowOutboundSend: false,
      senderIdentifier: "ig_123",
    }),
    {
      accountLabel: "Meta inbox",
      allowInboundSync: true,
      allowOutboundSend: false,
      defaultLeadSourceId: null,
      senderIdentifier: "ig_123",
      verifyToken: null,
    },
  );
  assert.deepEqual(
    parseListingFeedIntegrationConfig({
      feedLabel: "Zillow syndication",
      destinationPath: "https://partner.example.com/feed",
      includeOnlyActiveProperties: false,
    }),
    {
      destinationName: null,
      destinationPath: "https://partner.example.com/feed",
      feedLabel: "Zillow syndication",
      format: "json",
      includeOnlyActiveProperties: false,
    },
  );
  assert.deepEqual(
    parseSlackIntegrationConfig({
      webhookUrl: "https://hooks.slack.com/services/a/b/c",
      notifyOnNewLead: true,
    }),
    {
      channelLabel: null,
      notifyOnApplicationInviteStale: false,
      notifyOnNewLead: true,
      notifyOnReviewAlerts: false,
      notifyOnTourScheduled: false,
      webhookUrl: "https://hooks.slack.com/services/a/b/c",
    },
  );
  assert.deepEqual(
    parseS3CompatibleIntegrationConfig({
      endpointUrl: "https://s3.us-east-1.amazonaws.com",
      bucket: "roomflow-assets",
      basePath: "/exports/",
    }),
    {
      accessKeyIdHint: null,
      basePath: "exports",
      bucket: "roomflow-assets",
      endpointUrl: "https://s3.us-east-1.amazonaws.com/",
      region: null,
      secretAccessKeyHint: null,
    },
  );
  assert.deepEqual(
    serializeMetaLeadAdsIntegrationConfig(parseMetaLeadAdsIntegrationConfig({ pageId: "123" })),
    {
      appSecret: null,
      campaignTag: null,
      defaultLeadSourceId: null,
      fieldMappings: [],
      formId: null,
      pageId: "123",
      sourceLabel: "Meta Lead Ads",
      verifyToken: null,
    },
  );
  assert.deepEqual(
    serializeMessagingChannelIntegrationConfig(parseMessagingChannelIntegrationConfig({ accountLabel: "WhatsApp" })),
    {
      accountLabel: "WhatsApp",
      allowInboundSync: false,
      allowOutboundSend: false,
      defaultLeadSourceId: null,
      senderIdentifier: null,
      verifyToken: null,
    },
  );
  assert.deepEqual(
    serializeListingFeedIntegrationConfig(parseListingFeedIntegrationConfig({ feedLabel: "Feed" })),
    {
      destinationName: null,
      destinationPath: null,
      feedLabel: "Feed",
      format: "json",
      includeOnlyActiveProperties: true,
    },
  );
  assert.deepEqual(
    serializeSlackIntegrationConfig(parseSlackIntegrationConfig({ webhookUrl: "https://hooks.slack.com/services/a/b/c" })),
    {
      channelLabel: null,
      notifyOnApplicationInviteStale: false,
      notifyOnNewLead: false,
      notifyOnReviewAlerts: false,
      notifyOnTourScheduled: false,
      webhookUrl: "https://hooks.slack.com/services/a/b/c",
    },
  );
  assert.deepEqual(
    serializeS3CompatibleIntegrationConfig(parseS3CompatibleIntegrationConfig({ bucket: "roomflow-assets" })),
    {
      accessKeyIdHint: null,
      basePath: "roomflow",
      bucket: "roomflow-assets",
      endpointUrl: null,
      region: null,
      secretAccessKeyHint: null,
    },
  );
});

test("feed and storage helpers build stable provider payloads", () => {
  assert.deepEqual(
    buildListingFeedPayload({
      feedLabel: "Zillow syndication",
      generatedAt: new Date("2026-03-08T14:22:33.456Z"),
      properties: [
        {
          addressLine1: "123 Maple St",
          id: "prop_123",
          lifecycleStatus: "ACTIVE",
          listingSourceExternalId: "listing_1",
          listingSourceUrl: "https://example.com/listing/1",
          locality: "Seattle",
          name: "Maple House",
          parkingAvailable: true,
          petsAllowed: false,
          rentableRoomCount: 4,
          schedulingUrl: "https://example.com/tour",
          sharedBathroomCount: 2,
          smokingAllowed: false,
          updatedAt: new Date("2026-03-08T10:00:00.000Z"),
        },
      ],
      providerLabel: "Zillow",
      workspaceName: "Shared Housing Ops",
      workspaceSlug: "shared-housing-ops",
    }).provider,
    "Zillow",
  );
  assert.deepEqual(buildStorageManifestPreview({ basePath: "exports", workspaceSlug: "Shared Housing Ops" }), [
    "exports/shared-housing-ops/attachments/prospect-document.pdf",
    "exports/shared-housing-ops/exports/leads-2026-03-08T00-00-00-000Z.csv",
  ]);
});