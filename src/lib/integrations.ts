import { Prisma } from "@/generated/prisma/client";
import {
  IntegrationAuthState,
  IntegrationCategory,
  IntegrationHealthState,
  IntegrationProvider,
  IntegrationSyncStatus,
  LeadSourceType,
  MessageChannel,
} from "@/generated/prisma/client";

export const integrationCatalog = [
  {
    category: IntegrationCategory.MESSAGING,
    description: "Outbound transactional email foundation for auth, invites, and operator messaging.",
    label: "Outbound email",
    provider: IntegrationProvider.RESEND,
    setupSteps: [
      "Explanation",
      "Credentials",
      "Mapping",
      "Test event",
      "Completion",
    ],
  },
  {
    category: IntegrationCategory.MESSAGING,
    description: "SMS delivery, replies, and lead threading.",
    label: "Twilio SMS",
    provider: IntegrationProvider.TWILIO,
    setupSteps: ["Explanation", "Credentials", "Test send", "Completion"],
  },
  {
    category: IntegrationCategory.CALENDAR,
    description: "Tour scheduling sync with Google Calendar.",
    label: "Google Calendar",
    provider: IntegrationProvider.GOOGLE_CALENDAR,
    setupSteps: ["Explanation", "Credentials", "Calendar mapping", "Test sync", "Completion"],
  },
  {
    category: IntegrationCategory.CALENDAR,
    description: "Tour scheduling sync with Outlook / Microsoft 365.",
    label: "Outlook Calendar",
    provider: IntegrationProvider.OUTLOOK_CALENDAR,
    setupSteps: ["Explanation", "Credentials", "Calendar mapping", "Test sync", "Completion"],
  },
  {
    category: IntegrationCategory.SCREENING,
    description: "Hosted screening launch and status sync.",
    label: "Checkr screening",
    provider: IntegrationProvider.CHECKR,
    setupSteps: ["Explanation", "Credentials", "Package mapping", "Test invite", "Completion"],
  },
  {
    category: IntegrationCategory.SCREENING,
    description: "Hosted screening launch and status sync.",
    label: "TransUnion screening",
    provider: IntegrationProvider.TRANSUNION,
    setupSteps: ["Explanation", "Credentials", "Package mapping", "Test invite", "Completion"],
  },
  {
    category: IntegrationCategory.SCREENING,
    description: "Hosted screening launch and status sync.",
    label: "Zumper screening",
    provider: IntegrationProvider.ZUMPER,
    setupSteps: ["Explanation", "Credentials", "Package mapping", "Test invite", "Completion"],
  },
  {
    category: IntegrationCategory.LEAD_SOURCE,
    description: "Generic signed webhook entrypoint for third-party lead ingestion.",
    label: "Inbound webhook",
    provider: IntegrationProvider.GENERIC_INBOUND_WEBHOOK,
    setupSteps: ["Explanation", "Prerequisites", "Mapping", "Test event", "Completion"],
  },
  {
    category: IntegrationCategory.LEAD_SOURCE,
    description: "Delimited file ingestion with field mapping and validation preview.",
    label: "CSV import",
    provider: IntegrationProvider.CSV_IMPORT,
    setupSteps: ["Explanation", "File format", "Field mapping", "Validation preview", "Completion"],
  },
  {
    category: IntegrationCategory.CRM_WORKFLOW,
    description: "Webhook fan-out for Zapier, Make, n8n, and custom consumers.",
    label: "Outbound automation webhooks",
    provider: IntegrationProvider.OUTBOUND_WEBHOOK,
    setupSteps: ["Explanation", "Destination", "Event mapping", "Test event", "Completion"],
  },
  {
    category: IntegrationCategory.CRM_WORKFLOW,
    description: "Slack notifications for operator alerts and workflow events.",
    label: "Slack notifications",
    provider: IntegrationProvider.SLACK,
    setupSteps: ["Explanation", "Credentials", "Channel mapping", "Test event", "Completion"],
  },
  {
    category: IntegrationCategory.FILE_STORAGE,
    description: "S3-compatible attachment and export storage.",
    label: "S3-compatible storage",
    provider: IntegrationProvider.S3_COMPATIBLE,
    setupSteps: ["Explanation", "Credentials", "Bucket mapping", "Test upload", "Completion"],
  },
] as const;

