import { cache } from "react";
import { cookies } from "next/headers";
import {
  LeadStatus,
  MessageChannel,
  QualificationFit,
  RuleSeverity,
  TemplateType,
} from "@/generated/prisma/client";
import {
  buildLeadTimeline,
  evaluateLeadQualification,
  getLeadActionAvailability,
  getLeadWorkflowContext,
  renderTemplateForLead,
} from "@/lib/lead-workflow";
import {
  DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES,
  isManualOnlyAutomationModeEnabled,
  isMissingInfoPromptThrottled,
  isQualificationCompleted,
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
import { getLeadActionPermissionsForMembershipRole } from "@/lib/membership-role-permissions";
import { prisma } from "@/lib/prisma";
import { deriveWorkflowKpis } from "@/lib/kpi-derivation";
import { getServerSession } from "@/lib/session";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";

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

function formatCurrency(value: number | null) {
  if (value === null) {
    return "-";
  }

  return currencyFormatter.format(value);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return dateFormatter.format(value);
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

function formatFitLabel(value: QualificationFit) {
  return formatEnumLabel(value);
}

function formatStatusLabel(value: LeadStatus) {
  return formatEnumLabel(value);
}

function formatChannelLabel(value: MessageChannel) {
  return value === MessageChannel.INTERNAL_NOTE ? "Internal note" : value;
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
    case TemplateType.MISSING_INFO_FOLLOW_UP:
      return "Collects missing move-in, budget, or rule answers.";
    case TemplateType.TOUR_CONFIRMATION:
      return "Confirms the scheduling handoff for qualified leads.";
    case TemplateType.APPLICATION_INVITE:
      return "Invites a lead into the application step.";
    case TemplateType.DECLINE:
      return "Closes the loop when a lead misses a required rule.";
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

function getMissingInfoPromptThrottleWindowMinutes() {
  const configuredThrottleWindowMinutes = Number(
    process.env.MISSING_INFO_PROMPT_THROTTLE_MINUTES,
  );

  if (
    Number.isFinite(configuredThrottleWindowMinutes) &&
    configuredThrottleWindowMinutes > 0
  ) {
    return configuredThrottleWindowMinutes;
  }

  return DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES;
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
  const lead = await getLeadWorkflowContext(membership.workspaceId, leadId);

  if (!lead) {
    return null;
  }

  const evaluation = evaluateLeadQualification(lead);
  const workflowActionAvailability = getLeadActionAvailability(lead, evaluation);
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
  const normalizedFieldMetadataRows = buildLeadFieldMetadataRows(lead.fieldMetadata);

  const messages =
    lead.conversation?.messages.map((message) => ({
      direction: formatEnumLabel(message.direction),
      at: formatRelativeTime(
        message.sentAt ?? message.receivedAt ?? message.createdAt,
      ),
      body: message.body,
    })) ?? [];

  const preferredContact =
    lead.preferredContactChannel ??
    lead.contact?.preferredChannel ??
    (lead.email ? "EMAIL" : lead.phone ? "SMS" : null);

  return {
    id: lead.id,
    source: lead.leadSource?.name ?? "Manual",
    name: lead.fullName,
    property: lead.property?.name ?? "Unassigned",
    availableProperties: await prisma.property.findMany({
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
    status: formatStatusLabel(lead.status),
    statusValue: lead.status,
    contactMethod: preferredContact
      ? formatEnumLabel(preferredContact)
      : "Not set",
    moveInDate: formatDate(lead.moveInDate),
    budget: formatCurrency(lead.monthlyBudget),
    stayLength: formatStayLength(lead.stayLengthMonths),
    workStatus: lead.workStatus ?? "Not provided",
    notes: lead.notes ?? "No operator notes yet.",
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
    timeline,
    messages,
    normalizedFieldMetadataRows,
    possibleDuplicateCandidate,
    actions: {
      evaluateFit:
        workflowActionAvailability.evaluateFit && roleActionPermissions.evaluateFit,
      requestInfo:
        workflowActionAvailability.requestInfo && roleActionPermissions.requestInfo,
      scheduleTour:
        workflowActionAvailability.scheduleTour &&
        roleActionPermissions.scheduleTour,
      sendApplication:
        workflowActionAvailability.sendApplication &&
        roleActionPermissions.sendApplication,
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
  const threads = await prisma.lead.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    include: {
      contact: true,
      property: {
        select: {
          id: true,
          name: true,
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
    getMissingInfoPromptThrottleWindowMinutes();

  const mappedThreads = threads.map((lead) => ({
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
    id: lead.id,
    name: lead.fullName,
    source: lead.leadSource?.name ?? "Manual",
    property: lead.property?.name ?? "Unassigned",
    status: formatStatusLabel(lead.status),
    fit: formatFitLabel(lead.fitResult),
    lastActivity: formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt),
    latestMessage:
      lead.conversation?.messages[0]?.body ?? "No messages yet on this lead.",
    latestMessageDirection: lead.conversation?.messages[0]
      ? formatEnumLabel(lead.conversation.messages[0].direction)
      : "No thread",
    needsAssignment: !lead.propertyId && roleActionPermissions.assignProperty,
    availableProperties: properties,
  }));

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
});

export const getPropertyQuestionsViewData = cache(async (propertyId: string) => {
  const membership = await getCurrentWorkspaceMembership();
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

  return {
    propertyId: property.id,
    propertyName: property.name,
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
      id: property.id,
      name: property.name,
      activeRooms: property.rentableRoomCount ?? 0,
      activeLeads,
      qualifiedLeads,
      rulesCount: property._count.rules,
      schedulingUrl: property.schedulingUrl,
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
  const properties = await prisma.property.findMany({
    where: {
      workspaceId: membership.workspaceId,
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
    properties: properties.map((property) => ({
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

  return templates.map((template) => {
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
      purpose: describeTemplateType(template.type),
      subject: template.subject,
      preview: previewBody,
    };
  });
});
