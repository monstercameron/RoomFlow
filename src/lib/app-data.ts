import { cache } from "react";
import { cookies } from "next/headers";
import {
  CalendarSyncProvider,
  ContactChannel,
  IntegrationAuthState,
  IntegrationHealthState,
  IntegrationProvider,
  IntegrationSyncStatus,
  LeadStatus,
  LeadSourceType,
  MessageChannel,
  PropertyLifecycleStatus,
  QualificationFit,
  RuleSeverity,
  ScreeningConnectionAuthState,
  ScreeningProvider,
  ScreeningRequestStatus,
  TaskStatus,
  TemplateType,
  TourEventStatus,
  WebhookDeliveryStatus,
  WorkspaceCapability,
  WorkspacePlanType,
  type Prisma,
} from "@/generated/prisma/client";
import {
  buildLeadTimeline,
  evaluateLeadQualification,
  getLeadActionAvailability,
  getLeadAutomationSuppressionSummaries,
  getLeadWorkflowContext,
  renderTemplateForLead,
} from "@/lib/lead-workflow";
import {
  isManualOnlyAutomationModeEnabled,
  isMissingInfoPromptThrottled,
  isQualificationCompleted,
  resolveMissingInfoPromptThrottleWindowMinutes,
  resolveMissingRequiredQualificationQuestions,
  resolveMostRecentMissingInfoRequestTimestamp,
  resolveQualificationAutomationGate,
} from "@/lib/lead-qualification-guard";
import { buildLeadFieldMetadataRows } from "@/lib/lead-field-metadata-view";
import {
  extractDuplicateCandidateLeadIdFromAuditPayload,
  shouldShowDuplicateReviewPrompt,
} from "@/lib/lead-duplicate-review";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { formatAvailabilityWindow, parseAvailabilityWindowConfig } from "@/lib/availability-windows";
import { getLeadActionPermissionsForMembershipRole } from "@/lib/membership-role-permissions";
import { parseDeliveryStatus } from "@/lib/delivery-status";
import { resolveInternalNoteMentions } from "@/lib/internal-note-mentions";
import {
  formatMessageChannelLabel,
  isLeadChannelOptedOut,
  resolveLeadChannelOptOutState,
  resolveLeadOptOutSummary,
} from "@/lib/lead-channel-opt-outs";
import {
  findLatestAiArtifact,
  houseRulesGeneratorSchema,
  intakeFormGeneratorSchema,
  leadAiInsightsSchema,
  listingAnalyzerSchema,
  portfolioInsightsSchema,
  translationArtifactSchema,
  workflowTemplateGeneratorSchema,
} from "@/lib/ai-assist";
import { prisma } from "@/lib/prisma";
import { deriveWorkflowKpis } from "@/lib/kpi-derivation";
import { formatPropertyListingSyncStatus } from "@/lib/property-listing-sync";
import { formatPropertyLifecycleStatus } from "@/lib/property-lifecycle";
import { formatQuietHours, resolveEffectiveQuietHours } from "@/lib/quiet-hours";
import { resolveActiveQualificationQuestionSet } from "@/lib/workflow4-questions";
import {
  buildStorageManifestPreview,
  formatIntegrationConnectionSummary,
  integrationCatalog,
  parseInboundWebhookIntegrationConfig,
  parseListingFeedIntegrationConfig,
  parseMessagingChannelIntegrationConfig,
  parseMetaLeadAdsIntegrationConfig,
  parseOutboundWebhookIntegrationConfig,
  parseIntegrationFieldMappings,
  parseS3CompatibleIntegrationConfig,
  parseSlackIntegrationConfig,
  resolveIntegrationHealthState,
  resolveIntegrationSetupState,
} from "@/lib/integrations";
import {
  formatScreeningConnectionSummary,
  parseScreeningPackageConfig,
} from "@/lib/screening";
import {
  formatCalendarConnectionSummary,
  formatTourReminderSequenceSummary,
  formatTourSchedulingMode,
  parseCalendarConnectionsConfig,
  parseTourReminderState,
  parseTourReminderSequence,
} from "@/lib/tour-scheduling";
import { getServerSession } from "@/lib/session";
import {
  getIntlLocaleForLeadsPageLocale,
  getLeadsPageCopy,
  getLocalizedLeadFitLabel,
  getLocalizedLeadSlaLabel,
  getLocalizedLeadStatusLabel,
  getLocalizedMembershipRoleLabel,
  type LeadsPageLocale,
} from "@/lib/leads-page-i18n";
import {
  buildLeadListArchivedVisibilityClause,
  buildLeadListFilterClauses,
  buildLeadListSearchClause,
  buildLeadListWhereClause,
  buildLeadListWorkflowFilterClauses,
  type LeadListWorkflowFilters,
} from "@/lib/lead-list-filters";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";
import { sortTimelineEventsDeterministically } from "@/lib/workflow-events";

function hasStructuredIntegrationMappingConfig(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value).length > 0;
}

function resolveScreeningIntegrationProvider(provider: ScreeningProvider) {
  switch (provider) {
    case ScreeningProvider.CHECKR:
      return IntegrationProvider.CHECKR;
    case ScreeningProvider.TRANSUNION:
      return IntegrationProvider.TRANSUNION;
    case ScreeningProvider.ZUMPER:
      return IntegrationProvider.ZUMPER;
  }
}

function formatAiArtifactView<T>(
  artifact:
    | {
        createdAt: Date;
        data: T;
        status: "ready";
      }
    | {
        createdAt: Date;
        error: string;
        status: "failed";
      }
    | null,
) {
  if (!artifact) {
    return null;
  }

  if (artifact.status === "failed") {
    return {
      error: artifact.error,
      generatedAt: formatRelativeTime(artifact.createdAt),
      status: artifact.status,
    };
  }

  return {
    data: artifact.data,
    generatedAt: formatRelativeTime(artifact.createdAt),
    status: artifact.status,
  };
}

function formatCurrency(value: number | null, locale: LeadsPageLocale = "en") {
  const copy = getLeadsPageCopy(locale);

  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(getIntlLocaleForLeadsPageLocale(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyAmountCents(
  value: number | null,
  currency = "USD",
  locale: LeadsPageLocale = "en",
) {
  const copy = getLeadsPageCopy(locale);

  if (value === null) {
    return copy.common.notRecorded;
  }

  return new Intl.NumberFormat(getIntlLocaleForLeadsPageLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(value: Date | null, locale: LeadsPageLocale = "en") {
  const copy = getLeadsPageCopy(locale);

  if (!value) {
    return copy.common.notSet;
  }

  return new Intl.DateTimeFormat(getIntlLocaleForLeadsPageLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date | null, locale: LeadsPageLocale = "en") {
  const copy = getLeadsPageCopy(locale);

  if (!value) {
    return copy.common.notSet;
  }

  return new Intl.DateTimeFormat(getIntlLocaleForLeadsPageLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDateTimeInputValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60000);

  return localValue.toISOString().slice(0, 16);
}

function formatCalendarSyncSummary(params: {
  calendarSyncError: string | null;
  calendarSyncProvider: CalendarSyncProvider | null;
  calendarSyncStatus: string | null;
}) {
  if (!params.calendarSyncProvider && !params.calendarSyncStatus) {
    return "Manual scheduling";
  }

  const providerLabel = params.calendarSyncProvider
    ? formatEnumLabel(params.calendarSyncProvider)
    : "Calendar sync";

  if (params.calendarSyncStatus === "FAILED") {
    return params.calendarSyncError
      ? `${providerLabel} sync failed: ${params.calendarSyncError}`
      : `${providerLabel} sync failed`;
  }

  if (params.calendarSyncStatus) {
    return `${providerLabel} ${params.calendarSyncStatus.toLowerCase()}`;
  }

  return providerLabel;
}

function formatTourReminderStateSummary(value: unknown) {
  const reminderState = parseTourReminderState(value);

  if (reminderState.length === 0) {
    return "No reminders configured";
  }

  const sentCount = reminderState.filter((entry) => Boolean(entry.sentAt)).length;
  const nextPendingReminder = reminderState.find((entry) => !entry.sentAt);

  if (!nextPendingReminder) {
    return `All ${reminderState.length} reminders sent`;
  }

  return `${sentCount}/${reminderState.length} sent · next ${formatDateTime(new Date(nextPendingReminder.scheduledFor))}`;
}

function formatScreeningRequestSummary(params: {
  provider: ScreeningProvider;
  reportUrl: string | null;
  status: ScreeningRequestStatus;
}) {
  const providerLabel = formatEnumLabel(params.provider);
  const statusLabel = formatEnumLabel(params.status);

  return params.reportUrl
    ? `${providerLabel} · ${statusLabel} · report linked`
    : `${providerLabel} · ${statusLabel}`;
}

function formatRelativeTime(value: Date | null, locale: LeadsPageLocale = "en") {
  const copy = getLeadsPageCopy(locale);

  if (!value) {
    return copy.common.noRecentActivity;
  }

  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  const relativeTimeFormatter = new Intl.RelativeTimeFormat(
    getIntlLocaleForLeadsPageLocale(locale),
    { numeric: "always" },
  );

  if (diffMinutes < 60) {
    return relativeTimeFormatter.format(-diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return relativeTimeFormatter.format(-diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays === 1) {
    return copy.common.yesterday;
  }

  if (diffDays < 7) {
    return relativeTimeFormatter.format(-diffDays, "day");
  }

  return formatDate(value, locale);
}

async function resolveScopedPropertyIdsForMembership(params: {
  membershipId: string;
  membershipRole: Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>["role"];
}) {
  if (
    params.membershipRole === "OWNER" ||
    params.membershipRole === "ADMIN"
  ) {
    return null;
  }

  const propertyScopes = await prisma.membershipPropertyScope.findMany({
    where: {
      membershipId: params.membershipId,
    },
    select: {
      propertyId: true,
    },
  });

  return propertyScopes.length > 0
    ? propertyScopes.map((propertyScope) => propertyScope.propertyId)
    : null;
}

function buildScopedLeadAccessFilter(scopedPropertyIds: string[] | null) {
  if (!scopedPropertyIds) {
    return {};
  }

  return {
    OR: [
      {
        propertyId: null,
      },
      {
        propertyId: {
          in: scopedPropertyIds,
        },
      },
    ],
  };
}

function buildScopedPropertyAccessFilter(scopedPropertyIds: string[] | null) {
  if (!scopedPropertyIds) {
    return {};
  }

  return {
    id: {
      in: scopedPropertyIds,
    },
  };
}

function resolveLeadSlaSummary(params: {
  createdAt: Date;
  isReviewQueueItem: boolean;
  lastActivityAt: Date | null;
  leadReviewSlaMinutes: number;
  leadResponseSlaMinutes: number;
  status: LeadStatus;
  updatedAt: Date;
}) {
  const baseTimestamp = params.lastActivityAt ?? params.updatedAt ?? params.createdAt;
  const responseStatuses = new Set<LeadStatus>([
    LeadStatus.NEW,
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
  ]);
  const responseSlaApplies = responseStatuses.has(params.status);
  const reviewSlaApplies = params.isReviewQueueItem;

  if (!responseSlaApplies && !reviewSlaApplies) {
    return null;
  }

  const minutes = reviewSlaApplies
    ? params.leadReviewSlaMinutes
    : params.leadResponseSlaMinutes;
  const dueAt = new Date(baseTimestamp.getTime() + minutes * 60 * 1000);
  const isOverdue = dueAt.getTime() < Date.now();

  return {
    dueAt,
    isOverdue,
    label: reviewSlaApplies ? "Review SLA" : "Response SLA",
    queue: reviewSlaApplies ? "review" : "response",
  };
}

function resolveTaskIsOverdue(dueAt: Date | null, status: TaskStatus) {
  if (!dueAt) {
    return false;
  }

  if (status === TaskStatus.COMPLETED || status === TaskStatus.CANCELED) {
    return false;
  }

  return dueAt.getTime() < Date.now();
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFieldKeyLabel(fieldKey: string) {
  const normalizedLabel = fieldKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  switch (normalizedLabel) {
    case "monthly budget":
      return "Budget";
    case "stay length months":
      return "Stay length";
    case "bathroom sharing comfort":
      return "Bathroom sharing";
    case "parking need":
      return "Parking";
    case "guest expectations":
      return "Guest expectations";
    case "work schedule notes":
      return "Work schedule";
    default:
      return normalizedLabel
        .split(" ")
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function buildLeadRoutingReadinessSummary(params: {
  fitResult: QualificationFit;
  hasProperty: boolean;
  missingRequiredQuestionCount: number;
}) {
  if (!params.hasProperty) {
    return {
      detail:
        "Assign a property before routing or qualification follow-up can move forward cleanly.",
      label: "Property still missing",
      tone: "pending" as const,
    };
  }

  if (params.missingRequiredQuestionCount > 0) {
    return {
      detail:
        "Required qualification answers are still missing before the lead is ready for a routing decision.",
      label:
        params.missingRequiredQuestionCount === 1
          ? "1 required answer still missing"
          : `${params.missingRequiredQuestionCount} required answers still missing`,
      tone: "pending" as const,
    };
  }

  if (params.fitResult === QualificationFit.UNKNOWN) {
    return {
      detail:
        "Required answers are in place. Run fit evaluation before routing this lead further.",
      label: "Ready for fit evaluation",
      tone: "review" as const,
    };
  }

  return {
    detail:
      "Required answers and fit context are in place, so the lead can move through review, scheduling, or application steps.",
    label: "Ready for routing",
    tone: "ready" as const,
  };
}

function buildAskMissingQuestionsDraft(params: {
  leadName: string;
  propertyName: string | null;
  missingFieldLabels: string[];
  preferredChannel: ContactChannel | MessageChannel | null;
}) {
  if (params.missingFieldLabels.length === 0 || !params.preferredChannel) {
    return null;
  }

  const propertyReference = params.propertyName ? ` for ${params.propertyName}` : "";
  const firstName = params.leadName.trim().split(/\s+/)[0] ?? "there";
  const body = [
    `Hi ${firstName},`,
    "",
    `Thanks for your interest${propertyReference}. Before I can move your inquiry forward, I still need a few details:`,
    ...params.missingFieldLabels.map((label) => `- ${label}`),
    "",
    "Reply here with what you can, and I’ll keep things moving on my side.",
  ].join("\n");

  return {
    body,
    channel: params.preferredChannel,
    subject: params.propertyName
      ? `A few details for your ${params.propertyName} inquiry`
      : "A few details for your inquiry",
  };
}

function isAnswerValuePresentForChecklist(answerValue: unknown): boolean {
  if (answerValue === null || answerValue === undefined) {
    return false;
  }

  if (typeof answerValue === "string") {
    return answerValue.trim().length > 0;
  }

  if (typeof answerValue === "number") {
    return Number.isFinite(answerValue);
  }

  if (typeof answerValue === "boolean") {
    return true;
  }

  if (Array.isArray(answerValue)) {
    return answerValue.some((entry) => isAnswerValuePresentForChecklist(entry));
  }

  if (typeof answerValue === "object") {
    return Object.keys(answerValue).length > 0;
  }

  return false;
}

function resolveMissingInfoDraftChannel(params: {
  contactEmailAddress: string | null;
  contactPhoneNumber: string | null;
  lead: {
    emailOptOutAt?: Date | null;
    instagramOptOutAt?: Date | null;
    optOutAt?: Date | null;
    phone?: string | null;
    smsOptOutAt?: Date | null;
    whatsappOptOutAt?: Date | null;
  };
  leadEmailAddress: string | null;
  leadPhoneNumber: string | null;
  preferredChannel: ContactChannel | MessageChannel | null;
}) {
  const candidateChannels: MessageChannel[] = [];

  const pushCandidateChannel = (channel: MessageChannel | null) => {
    if (!channel || candidateChannels.includes(channel)) {
      return;
    }

    candidateChannels.push(channel);
  };

  let preferredMessageChannel: MessageChannel | null = null;

  if (
    params.preferredChannel === ContactChannel.EMAIL ||
    params.preferredChannel === MessageChannel.EMAIL
  ) {
    preferredMessageChannel = MessageChannel.EMAIL;
  } else if (
    params.preferredChannel === ContactChannel.SMS ||
    params.preferredChannel === MessageChannel.SMS
  ) {
    preferredMessageChannel = MessageChannel.SMS;
  }

  pushCandidateChannel(preferredMessageChannel);
  pushCandidateChannel(MessageChannel.EMAIL);
  pushCandidateChannel(MessageChannel.SMS);

  for (const candidateChannel of candidateChannels) {
    const hasChannelAddress =
      candidateChannel === MessageChannel.EMAIL
        ? Boolean(params.contactEmailAddress ?? params.leadEmailAddress)
        : Boolean(params.contactPhoneNumber ?? params.leadPhoneNumber);

    if (!hasChannelAddress) {
      continue;
    }

    if (isLeadChannelOptedOut(params.lead, candidateChannel)) {
      continue;
    }

    return candidateChannel;
  }

  return null;
}

function formatFitLabel(value: QualificationFit, locale: LeadsPageLocale = "en") {
  return getLocalizedLeadFitLabel(value, locale);
}

function formatStatusLabel(value: LeadStatus, locale: LeadsPageLocale = "en") {
  return getLocalizedLeadStatusLabel(value, locale);
}

function formatChannelLabel(value: MessageChannel) {
  return formatMessageChannelLabel(value);
}

function formatDeliveryProviderLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDeliveryStatusDisplay(deliveryStatusValue: string | null | undefined) {
  const parsedDeliveryStatus = parseDeliveryStatus(deliveryStatusValue);

  if (!parsedDeliveryStatus) {
    return null;
  }

  const detailParts = [
    parsedDeliveryStatus.provider
      ? `via ${formatDeliveryProviderLabel(parsedDeliveryStatus.provider)}`
      : null,
    parsedDeliveryStatus.scheduledFor
      ? `scheduled ${formatRelativeTime(new Date(parsedDeliveryStatus.scheduledFor))}`
      : null,
    parsedDeliveryStatus.deliveredAt
      ? `delivered ${formatRelativeTime(new Date(parsedDeliveryStatus.deliveredAt))}`
      : null,
    parsedDeliveryStatus.readAt
      ? `read ${formatRelativeTime(new Date(parsedDeliveryStatus.readAt))}`
      : null,
    parsedDeliveryStatus.retryCount && parsedDeliveryStatus.retryCount > 0
      ? `${parsedDeliveryStatus.retryCount} retr${parsedDeliveryStatus.retryCount === 1 ? "y" : "ies"}`
      : null,
  ].filter((detailPart): detailPart is string => Boolean(detailPart));

  return {
    label: formatEnumLabel(parsedDeliveryStatus.state),
    detail: detailParts.join(" | "),
    error: parsedDeliveryStatus.error ?? null,
  };
}

function formatAuditEventTitle(event: {
  eventType: string;
  payload: unknown;
}) {
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : null;
  const channelValue =
    typeof payload?.channel === "string" ? payload.channel : null;

  if (event.eventType === "lead_opted_out" && channelValue) {
    return `${formatMessageChannelLabel(channelValue as MessageChannel)} opted out`;
  }

  if (event.eventType === "lead_opted_in" && channelValue) {
    return `${formatMessageChannelLabel(channelValue as MessageChannel)} opted back in`;
  }

  if (event.eventType.includes("_")) {
    return formatEnumLabel(event.eventType);
  }

  return event.eventType;
}

function formatAuditEventDetail(event: {
  eventType: string;
  payload: unknown;
}) {
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : null;

  if (!payload) {
    return null;
  }

  if (
    (event.eventType === "lead_opted_out" || event.eventType === "lead_opted_in") &&
    typeof payload.reason === "string" &&
    payload.reason.trim().length > 0
  ) {
    return payload.reason;
  }

  if (typeof payload.reason === "string" && payload.reason.trim().length > 0) {
    return payload.reason;
  }

  return null;
}

const getWorkspaceMentionMembers = cache(async (workspaceId: string) => {
  const workspaceMembers = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return workspaceMembers.map((workspaceMember) => ({
    userId: workspaceMember.userId,
    name: workspaceMember.user.name,
    emailAddress: workspaceMember.user.email,
    membershipRole: workspaceMember.role,
  }));
});

function resolveChannelPriorityOrder(channelPriorityValue: unknown) {
  if (!Array.isArray(channelPriorityValue)) {
    return [MessageChannel.SMS, MessageChannel.EMAIL];
  }

  const parsedChannelPriorityOrder = channelPriorityValue
    .map((channelPriorityEntry) =>
      typeof channelPriorityEntry === "string"
        ? channelPriorityEntry.toUpperCase()
        : "",
    )
    .filter(
      (channelPriorityEntry) =>
        channelPriorityEntry === MessageChannel.SMS ||
        channelPriorityEntry === MessageChannel.EMAIL,
    ) as MessageChannel[];

  return parsedChannelPriorityOrder.length > 0
    ? parsedChannelPriorityOrder
    : [MessageChannel.SMS, MessageChannel.EMAIL];
}

function formatRuleMode(rule: {
  autoDecline: boolean;
  warningOnly: boolean;
  severity: RuleSeverity;
}) {
  if (rule.autoDecline) {
    return "Auto-decline";
  }

  if (rule.warningOnly || rule.severity === RuleSeverity.WARNING) {
    return "Manual review";
  }

  if (rule.severity === RuleSeverity.PREFERENCE) {
    return "Preference";
  }

  return "Required";
}

function formatStayLength(months: number | null) {
  if (!months) {
    return "Not provided";
  }

  return `${months} month${months === 1 ? "" : "s"}`;
}

function formatAnswerValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatAnswerValue(entry)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "Not provided";
}

function describeTemplateType(type: TemplateType) {
  switch (type) {
    case TemplateType.INITIAL_REPLY:
      return "Starts the qualification conversation.";
    case TemplateType.SCREENING_INVITE:
      return "Invites a new lead into the formal screening flow.";
    case TemplateType.MISSING_INFO_FOLLOW_UP:
      return "Collects missing move-in, budget, or rule answers.";
    case TemplateType.TOUR_CONFIRMATION:
      return "Confirms the scheduling handoff for qualified leads.";
    case TemplateType.TOUR_INVITE:
      return "Invites a qualified lead to pick a tour time.";
    case TemplateType.APPLICATION_INVITE:
      return "Invites a lead into the application step.";
    case TemplateType.HOUSE_RULES_ACKNOWLEDGMENT:
      return "Confirms shared-house expectations before move-in.";
    case TemplateType.ONBOARDING:
      return "Welcomes an approved resident into the onboarding flow.";
    case TemplateType.DECLINE:
      return "Closes the loop when a lead misses a required rule.";
    case TemplateType.WAITLIST_NOTICE:
      return "Keeps viable leads warm when no room is immediately available.";
    case TemplateType.REMINDER:
      return "Keeps slow-moving leads from stalling.";
    default:
      return "Reusable message copy.";
  }
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysAgo(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
}

function resolveSourceSummaryLabel(leadSourceName: string | null | undefined) {
  const trimmedLeadSourceName = leadSourceName?.trim();

  if (trimmedLeadSourceName) {
    return trimmedLeadSourceName;
  }

  return "Unattributed";
}

type SessionUser = {
  id: string;
  email: string;
  emailVerified?: boolean | null;
  name?: string | null;
};

function resolveAuthenticatedRedirectPath(params: {
  emailAddress: string;
  emailVerified?: boolean | null;
  onboardingComplete: boolean;
}) {
  if (!params.emailVerified) {
    return buildEmailVerificationPagePath({
      emailAddress: params.emailAddress,
      nextPath: params.onboardingComplete ? "/app" : "/onboarding",
    });
  }

  return params.onboardingComplete ? "/app" : "/onboarding";
}

async function getCurrentUser() {
  const session = await getServerSession();

  if (!session?.user) {
    throw new Error("Authenticated session is required.");
  }

  return session.user as SessionUser;
}

export const getCurrentWorkspaceState = cache(async () => {
  const user = await getCurrentUser();
  const membership = await getCurrentWorkspaceMembership();

  return {
    user,
    membership,
    workspace: membership.workspace,
    onboardingComplete: Boolean(membership.workspace.onboardingCompletedAt),
  };
});

export const getAuthenticatedRedirectPath = cache(async () => {
  const workspaceState = await getCurrentWorkspaceState();

  return resolveAuthenticatedRedirectPath({
    emailAddress: workspaceState.user.email,
    emailVerified: workspaceState.user.emailVerified,
    onboardingComplete: workspaceState.onboardingComplete,
  });
});

export const getCurrentWorkspaceMembership = cache(async () => {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get(activeWorkspaceCookieName)?.value;

  await ensureWorkspaceForUser(user);

  const workspaceMemberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
    },
    include: {
      workspace: {
        include: {
          billingOwner: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const selectedWorkspaceMembership =
    workspaceMemberships.find(
      (workspaceMembership) => workspaceMembership.workspaceId === preferredWorkspaceId,
    ) ?? workspaceMemberships[0];

  if (!selectedWorkspaceMembership) {
    throw new Error("Authenticated workspace membership is required.");
  }

  return selectedWorkspaceMembership;
});

export const getWorkspaceSwitcherData = cache(async () => {
  const user = await getCurrentUser();
  const activeWorkspaceMembership = await getCurrentWorkspaceMembership();

  const workspaceMemberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    activeWorkspaceId: activeWorkspaceMembership.workspaceId,
    workspaces: workspaceMemberships.map((workspaceMembership) => ({
      membershipRole: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
      workspaceName: workspaceMembership.workspace.name,
      workspaceSlug: workspaceMembership.workspace.slug,
    })),
  };
});

export const getAppShellData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const qualifiedStatuses = [
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ];

  const propertyCount = await prisma.property.count({
    where: {
      workspaceId: membership.workspaceId,
    },
  });
  const activeLeadCount = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      status: {
        notIn: [LeadStatus.ARCHIVED, LeadStatus.CLOSED],
      },
    },
  });
  const qualifiedLeadCount = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      status: {
        in: qualifiedStatuses,
      },
    },
  });

  return {
    workspaceName: membership.workspace.name,
    workspaceSummary: `${propertyCount} properties, ${activeLeadCount} active leads, ${qualifiedLeadCount} qualified or tour-ready.`,
  };
});

export const getDashboardViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const propertyCount = await prisma.property.count({
    where: {
      workspaceId: membership.workspaceId,
    },
  });
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const startToday = startOfDay(new Date());
  const startYesterday = daysAgo(1);
  startYesterday.setHours(0, 0, 0, 0);

  const newToday = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      createdAt: {
        gte: startToday,
      },
    },
  });
  const newYesterday = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      createdAt: {
        gte: startYesterday,
        lt: startToday,
      },
    },
  });
  const awaitingResponse = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      status: LeadStatus.AWAITING_RESPONSE,
    },
  });
  const qualified = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      status: {
        in: [
          LeadStatus.QUALIFIED,
          LeadStatus.TOUR_SCHEDULED,
          LeadStatus.APPLICATION_SENT,
        ],
      },
    },
  });
  const declined = await prisma.lead.count({
    where: {
      workspaceId: membership.workspaceId,
      status: LeadStatus.DECLINED,
    },
  });
  const recentEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 4,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
    },
  });
  const summaryLeads = await prisma.lead.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      fitResult: true,
      declineReason: true,
      leadSource: {
        select: {
          name: true,
        },
      },
    },
  });
  const statusHistory = await prisma.leadStatusHistory.findMany({
    where: {
      lead: {
        workspaceId: membership.workspaceId,
      },
    },
    select: {
      leadId: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    },
  });
  const kpiAuditEvents = await prisma.auditEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    select: {
      leadId: true,
      eventType: true,
      createdAt: true,
    },
    take: 500,
    orderBy: {
      createdAt: "desc",
    },
  });
  const latestUsageSnapshot = await prisma.workspaceUsageSnapshot.findFirst({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: {
      snapshotDate: "desc",
    },
  });
  const workspaceAiArtifacts = hasAiAssist
    ? await prisma.auditEvent.findMany({
        where: {
          workspaceId: membership.workspaceId,
          eventType: "ai_artifact_generated",
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          eventType: true,
          payload: true,
        },
      })
    : [];
  const staleLeads = hasAiAssist
    ? await prisma.lead.findMany({
        where: {
          workspaceId: membership.workspaceId,
          isStale: true,
        },
        include: {
          auditEvents: {
            where: {
              eventType: "ai_artifact_generated",
            },
            orderBy: {
              createdAt: "asc",
            },
            select: {
              createdAt: true,
              eventType: true,
              payload: true,
            },
          },
        },
        orderBy: {
          staleAt: "desc",
        },
        take: 6,
      })
    : [];

  const newLeadDelta = newToday - newYesterday;
  const statusCounts = new Map<LeadStatus, number>();
  const sourceCounts = new Map<string, number>();
  let unattributedSourceLeadCount = 0;

  for (const lead of summaryLeads) {
    statusCounts.set(lead.status, (statusCounts.get(lead.status) ?? 0) + 1);

    const sourceName = resolveSourceSummaryLabel(lead.leadSource?.name);

    if (sourceName === "Unattributed") {
      unattributedSourceLeadCount += 1;
    }

    sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
  }

  const derivedWorkflowKpis = deriveWorkflowKpis({
    leads: summaryLeads.map((lead) => ({
      id: lead.id,
      createdAt: lead.createdAt,
      leadSourceName: lead.leadSource?.name ?? null,
      fitResult: lead.fitResult,
      declineReason: lead.declineReason,
    })),
    statusHistory,
    auditEvents: kpiAuditEvents,
  });

  if (unattributedSourceLeadCount > 0) {
    console.warn(
      `[dashboard-source-summary] workspace ${membership.workspaceId} has ${unattributedSourceLeadCount} lead(s) without an assigned source label.`,
    );
  }

  return {
    hasAiAssist,
    propertyCount,
    metrics: [
      {
        label: "New leads today",
        value: String(newToday),
        delta:
          newLeadDelta === 0
            ? "Flat vs. yesterday"
            : `${newLeadDelta > 0 ? "+" : ""}${newLeadDelta} vs. yesterday`,
      },
      {
        label: "Awaiting response",
        value: String(awaitingResponse),
        delta:
          awaitingResponse === 0
            ? "Queue is clear"
            : `${awaitingResponse} need follow-up`,
      },
      {
        label: "Qualified leads",
        value: String(qualified),
        delta:
          qualified === 0
            ? "No tour-ready leads yet"
            : `${qualified} ready for a next action`,
      },
      {
        label: "Declined leads",
        value: String(declined),
        delta:
          declined === 0
            ? "No rule mismatches"
            : "Rule mismatch or house-rule decline",
      },
    ],
    recentActivity: recentEvents.map((event) => ({
      id: event.id,
      label: event.eventType,
      at: formatRelativeTime(event.createdAt),
    })),
    sourceSummaries: [...sourceCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => ({
        label,
        value: count,
      })),
    statusSummaries: [...statusCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label, count]) => ({
        label: formatStatusLabel(label),
        value: count,
      })),
    implementationChecklist: [
      "Better Auth session flow is live",
      "Workspace bootstrap runs on signup",
      "Seeded Prisma data powers the main routes",
      "Protected app shell is using current user state",
      "Lead detail reads answers, messages, and history from Postgres",
      "Templates and property rules are workspace-scoped records",
    ],
    kpiHighlights: [
      `Avg first response: ${Math.round(derivedWorkflowKpis.averageTimeToFirstResponseMinutes)} min`,
      `Qualification completion: ${Math.round(derivedWorkflowKpis.qualificationCompletionRate)}%`,
      `Inquiry->tour: ${Math.round(derivedWorkflowKpis.inquiryToTourConversionRate)}%`,
      `Inquiry->application: ${Math.round(derivedWorkflowKpis.inquiryToApplicationConversionRate)}%`,
    ],
    planWarnings:
      latestUsageSnapshot &&
      latestUsageSnapshot.activeProperties > 10
        ? ["Property count is above the soft starter-plan threshold (10)."]
        : [],
    portfolioInsights: formatAiArtifactView(
      findLatestAiArtifact({
        artifactKind: "portfolio_insights",
        auditEvents: workspaceAiArtifacts,
        schema: portfolioInsightsSchema,
      }),
    ),
    staleLeadRecommendations: staleLeads.map((lead) => ({
      id: lead.id,
      name: lead.fullName,
      staleAt: formatRelativeTime(lead.staleAt),
      status: formatStatusLabel(lead.status),
      recommendation: formatAiArtifactView(
        findLatestAiArtifact({
          artifactKind: "lead_insights",
          auditEvents: lead.auditEvents,
          schema: leadAiInsightsSchema,
        }),
      ),
    })),
    seedWindowLabel: `Demo data compares today (${formatDate(startToday)}) against yesterday (${formatDate(startYesterday)}).`,
  };
});