export const csvExportDatasetDefinitions = [
  {
    description: "Lead roster with source, property, status, and qualification context.",
    label: "Leads",
    value: "leads",
  },
  {
    description: "Conversation message log with direction, channel, and delivery metadata.",
    label: "Messages",
    value: "messages",
  },
  {
    description: "Workspace audit trail for lead, property, and operator actions.",
    label: "Activity",
    value: "activity",
  },
] as const;

export type CsvExportDataset = (typeof csvExportDatasetDefinitions)[number]["value"];

export const outboundWebhookEventDefinitions = [
  {
    description: "New lead intake after normalization and duplicate handling.",
    label: "Lead created",
    value: "lead.created",
  },
  {
    description: "Qualification routed the lead into a qualified state.",
    label: "Lead qualified",
    value: "lead.qualified",
  },
  {
    description: "Qualification routed the lead into a declined state.",
    label: "Lead declined",
    value: "lead.declined",
  },
  {
    description: "A tour was scheduled or rescheduled for the lead.",
    label: "Tour scheduled",
    value: "tour.scheduled",
  },
  {
    description: "A screening request was launched for the lead.",
    label: "Screening requested",
    value: "screening.requested",
  },
  {
    description: "An application invite was sent.",
    label: "Application sent",
    value: "application.sent",
  },
  {
    description: "A workflow-driven message event was emitted.",
    label: "Message event",
    value: "message_event",
  },
] as const;

export type OutboundWebhookEventType =
  (typeof outboundWebhookEventDefinitions)[number]["value"];

type CsvCellValue = boolean | number | string | null | undefined;

export type IntegrationFieldMapping = {
  required: boolean;
  sourceField: string;
  targetField: string;
};

export type InboundWebhookIntegrationConfig = {
  defaultLeadSourceId: string | null;
  defaultLeadSourceType: LeadSourceType;
  defaultMessageChannel: MessageChannel;
  fieldMappings: IntegrationFieldMapping[];
  payloadFormat: "json";
  secretHint: string | null;
  signingHeader: string;
  sourceLabel: string;
};

export type CsvImportPreviewRow = {
  email: string | null;
  errors: string[];
  fullName: string | null;
  phone: string | null;
  rowNumber: number;
  status: "valid" | "invalid";
};

export type CsvImportPreview = {
  headerFields: string[];
  invalidRowCount: number;
  rows: CsvImportPreviewRow[];
  sampleRowCount: number;
  validRowCount: number;
};

export type OutboundWebhookDestination = {
  enabled: boolean;
  label: string;
  url: string;
};

export type OutboundWebhookIntegrationConfig = {
  destinations: OutboundWebhookDestination[];
  eventTypes: OutboundWebhookEventType[];
  secretHint: string | null;
};

export type MetaLeadAdsIntegrationConfig = {
  appSecret: string | null;
  campaignTag: string | null;
  defaultLeadSourceId: string | null;
  fieldMappings: IntegrationFieldMapping[];
  formId: string | null;
  pageId: string | null;
  sourceLabel: string;
  verifyToken: string | null;
};

export type MessagingChannelIntegrationConfig = {
  accountLabel: string;
  allowInboundSync: boolean;
  allowOutboundSend: boolean;
  defaultLeadSourceId: string | null;
  senderIdentifier: string | null;
  verifyToken: string | null;
};

export type ListingFeedIntegrationConfig = {
  destinationName: string | null;
  destinationPath: string | null;
  feedLabel: string;
  format: "json";
  includeOnlyActiveProperties: boolean;
};

export type SlackIntegrationConfig = {
  channelLabel: string | null;
  notifyOnApplicationInviteStale: boolean;
  notifyOnNewLead: boolean;
  notifyOnReviewAlerts: boolean;
  notifyOnTourScheduled: boolean;
  webhookUrl: string | null;
};

export type S3CompatibleIntegrationConfig = {
  accessKeyIdHint: string | null;
  basePath: string;
  bucket: string | null;
  endpointUrl: string | null;
  region: string | null;
  secretAccessKeyHint: string | null;
};

