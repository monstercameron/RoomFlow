import { cache } from "react";
import { cookies } from "next/headers";
import {
  CalendarSyncProvider,
  LeadStatus,
  MessageChannel,
  PropertyLifecycleStatus,
  QualificationFit,
  RuleSeverity,
  ScreeningConnectionAuthState,
  ScreeningProvider,
  ScreeningRequestStatus,
  TemplateType,
  TourEventStatus,
  WorkspaceCapability,
  WorkspacePlanType,
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
import { workspaceHasCapability } from "@/lib/workspace-plan";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";
import { sortTimelineEventsDeterministically } from "@/lib/workflow-events";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatCurrency(value: number | null) {
  if (value === null) {
    return "-";
  }

  return currencyFormatter.format(value);
}

function formatCurrencyAmountCents(value: number | null, currency = "USD") {
  if (value === null) {
    return "Not recorded";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return dateFormatter.format(value);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return dateTimeFormatter.format(value);
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

function formatRelativeTime(value: Date | null) {
  if (!value) {
    return "No recent activity";
  }

  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return formatDate(value);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function formatFitLabel(value: QualificationFit) {
  return formatEnumLabel(value);
}

function formatStatusLabel(value: LeadStatus) {
  return formatEnumLabel(value);
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

export const getLeadListViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();
  const leads = await prisma.lead.findMany({
    where: {
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
    orderBy: [
      {
        lastActivityAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return leads.map((lead) => ({
    id: lead.id,
    name: lead.fullName,
    source: lead.leadSource?.name ?? "Manual",
    property: lead.property?.name ?? "Unassigned",
    moveInDate: formatDate(lead.moveInDate),
    budget: formatCurrency(lead.monthlyBudget),
    status: formatStatusLabel(lead.status),
    statusValue: lead.status,
    fit: formatFitLabel(lead.fitResult),
    fitValue: lead.fitResult,
    lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt),
  }));
});

export const getLeadDetailViewData = cache(async (leadId: string) => {
  const membership = await getCurrentWorkspaceMembership();
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
    property: lead.property?.name ?? "Unassigned",
    availableProperties: await prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
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
    evaluationSummary: evaluation.summary,
    evaluationIssues: evaluation.issues.map((issue) => ({
      label: issue.label,
      detail: issue.detail,
      severity: formatEnumLabel(issue.severity),
      outcome: formatEnumLabel(issue.outcome),
    })),
    recommendedStatus: formatStatusLabel(evaluation.recommendedStatus),
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
      overrideFit: roleActionPermissions.overrideFit,
      declineLead: roleActionPermissions.declineLead,
      confirmDuplicate:
        Boolean(possibleDuplicateCandidate) && roleActionPermissions.archiveLead,
    },
  };
});

export const getInboxViewData = cache(async (queueFilter?: string) => {
  const membership = await getCurrentWorkspaceMembership();
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
    },
    include: {
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
        questions: propertyQuestionSet.questions,
      });
      questionSetsByPropertyId.set(propertyQuestionSet.propertyId, existingQuestionSets);
    }
  }

  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
      lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
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

      return {
        canRequestInfo:
          qualificationAutomationGateResult.canRunAutomation &&
          !leadStatusIsInactive &&
          !qualificationCompleted &&
          !missingInfoPromptIsThrottled &&
          roleActionPermissions.requestInfo,
        isReviewQueueItem:
          lead.fitResult === QualificationFit.CAUTION ||
          lead.fitResult === QualificationFit.MISMATCH ||
          lead.status === LeadStatus.UNDER_REVIEW ||
          lead.auditEvents.some(
            (auditEvent) =>
              auditEvent.eventType === "possible_duplicate_flagged" ||
              auditEvent.eventType === "lead_conflict_detected",
          ),
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

export const getPropertyQuestionsViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
  const hasAiAssist = workspaceHasCapability(
    membership.workspace.enabledCapabilities,
    WorkspaceCapability.AI_ASSIST,
  );
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: membership.workspaceId,
    },
    include: {
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
    questionSets: property.questionSets.map((set) => ({
      id: set.id,
      name: set.name,
      isDefault: set.isDefault,
      questions: set.questions.map((question) => ({
        id: question.id,
        label: question.label,
        fieldKey: question.fieldKey,
        type: formatEnumLabel(question.type),
        required: question.required,
      })),
    })),
  };
});

export const getPropertyDetailViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
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
    questionCount: property.questionSets.reduce(
      (totalCount, questionSet) => totalCount + questionSet.questions.length,
      0,
    ),
    defaultQuestionSetCount: property.questionSets.filter(
      (questionSet) => questionSet.isDefault,
    ).length,
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
  const qualifiedStatuses = new Set<LeadStatus>([
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
  ]);
  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
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
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: membership.workspaceId,
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
  const scheduledTours = await prisma.tourEvent.findMany({
    where: {
      workspaceId: membership.workspaceId,
      status: TourEventStatus.SCHEDULED,
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
  const properties = await prisma.property.findMany({
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
  });

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