const analyticsTimeWindowOptions = [
  {
    value: "7d",
    label: "Last 7 days",
    days: 7,
  },
  {
    value: "30d",
    label: "Last 30 days",
    days: 30,
  },
  {
    value: "90d",
    label: "Last 90 days",
    days: 90,
  },
  {
    value: "all",
    label: "All time",
    days: null,
  },
] as const;

const analyticsReportPresets = [
  {
    value: "overview",
    label: "Overview",
    description: "Portfolio-wide funnel, property, and stale lead health.",
  },
  {
    value: "sources",
    label: "Source quality",
    description: "Compare listing channels and campaigns by fit and conversion.",
  },
  {
    value: "friction",
    label: "Rule friction",
    description: "Surface the rules and required questions that most often slow progression.",
  },
  {
    value: "team",
    label: "Team ops",
    description: "Review ownership, workload, AI usage, and integration health in one pass.",
  },
] as const;

function resolveAnalyticsTimeWindow(value: string | undefined) {
  const selectedTimeWindow =
    analyticsTimeWindowOptions.find((timeWindowOption) => timeWindowOption.value === value) ??
    analyticsTimeWindowOptions[1];

  return {
    ...selectedTimeWindow,
    startDate:
      selectedTimeWindow.days === null
        ? null
        : startOfDay(daysAgo(selectedTimeWindow.days)),
  };
}

function formatPercentValue(value: number) {
  return `${Math.round(value)}%`;
}

function resolveRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function buildScopedTaskAccessFilter(scopedPropertyIds: string[] | null) {
  if (!scopedPropertyIds) {
    return {};
  }

  return {
    OR: [
      {
        propertyId: null,
      },
      {
        propertyId: {
          in: scopedPropertyIds,
        },
      },
    ],
  };
}

function resolveAuditPayloadObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function resolvePayloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolvePayloadString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export const getAnalyticsViewData = cache(async (timeWindowValue = "30d") => {
  const membership = await getCurrentWorkspaceMembership();
  const hasAdvancedAnalytics = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ADVANCED_ANALYTICS,
  );
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const canViewTeamMetrics = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  );
  const timeWindow = resolveAnalyticsTimeWindow(timeWindowValue);
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const scopedLeadAccessFilter = buildScopedLeadAccessFilter(scopedPropertyIds);
  const scopedPropertyAccessFilter = buildScopedPropertyAccessFilter(scopedPropertyIds);
  const scopedTaskAccessFilter = buildScopedTaskAccessFilter(scopedPropertyIds);

  const [
    accessibleProperties,
    leads,
    memberships,
    tasks,
    auditEvents,
    integrationConnections,
    latestUsageSnapshot,
    staleLeads,
  ] = await Promise.all([
    prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...scopedPropertyAccessFilter,
      },
      select: {
        id: true,
        name: true,
        lifecycleStatus: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.lead.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...scopedLeadAccessFilter,
        ...(timeWindow.startDate
          ? {
              createdAt: {
                gte: timeWindow.startDate,
              },
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        status: true,
        fitResult: true,
        declineReason: true,
        isStale: true,
        staleAt: true,
        applicationInviteSentAt: true,
        assignedMembershipId: true,
        propertyId: true,
        property: {
          select: {
            name: true,
          },
        },
        leadSource: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.membership.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.task.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...scopedTaskAccessFilter,
      },
      select: {
        assignedMembershipId: true,
        completedAt: true,
        createdAt: true,
        dueAt: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...(timeWindow.startDate
          ? {
              createdAt: {
                gte: timeWindow.startDate,
              },
            }
          : {}),
      },
      select: {
        actorUserId: true,
        createdAt: true,
        eventType: true,
        payload: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.integrationConnection.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      select: {
        authState: true,
        displayName: true,
        enabled: true,
        healthMessage: true,
        healthState: true,
        lastSyncAt: true,
        lastSyncMessage: true,
        provider: true,
        syncStatus: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.workspaceUsageSnapshot.findFirst({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        snapshotDate: "desc",
      },
    }),
    prisma.lead.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...scopedLeadAccessFilter,
        isStale: true,
      },
      select: {
        id: true,
        fullName: true,
        staleAt: true,
        status: true,
        property: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        staleAt: "desc",
      },
      take: 8,
    }),
  ]);

  const accessiblePropertyIds = accessibleProperties.map((property) => property.id);
  const leadIds = leads.map((lead) => lead.id);

  const [tourEvents, propertyRules, requiredQuestions, answers] = await Promise.all([
    leadIds.length > 0
      ? prisma.tourEvent.findMany({
          where: {
            workspaceId: membership.workspaceId,
            leadId: {
              in: leadIds,
            },
          },
          select: {
            leadId: true,
          },
          distinct: ["leadId"],
        })
      : Promise.resolve([]),
    accessiblePropertyIds.length > 0
      ? prisma.propertyRule.findMany({
          where: {
            propertyId: {
              in: accessiblePropertyIds,
            },
          },
          select: {
            id: true,
            label: true,
            propertyId: true,
          },
        })
      : Promise.resolve([]),
    accessiblePropertyIds.length > 0
      ? prisma.qualificationQuestion.findMany({
          where: {
            required: true,
            questionSet: {
              propertyId: {
                in: accessiblePropertyIds,
              },
            },
          },
          select: {
            id: true,
            label: true,
            questionSet: {
              select: {
                propertyId: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    leadIds.length > 0
      ? prisma.qualificationAnswer.findMany({
          where: {
            leadId: {
              in: leadIds,
            },
          },
          select: {
            leadId: true,
            questionId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const qualifiedStatuses = new Set<LeadStatus>([
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ]);
  const activeOwnershipStatuses = new Set<LeadStatus>([
    LeadStatus.NEW,
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.CAUTION,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ]);
  const leadIdsWithTours = new Set(tourEvents.map((tourEvent) => tourEvent.leadId));
  const propertyNameById = new Map(accessibleProperties.map((property) => [property.id, property.name]));
  const propertyRuleLabelById = new Map(propertyRules.map((propertyRule) => [propertyRule.id, propertyRule.label]));
  const questionAnswersKey = new Set(answers.map((answer) => `${answer.leadId}:${answer.questionId}`));
  const requiredQuestionsByPropertyId = new Map<
    string,
    Array<(typeof requiredQuestions)[number]>
  >();

  for (const requiredQuestion of requiredQuestions) {
    const propertyId = requiredQuestion.questionSet.propertyId;

    if (!requiredQuestionsByPropertyId.has(propertyId)) {
      requiredQuestionsByPropertyId.set(propertyId, []);
    }

    requiredQuestionsByPropertyId.get(propertyId)?.push(requiredQuestion);
  }

  const inquiryCount = leads.length;
  const qualifiedLeadCount = leads.filter((lead) => qualifiedStatuses.has(lead.status)).length;
  const touredLeadCount = leads.filter((lead) => leadIdsWithTours.has(lead.id)).length;
  const applicationLeadCount = leads.filter(
    (lead) => Boolean(lead.applicationInviteSentAt) || lead.status === LeadStatus.APPLICATION_SENT,
  ).length;
  const staleLeadCount = staleLeads.length;

  const sourceRows = [...leads.reduce((sourceMap, lead) => {
    const sourceLabel = resolveSourceSummaryLabel(lead.leadSource?.name);
    const existingRow = sourceMap.get(sourceLabel) ?? {
      label: sourceLabel,
      sourceTypeLabel: lead.leadSource?.type ? formatEnumLabel(lead.leadSource.type) : "Other",
      inquiries: 0,
      qualifiedCount: 0,
      touredCount: 0,
      applicationCount: 0,
      mismatchCount: 0,
      cautionCount: 0,
    };

    existingRow.inquiries += 1;

    if (qualifiedStatuses.has(lead.status)) {
      existingRow.qualifiedCount += 1;
    }

    if (leadIdsWithTours.has(lead.id)) {
      existingRow.touredCount += 1;
    }

    if (lead.applicationInviteSentAt || lead.status === LeadStatus.APPLICATION_SENT) {
      existingRow.applicationCount += 1;
    }

    if (lead.fitResult === QualificationFit.MISMATCH) {
      existingRow.mismatchCount += 1;
    }

    if (lead.fitResult === QualificationFit.CAUTION) {
      existingRow.cautionCount += 1;
    }

    sourceMap.set(sourceLabel, existingRow);
    return sourceMap;
  }, new Map<string, {
    label: string;
    sourceTypeLabel: string;
    inquiries: number;
    qualifiedCount: number;
    touredCount: number;
    applicationCount: number;
    mismatchCount: number;
    cautionCount: number;
  }>()).values()]
    .map((sourceRow) => ({
      ...sourceRow,
      applicationRate: formatPercentValue(resolveRate(sourceRow.applicationCount, sourceRow.inquiries)),
      qualifiedRate: formatPercentValue(resolveRate(sourceRow.qualifiedCount, sourceRow.inquiries)),
      touredRate: formatPercentValue(resolveRate(sourceRow.touredCount, sourceRow.inquiries)),
    }))
    .sort((leftSourceRow, rightSourceRow) => rightSourceRow.inquiries - leftSourceRow.inquiries);

  const propertyRows = accessibleProperties
    .map((property) => {
      const propertyLeads = leads.filter((lead) => lead.propertyId === property.id);
      const propertyInquiryCount = propertyLeads.length;
      const propertyQualifiedCount = propertyLeads.filter((lead) => qualifiedStatuses.has(lead.status)).length;
      const propertyTourCount = propertyLeads.filter((lead) => leadIdsWithTours.has(lead.id)).length;
      const propertyApplicationCount = propertyLeads.filter(
        (lead) => Boolean(lead.applicationInviteSentAt) || lead.status === LeadStatus.APPLICATION_SENT,
      ).length;
      const propertyStaleCount = propertyLeads.filter((lead) => lead.isStale).length;

      return {
        id: property.id,
        inquiries: propertyInquiryCount,
        lifecycleStatus: formatPropertyLifecycleStatus(property.lifecycleStatus),
        name: property.name,
        qualificationRate: formatPercentValue(resolveRate(propertyQualifiedCount, propertyInquiryCount)),
        staleCount: propertyStaleCount,
        topSource:
          sourceRows.find((sourceRow) =>
            propertyLeads.some((lead) => resolveSourceSummaryLabel(lead.leadSource?.name) === sourceRow.label),
          )?.label ?? "No attributed source",
        tourRate: formatPercentValue(resolveRate(propertyTourCount, propertyInquiryCount)),
        applicationRate: formatPercentValue(resolveRate(propertyApplicationCount, propertyInquiryCount)),
      };
    })
    .sort((leftPropertyRow, rightPropertyRow) => rightPropertyRow.inquiries - leftPropertyRow.inquiries);

  const triggeredRuleRowsMap = new Map<string, {
    label: string;
    categoryLabel: string;
    modeLabel: string;
    explanation: string;
    count: number;
  }>();
  let missingRequiredQuestionEvaluationCount = 0;

  for (const auditEvent of auditEvents) {
    if (auditEvent.eventType !== "fit_computed") {
      continue;
    }

    const payload = resolveAuditPayloadObject(auditEvent.payload);
    const missingRequiredQuestionCount = resolvePayloadNumber(payload?.missingRequiredQuestionCount);

    if (missingRequiredQuestionCount && missingRequiredQuestionCount > 0) {
      missingRequiredQuestionEvaluationCount += 1;
    }

    const ruleEvaluation = resolveAuditPayloadObject(payload?.ruleEvaluation);
    const issues = Array.isArray(ruleEvaluation?.issues) ? ruleEvaluation.issues : [];

    for (const issueValue of issues) {
      const issue = resolveAuditPayloadObject(issueValue);

      if (!issue || issue.triggered !== true) {
        continue;
      }

      const ruleId = resolvePayloadString(issue.ruleId) ?? `${resolvePayloadString(issue.category) ?? "unknown"}:${resolvePayloadString(issue.mode) ?? "unknown"}`;
      const nextRow = triggeredRuleRowsMap.get(ruleId) ?? {
        label:
          (resolvePayloadString(issue.ruleId) && propertyRuleLabelById.get(resolvePayloadString(issue.ruleId) as string)) ??
          resolvePayloadString(issue.explanation) ??
          "Triggered rule",
        categoryLabel: formatEnumLabel(resolvePayloadString(issue.category) ?? "general"),
        modeLabel: formatEnumLabel(resolvePayloadString(issue.mode) ?? "warning_only"),
        explanation: resolvePayloadString(issue.explanation) ?? "No explanation recorded.",
        count: 0,
      };

      nextRow.count += 1;
      triggeredRuleRowsMap.set(ruleId, nextRow);
    }
  }

  const missingQuestionRowsMap = new Map<string, {
    label: string;
    propertyName: string;
    count: number;
  }>();

  for (const lead of leads) {
    if (!lead.propertyId) {
      continue;
    }

    const propertyQuestions = requiredQuestionsByPropertyId.get(lead.propertyId) ?? [];

    for (const requiredQuestion of propertyQuestions) {
      if (questionAnswersKey.has(`${lead.id}:${requiredQuestion.id}`)) {
        continue;
      }

      const questionKey = `${lead.propertyId}:${requiredQuestion.id}`;
      const questionRow = missingQuestionRowsMap.get(questionKey) ?? {
        label: requiredQuestion.label,
        propertyName: propertyNameById.get(lead.propertyId) ?? "Unknown property",
        count: 0,
      };

      questionRow.count += 1;
      missingQuestionRowsMap.set(questionKey, questionRow);
    }
  }

  const teamRows = memberships
    .map((workspaceMembership) => {
      const ownedLeads = leads.filter(
        (lead) =>
          lead.assignedMembershipId === workspaceMembership.id &&
          activeOwnershipStatuses.has(lead.status),
      ).length;
      const openTasks = tasks.filter(
        (task) =>
          task.assignedMembershipId === workspaceMembership.id &&
          task.status !== TaskStatus.COMPLETED &&
          task.status !== TaskStatus.CANCELED,
      );
      const completedTasks = tasks.filter(
        (task) =>
          task.assignedMembershipId === workspaceMembership.id &&
          task.completedAt &&
          (!timeWindow.startDate || task.completedAt >= timeWindow.startDate),
      ).length;
      const actionsLogged = auditEvents.filter(
        (auditEvent) => auditEvent.actorUserId === workspaceMembership.userId,
      ).length;

      return {
        id: workspaceMembership.id,
        actionsLogged,
        completedTasks,
        name: workspaceMembership.user.name,
        openTasks: openTasks.length,
        overdueTasks: openTasks.filter((task) => resolveTaskIsOverdue(task.dueAt, task.status)).length,
        ownedLeads,
        roleLabel: formatEnumLabel(workspaceMembership.role),
      };
    })
    .sort(
      (leftTeamRow, rightTeamRow) =>
        rightTeamRow.ownedLeads + rightTeamRow.openTasks + rightTeamRow.actionsLogged -
        (leftTeamRow.ownedLeads + leftTeamRow.openTasks + leftTeamRow.actionsLogged),
    );

  const aiUsageByKindMap = new Map<string, {
    appliedCount: number;
    failedCount: number;
    generatedCount: number;
    readyCount: number;
  }>();
  let generatedAiArtifactCount = 0;
  let readyAiArtifactCount = 0;
  let failedAiArtifactCount = 0;
  let appliedAiArtifactCount = 0;

  for (const auditEvent of auditEvents) {
    if (auditEvent.eventType !== "ai_artifact_generated" && auditEvent.eventType !== "ai_artifact_applied") {
      continue;
    }

    const payload = resolveAuditPayloadObject(auditEvent.payload);
    const artifactKind = resolvePayloadString(payload?.artifactKind) ?? "unknown";
    const nextRow = aiUsageByKindMap.get(artifactKind) ?? {
      appliedCount: 0,
      failedCount: 0,
      generatedCount: 0,
      readyCount: 0,
    };

    if (auditEvent.eventType === "ai_artifact_applied") {
      nextRow.appliedCount += 1;
      appliedAiArtifactCount += 1;
    } else {
      generatedAiArtifactCount += 1;
      nextRow.generatedCount += 1;

      if (payload?.status === "failed") {
        failedAiArtifactCount += 1;
        nextRow.failedCount += 1;
      }

      if (payload?.status === "ready") {
        readyAiArtifactCount += 1;
        nextRow.readyCount += 1;
      }
    }

    aiUsageByKindMap.set(artifactKind, nextRow);
  }

  const integrationRows = integrationConnections
    .map((integrationConnection) => ({
      displayName: integrationConnection.displayName,
      healthLabel: formatEnumLabel(integrationConnection.healthState),
      providerLabel: formatEnumLabel(integrationConnection.provider),
      setupSummary: formatIntegrationConnectionSummary({
        authState: integrationConnection.authState,
        enabled: integrationConnection.enabled,
        healthMessage: integrationConnection.healthMessage,
        lastSyncMessage: integrationConnection.lastSyncMessage,
        syncStatus: integrationConnection.syncStatus,
      }),
      syncLabel: formatEnumLabel(integrationConnection.syncStatus),
      updatedAtLabel: formatRelativeTime(integrationConnection.lastSyncAt),
    }))
    .sort((leftIntegrationRow, rightIntegrationRow) =>
      leftIntegrationRow.providerLabel.localeCompare(rightIntegrationRow.providerLabel),
    );

  const healthyIntegrationCount = integrationConnections.filter(
    (integrationConnection) => integrationConnection.healthState === IntegrationHealthState.HEALTHY,
  ).length;
  const degradedIntegrationCount = integrationConnections.filter(
    (integrationConnection) => integrationConnection.healthState === IntegrationHealthState.DEGRADED,
  ).length;
  const errorIntegrationCount = integrationConnections.filter(
    (integrationConnection) => integrationConnection.healthState === IntegrationHealthState.ERROR,
  ).length;
  const setupNeededIntegrationCount = integrationConnections.filter(
    (integrationConnection) =>
      integrationConnection.authState === IntegrationAuthState.NOT_CONNECTED ||
      integrationConnection.enabled === false,
  ).length;

  return {
    currentWindowLabel: timeWindow.label,
    hasAdvancedAnalytics,
    hasAiAssist,
    canViewTeamMetrics,
    timeWindow: {
      label: timeWindow.label,
      value: timeWindow.value,
    },
    timeWindowOptions: analyticsTimeWindowOptions.map((timeWindowOption) => ({
      label: timeWindowOption.label,
      value: timeWindowOption.value,
    })),
    reportPresets: analyticsReportPresets,
    summaryCards: [
      {
        label: "Inquiries",
        value: String(inquiryCount),
        detail: `${timeWindow.label} lead volume`,
      },
      {
        label: "Qualified rate",
        value: formatPercentValue(resolveRate(qualifiedLeadCount, inquiryCount)),
        detail: `${qualifiedLeadCount} leads moved into qualified stages`,
      },
      {
        label: "Tour conversion",
        value: formatPercentValue(resolveRate(touredLeadCount, inquiryCount)),
        detail: `${touredLeadCount} leads reached scheduling`,
      },
      {
        label: "Application conversion",
        value: formatPercentValue(resolveRate(applicationLeadCount, inquiryCount)),
        detail: `${applicationLeadCount} leads reached application handoff`,
      },
      {
        label: "Current stale leads",
        value: String(staleLeadCount),
        detail: staleLeadCount === 0 ? "No leads are flagged stale" : "Visible across the current workspace scope",
      },
      {
        label: "Top source",
        value: sourceRows[0]?.label ?? "None",
        detail: sourceRows[0] ? `${sourceRows[0].inquiries} inquiries in ${timeWindow.label.toLowerCase()}` : "No attributed sources yet",
      },
    ],
    funnelSteps: [
      {
        label: "Inquiries",
        count: inquiryCount,
        rateLabel: formatPercentValue(resolveRate(inquiryCount, inquiryCount || 1)),
      },
      {
        label: "Qualified",
        count: qualifiedLeadCount,
        rateLabel: formatPercentValue(resolveRate(qualifiedLeadCount, inquiryCount)),
      },
      {
        label: "Tour reached",
        count: touredLeadCount,
        rateLabel: formatPercentValue(resolveRate(touredLeadCount, inquiryCount)),
      },
      {
        label: "Application sent",
        count: applicationLeadCount,
        rateLabel: formatPercentValue(resolveRate(applicationLeadCount, inquiryCount)),
      },
    ],
    sourceRows,
    ruleFriction: {
      evaluationsWithMissingQuestions: missingRequiredQuestionEvaluationCount,
      topRules: [...triggeredRuleRowsMap.values()]
        .sort((leftRuleRow, rightRuleRow) => rightRuleRow.count - leftRuleRow.count)
        .slice(0, 6),
      topMissingQuestions: [...missingQuestionRowsMap.values()]
        .sort((leftQuestionRow, rightQuestionRow) => rightQuestionRow.count - leftQuestionRow.count)
        .slice(0, 6),
    },
    propertyRows,
    staleLeadRows: staleLeads.map((lead) => ({
      id: lead.id,
      name: lead.fullName,
      propertyName: lead.property?.name ?? "Unassigned",
      staleAtLabel: formatRelativeTime(lead.staleAt),
      statusLabel: formatStatusLabel(lead.status),
    })),
    teamRows,
    aiUsage: {
      acceptanceRateLabel: formatPercentValue(resolveRate(appliedAiArtifactCount, readyAiArtifactCount)),
      appliedCount: appliedAiArtifactCount,
      failedCount: failedAiArtifactCount,
      generatedCount: generatedAiArtifactCount,
      readyCount: readyAiArtifactCount,
      rows: [...aiUsageByKindMap.entries()]
        .map(([artifactKind, usageRow]) => ({
          artifactKindLabel: formatEnumLabel(artifactKind),
          ...usageRow,
          acceptanceRateLabel: formatPercentValue(resolveRate(usageRow.appliedCount, usageRow.readyCount)),
        }))
        .sort((leftUsageRow, rightUsageRow) => rightUsageRow.generatedCount - leftUsageRow.generatedCount),
    },
    integrationHealth: {
      degradedCount: degradedIntegrationCount,
      errorCount: errorIntegrationCount,
      healthyCount: healthyIntegrationCount,
      rows: integrationRows,
      setupNeededCount: setupNeededIntegrationCount,
    },
    latestUsageSnapshot: latestUsageSnapshot
      ? {
          activeProperties: latestUsageSnapshot.activeProperties,
          automationSends: latestUsageSnapshot.automationSends,
          monthlyLeads: latestUsageSnapshot.monthlyLeads,
          seats: latestUsageSnapshot.seats,
          snapshotDateLabel: formatDate(latestUsageSnapshot.snapshotDate),
        }
      : null,
  };
});

export const getWorkspacePlanUsageData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();

  const [membershipCount, messageTemplateCount, propertyCount] = await Promise.all([
    prisma.membership.count({
      where: {
        workspaceId: membership.workspaceId,
      },
    }),
    prisma.messageTemplate.count({
      where: {
        workspaceId: membership.workspaceId,
      },
    }),
    prisma.property.count({
      where: {
        workspaceId: membership.workspaceId,
      },
    }),
  ]);

  return {
    memberships: membershipCount,
    messageTemplates: messageTemplateCount,
    properties: propertyCount,
  };
});

export const getWorkspaceBillingOwnerTransferData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();

  const eligibleMemberships = await prisma.membership.findMany({
    where: {
      workspaceId: membership.workspaceId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    billingOwnerUserId: membership.workspace.billingOwnerUserId,
    candidates: eligibleMemberships.map((eligibleMembership) => ({
      membershipRole: eligibleMembership.role,
      userEmailAddress: eligibleMembership.user.email,
      userId: eligibleMembership.userId,
      userName: eligibleMembership.user.name,
    })),
  };
});

export type LeadListFilter =
  | "all"
  | "awaiting-response"
  | "archived"
  | "review"
  | "qualified"
  | "unassigned"
  | "overdue";

export type LeadListSort =
  | "last-activity-desc"
  | "last-activity-asc"
  | "name-asc"
  | "name-desc"
  | "property-asc"
  | "property-desc"
  | "assignee-asc"
  | "assignee-desc"
  | "move-in-asc"
  | "move-in-desc"
  | "budget-high"
  | "budget-low";

function buildLeadListSortOrder(sort: LeadListSort) {
  switch (sort) {
    case "assignee-asc":
      return [
        {
          assignedMembership: {
            user: {
              name: "asc" as const,
            },
          },
        },
        {
          fullName: "asc" as const,
        },
      ];
    case "assignee-desc":
      return [
        {
          assignedMembership: {
            user: {
              name: "desc" as const,
            },
          },
        },
        {
          fullName: "asc" as const,
        },
      ];
    case "budget-high":
      return [
        {
          monthlyBudget: "desc" as const,
        },
        {
          lastActivityAt: "desc" as const,
        },
      ];
    case "budget-low":
      return [
        {
          monthlyBudget: "asc" as const,
        },
        {
          lastActivityAt: "desc" as const,
        },
      ];
    case "move-in-asc":
      return [
        {
          moveInDate: "asc" as const,
        },
        {
          lastActivityAt: "desc" as const,
        },
      ];
    case "move-in-desc":
      return [
        {
          moveInDate: "desc" as const,
        },
        {
          lastActivityAt: "desc" as const,
        },
      ];
    case "name-asc":
      return [
        {
          fullName: "asc" as const,
        },
      ];
    case "name-desc":
      return [
        {
          fullName: "desc" as const,
        },
      ];
    case "property-asc":
      return [
        {
          property: {
            name: "asc" as const,
          },
        },
        {
          fullName: "asc" as const,
        },
      ];
    case "property-desc":
      return [
        {
          property: {
            name: "desc" as const,
          },
        },
        {
          fullName: "asc" as const,
        },
      ];
    case "last-activity-asc":
      return [
        {
          lastActivityAt: "asc" as const,
        },
        {
          createdAt: "asc" as const,
        },
      ];
    case "last-activity-desc":
    default:
      return [
        {
          lastActivityAt: "desc" as const,
        },
        {
          createdAt: "desc" as const,
        },
      ];
  }
}

export async function getLeadListViewData(params?: {
  filter?: LeadListFilter;
  fit?: QualificationFit;
  locale?: LeadsPageLocale;
  page?: number;
  pageSize?: number;
  property?: string;
  query?: string;
  source?: string;
  assignment?: string;
  status?: LeadStatus;
  showArchived?: boolean;
  sort?: LeadListSort;
}) {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const activeFilter = params?.filter ?? "all";
  const activeWorkflowFilters: LeadListWorkflowFilters = {
    assignment: params?.assignment?.trim() || undefined,
    fit: params?.fit,
    property: params?.property?.trim() || undefined,
    source: params?.source?.trim() || undefined,
    status: params?.status,
  };
  const activeQuery = params?.query?.trim() ?? "";
  const locale = params?.locale ?? "en";
  const leadsPageCopy = getLeadsPageCopy(locale);
  const showArchived = (params?.showArchived ?? false) || activeFilter === "archived";
  const pageSize =
    params?.pageSize && [5, 10, 25, 50].includes(params.pageSize)
      ? params.pageSize
      : 10;
  const roleActionPermissions = getLeadActionPermissionsForMembershipRole(
    membership.role,
  );
  const hasOrgMembersCapability = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  );
  const canAssignLeadOwner =
    roleActionPermissions.assignProperty &&
    hasOrgMembersCapability;
  const assignableMemberships = hasOrgMembersCapability
    ? await prisma.membership.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];
  const assignmentOptions = [
    {
      label: leadsPageCopy.common.unassigned,
      summary: leadsPageCopy.common.sharedInboxOwnershipRemainsOpen,
      value: "unassigned",
    },
    ...assignableMemberships.map((workspaceMembership) => ({
      label: workspaceMembership.user.name ?? "Team member",
      summary: getLocalizedMembershipRoleLabel(workspaceMembership.role, locale),
      value: workspaceMembership.id,
    })),
  ];
  const [propertyOptions, sourceOptions] = await Promise.all([
    prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...buildScopedPropertyAccessFilter(scopedPropertyIds),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.leadSource.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);
  const baseWhere = {
    workspaceId: membership.workspaceId,
    ...buildScopedLeadAccessFilter(scopedPropertyIds),
  };
  const summaryLeads = await prisma.lead.findMany({
    where: baseWhere,
    select: {
      assignedMembershipId: true,
      createdAt: true,
      fitResult: true,
      id: true,
      lastActivityAt: true,
      status: true,
      updatedAt: true,
    },
  });
  const activeSummaryLeads = summaryLeads.filter(
    (lead) => lead.status !== LeadStatus.ARCHIVED,
  );
  const archivedCount = summaryLeads.length - activeSummaryLeads.length;

  const overdueLeadIds = new Set(
    activeSummaryLeads
      .filter((lead) => {
        const slaSummary = resolveLeadSlaSummary({
          createdAt: lead.createdAt,
          isReviewQueueItem:
            lead.fitResult === QualificationFit.CAUTION ||
            lead.fitResult === QualificationFit.MISMATCH ||
            lead.status === LeadStatus.UNDER_REVIEW,
          lastActivityAt: lead.lastActivityAt,
          leadReviewSlaMinutes: membership.workspace.leadReviewSlaMinutes,
          leadResponseSlaMinutes: membership.workspace.leadResponseSlaMinutes,
          status: lead.status,
          updatedAt: lead.updatedAt,
        });

        return Boolean(slaSummary?.isOverdue);
      })
      .map((lead) => lead.id),
  );

  const where = buildLeadListWhereClause({
    activeFilter,
    activeQuery,
    activeWorkflowFilters,
    baseWhere,
    overdueLeadIds,
    showArchived,
  });
  const activeSort = params?.sort ?? "last-activity-desc";
  const sortOrder = buildLeadListSortOrder(activeSort);
  const totalCount = await prisma.lead.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(params?.page ?? 1, 1), pageCount);
  const leads = await prisma.lead.findMany({
    where,
    include: {
      answers: {
        select: {
          questionId: true,
          value: true,
        },
      },
      auditEvents: {
        select: {
          createdAt: true,
          eventType: true,
        },
      },
      assignedMembership: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      property: {
        select: {
          name: true,
          questionSets: {
            include: {
              questions: {
                orderBy: {
                  sortOrder: "asc",
                },
                select: {
                  fieldKey: true,
                  id: true,
                  label: true,
                  required: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
      leadSource: {
        select: {
          name: true,
        },
      },
      screeningRequests: {
        select: {
          status: true,
        },
      },
    },
    orderBy: sortOrder,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    activeFilter,
    activeWorkflowFilters,
    filterOptions: {
      assignments: [
        {
          label: leadsPageCopy.common.unassigned,
          value: "unassigned",
        },
        ...assignmentOptions
          .filter((assignmentOption) => assignmentOption.value !== "unassigned")
          .map((assignmentOption) => ({
            label: assignmentOption.label,
            value: assignmentOption.value,
          })),
      ],
      fits: [
        {
          label: formatFitLabel(QualificationFit.UNKNOWN, locale),
          value: QualificationFit.UNKNOWN,
        },
        {
          label: formatFitLabel(QualificationFit.PASS, locale),
          value: QualificationFit.PASS,
        },
        {
          label: formatFitLabel(QualificationFit.CAUTION, locale),
          value: QualificationFit.CAUTION,
        },
        {
          label: formatFitLabel(QualificationFit.MISMATCH, locale),
          value: QualificationFit.MISMATCH,
        },
      ],
      properties: [
        {
          label: leadsPageCopy.common.unassigned,
          value: "unassigned",
        },
        ...propertyOptions.map((propertyOption) => ({
          label: propertyOption.name,
          value: propertyOption.id,
        })),
      ],
      sources: [
        {
          label: leadsPageCopy.common.manual,
          value: "manual",
        },
        ...sourceOptions.map((sourceOption) => ({
          label: sourceOption.name,
          value: sourceOption.id,
        })),
      ],
      statuses: [
        LeadStatus.NEW,
        LeadStatus.AWAITING_RESPONSE,
        LeadStatus.INCOMPLETE,
        LeadStatus.UNDER_REVIEW,
        LeadStatus.QUALIFIED,
        LeadStatus.CAUTION,
        LeadStatus.TOUR_SCHEDULED,
        LeadStatus.APPLICATION_SENT,
        LeadStatus.DECLINED,
        LeadStatus.ARCHIVED,
        LeadStatus.CLOSED,
      ].map((statusValue) => ({
        label: formatStatusLabel(statusValue, locale),
        value: statusValue,
      })),
    },
    leads: leads.map((lead) => ({
      ...(() => {
        const activeQuestionSet = lead.property
          ? resolveActiveQualificationQuestionSet(lead.property.questionSets)
          : null;
        const missingRequiredQuestions = activeQuestionSet
          ? resolveMissingRequiredQualificationQuestions({
              propertyQuestionSets: [activeQuestionSet],
              leadAnswers: lead.answers,
            })
          : [];
        const mostRecentMissingInfoRequestAt = resolveMostRecentMissingInfoRequestTimestamp(
          lead.auditEvents,
        );
        const missingInfoPromptIsThrottled = isMissingInfoPromptThrottled({
          mostRecentMissingInfoRequestAt,
          referenceTime: new Date(),
          throttleWindowMinutes: resolveMissingInfoPromptThrottleWindowMinutes(
            membership.workspace.missingInfoPromptThrottleMinutes,
          ),
        });
        const needsReview =
          lead.fitResult === QualificationFit.CAUTION ||
          lead.fitResult === QualificationFit.MISMATCH ||
          lead.status === LeadStatus.UNDER_REVIEW ||
          lead.auditEvents.some(
            (auditEvent) =>
              auditEvent.eventType === "possible_duplicate_flagged" ||
              auditEvent.eventType === "lead_conflict_detected",
          );
        const hasDuplicateFlag = lead.auditEvents.some(
          (auditEvent) => auditEvent.eventType === "possible_duplicate_flagged",
        );
        const hasPendingScreening = lead.screeningRequests.some(
          (screeningRequest) =>
            screeningRequest.status !== ScreeningRequestStatus.REVIEWED &&
            screeningRequest.status !== ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
        );
        const isAwaitingResponseStatus =
          lead.status === LeadStatus.NEW ||
          lead.status === LeadStatus.AWAITING_RESPONSE ||
          lead.status === LeadStatus.INCOMPLETE;
        const isStale = Boolean(
          overdueLeadIds.has(lead.id) ||
            (lead.lastActivityAt ?? lead.updatedAt).getTime() <
              Date.now() - 72 * 60 * 60 * 1000,
        );
        const badges: Array<{
          label: string;
          tone: "attention" | "muted" | "review";
        }> = [];

        if (isAwaitingResponseStatus) {
          badges.push({
            label: leadsPageCopy.indicators.awaitingResponse,
            tone: "muted",
          });
        }

        if (needsReview) {
          badges.push({
            label: leadsPageCopy.indicators.reviewNeeded,
            tone: "review",
          });
        }

        if (hasDuplicateFlag) {
          badges.push({
            label: leadsPageCopy.indicators.duplicatePossible,
            tone: "review",
          });
        }

        if (isStale) {
          badges.push({
            label: leadsPageCopy.indicators.stale,
            tone: "attention",
          });
        }

        if (hasPendingScreening) {
          badges.push({
            label: leadsPageCopy.indicators.screeningPending,
            tone: "attention",
          });
        }

        const nextActionLabel = missingRequiredQuestions.length > 0
          ? missingInfoPromptIsThrottled
            ? leadsPageCopy.indicators.missingInfoRequested
            : leadsPageCopy.indicators.askMissingQuestions
          : needsReview
            ? leadsPageCopy.indicators.reviewLead
            : leadsPageCopy.actions.openLead;

        const nextActionDetail = missingRequiredQuestions.length > 0
          ? leadsPageCopy.indicators.missingInfo(missingRequiredQuestions.length)
          : needsReview
            ? leadsPageCopy.indicators.reviewNeeded
            : null;

        return {
          badges,
          nextActionDetail,
          nextActionKind:
            missingRequiredQuestions.length > 0 &&
            !missingInfoPromptIsThrottled &&
            roleActionPermissions.requestInfo
              ? "missing-info"
              : needsReview && roleActionPermissions.overrideFit
                ? "review"
                : "open-lead",
          nextActionLabel,
          nextActionTone:
            missingRequiredQuestions.length > 0
              ? "attention"
              : needsReview
                ? "review"
                : "muted",
        };
      })(),
      assignedMembershipId: lead.assignedMembershipId,
      assignedTo: lead.assignedMembership?.user.name ?? leadsPageCopy.common.unassigned,
      assignmentOptions,
      budget: formatCurrency(lead.monthlyBudget, locale),
      budgetValue: lead.monthlyBudget,
      canArchive:
        roleActionPermissions.archiveLead && lead.status !== LeadStatus.ARCHIVED,
      canAssignOwner: canAssignLeadOwner,
      canUnarchive:
        roleActionPermissions.archiveLead && lead.status === LeadStatus.ARCHIVED,
      email: lead.email,
      fit: formatFitLabel(lead.fitResult, locale),
      fitValue: lead.fitResult,
      id: lead.id,
      isArchived: lead.status === LeadStatus.ARCHIVED,
      lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt, locale),
      moveInDate: formatDate(lead.moveInDate, locale),
      moveInDateValue: lead.moveInDate,
      name: lead.fullName,
      phone: lead.phone,
      property: lead.property?.name ?? "Unassigned",
      slaSummary: (() => {
        const slaSummary = resolveLeadSlaSummary({
          createdAt: lead.createdAt,
          isReviewQueueItem:
            lead.fitResult === QualificationFit.CAUTION ||
            lead.fitResult === QualificationFit.MISMATCH ||
            lead.status === LeadStatus.UNDER_REVIEW,
          lastActivityAt: lead.lastActivityAt,
          leadReviewSlaMinutes: membership.workspace.leadReviewSlaMinutes,
          leadResponseSlaMinutes: membership.workspace.leadResponseSlaMinutes,
          status: lead.status,
          updatedAt: lead.updatedAt,
        });

        return slaSummary
          ? {
              dueAt: formatRelativeTime(slaSummary.dueAt),
              isOverdue: slaSummary.isOverdue,
              label: getLocalizedLeadSlaLabel(slaSummary.queue, locale),
            }
          : null;
      })(),
      source: lead.leadSource?.name ?? leadsPageCopy.common.manual,
      status: formatStatusLabel(lead.status, locale),
      statusValue: lead.status,
    })),
    page,
    pageCount,
    pageSize,
    query: activeQuery,
    archivedCount,
    allLeadCount: summaryLeads.length,
    showArchived,
    sort: activeSort,
    summary: {
      awaitingResponseCount: activeSummaryLeads.filter((lead) =>
        lead.status === LeadStatus.NEW ||
        lead.status === LeadStatus.AWAITING_RESPONSE ||
        lead.status === LeadStatus.INCOMPLETE,
      ).length,
      overdueCount: overdueLeadIds.size,
      qualifiedCount: activeSummaryLeads.filter(
        (lead) => lead.fitResult === QualificationFit.PASS,
      ).length,
      reviewCount: activeSummaryLeads.filter(
        (lead) =>
          lead.fitResult === QualificationFit.CAUTION ||
          lead.fitResult === QualificationFit.MISMATCH ||
          lead.status === LeadStatus.UNDER_REVIEW,
      ).length,
      totalCount: activeSummaryLeads.length,
      unassignedCount: activeSummaryLeads.filter((lead) => !lead.assignedMembershipId)
        .length,
    },
    totalCount,
  };
}

export async function getLeadDetailNavigationData(params: {
  assignment?: string;
  filter?: LeadListFilter;
  fit?: QualificationFit;
  leadId: string;
  property?: string;
  query?: string;
  source?: string;
  status?: LeadStatus;
  showArchived?: boolean;
  sort?: LeadListSort;
}) {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const activeFilter = params.filter ?? "all";
  const activeWorkflowFilters: LeadListWorkflowFilters = {
    assignment: params.assignment?.trim() || undefined,
    fit: params.fit,
    property: params.property?.trim() || undefined,
    source: params.source?.trim() || undefined,
    status: params.status,
  };
  const activeQuery = params.query?.trim() ?? "";
  const activeSort = params.sort ?? "last-activity-desc";
  const showArchived = (params.showArchived ?? false) || activeFilter === "archived";
  const baseWhere = {
    workspaceId: membership.workspaceId,
    ...buildScopedLeadAccessFilter(scopedPropertyIds),
  };
  const summaryLeads = await prisma.lead.findMany({
    where: baseWhere,
    select: {
      assignedMembershipId: true,
      createdAt: true,
      fitResult: true,
      id: true,
      lastActivityAt: true,
      status: true,
      updatedAt: true,
    },
  });
  const activeSummaryLeads = summaryLeads.filter(
    (lead) => lead.status !== LeadStatus.ARCHIVED,
  );
  const overdueLeadIds = new Set(
    activeSummaryLeads
      .filter((lead) => {
        const slaSummary = resolveLeadSlaSummary({
          createdAt: lead.createdAt,
          isReviewQueueItem:
            lead.fitResult === QualificationFit.CAUTION ||
            lead.fitResult === QualificationFit.MISMATCH ||
            lead.status === LeadStatus.UNDER_REVIEW,
          lastActivityAt: lead.lastActivityAt,
          leadReviewSlaMinutes: membership.workspace.leadReviewSlaMinutes,
          leadResponseSlaMinutes: membership.workspace.leadResponseSlaMinutes,
          status: lead.status,
          updatedAt: lead.updatedAt,
        });

        return Boolean(slaSummary?.isOverdue);
      })
      .map((lead) => lead.id),
  );
  const filterClauses = buildLeadListFilterClauses(overdueLeadIds);
  const searchClause = buildLeadListSearchClause(activeQuery);
  const workflowFilterClauses = buildLeadListWorkflowFilterClauses(
    activeWorkflowFilters,
  );
  const archivedVisibilityClause: Prisma.LeadWhereInput | null = showArchived
    ? null
    : {
        status: {
          not: LeadStatus.ARCHIVED,
        },
      };
  const where: Prisma.LeadWhereInput = {
    ...baseWhere,
    AND: [
      archivedVisibilityClause,
      filterClauses[activeFilter],
      searchClause,
      ...workflowFilterClauses,
    ].filter((clause): clause is Prisma.LeadWhereInput => clause !== null),
  };
  const orderedLeads = await prisma.lead.findMany({
    where,
    select: {
      fullName: true,
      id: true,
    },
    orderBy: buildLeadListSortOrder(activeSort),
  });
  const currentIndex = orderedLeads.findIndex((lead) => lead.id === params.leadId);

  if (currentIndex === -1) {
    return {
      nextLead: null,
      previousLead: null,
    };
  }

  return {
    nextLead:
      currentIndex < orderedLeads.length - 1 ? orderedLeads[currentIndex + 1] : null,
    previousLead: currentIndex > 0 ? orderedLeads[currentIndex - 1] : null,
  };
}

export const getLeadCreateViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const [properties, sources] = await Promise.all([
    prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...buildScopedPropertyAccessFilter(scopedPropertyIds),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.leadSource.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
  ]);

  return {
    defaultLeadSourceId:
      sources.find((source) => source.type === LeadSourceType.MANUAL)?.id ?? null,
    properties,
    sources,
  };
});

export const getLeadDetailViewData = cache(async (leadId: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const canUseScreening = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.SCREENING,
  );
  const lead = await getLeadWorkflowContext(membership.workspaceId, leadId);

  if (!lead) {
    return null;
  }

  if (
    scopedPropertyIds &&
    lead.propertyId &&
    !scopedPropertyIds.includes(lead.propertyId)
  ) {
    return null;
  }

  const evaluation = evaluateLeadQualification(lead);
  const workflowActionAvailability = getLeadActionAvailability(lead, evaluation);
  const automationSuppressionSummaries = getLeadAutomationSuppressionSummaries(
    lead,
    evaluation,
  );
  const roleActionPermissions = getLeadActionPermissionsForMembershipRole(
    membership.role,
  );
  const latestPossibleDuplicateEvent = [...lead.auditEvents]
    .reverse()
    .find((auditEvent) => auditEvent.eventType === "possible_duplicate_flagged");
  const hasDuplicateConfirmedEvent = lead.auditEvents.some(
    (auditEvent) => auditEvent.eventType === "duplicate_confirmed",
  );
  const duplicateCandidateLeadId = latestPossibleDuplicateEvent
    ? extractDuplicateCandidateLeadIdFromAuditPayload(
        latestPossibleDuplicateEvent.payload,
      )
    : null;
  const shouldShowDuplicatePrompt = shouldShowDuplicateReviewPrompt({
    leadStatus: lead.status,
    hasPossibleDuplicateEvent: Boolean(latestPossibleDuplicateEvent),
    hasDuplicateConfirmedEvent,
  });
  const duplicateCandidateLead = duplicateCandidateLeadId
    ? await prisma.lead.findFirst({
        where: {
          id: duplicateCandidateLeadId,
          workspaceId: membership.workspaceId,
        },
        include: {
          property: {
            select: {
              name: true,
            },
          },
          leadSource: {
            select: {
              name: true,
            },
          },
        },
      })
    : null;
  const possibleDuplicateCandidate =
    shouldShowDuplicatePrompt && duplicateCandidateLead
      ? {
          id: duplicateCandidateLead.id,
          name: duplicateCandidateLead.fullName,
          status: formatStatusLabel(duplicateCandidateLead.status),
          source: duplicateCandidateLead.leadSource?.name ?? "Manual",
          property: duplicateCandidateLead.property?.name ?? "Unassigned",
          lastActivity: formatRelativeTime(
            duplicateCandidateLead.lastActivityAt ?? duplicateCandidateLead.updatedAt,
          ),
        }
      : null;
  const answers = [...lead.answers]
    .sort((left, right) => left.question.sortOrder - right.question.sortOrder)
    .map((answer) => ({
      label: answer.question.label,
      value: formatAnswerValue(answer.value),
    }));
  const activeQuestionSet = lead.property
    ? resolveActiveQualificationQuestionSet(lead.property.questionSets)
    : null;
  const missingRequiredQuestions = activeQuestionSet
    ? resolveMissingRequiredQualificationQuestions({
        propertyQuestionSets: [activeQuestionSet],
        leadAnswers: lead.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
        })),
      })
    : [];
  const answerValueByQuestionId = new Map(
    lead.answers.map((answer) => [answer.questionId, answer.value]),
  );
  const missingOptionalQuestions = activeQuestionSet
    ? activeQuestionSet.questions
        .filter((question) => !question.required)
        .filter(
          (question) =>
            !isAnswerValuePresentForChecklist(answerValueByQuestionId.get(question.id)),
        )
        .map((question) => ({
          fieldKey: question.fieldKey,
          label: question.label,
          questionId: question.id,
        }))
    : [];
  const totalRequiredQuestionCount = activeQuestionSet
    ? activeQuestionSet.questions.filter((question) => question.required).length
    : 0;
  const mostRecentMissingInfoRequestAt = resolveMostRecentMissingInfoRequestTimestamp(
    lead.auditEvents.map((auditEvent) => ({
      eventType: auditEvent.eventType,
      createdAt: auditEvent.createdAt,
    })),
  );
  const missingInfoPromptThrottleWindowMinutes =
    resolveMissingInfoPromptThrottleWindowMinutes(
      membership.workspace.missingInfoPromptThrottleMinutes,
    );
  const missingInfoPromptIsThrottled = isMissingInfoPromptThrottled({
    mostRecentMissingInfoRequestAt,
    referenceTime: new Date(),
    throttleWindowMinutes: missingInfoPromptThrottleWindowMinutes,
  });
  const routingReadiness = buildLeadRoutingReadinessSummary({
    fitResult: lead.fitResult,
    hasProperty: Boolean(lead.propertyId),
    missingRequiredQuestionCount: missingRequiredQuestions.length,
  });

  const timeline = buildLeadTimeline(lead);
  const manualOutboundChannels = [
    MessageChannel.EMAIL,
    MessageChannel.SMS,
    ...(workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.WHATSAPP_MESSAGING,
    )
      ? [MessageChannel.WHATSAPP]
      : []),
    ...(workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.INSTAGRAM_MESSAGING,
    )
      ? [MessageChannel.INSTAGRAM]
      : []),
  ].map((channel) => ({
    value: channel,
    label: formatMessageChannelLabel(channel),
  }));
  const channelOptOuts = [
    MessageChannel.EMAIL,
    MessageChannel.SMS,
    MessageChannel.WHATSAPP,
    MessageChannel.INSTAGRAM,
  ].map((channel) => {
    const optOutState = resolveLeadChannelOptOutState(lead, channel);

    return {
      value: channel,
      label: formatMessageChannelLabel(channel),
      isOptedOut: Boolean(optOutState.optedOutAt),
      optedOutAt: optOutState.optedOutAt
        ? formatRelativeTime(optOutState.optedOutAt)
        : null,
      optedOutReason: optOutState.reason ?? null,
    };
  });
  const aggregateOptOutSummary = resolveLeadOptOutSummary(lead);
  const normalizedFieldMetadataRows = buildLeadFieldMetadataRows(lead.fieldMetadata);
  const workspaceMentionMembers = await getWorkspaceMentionMembers(
    membership.workspaceId,
  );
  const availableInternalNoteMentions = resolveInternalNoteMentions({
    noteBody: "",
    workspaceMembers: workspaceMentionMembers.filter(
      (workspaceMember) => workspaceMember.userId !== membership.userId,
    ),
  }).availableMentions;
  const screeningConnections = canUseScreening
    ? await prisma.screeningProviderConnection.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        orderBy: {
          provider: "asc",
        },
      })
    : [];
  const activeScreeningConnections = screeningConnections.filter(
    (screeningConnection) =>
      screeningConnection.authState === ScreeningConnectionAuthState.ACTIVE,
  );

  const messages =
    lead.conversation?.messages.map((message) => {
      const deliveryStatusDisplay = buildDeliveryStatusDisplay(message.deliveryStatus);
      const resolvedInternalNoteMentions =
        message.channel === MessageChannel.INTERNAL_NOTE
          ? resolveInternalNoteMentions({
              noteBody: message.body,
              workspaceMembers: workspaceMentionMembers,
            })
          : null;

      return {
        channel: formatChannelLabel(message.channel),
        direction: formatEnumLabel(message.direction),
        isInternalNote: message.channel === MessageChannel.INTERNAL_NOTE,
        at: formatRelativeTime(
          message.sentAt ?? message.receivedAt ?? message.createdAt,
        ),
        body: message.body,
        deliveryStatusLabel: deliveryStatusDisplay?.label ?? null,
        deliveryStatusDetail: deliveryStatusDisplay?.detail ?? null,
        deliveryStatusError: deliveryStatusDisplay?.error ?? null,
        mentionedTeammates:
          resolvedInternalNoteMentions?.mentions.map((mention) => ({
            userId: mention.userId,
            name: mention.name,
            canonicalHandle: mention.canonicalHandle,
            membershipRole: mention.membershipRole,
          })) ?? [],
      };
    }) ?? [];
  const sharedThread = sortTimelineEventsDeterministically([
    ...lead.statusHistory.map((entry) => ({
      id: entry.id,
      leadId: lead.id,
      eventType: "lead_status_changed",
      createdAt: entry.createdAt,
      kind: "status" as const,
      title: `Status changed to ${formatStatusLabel(entry.toStatus)}`,
      detail: entry.reason ?? null,
      body: null,
      meta: null,
      error: null,
      mentionedTeammates: [],
    })),
    ...lead.auditEvents.map((event) => ({
      id: event.id,
      leadId: lead.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      kind: "event" as const,
      title: formatAuditEventTitle(event),
      detail: formatAuditEventDetail(event),
      body: null,
      meta: null,
      error: null,
      mentionedTeammates: [],
    })),
    ...messages.map((message, index) => ({
      id: `${lead.id}-message-${index}`,
      leadId: lead.id,
      eventType: "message_event",
      createdAt:
        lead.conversation?.messages[index]?.sentAt ??
        lead.conversation?.messages[index]?.receivedAt ??
        lead.conversation?.messages[index]?.createdAt ??
        new Date(),
      kind: "message" as const,
      title: `${message.channel} ${message.direction}`,
      detail: message.deliveryStatusDetail,
      body: message.body,
      meta: message.deliveryStatusLabel,
      error: message.deliveryStatusError,
      mentionedTeammates: message.mentionedTeammates,
    })),
    ...lead.screeningRequests.flatMap((screeningRequest) =>
      screeningRequest.statusEvents.map((statusEvent) => ({
        id: statusEvent.id,
        leadId: lead.id,
        eventType: `screening_${statusEvent.status.toLowerCase()}`,
        createdAt: statusEvent.createdAt,
        kind: "event" as const,
        title: `Screening ${formatEnumLabel(statusEvent.status)}`,
        detail:
          statusEvent.detail ??
          `${formatEnumLabel(screeningRequest.screeningProviderConnection.provider)} ${screeningRequest.packageLabel}`,
        body: null,
        meta: null,
        error: null,
        mentionedTeammates: [],
      })),
    ),
    ...lead.screeningRequests.flatMap((screeningRequest) =>
      screeningRequest.consentRecords.map((consentRecord) => ({
        id: consentRecord.id,
        leadId: lead.id,
        eventType: "screening_consent_recorded",
        createdAt: consentRecord.createdAt,
        kind: "event" as const,
        title: "Screening consent recorded",
        detail:
          consentRecord.source ??
          `${formatEnumLabel(screeningRequest.screeningProviderConnection.provider)} authorization`,
        body: null,
        meta: consentRecord.disclosureVersion,
        error: null,
        mentionedTeammates: [],
      })),
    ),
  ]).map((item) => ({
    ...item,
    at: formatRelativeTime(item.createdAt),
    kindLabel:
      item.kind === "message"
        ? "Message"
        : item.kind === "status"
          ? "Status"
          : "System",
  }));

  const preferredContact =
    lead.preferredContactChannel ??
    lead.contact?.preferredChannel ??
    (lead.email ? "EMAIL" : lead.phone ? "SMS" : null);
  const missingInfoDraftChannel = resolveMissingInfoDraftChannel({
    contactEmailAddress: lead.contact?.email ?? null,
    contactPhoneNumber: lead.contact?.phone ?? null,
    lead,
    leadEmailAddress: lead.email ?? null,
    leadPhoneNumber: lead.phone ?? null,
    preferredChannel: preferredContact,
  });
  const askMissingQuestionsDraft = buildAskMissingQuestionsDraft({
    leadName: lead.fullName,
    propertyName: lead.property?.name ?? null,
    missingFieldLabels: missingRequiredQuestions.map((question) =>
      formatFieldKeyLabel(question.fieldKey),
    ),
    preferredChannel: missingInfoDraftChannel,
  });
  const canOpenAskMissingQuestionsComposer = Boolean(
    roleActionPermissions.requestInfo &&
      askMissingQuestionsDraft &&
      !missingInfoPromptIsThrottled,
  );
  const askMissingQuestionsDisabledReason = missingInfoPromptIsThrottled
    ? `Wait for the ${missingInfoPromptThrottleWindowMinutes}-minute throttle window before sending another missing-info request.`
    : !askMissingQuestionsDraft
      ? "A contactable, non-opted-out email or SMS channel is required before sending a missing-info draft."
      : null;
  const missingInfoStatusAfterSend =
    lead.status === LeadStatus.INCOMPLETE
      ? formatStatusLabel(LeadStatus.INCOMPLETE)
      : formatStatusLabel(LeadStatus.AWAITING_RESPONSE);
  const latestConversationMessage = lead.conversation?.messages.at(-1) ?? null;
  const leadInsightsArtifact = hasAiAssist
    ? formatAiArtifactView(
        findLatestAiArtifact({
          artifactKind: "lead_insights",
          auditEvents: lead.auditEvents,
          schema: leadAiInsightsSchema,
        }),
      )
    : null;
  const translationArtifact = hasAiAssist
    ? formatAiArtifactView(
        findLatestAiArtifact({
          artifactKind: "translation",
          auditEvents: lead.auditEvents,
          schema: translationArtifactSchema,
        }),
      )
    : null;
  const orderedTours = [...lead.tours].sort((leftTour, rightTour) => {
    const leftTimestamp = (leftTour.scheduledAt ?? leftTour.createdAt).getTime();
    const rightTimestamp = (rightTour.scheduledAt ?? rightTour.createdAt).getTime();

    return rightTimestamp - leftTimestamp;
  });
  const activeScheduledTour = orderedTours.find(
    (tour) => tour.status === TourEventStatus.SCHEDULED,
  );
  const operatorSchedulingAvailability = parseAvailabilityWindowConfig(
    membership.schedulingAvailability,
  );
  const propertySchedulingAvailability = parseAvailabilityWindowConfig(
    lead.property?.schedulingAvailability,
  );
  const assignedMembershipIds = orderedTours
    .map((tour) => tour.assignedMembershipId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (lead.assignedMembershipId) {
    assignedMembershipIds.push(lead.assignedMembershipId);
  }
  const leadTasks = await prisma.task.findMany({
    where: {
      leadId: lead.id,
      workspaceId: membership.workspaceId,
    },
    include: {
      assignedMembership: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
  const assignedMemberships = assignedMembershipIds.length
    ? await prisma.membership.findMany({
        where: {
          id: {
            in: assignedMembershipIds,
          },
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      })
    : [];
  const assignedMembershipLabelById = new Map(
    assignedMemberships.map((assignedMembership) => [
      assignedMembership.id,
      assignedMembership.user.name ?? "Team member",
    ]),
  );
  const assignableMemberships = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  )
    ? await prisma.membership.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];
  const isReviewQueueItem =
    lead.fitResult === QualificationFit.CAUTION ||
    lead.fitResult === QualificationFit.MISMATCH ||
    lead.status === LeadStatus.UNDER_REVIEW ||
    lead.auditEvents.some(
      (auditEvent) =>
        auditEvent.eventType === "possible_duplicate_flagged" ||
        auditEvent.eventType === "lead_conflict_detected",
    );
  const slaSummary = resolveLeadSlaSummary({
    createdAt: lead.createdAt,
    isReviewQueueItem,
    lastActivityAt: lead.lastActivityAt,
    leadReviewSlaMinutes: membership.workspace.leadReviewSlaMinutes,
    leadResponseSlaMinutes: membership.workspace.leadResponseSlaMinutes,
    status: lead.status,
    updatedAt: lead.updatedAt,
  });
  const screeningRequests = lead.screeningRequests.map((screeningRequest) => ({
    attachmentReferences: screeningRequest.attachmentReferences.map((attachmentReference) => ({
      contentType: attachmentReference.contentType ?? null,
      createdAt: formatRelativeTime(attachmentReference.createdAt),
      externalId: attachmentReference.externalId ?? null,
      id: attachmentReference.id,
      label: attachmentReference.label,
      url: attachmentReference.url ?? null,
    })),
    adverseActionRecordedAt: formatDateTime(screeningRequest.adverseActionRecordedAt),
    chargeMode: formatEnumLabel(screeningRequest.chargeMode),
    chargeAmount: formatCurrencyAmountCents(
      screeningRequest.chargeAmountCents,
      screeningRequest.chargeCurrency ?? "USD",
    ),
    chargeAmountValue:
      screeningRequest.chargeAmountCents !== null
        ? (screeningRequest.chargeAmountCents / 100).toFixed(2)
        : "",
    chargeCurrency: screeningRequest.chargeCurrency ?? "USD",
    chargeReference: screeningRequest.chargeReference ?? null,
    completedAt: formatDateTime(screeningRequest.completedAt),
    consentCompletedAt: formatDateTime(screeningRequest.consentCompletedAt),
    consentRecords: screeningRequest.consentRecords.map((consentRecord) => ({
      consentedAt: formatDateTime(consentRecord.consentedAt),
      disclosureVersion: consentRecord.disclosureVersion ?? null,
      id: consentRecord.id,
      providerReference: consentRecord.providerReference ?? null,
      source: consentRecord.source ?? null,
    })),
    currentStatus: formatEnumLabel(screeningRequest.status),
    currentStatusValue: screeningRequest.status,
    id: screeningRequest.id,
    invitedAt: formatDateTime(screeningRequest.inviteSentAt),
    packageKey: screeningRequest.packageKey,
    packageLabel: screeningRequest.packageLabel,
    provider: formatEnumLabel(screeningRequest.screeningProviderConnection.provider),
    providerReference: screeningRequest.providerReference ?? null,
    providerReportId: screeningRequest.providerReportId ?? null,
    providerReportUrl: screeningRequest.providerReportUrl ?? null,
    providerUpdatedAt: formatDateTime(screeningRequest.providerUpdatedAt),
    requestedAt: formatDateTime(screeningRequest.requestedAt),
    adverseActionNotes: screeningRequest.adverseActionNotes ?? null,
    reviewNotes: screeningRequest.reviewNotes ?? null,
    reviewedAt: formatDateTime(screeningRequest.reviewedAt),
    startedAt: formatDateTime(screeningRequest.startedAt),
    statusEvents: screeningRequest.statusEvents.map((statusEvent) => ({
      at: formatDateTime(statusEvent.providerTimestamp ?? statusEvent.createdAt),
      detail: statusEvent.detail ?? null,
      id: statusEvent.id,
      status: formatEnumLabel(statusEvent.status),
      statusValue: statusEvent.status,
    })),
    summary: formatScreeningRequestSummary({
      provider: screeningRequest.screeningProviderConnection.provider,
      reportUrl: screeningRequest.providerReportUrl ?? null,
      status: screeningRequest.status,
    }),
  }));
  const activeScreeningRequest = lead.screeningRequests.find(
    (screeningRequest) =>
      screeningRequest.status !== ScreeningRequestStatus.REVIEWED &&
      screeningRequest.status !== ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
  );
  const tourHistory = orderedTours
    .filter((tour) => tour.id !== activeScheduledTour?.id)
    .map((tour) => ({
      assignedMembershipId: tour.assignedMembershipId ?? null,
      assignedTo:
        (tour.assignedMembershipId
          ? assignedMembershipLabelById.get(tour.assignedMembershipId)
          : null) ?? "Unassigned",
      calendarSyncSummary: formatCalendarSyncSummary({
        calendarSyncError: tour.calendarSyncError,
        calendarSyncProvider: tour.calendarSyncProvider,
        calendarSyncStatus: tour.calendarSyncStatus,
      }),
      id: tour.id,
      scheduledAt: formatDateTime(tour.scheduledAt ?? tour.createdAt),
      status: formatEnumLabel(tour.status),
      statusValue: tour.status,
      canceledAt: formatDateTime(tour.canceledAt),
      cancelReason: tour.cancelReason ?? null,
      operatorCancelReason: tour.operatorCancelReason ?? null,
      operatorNoShowReason: tour.operatorNoShowReason ?? null,
      operatorRescheduleReason: tour.operatorRescheduleReason ?? null,
      externalCalendarId: tour.externalCalendarId ?? null,
      reminderSummary: formatTourReminderStateSummary(tour.reminderSequenceState),
      createdAt: formatRelativeTime(tour.createdAt),
    }));

  return {
    hasAiAssist,
    canUseScreening,
    id: lead.id,
    source: lead.leadSource?.name ?? "Manual",
    name: lead.fullName,
    email: lead.email ?? "Not set",
    phone: lead.phone ?? "Not set",
    lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt),
    property: lead.property?.name ?? "Unassigned",
    propertyId: lead.propertyId,
    availableProperties: await prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
        ...buildScopedPropertyAccessFilter(scopedPropertyIds),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    leadOwner: {
      assignedMembershipId: lead.assignedMembershipId ?? null,
      assignedTo: lead.assignedMembershipId
        ? assignedMembershipLabelById.get(lead.assignedMembershipId) ?? "Team member"
        : "Unassigned",
    },
    leadAssignmentOptions: [
      {
        label: "Unassigned",
        summary: "Shared inbox ownership remains open",
        value: "unassigned",
      },
      ...assignableMemberships.map((workspaceMembership) => ({
        label: workspaceMembership.user.name ?? "Team member",
        summary: formatEnumLabel(workspaceMembership.role),
        value: workspaceMembership.id,
      })),
    ],
    slaSummary: slaSummary
      ? {
          dueAt: formatDateTime(slaSummary.dueAt),
          dueAtRelative: formatRelativeTime(slaSummary.dueAt),
          isOverdue: slaSummary.isOverdue,
          label: slaSummary.label,
        }
      : null,
    status: formatStatusLabel(lead.status),
    statusValue: lead.status,
    upcomingTour: activeScheduledTour
      ? {
          assignedMembershipId: activeScheduledTour.assignedMembershipId ?? null,
          assignedTo:
            (activeScheduledTour.assignedMembershipId
              ? assignedMembershipLabelById.get(activeScheduledTour.assignedMembershipId)
              : null) ?? "Unassigned",
          calendarSyncError: activeScheduledTour.calendarSyncError ?? null,
          calendarSyncStatus: activeScheduledTour.calendarSyncStatus
            ? formatEnumLabel(activeScheduledTour.calendarSyncStatus)
            : "Manual",
          calendarSyncSummary: formatCalendarSyncSummary({
            calendarSyncError: activeScheduledTour.calendarSyncError,
            calendarSyncProvider: activeScheduledTour.calendarSyncProvider,
            calendarSyncStatus: activeScheduledTour.calendarSyncStatus,
          }),
          id: activeScheduledTour.id,
          prospectNotificationSentAt: formatDateTime(
            activeScheduledTour.prospectNotificationSentAt,
          ),
          reminderSummary: formatTourReminderStateSummary(
            activeScheduledTour.reminderSequenceState,
          ),
          scheduledAt: formatDateTime(
            activeScheduledTour.scheduledAt ?? activeScheduledTour.createdAt,
          ),
          scheduledAtInputValue: formatDateTimeInputValue(
            activeScheduledTour.scheduledAt,
          ),
          status: formatEnumLabel(activeScheduledTour.status),
          externalCalendarId: activeScheduledTour.externalCalendarId ?? null,
        }
      : null,
    tourAssignmentOptions: [
      {
        label: "Current operator",
        summary: "Current operator",
        value: membership.id,
      },
      ...assignableMemberships
        .filter((workspaceMembership) => workspaceMembership.id !== membership.id)
        .map((workspaceMembership) => ({
          label: workspaceMembership.user.name ?? "Team member",
          summary: workspaceMembership.sharedTourCoverageEnabled
            ? "Shared coverage enabled"
            : "Manual assignment",
          value: workspaceMembership.id,
        })),
    ],
    tourReminderSequenceSummary: formatTourReminderSequenceSummary(
      parseTourReminderSequence(membership.workspace.tourReminderSequence),
    ),
    tourSchedulingModeSummary: formatTourSchedulingMode(
      membership.workspace.tourSchedulingMode,
    ),
    tourHistory,
    operatorSchedulingAvailabilitySummary: formatAvailabilityWindow(
      operatorSchedulingAvailability,
    ),
    propertySchedulingAvailabilitySummary: formatAvailabilityWindow(
      propertySchedulingAvailability,
    ),
    contactMethod: preferredContact
      ? formatEnumLabel(preferredContact)
      : "Not set",
    moveInDate: formatDate(lead.moveInDate),
    budget: formatCurrency(lead.monthlyBudget),
    stayLength: formatStayLength(lead.stayLengthMonths),
    availableInternalNoteMentions,
    manualOutboundChannels,
    workStatus: lead.workStatus ?? "Not provided",
    notes: lead.notes ?? "No operator notes yet.",
    optOutSummary: {
      isOptedOut: Boolean(aggregateOptOutSummary.optOutAt),
      optedOutAt: aggregateOptOutSummary.optOutAt
        ? formatRelativeTime(aggregateOptOutSummary.optOutAt)
        : null,
      optedOutReason: aggregateOptOutSummary.optOutReason ?? null,
    },
    channelOptOuts,
    schedulingUrl: lead.property?.schedulingUrl ?? null,
    fit: formatFitLabel(lead.fitResult),
    fitValue: lead.fitResult,
    requestInfoActionLabel:
      missingRequiredQuestions.length > 0 ? "Ask missing questions" : "Request info",
    askMissingQuestionsDraft,
    askMissingQuestionsAvailability: {
      canOpenComposer: canOpenAskMissingQuestionsComposer,
      disabledReason: askMissingQuestionsDisabledReason,
      statusAfterSend: missingInfoStatusAfterSend,
    },
    missingInfoChecklist: {
      isRequestThrottled: missingInfoPromptIsThrottled,
      items: [
        ...missingRequiredQuestions.map((question) => ({
          fieldKey: question.fieldKey,
          fieldLabel: formatFieldKeyLabel(question.fieldKey),
          kind: "required" as const,
          label: question.label,
          questionId: question.questionId,
          severityLabel: "Required blocker",
        })),
        ...missingOptionalQuestions.map((question) => ({
          fieldKey: question.fieldKey,
          fieldLabel: formatFieldKeyLabel(question.fieldKey),
          kind: "optional" as const,
          label: question.label,
          questionId: question.questionId,
          severityLabel: "Optional follow-up",
        })),
      ],
      mostRecentRequestAt: mostRecentMissingInfoRequestAt
        ? formatRelativeTime(mostRecentMissingInfoRequestAt)
        : null,
      readiness: routingReadiness,
      statusAfterSend: missingInfoStatusAfterSend,
      throttleSummary: missingInfoPromptIsThrottled
        ? `Missing-info outreach is throttled for ${missingInfoPromptThrottleWindowMinutes} minutes after the last request.`
        : null,
      totalRequiredCount: totalRequiredQuestionCount,
    },
    evaluationSummary: evaluation.summary,
    evaluationIssues: evaluation.issues.map((issue) => ({
      label: issue.label,
      detail: issue.detail,
      severity: formatEnumLabel(issue.severity),
      outcome: formatEnumLabel(issue.outcome),
    })),
    recommendedStatus: formatStatusLabel(evaluation.recommendedStatus),
    recommendedStatusValue: evaluation.recommendedStatus,
    tasks: leadTasks.map((task) => ({
      assignedTo: task.assignedMembership?.user.name ?? "Unassigned",
      assignedMembershipId: task.assignedMembershipId ?? null,
      description: task.description ?? null,
      dueAt: formatDateTime(task.dueAt),
      dueAtInputValue: formatDateTimeInputValue(task.dueAt),
      id: task.id,
      isOverdue: resolveTaskIsOverdue(task.dueAt, task.status),
      status: formatEnumLabel(task.status),
      statusValue: task.status,
      title: task.title,
    })),
    qualificationAnswers: answers,
    automationSuppressionSummaries,
    sharedThread,
    timeline,
    messages,
    normalizedFieldMetadataRows,
    latestMessageForTranslation: latestConversationMessage
      ? {
          body: latestConversationMessage.body,
          sourceSummary: `${formatChannelLabel(latestConversationMessage.channel)} ${formatEnumLabel(
            latestConversationMessage.direction,
          )}`,
        }
      : null,
    leadInsightsArtifact,
    possibleDuplicateCandidate,
    screeningConnections: activeScreeningConnections.map((screeningConnection) => {
      const configuredPackages = parseScreeningPackageConfig(screeningConnection.packageConfig);
      const packages = configuredPackages.length
        ? configuredPackages
        : screeningConnection.defaultPackageKey && screeningConnection.defaultPackageLabel
          ? [
              {
                isDefault: true,
                key: screeningConnection.defaultPackageKey,
                label: screeningConnection.defaultPackageLabel,
              },
            ]
          : [];

      return {
        authState: screeningConnection.authState,
        chargeMode: screeningConnection.chargeMode,
        id: screeningConnection.id,
        packageOptions: packages,
        provider: screeningConnection.provider,
        providerLabel: formatEnumLabel(screeningConnection.provider),
        summary: formatScreeningConnectionSummary({
          authState: screeningConnection.authState,
          connectedAccount: screeningConnection.connectedAccount,
          defaultPackageLabel: screeningConnection.defaultPackageLabel,
          lastError: screeningConnection.lastError,
        }),
      };
    }),
    screeningRequests,
    translationArtifact,
    actions: {
      evaluateFit:
        workflowActionAvailability.evaluateFit && roleActionPermissions.evaluateFit,
      requestInfo:
        workflowActionAvailability.requestInfo && roleActionPermissions.requestInfo,
      scheduleTour:
        workflowActionAvailability.scheduleTour &&
        roleActionPermissions.scheduleTour,
      manualScheduleTour:
        workflowActionAvailability.manualScheduleTour &&
        roleActionPermissions.scheduleTour,
      manageScheduledTour:
        Boolean(activeScheduledTour) && roleActionPermissions.scheduleTour,
      sendApplication:
        workflowActionAvailability.sendApplication &&
        roleActionPermissions.sendApplication,
      launchScreening:
        canUseScreening &&
        roleActionPermissions.launchScreening &&
        lead.status === LeadStatus.QUALIFIED &&
        activeScreeningConnections.length > 0 &&
        !activeScreeningRequest,
      manageScreening:
        canUseScreening &&
        roleActionPermissions.launchScreening &&
        screeningRequests.length > 0,
      manualOutbound: roleActionPermissions.requestInfo,
      assignProperty: roleActionPermissions.assignProperty,
      archiveLead:
        roleActionPermissions.archiveLead && lead.status !== LeadStatus.ARCHIVED,
      unarchiveLead:
        roleActionPermissions.archiveLead && lead.status === LeadStatus.ARCHIVED,
      overrideFit: roleActionPermissions.overrideFit,
      declineLead: roleActionPermissions.declineLead,
      confirmDuplicate:
        Boolean(possibleDuplicateCandidate) && roleActionPermissions.archiveLead,
    },
  };
});

export const getInboxViewData = cache(async (queueFilter?: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const workspaceMentionMembers = await getWorkspaceMentionMembers(
    membership.workspaceId,
  );
  const availableInternalNoteMentions = resolveInternalNoteMentions({
    noteBody: "",
    workspaceMembers: workspaceMentionMembers.filter(
      (workspaceMember) => workspaceMember.userId !== membership.userId,
    ),
  }).availableMentions;
  const threads = await prisma.lead.findMany({
    where: {
      workspaceId: membership.workspaceId,
      ...buildScopedLeadAccessFilter(scopedPropertyIds),
    },
    include: {
      assignedMembership: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      workspace: {
        select: {
          channelPriority: true,
          dailyAutomatedSendCap: true,
          missingInfoPromptThrottleMinutes: true,
          quietHoursStartLocal: true,
          quietHoursEndLocal: true,
          quietHoursTimeZone: true,
        },
      },
      contact: true,
      property: {
        select: {
          id: true,
          name: true,
          lifecycleStatus: true,
          smokingAllowed: true,
          petsAllowed: true,
          parkingAvailable: true,
          schedulingUrl: true,
          schedulingEnabled: true,
          channelPriority: true,
          quietHoursStartLocal: true,
          quietHoursEndLocal: true,
          quietHoursTimeZone: true,
          rules: {
            orderBy: {
              createdAt: "asc",
            },
          },
          questionSets: {
            include: {
              questions: {
                orderBy: {
                  sortOrder: "asc",
                },
                select: {
                  id: true,
                  fieldKey: true,
                  label: true,
                  required: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
      leadSource: {
        select: {
          name: true,
        },
      },
      answers: {
        select: {
          questionId: true,
          value: true,
          question: {
            select: {
              fieldKey: true,
              label: true,
            },
          },
        },
      },
      auditEvents: {
        where: {
          eventType: {
            in: [
              "Missing information requested",
              "missing information requested",
              "possible_duplicate_flagged",
              "lead_conflict_detected",
              "ai_artifact_generated",
            ],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        select: {
          eventType: true,
          createdAt: true,
          payload: true,
        },
      },
      conversation: {
        include: {
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      {
        lastActivityAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });
  const propertyIds = [
    ...new Set(
      threads
        .map((lead) => lead.propertyId)
        .filter((propertyId): propertyId is string => typeof propertyId === "string"),
    ),
  ];
  const questionSetsByPropertyId = new Map<
    string,
    Array<{
      id: string;
      isDefault?: boolean;
      questions: Array<{
        id: string;
        fieldKey: string;
        label: string;
        required: boolean;
      }>;
    }>
  >();

  if (propertyIds.length > 0) {
    const propertyQuestionSets = await prisma.qualificationQuestionSet.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        isDefault: true,
        propertyId: true,
        questions: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            id: true,
            fieldKey: true,
            label: true,
            required: true,
          },
        },
      },
    });

    for (const propertyQuestionSet of propertyQuestionSets) {
      const existingQuestionSets =
        questionSetsByPropertyId.get(propertyQuestionSet.propertyId) ?? [];
      existingQuestionSets.push({
        id: propertyQuestionSet.id,
        isDefault: propertyQuestionSet.isDefault,
        questions: propertyQuestionSet.questions,
      });
      questionSetsByPropertyId.set(propertyQuestionSet.propertyId, existingQuestionSets);
    }

    for (const [propertyId, questionSets] of questionSetsByPropertyId.entries()) {
      const activeQuestionSet = resolveActiveQualificationQuestionSet(questionSets);

      questionSetsByPropertyId.set(propertyId, activeQuestionSet ? [activeQuestionSet] : []);
    }
  }

  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
      lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
  const roleActionPermissions = getLeadActionPermissionsForMembershipRole(
    membership.role,
  );
  const assignableMemberships = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  )
    ? await prisma.membership.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];
  const manualOnlyModeEnabled = isManualOnlyAutomationModeEnabled(
    process.env.ROOMFLOW_MANUAL_ONLY_MODE,
  );
  const missingInfoPromptThrottleWindowMinutes =
    resolveMissingInfoPromptThrottleWindowMinutes(
      membership.workspace.missingInfoPromptThrottleMinutes,
    );

  const mappedThreads = threads.map((lead) => {
    const automationSuppressionSummaries = getLeadAutomationSuppressionSummaries(
      lead,
      evaluateLeadQualification(lead),
    );
    const blockedAutomationActionKeys = new Set(
      automationSuppressionSummaries.map((summary) => summary.actionKey),
    );

    return {
      ...(() => {
      const propertyQuestionSetsForLead = lead.propertyId
        ? questionSetsByPropertyId.get(lead.propertyId) ?? []
        : [];
      const qualificationAutomationGateResult = resolveQualificationAutomationGate({
        leadPropertyId: lead.propertyId,
        propertyQuestionSets: propertyQuestionSetsForLead,
        leadEmailAddress: lead.email,
        leadPhoneNumber: lead.phone,
        contactEmailAddress: lead.contact?.email ?? null,
        contactPhoneNumber: lead.contact?.phone ?? null,
        manualOnlyModeEnabled,
      });
      const missingRequiredQuestions = resolveMissingRequiredQualificationQuestions({
        propertyQuestionSets: propertyQuestionSetsForLead,
        leadAnswers: lead.answers.map((leadAnswer) => ({
          questionId: leadAnswer.questionId,
          value: leadAnswer.value,
        })),
      });
      const qualificationCompleted = isQualificationCompleted({
        missingRequiredQuestionCount: missingRequiredQuestions.length,
        fitResult: lead.fitResult,
        currentLeadStatus: lead.status,
      });
      const mostRecentMissingInfoRequestAt = resolveMostRecentMissingInfoRequestTimestamp(
        lead.auditEvents.map((auditEvent) => ({
          eventType: auditEvent.eventType,
          createdAt: auditEvent.createdAt,
        })),
      );
      const missingInfoPromptIsThrottled = isMissingInfoPromptThrottled({
        mostRecentMissingInfoRequestAt,
        referenceTime: new Date(),
        throttleWindowMinutes: missingInfoPromptThrottleWindowMinutes,
      });
      const leadStatusIsInactive =
        lead.status === LeadStatus.DECLINED ||
        lead.status === LeadStatus.ARCHIVED ||
        lead.status === LeadStatus.CLOSED;
      const isReviewQueueItem =
        lead.fitResult === QualificationFit.CAUTION ||
        lead.fitResult === QualificationFit.MISMATCH ||
        lead.status === LeadStatus.UNDER_REVIEW ||
        lead.auditEvents.some(
          (auditEvent) =>
            auditEvent.eventType === "possible_duplicate_flagged" ||
            auditEvent.eventType === "lead_conflict_detected",
        );
      const slaSummary = resolveLeadSlaSummary({
        createdAt: lead.createdAt,
        isReviewQueueItem,
        lastActivityAt: lead.lastActivityAt,
        leadReviewSlaMinutes: membership.workspace.leadReviewSlaMinutes,
        leadResponseSlaMinutes: membership.workspace.leadResponseSlaMinutes,
        status: lead.status,
        updatedAt: lead.updatedAt,
      });

      return {
        assignedMembershipId: lead.assignedMembership?.id ?? null,
        assignedTo: lead.assignedMembership?.user.name ?? "Unassigned",
        assignmentOptions: [
          {
            label: "Unassigned",
            summary: "Shared inbox ownership remains open",
            value: "unassigned",
          },
          ...assignableMemberships.map((workspaceMembership) => ({
            label: workspaceMembership.user.name ?? "Team member",
            summary: formatEnumLabel(workspaceMembership.role),
            value: workspaceMembership.id,
          })),
        ],
        canRequestInfo:
          qualificationAutomationGateResult.canRunAutomation &&
          !leadStatusIsInactive &&
          !qualificationCompleted &&
          !missingInfoPromptIsThrottled &&
          roleActionPermissions.requestInfo,
        canAssignOwner: roleActionPermissions.assignProperty,
        isReviewQueueItem,
        reviewFlags: {
          caution: lead.fitResult === QualificationFit.CAUTION,
          mismatch: lead.fitResult === QualificationFit.MISMATCH,
          duplicate: lead.auditEvents.some(
            (auditEvent) => auditEvent.eventType === "possible_duplicate_flagged",
          ),
          conflict: lead.auditEvents.some(
            (auditEvent) => auditEvent.eventType === "lead_conflict_detected",
          ),
        },
        slaSummary: slaSummary
          ? {
              dueAt: formatRelativeTime(slaSummary.dueAt),
              isOverdue: slaSummary.isOverdue,
              label: slaSummary.label,
            }
          : null,
      };
      })(),
      automationSuppressionSummaries,
      canScheduleTour:
        !blockedAutomationActionKeys.has("schedule_tour") &&
        roleActionPermissions.scheduleTour,
      canSendApplication:
        !blockedAutomationActionKeys.has("send_application") &&
        roleActionPermissions.sendApplication,
      id: lead.id,
      name: lead.fullName,
      source: lead.leadSource?.name ?? "Manual",
      property: lead.property?.name ?? "Unassigned",
      status: formatStatusLabel(lead.status),
      fit: formatFitLabel(lead.fitResult),
      lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt),
      latestMessage:
        lead.conversation?.messages[0]?.body ?? "No messages yet on this lead.",
      latestMessageDeliveryStatus:
        lead.conversation?.messages[0]
          ? buildDeliveryStatusDisplay(lead.conversation.messages[0].deliveryStatus)
          : null,
      latestMessageMentions:
        lead.conversation?.messages[0]?.channel === MessageChannel.INTERNAL_NOTE
          ? resolveInternalNoteMentions({
              noteBody: lead.conversation.messages[0].body,
              workspaceMembers: workspaceMentionMembers,
            }).mentions.map((mention) => ({
              userId: mention.userId,
              name: mention.name,
              canonicalHandle: mention.canonicalHandle,
              membershipRole: mention.membershipRole,
            }))
          : [],
      latestMessageDirection: lead.conversation?.messages[0]
        ? lead.conversation.messages[0].channel === MessageChannel.INTERNAL_NOTE
          ? "Internal note"
          : formatEnumLabel(lead.conversation.messages[0].direction)
        : "No thread",
      latestMessageIsInternalNote:
        lead.conversation?.messages[0]?.channel === MessageChannel.INTERNAL_NOTE,
      availableInternalNoteMentions,
      hasAiAssist,
      leadInsightsArtifact: hasAiAssist
        ? formatAiArtifactView(
            findLatestAiArtifact({
              artifactKind: "lead_insights",
              auditEvents: lead.auditEvents,
              schema: leadAiInsightsSchema,
            }),
          )
        : null,
      translationArtifact: hasAiAssist
        ? formatAiArtifactView(
            findLatestAiArtifact({
              artifactKind: "translation",
              auditEvents: lead.auditEvents,
              schema: translationArtifactSchema,
            }),
          )
        : null,
      needsAssignment: !lead.propertyId && roleActionPermissions.assignProperty,
      translationSourceSummary: lead.conversation?.messages[0]
        ? `${formatChannelLabel(lead.conversation.messages[0].channel)} ${formatEnumLabel(
            lead.conversation.messages[0].direction,
          )}`
        : "No thread",
      availableProperties: properties,
    };
  });

  const filteredThreads = (() => {
  if (!queueFilter || queueFilter === "all") {
    return mappedThreads;
  }

  if (queueFilter === "review") {
    return mappedThreads.filter((thread) => thread.isReviewQueueItem);
  }

  if (queueFilter === "mine") {
    return mappedThreads.filter(
      (thread) => thread.assignedMembershipId === membership.id,
    );
  }

  if (queueFilter === "unassigned") {
    return mappedThreads.filter((thread) => !thread.assignedMembershipId);
  }

  if (queueFilter === "overdue") {
    return mappedThreads.filter((thread) => thread.slaSummary?.isOverdue);
  }

  if (queueFilter === "duplicate") {
    return mappedThreads.filter((thread) => thread.reviewFlags.duplicate);
  }

  if (queueFilter === "caution") {
    return mappedThreads.filter((thread) => thread.reviewFlags.caution);
  }

  if (queueFilter === "mismatch") {
    return mappedThreads.filter((thread) => thread.reviewFlags.mismatch);
  }

  if (queueFilter === "conflict") {
    return mappedThreads.filter((thread) => thread.reviewFlags.conflict);
  }

  return mappedThreads;
  })();

  return {
    hasAiAssist,
    threads: filteredThreads,
  };
});

export const getTasksViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: membership.workspaceId,
      ...(scopedPropertyIds
        ? {
            OR: [
              {
                propertyId: null,
              },
              {
                propertyId: {
                  in: scopedPropertyIds,
                },
              },
            ],
          }
        : {}),
    },
    include: {
      assignedMembership: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      lead: {
        select: {
          fullName: true,
          id: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
  const assignableMemberships = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  )
    ? await prisma.membership.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];

  return {
    taskStatusOptions: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELED].map((taskStatus) => ({
      label: formatEnumLabel(taskStatus),
      value: taskStatus,
    })),
    tasks: tasks.map((task) => ({
      assignedTo: task.assignedMembership?.user.name ?? "Unassigned",
      dueAt: formatDateTime(task.dueAt),
      id: task.id,
      isOverdue: resolveTaskIsOverdue(task.dueAt, task.status),
      leadId: task.lead?.id ?? null,
      leadName: task.lead?.fullName ?? null,
      propertyName: task.property?.name ?? null,
      status: formatEnumLabel(task.status),
      statusValue: task.status,
      title: task.title,
    })),
    teammateOptions: [
      {
        label: "Unassigned",
        value: "unassigned",
      },
      ...assignableMemberships.map((workspaceMembership) => ({
        label: workspaceMembership.user.name ?? "Team member",
        value: workspaceMembership.id,
      })),
    ],
  };
});

export const getPropertyQuestionsViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: membership.workspaceId,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    include: {
      rules: {
        where: {
          active: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          description: true,
          label: true,
        },
      },
      questionSets: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          questions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  if (!property) {
    return null;
  }

  const propertyAiAuditEvents = hasAiAssist
    ? await prisma.auditEvent.findMany({
        where: {
          workspaceId: membership.workspaceId,
          propertyId: property.id,
          eventType: "ai_artifact_generated",
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          eventType: true,
          payload: true,
        },
      })
    : [];

  return {
    hasAiAssist,
    intakeFormArtifact: formatAiArtifactView(
      findLatestAiArtifact({
        artifactKind: "intake_form_generator",
        auditEvents: propertyAiAuditEvents,
        schema: intakeFormGeneratorSchema,
      }),
    ),
    propertyId: property.id,
    propertyName: property.name,
    lifecycleStatus: formatPropertyLifecycleStatus(property.lifecycleStatus),
    rentableRoomCount: property.rentableRoomCount,
    sharedBathroomCount: property.sharedBathroomCount,
    parkingAvailable: property.parkingAvailable,
    smokingAllowed: property.smokingAllowed,
    petsAllowed: property.petsAllowed,
    rules: property.rules,
    activeQuestionSet: (() => {
      const activeQuestionSet = resolveActiveQualificationQuestionSet(property.questionSets);

      return activeQuestionSet
        ? {
            id: activeQuestionSet.id,
            isDefault: activeQuestionSet.isDefault,
            name: activeQuestionSet.name,
            questions: activeQuestionSet.questions.map((question) => ({
              id: question.id,
              fieldKey: question.fieldKey,
              label: question.label,
              options: Array.isArray(question.options)
                ? question.options.filter((option): option is string => typeof option === "string")
                : [],
              required: question.required,
              sortOrder: question.sortOrder,
              type: question.type,
            })),
          }
        : null;
    })(),
    questionSetHistory: (() => {
      const activeQuestionSet = resolveActiveQualificationQuestionSet(property.questionSets);

      return property.questionSets
        .filter((set) => !activeQuestionSet || set.id !== activeQuestionSet.id)
        .slice()
        .reverse()
        .map((set) => ({
          id: set.id,
          name: set.name,
          questions: set.questions.map((question) => ({
            id: question.id,
            label: question.label,
            fieldKey: question.fieldKey,
            type: formatEnumLabel(question.type),
            required: question.required,
          })),
        }));
    })(),
  };
});

export const getPropertyDetailViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const recentInquiryWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const qualifiedLeadStatuses = new Set<LeadStatus>([
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ]);
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: membership.workspaceId,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    include: {
      workspace: {
        select: {
          channelPriority: true,
          quietHoursStartLocal: true,
          quietHoursEndLocal: true,
          quietHoursTimeZone: true,
        },
      },
      _count: {
        select: {
          leads: true,
          questionSets: true,
          rules: true,
          tours: true,
        },
      },
      questionSets: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          questions: {
            select: {
              id: true,
            },
          },
        },
      },
      rules: {
        select: {
          active: true,
        },
      },
    },
  });

  if (!property) {
    return null;
  }

  // Keep the property detail metrics aligned with the list view chips and counts.
  const leadCountsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where: {
      workspaceId: membership.workspaceId,
      propertyId: property.id,
    },
    _count: {
      _all: true,
    },
  });

  const activeLeadCount = leadCountsByStatus
    .filter(
      (leadCountEntry) =>
        leadCountEntry.status !== LeadStatus.ARCHIVED &&
        leadCountEntry.status !== LeadStatus.CLOSED,
    )
    .reduce((totalCount, leadCountEntry) => totalCount + leadCountEntry._count._all, 0);

  const qualifiedLeadCount = leadCountsByStatus
    .filter((leadCountEntry) => qualifiedLeadStatuses.has(leadCountEntry.status))
    .reduce((totalCount, leadCountEntry) => totalCount + leadCountEntry._count._all, 0);

  const scheduledTourCount = await prisma.tourEvent.count({
    where: {
      workspaceId: membership.workspaceId,
      propertyId: property.id,
      status: TourEventStatus.SCHEDULED,
    },
  });

  const propertyLeads = await prisma.lead.findMany({
    where: {
      workspaceId: membership.workspaceId,
      propertyId: property.id,
    },
    select: {
      createdAt: true,
      leadSource: {
        select: {
          name: true,
        },
      },
    },
  });

  const resolvedChannelPriorityOrder = resolveChannelPriorityOrder(
    property.channelPriority ?? property.workspace.channelPriority,
  );
  const effectiveQuietHours = resolveEffectiveQuietHours({
    workspaceQuietHoursStartLocal: property.workspace.quietHoursStartLocal,
    workspaceQuietHoursEndLocal: property.workspace.quietHoursEndLocal,
    workspaceQuietHoursTimeZone: property.workspace.quietHoursTimeZone,
    propertyQuietHoursStartLocal: property.quietHoursStartLocal,
    propertyQuietHoursEndLocal: property.quietHoursEndLocal,
    propertyQuietHoursTimeZone: property.quietHoursTimeZone,
  });
  const propertySchedulingAvailability = parseAvailabilityWindowConfig(
    property.schedulingAvailability,
  );
  const leadsBySourceName = new Map<string, number>();

  for (const propertyLead of propertyLeads) {
    const sourceName = propertyLead.leadSource?.name ?? "Manual";
    const currentCount = leadsBySourceName.get(sourceName) ?? 0;

    leadsBySourceName.set(sourceName, currentCount + 1);
  }

  const topLeadSourceEntry = [...leadsBySourceName.entries()].sort(
    (leftEntry, rightEntry) => rightEntry[1] - leftEntry[1],
  )[0] ?? null;
  const recentInquiryCount = propertyLeads.filter(
    (propertyLead) => propertyLead.createdAt >= recentInquiryWindowStart,
  ).length;
  const qualificationRateLabel =
    property._count.leads > 0
      ? `${Math.round((qualifiedLeadCount / property._count.leads) * 100)}%`
      : "No inquiries yet";
  const tourConversionRateLabel =
    property._count.leads > 0
      ? `${Math.round((scheduledTourCount / property._count.leads) * 100)}%`
      : "No inquiries yet";
  const propertyAiAuditEvents = hasAiAssist
    ? await prisma.auditEvent.findMany({
        where: {
          workspaceId: membership.workspaceId,
          propertyId: property.id,
          eventType: "ai_artifact_generated",
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          eventType: true,
          payload: true,
        },
      })
    : [];

  return {
    hasAiAssist,
    houseRulesArtifact: formatAiArtifactView(
      findLatestAiArtifact({
        artifactKind: "house_rules_generator",
        auditEvents: propertyAiAuditEvents,
        schema: houseRulesGeneratorSchema,
      }),
    ),
    id: property.id,
    name: property.name,
    lifecycleStatus: formatPropertyLifecycleStatus(property.lifecycleStatus),
    lifecycleStatusValue: property.lifecycleStatus,
    listingSourceExternalId: property.listingSourceExternalId,
    listingSourceName: property.listingSourceName,
    listingSourceType: property.listingSourceType,
    listingSourceUrl: property.listingSourceUrl,
    listingAnalyzerArtifact: formatAiArtifactView(
      findLatestAiArtifact({
        artifactKind: "listing_analyzer",
        auditEvents: propertyAiAuditEvents,
        schema: listingAnalyzerSchema,
      }),
    ),
    listingSyncMessage: property.listingSyncMessage,
    listingSyncStatus: property.listingSyncStatus
      ? formatPropertyListingSyncStatus(property.listingSyncStatus)
      : "Not tracked",
    listingSyncStatusValue: property.listingSyncStatus,
    listingSyncUpdatedAtLabel: formatRelativeTime(property.listingSyncUpdatedAt),
    calendarTargetExternalId: property.calendarTargetExternalId,
    calendarTargetName: property.calendarTargetName,
    calendarTargetProvider: property.calendarTargetProvider,
    schedulingAvailabilitySummary: formatAvailabilityWindow(
      propertySchedulingAvailability,
    ),
    schedulingAvailabilityStartLocal:
      propertySchedulingAvailability?.startLocal ?? null,
    schedulingAvailabilityEndLocal:
      propertySchedulingAvailability?.endLocal ?? null,
    schedulingAvailabilityTimeZone:
      propertySchedulingAvailability?.timeZone ?? null,
    schedulingAvailabilityDays: propertySchedulingAvailability?.days ?? [],
    quietHoursSummary: formatQuietHours(effectiveQuietHours?.config ?? null),
    quietHoursSource:
      effectiveQuietHours?.source === "property"
        ? "Property override"
        : effectiveQuietHours?.source === "workspace"
          ? "Workspace default"
          : "Disabled",
    quietHoursStartLocal: property.quietHoursStartLocal,
    quietHoursEndLocal: property.quietHoursEndLocal,
    quietHoursTimeZone: property.quietHoursTimeZone,
    workspaceQuietHoursSummary: formatQuietHours(
      property.workspace.quietHoursStartLocal &&
        property.workspace.quietHoursEndLocal &&
        property.workspace.quietHoursTimeZone
        ? {
            startLocal: property.workspace.quietHoursStartLocal,
            endLocal: property.workspace.quietHoursEndLocal,
            timeZone: property.workspace.quietHoursTimeZone,
          }
        : null,
    ),
    propertyType: property.propertyType,
    addressLine1: property.addressLine1,
    locality: property.locality,
    activeRooms: property.rentableRoomCount ?? 0,
    activeLeads: activeLeadCount,
    qualifiedLeads: qualifiedLeadCount,
    rulesCount: property._count.rules,
    questionSetCount: property._count.questionSets,
    schedulingEnabled: property.schedulingEnabled,
    schedulingUrl: property.schedulingUrl,
    sharedBathroomCount: property.sharedBathroomCount ?? 0,
    parkingAvailable: property.parkingAvailable,
    smokingAllowed: property.smokingAllowed,
    petsAllowed: property.petsAllowed,
    createdAtLabel: formatDate(property.createdAt),
    updatedAtLabel: formatRelativeTime(property.updatedAt),
    activeRuleCount: property.rules.filter((rule) => rule.active).length,
    inactiveRuleCount: property.rules.filter((rule) => !rule.active).length,
    questionCount:
      resolveActiveQualificationQuestionSet(property.questionSets)?.questions.length ?? 0,
    defaultQuestionSetCount: resolveActiveQualificationQuestionSet(property.questionSets)
      ? 1
      : 0,
    totalLeadCount: property._count.leads,
    scheduledTourCount,
    totalTourCount: property._count.tours,
    recentInquiryCount,
    topLeadSourceCount: topLeadSourceEntry?.[1] ?? 0,
    topLeadSourceName: topLeadSourceEntry?.[0] ?? "No lead sources yet",
    qualificationRateLabel,
    tourConversionRateLabel,
    distinctLeadSourceCount: leadsBySourceName.size,
    channelPrioritySource: property.channelPriority
      ? "Property override"
      : "Workspace default",
    channelPriorityOrder: resolvedChannelPriorityOrder.map(formatChannelLabel),
  };
});