type ListingFeedProperty = {
  addressLine1: string | null;
  id: string;
  lifecycleStatus: string;
  listingSourceExternalId: string | null;
  listingSourceUrl: string | null;
  locality: string | null;
  name: string;
  parkingAvailable: boolean;
  petsAllowed: boolean;
  rentableRoomCount: number | null;
  schedulingUrl: string | null;
  sharedBathroomCount: number | null;
  smokingAllowed: boolean;
  updatedAt: Date;
};

function escapeCsvCellValue(value: CsvCellValue) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalizedValue = typeof value === "string" ? value : String(value);

  if (
    normalizedValue.includes(",") ||
    normalizedValue.includes("\n") ||
    normalizedValue.includes("\r") ||
    normalizedValue.includes('"')
  ) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

function formatCsvTimestamp(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function normalizeOptionalHttpUrl(value: string | null | undefined) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(value.trim());

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function isCsvExportDataset(value: string): value is CsvExportDataset {
  return csvExportDatasetDefinitions.some((dataset) => dataset.value === value);
}

export function isOutboundWebhookEventType(value: string): value is OutboundWebhookEventType {
  return outboundWebhookEventDefinitions.some((eventDefinition) => eventDefinition.value === value);
}

function normalizeOutboundWebhookDestination(
  value: Partial<OutboundWebhookDestination> | null | undefined,
) {
  const label = typeof value?.label === "string" ? value.label.trim() : "";
  const url = typeof value?.url === "string" ? value.url.trim() : "";

  if (!label || !url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return {
      enabled: value?.enabled === true,
      label,
      url: parsedUrl.toString(),
    } satisfies OutboundWebhookDestination;
  } catch {
    return null;
  }
}

export function parseOutboundWebhookEventTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as OutboundWebhookEventType[];
  }

  return value.filter(
    (entry): entry is OutboundWebhookEventType =>
      typeof entry === "string" && isOutboundWebhookEventType(entry),
  );
}

export function parseOutboundWebhookIntegrationConfig(
  value: unknown,
): OutboundWebhookIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<OutboundWebhookIntegrationConfig>)
      : null;

  return {
    destinations: Array.isArray(parsedValue?.destinations)
      ? parsedValue.destinations
          .map((destination) =>
            normalizeOutboundWebhookDestination(
              destination && typeof destination === "object" && !Array.isArray(destination)
                ? (destination as Partial<OutboundWebhookDestination>)
                : null,
            ),
          )
          .filter((destination): destination is OutboundWebhookDestination => Boolean(destination))
      : [],
    eventTypes: parseOutboundWebhookEventTypes(parsedValue?.eventTypes),
    secretHint:
      typeof parsedValue?.secretHint === "string" && parsedValue.secretHint.trim().length > 0
        ? parsedValue.secretHint.trim()
        : null,
  };
}

export function serializeOutboundWebhookIntegrationConfig(
  value: OutboundWebhookIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseOutboundWebhookIntegrationConfig(value);

  return {
    destinations: parsedValue.destinations.map((destination) => ({
      enabled: destination.enabled,
      label: destination.label,
      url: destination.url,
    })),
    eventTypes: parsedValue.eventTypes,
    secretHint: parsedValue.secretHint,
  } satisfies Prisma.InputJsonValue;
}

export function resolveOutboundWebhookDestinationsForEvent(params: {
  config: OutboundWebhookIntegrationConfig;
  eventType: string;
}) {
  if (!isOutboundWebhookEventType(params.eventType)) {
    return [] as OutboundWebhookDestination[];
  }

  if (!params.config.eventTypes.includes(params.eventType)) {
    return [] as OutboundWebhookDestination[];
  }

  return params.config.destinations.filter((destination) => destination.enabled);
}

export function parseMetaLeadAdsIntegrationConfig(value: unknown): MetaLeadAdsIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<MetaLeadAdsIntegrationConfig>)
      : null;

  return {
    appSecret:
      typeof parsedValue?.appSecret === "string" && parsedValue.appSecret.trim().length > 0
        ? parsedValue.appSecret.trim()
        : null,
    campaignTag:
      typeof parsedValue?.campaignTag === "string" && parsedValue.campaignTag.trim().length > 0
        ? parsedValue.campaignTag.trim()
        : null,
    defaultLeadSourceId:
      typeof parsedValue?.defaultLeadSourceId === "string" &&
      parsedValue.defaultLeadSourceId.trim().length > 0
        ? parsedValue.defaultLeadSourceId.trim()
        : null,
    fieldMappings: parseIntegrationFieldMappings(parsedValue?.fieldMappings),
    formId:
      typeof parsedValue?.formId === "string" && parsedValue.formId.trim().length > 0
        ? parsedValue.formId.trim()
        : null,
    pageId:
      typeof parsedValue?.pageId === "string" && parsedValue.pageId.trim().length > 0
        ? parsedValue.pageId.trim()
        : null,
    sourceLabel:
      typeof parsedValue?.sourceLabel === "string" && parsedValue.sourceLabel.trim().length > 0
        ? parsedValue.sourceLabel.trim()
        : "Meta Lead Ads",
    verifyToken:
      typeof parsedValue?.verifyToken === "string" && parsedValue.verifyToken.trim().length > 0
        ? parsedValue.verifyToken.trim()
        : null,
  };
}