export const getPropertiesViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const qualifiedStatuses = new Set<LeadStatus>([
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ]);
  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    include: {
      _count: {
        select: {
          questionSets: true,
          rules: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const leadCounts = await prisma.lead.groupBy({
    by: ["propertyId", "status"],
    where: {
      workspaceId: membership.workspaceId,
      propertyId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  return properties.map((property) => {
    const propertyCounts = leadCounts.filter(
      (entry) => entry.propertyId === property.id,
    );

    const activeLeads = propertyCounts
      .filter(
        (entry) =>
          entry.status !== LeadStatus.ARCHIVED &&
          entry.status !== LeadStatus.CLOSED,
      )
      .reduce((total, entry) => total + entry._count._all, 0);

    const qualifiedLeads = propertyCounts
      .filter((entry) => qualifiedStatuses.has(entry.status))
      .reduce((total, entry) => total + entry._count._all, 0);

    return {
      addressLine1: property.addressLine1,
      id: property.id,
      locality: property.locality,
      lifecycleStatus: formatPropertyLifecycleStatus(property.lifecycleStatus),
      lifecycleStatusValue: property.lifecycleStatus,
      listingSourceName: property.listingSourceName,
      listingSourceType: property.listingSourceType,
      listingSyncStatus: property.listingSyncStatus
        ? formatPropertyListingSyncStatus(property.listingSyncStatus)
        : "Not tracked",
      calendarTargetName: property.calendarTargetName,
      calendarTargetProvider: property.calendarTargetProvider,
      name: property.name,
      activeRooms: property.rentableRoomCount ?? 0,
      activeLeads,
      parkingAvailable: property.parkingAvailable,
      propertyType: property.propertyType,
      qualifiedLeads,
      questionSetCount: property._count.questionSets,
      rulesCount: property._count.rules,
      schedulingEnabled: property.schedulingEnabled,
      schedulingUrl: property.schedulingUrl,
      sharedBathroomCount: property.sharedBathroomCount ?? 0,
    };
  });
});

export const getPropertyRulesViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: membership.workspaceId,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    include: {
      rules: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!property) {
    return null;
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    lifecycleStatus: formatPropertyLifecycleStatus(property.lifecycleStatus),
    schedulingUrl: property.schedulingUrl,
    schedulingConfigured: Boolean(property.schedulingUrl),
    rules: property.rules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      active: rule.active,
      category: rule.category ?? "General",
      description: rule.description ?? "No description provided.",
      mode: formatRuleMode(rule),
    })),
  };
});