export function serializeMetaLeadAdsIntegrationConfig(
  value: MetaLeadAdsIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseMetaLeadAdsIntegrationConfig(value);

  return {
    appSecret: parsedValue.appSecret,
    campaignTag: parsedValue.campaignTag,
    defaultLeadSourceId: parsedValue.defaultLeadSourceId,
    fieldMappings: serializeIntegrationFieldMappings(parsedValue.fieldMappings),
    formId: parsedValue.formId,
    pageId: parsedValue.pageId,
    sourceLabel: parsedValue.sourceLabel,
    verifyToken: parsedValue.verifyToken,
  } satisfies Prisma.InputJsonValue;
}

export function parseMessagingChannelIntegrationConfig(
  value: unknown,
): MessagingChannelIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<MessagingChannelIntegrationConfig>)
      : null;

  return {
    accountLabel:
      typeof parsedValue?.accountLabel === "string" && parsedValue.accountLabel.trim().length > 0
        ? parsedValue.accountLabel.trim()
        : "",
    allowInboundSync: parsedValue?.allowInboundSync === true,
    allowOutboundSend: parsedValue?.allowOutboundSend === true,
    defaultLeadSourceId:
      typeof parsedValue?.defaultLeadSourceId === "string" &&
      parsedValue.defaultLeadSourceId.trim().length > 0
        ? parsedValue.defaultLeadSourceId.trim()
        : null,
    senderIdentifier:
      typeof parsedValue?.senderIdentifier === "string" &&
      parsedValue.senderIdentifier.trim().length > 0
        ? parsedValue.senderIdentifier.trim()
        : null,
    verifyToken:
      typeof parsedValue?.verifyToken === "string" && parsedValue.verifyToken.trim().length > 0
        ? parsedValue.verifyToken.trim()
        : null,
  };
}

export function serializeMessagingChannelIntegrationConfig(
  value: MessagingChannelIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseMessagingChannelIntegrationConfig(value);

  return {
    accountLabel: parsedValue.accountLabel,
    allowInboundSync: parsedValue.allowInboundSync,
    allowOutboundSend: parsedValue.allowOutboundSend,
    defaultLeadSourceId: parsedValue.defaultLeadSourceId,
    senderIdentifier: parsedValue.senderIdentifier,
    verifyToken: parsedValue.verifyToken,
  } satisfies Prisma.InputJsonValue;
}

export function parseListingFeedIntegrationConfig(value: unknown): ListingFeedIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<ListingFeedIntegrationConfig>)
      : null;

  return {
    destinationName:
      typeof parsedValue?.destinationName === "string" &&
      parsedValue.destinationName.trim().length > 0
        ? parsedValue.destinationName.trim()
        : null,
    destinationPath: normalizeOptionalHttpUrl(parsedValue?.destinationPath ?? null),
    feedLabel:
      typeof parsedValue?.feedLabel === "string" && parsedValue.feedLabel.trim().length > 0
        ? parsedValue.feedLabel.trim()
        : "Listing feed",
    format: "json",
    includeOnlyActiveProperties: parsedValue?.includeOnlyActiveProperties !== false,
  };
}

export function serializeListingFeedIntegrationConfig(
  value: ListingFeedIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseListingFeedIntegrationConfig(value);

  return {
    destinationName: parsedValue.destinationName,
    destinationPath: parsedValue.destinationPath,
    feedLabel: parsedValue.feedLabel,
    format: parsedValue.format,
    includeOnlyActiveProperties: parsedValue.includeOnlyActiveProperties,
  } satisfies Prisma.InputJsonValue;
}

export function parseSlackIntegrationConfig(value: unknown): SlackIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<SlackIntegrationConfig>)
      : null;

  return {
    channelLabel:
      typeof parsedValue?.channelLabel === "string" && parsedValue.channelLabel.trim().length > 0
        ? parsedValue.channelLabel.trim()
        : null,
    notifyOnApplicationInviteStale: parsedValue?.notifyOnApplicationInviteStale === true,
    notifyOnNewLead: parsedValue?.notifyOnNewLead === true,
    notifyOnReviewAlerts: parsedValue?.notifyOnReviewAlerts === true,
    notifyOnTourScheduled: parsedValue?.notifyOnTourScheduled === true,
    webhookUrl: normalizeOptionalHttpUrl(parsedValue?.webhookUrl ?? null),
  };
}

export function serializeSlackIntegrationConfig(
  value: SlackIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseSlackIntegrationConfig(value);

  return {
    channelLabel: parsedValue.channelLabel,
    notifyOnApplicationInviteStale: parsedValue.notifyOnApplicationInviteStale,
    notifyOnNewLead: parsedValue.notifyOnNewLead,
    notifyOnReviewAlerts: parsedValue.notifyOnReviewAlerts,
    notifyOnTourScheduled: parsedValue.notifyOnTourScheduled,
    webhookUrl: parsedValue.webhookUrl,
  } satisfies Prisma.InputJsonValue;
}

export function parseS3CompatibleIntegrationConfig(value: unknown): S3CompatibleIntegrationConfig {
  const parsedValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<S3CompatibleIntegrationConfig>)
      : null;

  return {
    accessKeyIdHint:
      typeof parsedValue?.accessKeyIdHint === "string" &&
      parsedValue.accessKeyIdHint.trim().length > 0
        ? parsedValue.accessKeyIdHint.trim()
        : null,
    basePath:
      typeof parsedValue?.basePath === "string" && parsedValue.basePath.trim().length > 0
        ? parsedValue.basePath.trim().replace(/^\/+|\/+$/g, "")
        : "roomflow",
    bucket:
      typeof parsedValue?.bucket === "string" && parsedValue.bucket.trim().length > 0
        ? parsedValue.bucket.trim()
        : null,
    endpointUrl: normalizeOptionalHttpUrl(parsedValue?.endpointUrl ?? null),
    region:
      typeof parsedValue?.region === "string" && parsedValue.region.trim().length > 0
        ? parsedValue.region.trim()
        : null,
    secretAccessKeyHint:
      typeof parsedValue?.secretAccessKeyHint === "string" &&
      parsedValue.secretAccessKeyHint.trim().length > 0
        ? parsedValue.secretAccessKeyHint.trim()
        : null,
  };
}

export function serializeS3CompatibleIntegrationConfig(
  value: S3CompatibleIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseS3CompatibleIntegrationConfig(value);

  return {
    accessKeyIdHint: parsedValue.accessKeyIdHint,
    basePath: parsedValue.basePath,
    bucket: parsedValue.bucket,
    endpointUrl: parsedValue.endpointUrl,
    region: parsedValue.region,
    secretAccessKeyHint: parsedValue.secretAccessKeyHint,
  } satisfies Prisma.InputJsonValue;
}

export function buildListingFeedPayload(params: {
  feedLabel: string;
  generatedAt?: Date;
  properties: ReadonlyArray<ListingFeedProperty>;
  providerLabel: string;
  workspaceName: string;
  workspaceSlug: string;
}) {
  return {
    feedLabel: params.feedLabel,
    generatedAt: formatCsvTimestamp(params.generatedAt ?? new Date()),
    listings: params.properties.map((property) => ({
      addressLine1: property.addressLine1,
      externalListingId: property.listingSourceExternalId,
      listingUrl: property.listingSourceUrl,
      locality: property.locality,
      parkingAvailable: property.parkingAvailable,
      petsAllowed: property.petsAllowed,
      propertyId: property.id,
      propertyName: property.name,
      rentableRoomCount: property.rentableRoomCount,
      schedulingUrl: property.schedulingUrl,
      sharedBathroomCount: property.sharedBathroomCount,
      smokingAllowed: property.smokingAllowed,
      status: property.lifecycleStatus,
      updatedAt: formatCsvTimestamp(property.updatedAt),
    })),
    provider: params.providerLabel,
    workspace: {
      name: params.workspaceName,
      slug: params.workspaceSlug,
    },
  };
}