export const getCalendarViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const scopedPropertyIds = await resolveScopedPropertyIdsForMembership({
    membershipId: membership.id,
    membershipRole: membership.role,
  });
  const scheduledTours = await prisma.tourEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      status: TourEventStatus.SCHEDULED,
      ...(scopedPropertyIds
        ? {
            OR: [
              {
                propertyId: null,
              },
              {
                propertyId: {
                  in: scopedPropertyIds,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [
      {
        scheduledAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    include: {
      assignedMembership: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      lead: {
        select: {
          id: true,
          fullName: true,
          monthlyBudget: true,
          moveInDate: true,
          status: true,
          lastActivityAt: true,
          updatedAt: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          calendarTargetName: true,
          calendarTargetProvider: true,
        },
      },
    },
  });
  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
      lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      schedulingUrl: {
        not: null,
      },
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    orderBy: {
      name: "asc",
    },
    include: {
      leads: {
        where: {
          status: {
            in: [LeadStatus.QUALIFIED, LeadStatus.TOUR_SCHEDULED],
          },
        },
        orderBy: [
          {
            status: "asc",
          },
          {
            lastActivityAt: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
        include: {
          auditEvents: {
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
        },
      },
    },
  });

  const unconfiguredProperties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
      lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      schedulingUrl: null,
      ...buildScopedPropertyAccessFilter(scopedPropertyIds),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    scheduledTours: scheduledTours.map((tour) => ({
      assignedTo: tour.assignedMembership?.user.name ?? "Unassigned",
      calendarSyncSummary: formatCalendarSyncSummary({
        calendarSyncError: tour.calendarSyncError,
        calendarSyncProvider: tour.calendarSyncProvider,
        calendarSyncStatus: tour.calendarSyncStatus,
      }),
      id: tour.id,
      leadId: tour.lead.id,
      leadName: tour.lead.fullName,
      leadStatus: formatStatusLabel(tour.lead.status),
      propertyId: tour.property?.id ?? null,
      propertyName: tour.property?.name ?? "Unassigned",
      scheduledAt: formatDateTime(tour.scheduledAt ?? tour.createdAt),
      moveInDate: formatDate(tour.lead.moveInDate),
      budget: formatCurrency(tour.lead.monthlyBudget),
      calendarTarget:
        tour.property?.calendarTargetName ??
        tour.property?.calendarTargetProvider ??
        "Manual scheduling",
      externalCalendarId: tour.externalCalendarId ?? null,
      lastActivity: formatRelativeTime(
        tour.lead.lastActivityAt ?? tour.lead.updatedAt,
      ),
      reminderSummary: formatTourReminderStateSummary(tour.reminderSequenceState),
    })),
    properties: properties.map((property) => ({
      calendarTargetName: property.calendarTargetName,
      calendarTargetProvider: property.calendarTargetProvider,
      id: property.id,
      name: property.name,
      schedulingUrl: property.schedulingUrl,
      readyCount: property.leads.filter((lead) => lead.status === LeadStatus.QUALIFIED)
        .length,
      handoffCount: property.leads.filter(
        (lead) => lead.status === LeadStatus.TOUR_SCHEDULED,
      ).length,
      leads: property.leads.map((lead) => {
        const latestSchedulingEvent =
          lead.auditEvents.find((event) =>
            event.eventType.toLowerCase().includes("scheduling handoff"),
          ) ?? null;

        return {
          id: lead.id,
          name: lead.fullName,
          status: formatStatusLabel(lead.status),
          moveInDate: formatDate(lead.moveInDate),
          budget: formatCurrency(lead.monthlyBudget),
          lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt),
          lastSchedulingEvent: latestSchedulingEvent
            ? formatRelativeTime(latestSchedulingEvent.createdAt)
            : "Not sent yet",
        };
      }),
    })),
    unconfiguredProperties,
  };
});

export const getTemplatesViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const templates = await prisma.messageTemplate.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: [
      {
        channel: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
  const sampleLead = await prisma.lead.findFirst({
    where: {
      workspaceId: membership.workspaceId,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      property: {
        include: {
          rules: true,
        },
      },
      leadSource: {
        select: {
          name: true,
        },
      },
      contact: true,
      answers: {
        include: {
          question: {
            select: {
              fieldKey: true,
              label: true,
              sortOrder: true,
            },
          },
        },
      },
      statusHistory: true,
      auditEvents: true,
      conversation: {
        include: {
          messages: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const workspaceAiArtifacts = hasAiAssist
    ? await prisma.auditEvent.findMany({
        where: {
          workspaceId: membership.workspaceId,
          eventType: "ai_artifact_generated",
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          eventType: true,
          payload: true,
        },
      })
    : [];

  return {
    generatedWorkflowTemplate: formatAiArtifactView(
      findLatestAiArtifact({
        artifactKind: "workflow_template_generator",
        auditEvents: workspaceAiArtifacts,
        schema: workflowTemplateGeneratorSchema,
      }),
    ),
    hasAiAssist,
    templates: templates.map((template) => {
    const rendered = sampleLead
      ? renderTemplateForLead(template, sampleLead)
      : { subject: template.subject ?? "", body: template.body };
    const previewBody =
      rendered.body.length > 120
        ? `${rendered.body.slice(0, 117)}...`
        : rendered.body;

    return {
      rendered,
      id: template.id,
      name: template.name,
      channel: formatChannelLabel(template.channel),
      typeLabel: formatEnumLabel(template.type),
      purpose: describeTemplateType(template.type),
      subject: template.subject,
      preview: previewBody,
    };
    }),
  };
});

export const getMessagingSettingsViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const [
    properties,
    leadSources,
    integrationConnections,
    outboundWebhookPendingCount,
    outboundWebhookFailureCount,
  ] = await Promise.all([
    prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        schedulingAvailability: true,
        quietHoursStartLocal: true,
        quietHoursEndLocal: true,
        quietHoursTimeZone: true,
      },
    }),
    prisma.leadSource.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.integrationConnection.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      include: {
        syncHistory: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        {
          category: "asc",
        },
        {
          provider: "asc",
        },
      ],
    }),
    prisma.outboundWebhookDelivery.count({
      where: {
        workspaceId: membership.workspaceId,
        status: WebhookDeliveryStatus.PENDING,
      },
    }),
    prisma.outboundWebhookDelivery.count({
      where: {
        workspaceId: membership.workspaceId,
        status: {
          in: [WebhookDeliveryStatus.FAILED, WebhookDeliveryStatus.DEAD_LETTER],
        },
      },
    }),
  ]);

  const operatorSchedulingAvailability = parseAvailabilityWindowConfig(
    membership.schedulingAvailability,
  );
  const calendarConnections = parseCalendarConnectionsConfig(
    membership.workspace.calendarConnections,
  );
  const tourReminderSequence = parseTourReminderSequence(
    membership.workspace.tourReminderSequence,
  );
  const sharedCoverageMemberships = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  )
    ? await prisma.membership.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          {
            lastTourAssignedAt: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      })
    : [];
  const screeningConnections = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.SCREENING,
  )
    ? await prisma.screeningProviderConnection.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        orderBy: {
          provider: "asc",
        },
      })
    : [];
  const integrationConnectionByProvider = new Map(
    integrationConnections.map((integrationConnection) => [
      integrationConnection.provider,
      integrationConnection,
    ]),
  );
  const screeningConnectionByProvider = new Map<
    IntegrationProvider,
    (typeof screeningConnections)[number]
  >(
    screeningConnections.map((screeningConnection) => [
      resolveScreeningIntegrationProvider(screeningConnection.provider),
      screeningConnection,
    ]),
  );
  const inboundWebhookIntegrationConfig = parseInboundWebhookIntegrationConfig(
    integrationConnectionByProvider.get(IntegrationProvider.GENERIC_INBOUND_WEBHOOK)?.config,
  );
  const metaLeadAdsIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.META_LEAD_ADS,
  );
  const metaLeadAdsIntegrationConfig = parseMetaLeadAdsIntegrationConfig(
    metaLeadAdsIntegrationConnection?.config,
  );
  const outboundWebhookIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.OUTBOUND_WEBHOOK,
  );
  const outboundWebhookIntegrationConfig = parseOutboundWebhookIntegrationConfig(
    outboundWebhookIntegrationConnection?.config,
  );
  const whatsappIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.WHATSAPP,
  );
  const whatsappIntegrationConfig = parseMessagingChannelIntegrationConfig(
    whatsappIntegrationConnection?.config,
  );
  const instagramIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.INSTAGRAM,
  );
  const instagramIntegrationConfig = parseMessagingChannelIntegrationConfig(
    instagramIntegrationConnection?.config,
  );
  const zillowIntegrationConnection = integrationConnectionByProvider.get(IntegrationProvider.ZILLOW);
  const zillowIntegrationConfig = parseListingFeedIntegrationConfig(zillowIntegrationConnection?.config);
  const apartmentsIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.APARTMENTS_COM,
  );
  const apartmentsIntegrationConfig = parseListingFeedIntegrationConfig(
    apartmentsIntegrationConnection?.config,
  );
  const slackIntegrationConnection = integrationConnectionByProvider.get(IntegrationProvider.SLACK);
  const slackIntegrationConfig = parseSlackIntegrationConfig(slackIntegrationConnection?.config);
  const s3IntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.S3_COMPATIBLE,
  );
  const s3IntegrationConfig = parseS3CompatibleIntegrationConfig(s3IntegrationConnection?.config);
  const csvImportIntegrationConnection = integrationConnectionByProvider.get(
    IntegrationProvider.CSV_IMPORT,
  );
  const csvImportConfig =
    csvImportIntegrationConnection?.config &&
    typeof csvImportIntegrationConnection.config === "object" &&
    !Array.isArray(csvImportIntegrationConnection.config)
      ? (csvImportIntegrationConnection.config as {
          defaultLeadSourceId?: string | null;
          sourceLabel?: string | null;
        })
      : null;
  const csvImportPreviewMetadata =
    csvImportIntegrationConnection?.metadata &&
    typeof csvImportIntegrationConnection.metadata === "object" &&
    !Array.isArray(csvImportIntegrationConnection.metadata) &&
    "preview" in csvImportIntegrationConnection.metadata &&
    csvImportIntegrationConnection.metadata.preview &&
    typeof csvImportIntegrationConnection.metadata.preview === "object"
      ? (csvImportIntegrationConnection.metadata.preview as {
          headerFields?: string[];
          invalidRowCount?: number;
          rows?: Array<{
            email?: string | null;
            errors?: string[];
            fullName?: string | null;
            phone?: string | null;
            rowNumber?: number;
            status?: "valid" | "invalid";
          }>;
          sampleRowCount?: number;
          validRowCount?: number;
        })
      : null;
  const integrationHubConnections = integrationCatalog.map((integrationDefinition) => {
    const storedConnection = integrationConnectionByProvider.get(integrationDefinition.provider);
    const latestSyncEvent = storedConnection?.syncHistory[0] ?? null;

    if (storedConnection) {
      const setupState = resolveIntegrationSetupState({
        authState: storedConnection.authState,
        enabled: storedConnection.enabled,
        hasMappingConfig: hasStructuredIntegrationMappingConfig(storedConnection.mappingConfig),
        healthState: storedConnection.healthState,
        provider: storedConnection.provider,
      });

      return {
        authState: formatEnumLabel(storedConnection.authState),
        authStateValue: storedConnection.authState,
        category: formatEnumLabel(integrationDefinition.category),
        currentSetupLabel: setupState.label,
        currentSetupStep: setupState.currentStep,
        description: integrationDefinition.description,
        enabled: storedConnection.enabled,
        healthMessage: storedConnection.healthMessage ?? null,
        healthState: formatEnumLabel(storedConnection.healthState),
        healthStateValue: storedConnection.healthState,
        id: storedConnection.id,
        label: storedConnection.displayName,
        lastSyncAt: formatDateTime(storedConnection.lastSyncAt),
        latestSyncSummary: latestSyncEvent?.summary ?? storedConnection.lastSyncMessage ?? null,
        provider: storedConnection.provider,
        summary: formatIntegrationConnectionSummary({
          authState: storedConnection.authState,
          enabled: storedConnection.enabled,
          healthMessage: storedConnection.healthMessage,
          lastSyncMessage: storedConnection.lastSyncMessage,
          syncStatus: storedConnection.syncStatus,
        }),
        syncStatus: formatEnumLabel(storedConnection.syncStatus),
        syncStatusValue: storedConnection.syncStatus,
        totalSetupSteps: setupState.totalSteps,
      };
    }

    if (
      integrationDefinition.provider === IntegrationProvider.GOOGLE_CALENDAR ||
      integrationDefinition.provider === IntegrationProvider.OUTLOOK_CALENDAR
    ) {
      const calendarProvider =
        integrationDefinition.provider === IntegrationProvider.GOOGLE_CALENDAR
          ? CalendarSyncProvider.GOOGLE
          : CalendarSyncProvider.OUTLOOK;
      const calendarConnection = calendarConnections[calendarProvider];
      const authState =
        calendarConnection.status === "DISCONNECTED"
          ? IntegrationAuthState.NOT_CONNECTED
          : calendarConnection.status === "ACTIVE"
            ? IntegrationAuthState.ACTIVE
            : calendarConnection.status === "ERROR"
              ? IntegrationAuthState.ERROR
              : IntegrationAuthState.CONFIGURED;
      const syncStatus =
        authState === IntegrationAuthState.ERROR
          ? IntegrationSyncStatus.FAILED
          : authState === IntegrationAuthState.ACTIVE && calendarConnection.syncEnabled
            ? IntegrationSyncStatus.SUCCESS
            : IntegrationSyncStatus.IDLE;
      const healthState = resolveIntegrationHealthState({
        authState,
        enabled: calendarConnection.syncEnabled,
        healthMessage: calendarConnection.errorMessage,
        syncStatus,
      });
      const setupState = resolveIntegrationSetupState({
        authState,
        enabled: calendarConnection.syncEnabled,
        hasMappingConfig: calendarConnection.syncEnabled,
        healthState,
        provider: integrationDefinition.provider,
      });

      return {
        authState: formatEnumLabel(authState),
        authStateValue: authState,
        category: formatEnumLabel(integrationDefinition.category),
        currentSetupLabel: setupState.label,
        currentSetupStep: setupState.currentStep,
        description: integrationDefinition.description,
        enabled: calendarConnection.syncEnabled,
        healthMessage: calendarConnection.errorMessage,
        healthState: formatEnumLabel(healthState),
        healthStateValue: healthState,
        id: integrationDefinition.provider,
        label: integrationDefinition.label,
        lastSyncAt: "Not synced yet",
        latestSyncSummary: null,
        provider: integrationDefinition.provider,
        summary: formatCalendarConnectionSummary(calendarConnection),
        syncStatus: formatEnumLabel(syncStatus),
        syncStatusValue: syncStatus,
        totalSetupSteps: setupState.totalSteps,
      };
    }

    const screeningConnection = screeningConnectionByProvider.get(integrationDefinition.provider);

    if (screeningConnection) {
      const authState =
        screeningConnection.authState === ScreeningConnectionAuthState.DISCONNECTED
          ? IntegrationAuthState.NOT_CONNECTED
          : screeningConnection.authState === ScreeningConnectionAuthState.ACTIVE
            ? IntegrationAuthState.ACTIVE
            : screeningConnection.authState === ScreeningConnectionAuthState.ERROR
              ? IntegrationAuthState.ERROR
              : IntegrationAuthState.CONFIGURED;
      const syncStatus =
        authState === IntegrationAuthState.ERROR
          ? IntegrationSyncStatus.FAILED
          : authState === IntegrationAuthState.ACTIVE
            ? IntegrationSyncStatus.SUCCESS
            : IntegrationSyncStatus.IDLE;
      const healthState = resolveIntegrationHealthState({
        authState,
        enabled: authState !== IntegrationAuthState.NOT_CONNECTED,
        healthMessage: screeningConnection.lastError,
        syncStatus,
      });
      const setupState = resolveIntegrationSetupState({
        authState,
        enabled: authState !== IntegrationAuthState.NOT_CONNECTED,
        hasMappingConfig: Boolean(screeningConnection.packageConfig),
        healthState,
        provider: integrationDefinition.provider,
      });

      return {
        authState: formatEnumLabel(authState),
        authStateValue: authState,
        category: formatEnumLabel(integrationDefinition.category),
        currentSetupLabel: setupState.label,
        currentSetupStep: setupState.currentStep,
        description: integrationDefinition.description,
        enabled: authState !== IntegrationAuthState.NOT_CONNECTED,
        healthMessage: screeningConnection.lastError ?? null,
        healthState: formatEnumLabel(healthState),
        healthStateValue: healthState,
        id: integrationDefinition.provider,
        label: integrationDefinition.label,
        lastSyncAt: formatDateTime(screeningConnection.lastSyncAt),
        latestSyncSummary: null,
        provider: integrationDefinition.provider,
        summary: formatScreeningConnectionSummary({
          authState: screeningConnection.authState,
          connectedAccount: screeningConnection.connectedAccount,
          defaultPackageLabel: screeningConnection.defaultPackageLabel,
          lastError: screeningConnection.lastError,
        }),
        syncStatus: formatEnumLabel(syncStatus),
        syncStatusValue: syncStatus,
        totalSetupSteps: setupState.totalSteps,
      };
    }

    if (integrationDefinition.provider === IntegrationProvider.OUTBOUND_WEBHOOK) {
      const syncStatus =
        outboundWebhookFailureCount > 0
          ? IntegrationSyncStatus.FAILED
          : outboundWebhookPendingCount > 0
            ? IntegrationSyncStatus.PENDING
            : IntegrationSyncStatus.IDLE;
      const healthState =
        outboundWebhookFailureCount > 0
          ? IntegrationHealthState.ERROR
          : outboundWebhookPendingCount > 0
            ? IntegrationHealthState.DEGRADED
            : IntegrationHealthState.UNKNOWN;
      const setupState = resolveIntegrationSetupState({
        authState: IntegrationAuthState.NOT_CONNECTED,
        enabled: false,
        hasMappingConfig: false,
        healthState,
        provider: integrationDefinition.provider,
      });

      return {
        authState: formatEnumLabel(IntegrationAuthState.NOT_CONNECTED),
        authStateValue: IntegrationAuthState.NOT_CONNECTED,
        category: formatEnumLabel(integrationDefinition.category),
        currentSetupLabel: setupState.label,
        currentSetupStep: setupState.currentStep,
        description: integrationDefinition.description,
        enabled: outboundWebhookPendingCount > 0 || outboundWebhookFailureCount > 0,
        healthMessage:
          outboundWebhookFailureCount > 0
            ? `${outboundWebhookFailureCount} webhook deliveries failed.`
            : outboundWebhookPendingCount > 0
              ? `${outboundWebhookPendingCount} webhook deliveries pending retry.`
              : null,
        healthState: formatEnumLabel(healthState),
        healthStateValue: healthState,
        id: integrationDefinition.provider,
        label: integrationDefinition.label,
        lastSyncAt: "Not delivered yet",
        latestSyncSummary: null,
        provider: integrationDefinition.provider,
        summary:
          outboundWebhookFailureCount > 0
            ? `${outboundWebhookFailureCount} failed deliveries need attention.`
            : outboundWebhookPendingCount > 0
              ? `${outboundWebhookPendingCount} deliveries are queued.`
              : "No outbound webhook destination configured.",
        syncStatus: formatEnumLabel(syncStatus),
        syncStatusValue: syncStatus,
        totalSetupSteps: setupState.totalSteps,
      };
    }

    const setupState = resolveIntegrationSetupState({
      authState: IntegrationAuthState.NOT_CONNECTED,
      enabled: false,
      hasMappingConfig: false,
      healthState: IntegrationHealthState.UNKNOWN,
      provider: integrationDefinition.provider,
    });

    return {
      authState: formatEnumLabel(IntegrationAuthState.NOT_CONNECTED),
      authStateValue: IntegrationAuthState.NOT_CONNECTED,
      category: formatEnumLabel(integrationDefinition.category),
      currentSetupLabel: setupState.label,
      currentSetupStep: setupState.currentStep,
      description: integrationDefinition.description,
      enabled: false,
      healthMessage: null,
      healthState: formatEnumLabel(IntegrationHealthState.UNKNOWN),
      healthStateValue: IntegrationHealthState.UNKNOWN,
      id: integrationDefinition.provider,
      label: integrationDefinition.label,
      lastSyncAt: "Not configured",
      latestSyncSummary: null,
      provider: integrationDefinition.provider,
      summary: "Not set up",
      syncStatus: formatEnumLabel(IntegrationSyncStatus.IDLE),
      syncStatusValue: IntegrationSyncStatus.IDLE,
      totalSetupSteps: setupState.totalSteps,
    };
  });
  const integrationHealthOverview = {
    connected:
      integrationHubConnections.filter((connection) => connection.enabled).length,
    degraded: integrationHubConnections.filter(
      (connection) => connection.healthStateValue === IntegrationHealthState.DEGRADED,
    ).length,
    errors: integrationHubConnections.filter(
      (connection) => connection.healthStateValue === IntegrationHealthState.ERROR,
    ).length,
    total: integrationHubConnections.length,
  };

  return {
    dailyAutomatedSendCap: membership.workspace.dailyAutomatedSendCap,
    canUseCalendarSync: workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.CALENDAR_SYNC,
    ),
    canUseScreening: workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.SCREENING,
    ),
    canUseTeamScheduling:
      membership.workspace.planType === WorkspacePlanType.ORG &&
      workspaceHasCapability(
        membership.workspace.enabledCapabilities,
        WorkspaceCapability.ORG_MEMBERS,
      ),
    hasWhatsAppMessagingCapability: workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.WHATSAPP_MESSAGING,
    ),
    hasInstagramMessagingCapability: workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.INSTAGRAM_MESSAGING,
    ),
    csvImportIntegration: {
      defaultLeadSourceId: csvImportConfig?.defaultLeadSourceId ?? null,
      fieldMappings: parseIntegrationFieldMappings(csvImportIntegrationConnection?.mappingConfig),
      preview:
        csvImportPreviewMetadata
          ? {
              headerFields: csvImportPreviewMetadata.headerFields ?? [],
              invalidRowCount: csvImportPreviewMetadata.invalidRowCount ?? 0,
              rows: (csvImportPreviewMetadata.rows ?? []).map((row) => ({
                email: row.email ?? null,
                errors: row.errors ?? [],
                fullName: row.fullName ?? null,
                phone: row.phone ?? null,
                rowNumber: row.rowNumber ?? 0,
                status: row.status ?? "invalid",
              })),
              sampleRowCount: csvImportPreviewMetadata.sampleRowCount ?? 0,
              validRowCount: csvImportPreviewMetadata.validRowCount ?? 0,
            }
          : null,
      sourceLabel: csvImportConfig?.sourceLabel ?? "CSV import",
      summary: csvImportIntegrationConnection?.lastSyncMessage ?? "CSV mapping not configured.",
      webhookEnabled: csvImportIntegrationConnection?.enabled ?? false,
    },
    inboundWebhookIntegration: {
      defaultLeadSourceId: inboundWebhookIntegrationConfig.defaultLeadSourceId,
      defaultLeadSourceType: inboundWebhookIntegrationConfig.defaultLeadSourceType,
      defaultMessageChannel: inboundWebhookIntegrationConfig.defaultMessageChannel,
      fieldMappings: inboundWebhookIntegrationConfig.fieldMappings,
      secretHint: inboundWebhookIntegrationConfig.secretHint,
      signingHeader: inboundWebhookIntegrationConfig.signingHeader,
      sourceLabel: inboundWebhookIntegrationConfig.sourceLabel,
      webhookEnabled:
        integrationConnectionByProvider.get(IntegrationProvider.GENERIC_INBOUND_WEBHOOK)
          ?.enabled ?? false,
    },
    metaLeadAdsIntegration: {
      appSecret: metaLeadAdsIntegrationConfig.appSecret,
      campaignTag: metaLeadAdsIntegrationConfig.campaignTag,
      defaultLeadSourceId: metaLeadAdsIntegrationConfig.defaultLeadSourceId,
      fieldMappings: metaLeadAdsIntegrationConfig.fieldMappings,
      formId: metaLeadAdsIntegrationConfig.formId,
      pageId: metaLeadAdsIntegrationConfig.pageId,
      sourceLabel: metaLeadAdsIntegrationConfig.sourceLabel,
      summary:
        metaLeadAdsIntegrationConnection?.lastSyncMessage ?? "Meta Lead Ads not configured.",
      verifyToken: metaLeadAdsIntegrationConfig.verifyToken,
      webhookEnabled: metaLeadAdsIntegrationConnection?.enabled ?? false,
    },
    outboundWebhookIntegration: {
      destinations: outboundWebhookIntegrationConfig.destinations,
      eventTypes: outboundWebhookIntegrationConfig.eventTypes,
      failedDeliveryCount: outboundWebhookFailureCount,
      pendingDeliveryCount: outboundWebhookPendingCount,
      secretHint: outboundWebhookIntegrationConfig.secretHint,
      summary:
        outboundWebhookIntegrationConnection?.lastSyncMessage ??
        (outboundWebhookIntegrationConfig.destinations.length > 0
          ? `${outboundWebhookIntegrationConfig.destinations.filter((destination) => destination.enabled).length} outbound destination${outboundWebhookIntegrationConfig.destinations.filter((destination) => destination.enabled).length === 1 ? "" : "s"} configured.`
          : "No outbound webhook destination configured."),
      webhookEnabled: outboundWebhookIntegrationConnection?.enabled ?? false,
    },
    whatsappIntegration: {
      accountLabel: whatsappIntegrationConfig.accountLabel,
      allowInboundSync: whatsappIntegrationConfig.allowInboundSync,
      allowOutboundSend: whatsappIntegrationConfig.allowOutboundSend,
      defaultLeadSourceId: whatsappIntegrationConfig.defaultLeadSourceId,
      senderIdentifier: whatsappIntegrationConfig.senderIdentifier,
      summary:
        whatsappIntegrationConnection?.lastSyncMessage ?? "WhatsApp provider not configured.",
      verifyToken: whatsappIntegrationConfig.verifyToken,
      webhookEnabled: whatsappIntegrationConnection?.enabled ?? false,
    },
    instagramIntegration: {
      accountLabel: instagramIntegrationConfig.accountLabel,
      allowInboundSync: instagramIntegrationConfig.allowInboundSync,
      allowOutboundSend: instagramIntegrationConfig.allowOutboundSend,
      defaultLeadSourceId: instagramIntegrationConfig.defaultLeadSourceId,
      senderIdentifier: instagramIntegrationConfig.senderIdentifier,
      summary:
        instagramIntegrationConnection?.lastSyncMessage ??
        "Instagram provider not configured.",
      verifyToken: instagramIntegrationConfig.verifyToken,
      webhookEnabled: instagramIntegrationConnection?.enabled ?? false,
    },
    zillowListingFeedIntegration: {
      destinationName: zillowIntegrationConfig.destinationName,
      destinationPath: zillowIntegrationConfig.destinationPath,
      feedLabel: zillowIntegrationConfig.feedLabel,
      includeOnlyActiveProperties: zillowIntegrationConfig.includeOnlyActiveProperties,
      propertyCount: properties.length,
      summary:
        zillowIntegrationConnection?.lastSyncMessage ?? "Zillow feed not configured.",
      webhookEnabled: zillowIntegrationConnection?.enabled ?? false,
    },
    apartmentsListingFeedIntegration: {
      destinationName: apartmentsIntegrationConfig.destinationName,
      destinationPath: apartmentsIntegrationConfig.destinationPath,
      feedLabel: apartmentsIntegrationConfig.feedLabel,
      includeOnlyActiveProperties: apartmentsIntegrationConfig.includeOnlyActiveProperties,
      propertyCount: properties.length,
      summary:
        apartmentsIntegrationConnection?.lastSyncMessage ??
        "Apartments.com feed not configured.",
      webhookEnabled: apartmentsIntegrationConnection?.enabled ?? false,
    },
    slackIntegration: {
      channelLabel: slackIntegrationConfig.channelLabel,
      notifyOnApplicationInviteStale: slackIntegrationConfig.notifyOnApplicationInviteStale,
      notifyOnNewLead: slackIntegrationConfig.notifyOnNewLead,
      notifyOnReviewAlerts: slackIntegrationConfig.notifyOnReviewAlerts,
      notifyOnTourScheduled: slackIntegrationConfig.notifyOnTourScheduled,
      summary: slackIntegrationConnection?.lastSyncMessage ?? "Slack notifications not configured.",
      webhookEnabled: slackIntegrationConnection?.enabled ?? false,
      webhookUrl: slackIntegrationConfig.webhookUrl,
    },
    s3Integration: {
      accessKeyIdHint: s3IntegrationConfig.accessKeyIdHint,
      basePath: s3IntegrationConfig.basePath,
      bucket: s3IntegrationConfig.bucket,
      endpointUrl: s3IntegrationConfig.endpointUrl,
      manifestPreview: buildStorageManifestPreview({
        basePath: s3IntegrationConfig.basePath,
        workspaceSlug: membership.workspace.slug,
      }),
      region: s3IntegrationConfig.region,
      secretAccessKeyHint: s3IntegrationConfig.secretAccessKeyHint,
      summary:
        s3IntegrationConnection?.lastSyncMessage ?? "S3-compatible storage not configured.",
      webhookEnabled: s3IntegrationConnection?.enabled ?? false,
    },
    integrationHealthOverview,
    integrationHubConnections,
    leadSources: leadSources.map((leadSource) => ({
      id: leadSource.id,
      label: `${leadSource.name} · ${formatEnumLabel(leadSource.type)}`,
      name: leadSource.name,
      type: leadSource.type,
    })),
    missingInfoPromptThrottleMinutes:
      membership.workspace.missingInfoPromptThrottleMinutes,
    operatorSchedulingAvailabilitySummary: formatAvailabilityWindow(
      operatorSchedulingAvailability,
    ),
    operatorSchedulingAvailabilityStartLocal:
      operatorSchedulingAvailability?.startLocal ?? null,
    operatorSchedulingAvailabilityEndLocal:
      operatorSchedulingAvailability?.endLocal ?? null,
    operatorSchedulingAvailabilityTimeZone:
      operatorSchedulingAvailability?.timeZone ?? null,
    operatorSchedulingAvailabilityDays:
      operatorSchedulingAvailability?.days ?? [],
    googleCalendarConnectionSummary: formatCalendarConnectionSummary(
      calendarConnections[CalendarSyncProvider.GOOGLE],
    ),
    googleCalendarConnectedAccount:
      calendarConnections[CalendarSyncProvider.GOOGLE].connectedAccount,
    googleCalendarConnectionStatus:
      calendarConnections[CalendarSyncProvider.GOOGLE].status,
    googleCalendarConnectionSyncEnabled:
      calendarConnections[CalendarSyncProvider.GOOGLE].syncEnabled,
    googleCalendarConnectionError:
      calendarConnections[CalendarSyncProvider.GOOGLE].errorMessage,
    outlookCalendarConnectionSummary: formatCalendarConnectionSummary(
      calendarConnections[CalendarSyncProvider.OUTLOOK],
    ),
    outlookCalendarConnectedAccount:
      calendarConnections[CalendarSyncProvider.OUTLOOK].connectedAccount,
    outlookCalendarConnectionStatus:
      calendarConnections[CalendarSyncProvider.OUTLOOK].status,
    outlookCalendarConnectionSyncEnabled:
      calendarConnections[CalendarSyncProvider.OUTLOOK].syncEnabled,
    outlookCalendarConnectionError:
      calendarConnections[CalendarSyncProvider.OUTLOOK].errorMessage,
    tourSchedulingMode: membership.workspace.tourSchedulingMode,
    tourSchedulingModeSummary: formatTourSchedulingMode(
      membership.workspace.tourSchedulingMode,
    ),
    tourReminderSequence,
    tourReminderSequenceSummary: formatTourReminderSequenceSummary(
      tourReminderSequence,
    ),
    sharedCoverageMemberships: sharedCoverageMemberships.map((workspaceMembership) => ({
      id: workspaceMembership.id,
      name: workspaceMembership.user.name,
      sharedTourCoverageEnabled: workspaceMembership.sharedTourCoverageEnabled,
      schedulingAvailabilitySummary: formatAvailabilityWindow(
        parseAvailabilityWindowConfig(workspaceMembership.schedulingAvailability),
      ),
      lastTourAssignedAt: formatRelativeTime(workspaceMembership.lastTourAssignedAt),
    })),
    screeningConnections: screeningConnections.map((screeningConnection) => ({
      authState: screeningConnection.authState,
      chargeMode: screeningConnection.chargeMode,
      connectedAccount: screeningConnection.connectedAccount ?? "",
      defaultPackageKey: screeningConnection.defaultPackageKey ?? "",
      defaultPackageLabel: screeningConnection.defaultPackageLabel ?? "",
      disclosureStrategy: screeningConnection.disclosureStrategy ?? "",
      id: screeningConnection.id,
      lastError: screeningConnection.lastError ?? null,
      packageOptions: parseScreeningPackageConfig(screeningConnection.packageConfig),
      provider: screeningConnection.provider,
      providerLabel: formatEnumLabel(screeningConnection.provider),
      summary: formatScreeningConnectionSummary({
        authState: screeningConnection.authState,
        connectedAccount: screeningConnection.connectedAccount,
        defaultPackageLabel: screeningConnection.defaultPackageLabel,
        lastError: screeningConnection.lastError,
      }),
    })),
    workspaceQuietHoursStartLocal: membership.workspace.quietHoursStartLocal,
    workspaceQuietHoursEndLocal: membership.workspace.quietHoursEndLocal,
    workspaceQuietHoursTimeZone: membership.workspace.quietHoursTimeZone,
    workspaceQuietHoursSummary: formatQuietHours(
      membership.workspace.quietHoursStartLocal &&
        membership.workspace.quietHoursEndLocal &&
        membership.workspace.quietHoursTimeZone
        ? {
            startLocal: membership.workspace.quietHoursStartLocal,
            endLocal: membership.workspace.quietHoursEndLocal,
            timeZone: membership.workspace.quietHoursTimeZone,
          }
        : null,
    ),
    properties: properties.map((property) => ({
      id: property.id,
      name: property.name,
      schedulingAvailabilitySummary: formatAvailabilityWindow(
        parseAvailabilityWindowConfig(property.schedulingAvailability),
      ),
      quietHoursSummary: formatQuietHours(
        property.quietHoursStartLocal &&
          property.quietHoursEndLocal &&
          property.quietHoursTimeZone
          ? {
              startLocal: property.quietHoursStartLocal,
              endLocal: property.quietHoursEndLocal,
              timeZone: property.quietHoursTimeZone,
            }
          : null,
      ),
    })),
  };
});