export function buildStorageManifestPreview(params: {
  basePath: string;
  workspaceSlug: string;
}) {
  const normalizedWorkspaceSlug = params.workspaceSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";

  return [
    `${params.basePath}/${normalizedWorkspaceSlug}/attachments/prospect-document.pdf`,
    `${params.basePath}/${normalizedWorkspaceSlug}/exports/leads-${new Date("2026-03-08T00:00:00.000Z").toISOString().replace(/[.:]/g, "-")}.csv`,
  ];
}

export function buildCsvDocument(params: {
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<CsvCellValue>>;
}) {
  const headerRow = params.headers.map((header) => escapeCsvCellValue(header)).join(",");
  const dataRows = params.rows.map((row) => row.map((cell) => escapeCsvCellValue(cell)).join(","));

  return [headerRow, ...dataRows].join("\n");
}

export function buildCsvExportFileName(params: {
  dataset: CsvExportDataset;
  now?: Date;
  workspaceSlug: string;
}) {
  const timestamp = (params.now ?? new Date()).toISOString().replace(/[.:]/g, "-");
  const normalizedWorkspaceSlug = params.workspaceSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";

  return `${normalizedWorkspaceSlug}-${params.dataset}-${timestamp}.csv`;
}

export function serializeAuditEventPayloadSummary(payload: Prisma.JsonValue | null | undefined) {
  if (payload === null || payload === undefined) {
    return "";
  }

  return JSON.stringify(payload);
}

export function extractAuditEventReason(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  return typeof payload.reason === "string" ? payload.reason : "";
}

export function extractAuditEventChannel(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  return typeof payload.channel === "string" ? payload.channel : "";
}

function normalizeFieldMapping(value: Partial<IntegrationFieldMapping> | null | undefined) {
  const sourceField = typeof value?.sourceField === "string" ? value.sourceField.trim() : "";
  const targetField = typeof value?.targetField === "string" ? value.targetField.trim() : "";

  if (!sourceField || !targetField) {
    return null;
  }

  return {
    required: value?.required === true,
    sourceField,
    targetField,
  };
}

export function parseIntegrationFieldMappings(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as IntegrationFieldMapping[];
  }

  return value
    .map((entry) =>
      normalizeFieldMapping(
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Partial<IntegrationFieldMapping>)
          : null,
      ),
    )
    .filter((entry): entry is IntegrationFieldMapping => Boolean(entry));
}

export function serializeIntegrationFieldMappings(
  value: ReadonlyArray<IntegrationFieldMapping>,
): Prisma.InputJsonValue {
  return parseIntegrationFieldMappings(value).map((entry) => ({
    required: entry.required,
    sourceField: entry.sourceField,
    targetField: entry.targetField,
  }));
}

export function parseInboundWebhookIntegrationConfig(
  value: unknown,
): InboundWebhookIntegrationConfig {
  const parsedValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<InboundWebhookIntegrationConfig>)
    : null;

  const defaultLeadSourceType =
    parsedValue?.defaultLeadSourceType &&
    Object.values(LeadSourceType).includes(parsedValue.defaultLeadSourceType)
      ? parsedValue.defaultLeadSourceType
      : LeadSourceType.WEB_FORM;
  const defaultMessageChannel =
    parsedValue?.defaultMessageChannel &&
    Object.values(MessageChannel).includes(parsedValue.defaultMessageChannel)
      ? parsedValue.defaultMessageChannel
      : MessageChannel.EMAIL;

  return {
    defaultLeadSourceId:
      typeof parsedValue?.defaultLeadSourceId === "string" &&
      parsedValue.defaultLeadSourceId.trim().length > 0
        ? parsedValue.defaultLeadSourceId.trim()
        : null,
    defaultLeadSourceType,
    defaultMessageChannel,
    fieldMappings: parseIntegrationFieldMappings(parsedValue?.fieldMappings),
    payloadFormat: "json",
    secretHint:
      typeof parsedValue?.secretHint === "string" && parsedValue.secretHint.trim().length > 0
        ? parsedValue.secretHint.trim()
        : null,
    signingHeader:
      typeof parsedValue?.signingHeader === "string" &&
      parsedValue.signingHeader.trim().length > 0
        ? parsedValue.signingHeader.trim()
        : "x-roomflow-signature",
    sourceLabel:
      typeof parsedValue?.sourceLabel === "string" && parsedValue.sourceLabel.trim().length > 0
        ? parsedValue.sourceLabel.trim()
        : "Generic webhook source",
  };
}

export function serializeInboundWebhookIntegrationConfig(
  value: InboundWebhookIntegrationConfig,
): Prisma.InputJsonValue {
  const parsedValue = parseInboundWebhookIntegrationConfig(value);

  return {
    defaultLeadSourceId: parsedValue.defaultLeadSourceId,
    defaultLeadSourceType: parsedValue.defaultLeadSourceType,
    defaultMessageChannel: parsedValue.defaultMessageChannel,
    fieldMappings: serializeIntegrationFieldMappings(parsedValue.fieldMappings),
    payloadFormat: parsedValue.payloadFormat,
    secretHint: parsedValue.secretHint,
    signingHeader: parsedValue.signingHeader,
    sourceLabel: parsedValue.sourceLabel,
  } satisfies Prisma.InputJsonValue;
}

export function parseCsvText(value: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let isInsideQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell.trim());
    currentCell = "";
  };

  const pushRow = () => {
    if (currentRow.length > 0 || currentCell.length > 0) {
      pushCell();
      rows.push(currentRow);
      currentRow = [];
    }
  };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = value[index + 1];

    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      isInsideQuotes = !isInsideQuotes;
      continue;
    }

    if (character === "," && !isInsideQuotes) {
      pushCell();
      continue;
    }

    if ((character === "\n" || character === "\r") && !isInsideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      pushRow();
      continue;
    }

    currentCell += character;
  }

  pushRow();

  return rows.filter((row) => row.some((cell) => cell.length > 0));
}

function resolveMappedCsvValue(params: {
  headers: string[];
  row: string[];
  sourceField: string;
}) {
  const headerIndex = params.headers.findIndex(
    (header) => header.trim().toLowerCase() === params.sourceField.trim().toLowerCase(),
  );

  if (headerIndex >= 0) {
    return params.row[headerIndex]?.trim() ?? "";
  }

  return "";
}

export async function buildCsvImportPreview(params: {
  csvText: string;
  defaultSourceName?: string;
  fieldMappings: ReadonlyArray<IntegrationFieldMapping>;
  workspaceId: string;
}) {
  const { normalizeInboundCsvImportPayload } = await import("@/lib/lead-normalization");
  const parsedRows = parseCsvText(params.csvText);

  if (parsedRows.length === 0) {
    return {
      headerFields: [],
      invalidRowCount: 0,
      rows: [],
      sampleRowCount: 0,
      validRowCount: 0,
    } satisfies CsvImportPreview;
  }

  const [headerRow, ...dataRows] = parsedRows;
  const previewRows = dataRows.slice(0, 5).map((row, rowIndex) => {
    const mappedRecord = params.fieldMappings.reduce<Record<string, string>>((result, mapping) => {
      result[mapping.targetField] = resolveMappedCsvValue({
        headers: headerRow,
        row,
        sourceField: mapping.sourceField,
      });

      return result;
    }, {});
    const missingRequiredMappings = params.fieldMappings
      .filter((mapping) => mapping.required)
      .filter((mapping) => !mappedRecord[mapping.targetField])
      .map((mapping) => `Missing required field: ${mapping.targetField}`);

    try {
      const normalizedRow = normalizeInboundCsvImportPayload({
        body: mappedRecord.body || undefined,
        email: mappedRecord.email || undefined,
        fullName: mappedRecord.fullName,
        importedAt: new Date().toISOString(),
        metadata: {
          rawRow: row,
        },
        notes: mappedRecord.notes || undefined,
        phone: mappedRecord.phone || undefined,
        rowId: mappedRecord.rowId || `preview-row-${rowIndex + 1}`,
        sourceName: params.defaultSourceName ?? "CSV import",
        workspaceId: params.workspaceId,
      });

      if (missingRequiredMappings.length > 0) {
        return {
          email: normalizedRow.email ?? null,
          errors: missingRequiredMappings,
          fullName: normalizedRow.fullName,
          phone: normalizedRow.phone ?? null,
          rowNumber: rowIndex + 2,
          status: "invalid",
        } satisfies CsvImportPreviewRow;
      }

      return {
        email: normalizedRow.email ?? null,
        errors: [],
        fullName: normalizedRow.fullName,
        phone: normalizedRow.phone ?? null,
        rowNumber: rowIndex + 2,
        status: "valid",
      } satisfies CsvImportPreviewRow;
    } catch (error) {
      return {
        email: mappedRecord.email || null,
        errors: [
          ...missingRequiredMappings,
          error instanceof Error ? error.message : "CSV row could not be normalized.",
        ],
        fullName: mappedRecord.fullName || null,
        phone: mappedRecord.phone || null,
        rowNumber: rowIndex + 2,
        status: "invalid",
      } satisfies CsvImportPreviewRow;
    }
  });

  return {
    headerFields: headerRow,
    invalidRowCount: previewRows.filter((row) => row.status === "invalid").length,
    rows: previewRows,
    sampleRowCount: previewRows.length,
    validRowCount: previewRows.filter((row) => row.status === "valid").length,
  } satisfies CsvImportPreview;
}

export function formatCsvExportTimestamp(value: Date | null | undefined) {
  return formatCsvTimestamp(value);
}

export function resolveIntegrationHealthState(params: {
  authState: IntegrationAuthState;
  enabled: boolean;
  healthMessage: string | null;
  syncStatus: IntegrationSyncStatus;
}) {
  if (params.authState === IntegrationAuthState.ERROR) {
    return IntegrationHealthState.ERROR;
  }

  if (params.healthMessage || params.syncStatus === IntegrationSyncStatus.FAILED) {
    return IntegrationHealthState.DEGRADED;
  }

  if (params.enabled && params.authState === IntegrationAuthState.ACTIVE) {
    return IntegrationHealthState.HEALTHY;
  }

  return IntegrationHealthState.UNKNOWN;
}

export function formatIntegrationConnectionSummary(params: {
  authState: IntegrationAuthState;
  enabled: boolean;
  healthMessage: string | null;
  lastSyncMessage: string | null;
  syncStatus: IntegrationSyncStatus;
}) {
  if (!params.enabled && params.authState === IntegrationAuthState.NOT_CONNECTED) {
    return "Not set up";
  }

  if (params.healthMessage) {
    return params.healthMessage;
  }

  if (params.lastSyncMessage) {
    return params.lastSyncMessage;
  }

  if (params.syncStatus === IntegrationSyncStatus.SUCCESS) {
    return "Healthy";
  }

  if (params.syncStatus === IntegrationSyncStatus.FAILED) {
    return "Needs attention";
  }

  return params.enabled ? "Configured" : "Setup incomplete";
}

export function resolveIntegrationSetupState(params: {
  authState: IntegrationAuthState;
  enabled: boolean;
  hasMappingConfig: boolean;
  healthState: IntegrationHealthState;
  provider: IntegrationProvider;
}) {
  const integrationDefinition = integrationCatalog.find(
    (catalogEntry) => catalogEntry.provider === params.provider,
  );
  const totalSteps = integrationDefinition?.setupSteps.length ?? 5;

  if (params.healthState === IntegrationHealthState.HEALTHY) {
    return {
      currentStep: totalSteps,
      label: "Completion",
      totalSteps,
    };
  }

  if (params.authState === IntegrationAuthState.NOT_CONNECTED) {
    return {
      currentStep: 1,
      label: integrationDefinition?.setupSteps[0] ?? "Explanation",
      totalSteps,
    };
  }

  if (params.authState === IntegrationAuthState.CONFIGURED) {
    return {
      currentStep: Math.min(2, totalSteps),
      label: integrationDefinition?.setupSteps[1] ?? "Credentials",
      totalSteps,
    };
  }

  if (!params.hasMappingConfig) {
    return {
      currentStep: Math.min(3, totalSteps),
      label: integrationDefinition?.setupSteps[2] ?? "Mapping",
      totalSteps,
    };
  }

  return {
    currentStep: Math.min(totalSteps - 1, totalSteps),
    label: integrationDefinition?.setupSteps[Math.max(totalSteps - 2, 0)] ?? "Test event",
    totalSteps,
  };
}
