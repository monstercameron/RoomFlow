import { createHmac } from "node:crypto";
import {
  AuditActorType,
  ContactChannel,
  LeadStatus,
  MessageChannel,
  MessageDirection,
  MessageOrigin,
  NotificationType,
  type Prisma,
  QualificationFit,
  RuleSeverity,
  TemplateType,
  TourEventStatus,
  WebhookDeliveryStatus,
} from "@/generated/prisma/client";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import {
  enqueueOutboundMessageSend,
  enqueueOutboundWebhookDelivery,
  scheduleReminderSend,
} from "@/lib/jobs";
import { buildLeadStatusTransitionAuditPayload } from "@/lib/lead-status-transition-audit";
import { LeadWorkflowError } from "@/lib/lead-workflow-errors";
import {
  DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES,
  isManualOnlyAutomationModeEnabled,
  isMissingInfoPromptThrottled,
  isQualificationCompleted,
  resolveMissingRequiredQualificationQuestions,
  resolveMostRecentMissingInfoRequestTimestamp,
  resolveQualificationAutomationGate,
  type QualificationAutomationBlockingReason,
} from "@/lib/lead-qualification-guard";
import {
  evaluateLeadRules,
  type LeadRuleEvaluationResult,
  resolveRuleCategoryFromLabel,
  resolveRuleMode,
} from "@/lib/lead-rule-engine";
import {
  assertLeadStatusTransitionIsAllowed,
  resolveLeadStatusAfterEvaluation,
} from "@/lib/lead-status-machine";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import { sendOwnerAdminNotificationEmail } from "@/lib/notification-delivery";
import { prisma } from "@/lib/prisma";
import {
  dedupeNearSimultaneousTimelineEvents,
  sortTimelineEventsDeterministically,
  workflowEventTypes,
} from "@/lib/workflow-events";

type WorkflowLead = Awaited<ReturnType<typeof getLeadWorkflowContext>>;
type TemplateRenderLeadContext = {
  fullName: string;
  moveInDate: Date | null;
  monthlyBudget: number | null;
  property: {
    name: string;
    schedulingUrl: string | null;
  } | null;
  workspace: {
    name: string;
  };
  leadSource: {
    name: string;
  } | null;
};

type EvaluationIssue = {
  label: string;
  detail: string;
  severity: "required" | "warning" | "preference";
  outcome: "pass" | "caution" | "mismatch" | "unknown";
};

type EvaluationResult = {
  fitResult: QualificationFit;
  recommendedStatus: LeadStatus;
  summary: string;
  issues: EvaluationIssue[];
  ruleEvaluation?: LeadRuleEvaluationResult;
};

export type WorkflowActionName =
  | "evaluate_fit"
  | "request_info"
  | "schedule_tour"
  | "send_application";

const schedulableLeadStatuses = new Set<LeadStatus>([
  LeadStatus.QUALIFIED,
  LeadStatus.TOUR_SCHEDULED,
]);

const defaultChannelPriorityOrder: MessageChannel[] = [
  MessageChannel.SMS,
  MessageChannel.EMAIL,
];

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

function resolveWorkflowErrorCodeForQualificationAutomationBlockingReason(
  qualificationAutomationBlockingReason: QualificationAutomationBlockingReason,
): "ACTION_REQUIRES_PROPERTY" | "ACTION_REQUIRES_ACTIVE_QUESTION_SET" | "ACTION_REQUIRES_CONTACT_CHANNEL" {
  switch (qualificationAutomationBlockingReason) {
    case "missing_property":
      return "ACTION_REQUIRES_PROPERTY";
    case "missing_active_question_set":
      return "ACTION_REQUIRES_ACTIVE_QUESTION_SET";
    case "missing_contact_channel":
      return "ACTION_REQUIRES_CONTACT_CHANNEL";
  }
}

function resolveOutboundMessageChannelForAction(params: {
  action: Exclude<WorkflowActionName, "evaluate_fit">;
  templateChannel: MessageChannel | null | undefined;
  lead: NonNullable<WorkflowLead>;
  manualOnlyModeEnabled: boolean;
  channelPriorityOrder: MessageChannel[];
}) {
  if (params.templateChannel) {
    return params.templateChannel;
  }

  const resolvedContactEmailAddress = params.lead.contact?.email ?? params.lead.email;
  const resolvedContactPhoneNumber = params.lead.contact?.phone ?? params.lead.phone;
  const hasDeliverableEmailChannel = Boolean(resolvedContactEmailAddress);
  const hasDeliverableSmsChannel = Boolean(resolvedContactPhoneNumber);

  if (
    params.lead.preferredContactChannel === ContactChannel.SMS &&
    hasDeliverableSmsChannel
  ) {
    return MessageChannel.SMS;
  }

  if (
    params.lead.preferredContactChannel === ContactChannel.EMAIL &&
    hasDeliverableEmailChannel
  ) {
    return MessageChannel.EMAIL;
  }

  for (const prioritizedMessageChannel of params.channelPriorityOrder) {
    if (prioritizedMessageChannel === MessageChannel.SMS && hasDeliverableSmsChannel) {
      return MessageChannel.SMS;
    }

    if (
      prioritizedMessageChannel === MessageChannel.EMAIL &&
      hasDeliverableEmailChannel
    ) {
      return MessageChannel.EMAIL;
    }
  }

  if (params.manualOnlyModeEnabled) {
    return MessageChannel.INTERNAL_NOTE;
  }

  return params.action === "request_info"
    ? MessageChannel.SMS
    : MessageChannel.EMAIL;
}

function resolveChannelPriorityOrder(channelPriorityValue: unknown) {
  if (!Array.isArray(channelPriorityValue)) {
    return defaultChannelPriorityOrder;
  }

  const parsedPriorityOrder = channelPriorityValue
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

  return parsedPriorityOrder.length > 0
    ? parsedPriorityOrder
    : defaultChannelPriorityOrder;
}

function isLeadActiveForAutomation(leadStatus: LeadStatus) {
  return (
    leadStatus !== LeadStatus.DECLINED &&
    leadStatus !== LeadStatus.ARCHIVED &&
    leadStatus !== LeadStatus.CLOSED
  );
}

function isChannelDeliverableForLead(params: {
  outboundMessageChannel: MessageChannel;
  lead: NonNullable<WorkflowLead>;
}) {
  const resolvedContactEmailAddress = params.lead.contact?.email ?? params.lead.email;
  const resolvedContactPhoneNumber = params.lead.contact?.phone ?? params.lead.phone;

  if (params.outboundMessageChannel === MessageChannel.EMAIL) {
    return Boolean(resolvedContactEmailAddress);
  }

  if (params.outboundMessageChannel === MessageChannel.SMS) {
    return Boolean(resolvedContactPhoneNumber);
  }

  return true;
}

function isSameUtcDay(leftDate: Date, rightDate: Date) {
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function stringifyAnswerValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stringifyAnswerValue(entry)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "";
}

function formatDisplayDate(value: Date | null) {
  if (!value) {
    return "not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatDisplayCurrency(value: number | null) {
  if (value === null) {
    return "not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  return formatDisplayDate(value);
}

function toSeverityLabel(severity: RuleSeverity) {
  if (severity === RuleSeverity.WARNING) {
    return "warning";
  }

  if (severity === RuleSeverity.PREFERENCE) {
    return "preference";
  }

  return "required";
}

function buildAnswerIndex(
  lead: NonNullable<WorkflowLead>,
): Map<string, string> {
  const answers = new Map<string, string>();

  for (const answer of lead.answers) {
    const value = stringifyAnswerValue(answer.value);
    answers.set(normalizeText(answer.question.fieldKey), value);
    answers.set(normalizeText(answer.question.label), value);
  }

  return answers;
}

function resolveMissingRequiredQuestionsForLead(lead: NonNullable<WorkflowLead>) {
  if (!lead.property) {
    return [];
  }

  return resolveMissingRequiredQualificationQuestions({
    propertyQuestionSets: lead.property.questionSets,
    leadAnswers: lead.answers.map((leadAnswer) => ({
      questionId: leadAnswer.questionId,
      value: leadAnswer.value,
    })),
  });
}

export async function getLeadWorkflowContext(workspaceId: string, leadId: string) {
  return prisma.lead.findFirst({
    where: {
      id: leadId,
      workspaceId,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          channelPriority: true,
          dailyAutomatedSendCap: true,
          webhookSigningSecret: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          smokingAllowed: true,
          petsAllowed: true,
          parkingAvailable: true,
          schedulingUrl: true,
          channelPriority: true,
          schedulingEnabled: true,
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
      contact: true,
      answers: {
        include: {
          question: {
            select: {
              id: true,
              fieldKey: true,
              label: true,
              required: true,
              sortOrder: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },
      auditEvents: {
        orderBy: {
          createdAt: "asc",
        },
      },
      conversation: {
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });
}

export function evaluateLeadQualification(lead: NonNullable<WorkflowLead>): EvaluationResult {
  const issues: EvaluationIssue[] = [];

  if (!lead.property) {
    return {
      fitResult: QualificationFit.UNKNOWN,
      recommendedStatus: LeadStatus.INCOMPLETE,
      summary: "Lead cannot be evaluated until it is assigned to a property.",
      issues: [
        {
          label: "Property assignment",
          detail: "Assign a property before evaluating fit.",
          severity: "required",
          outcome: "unknown",
        },
      ],
    };
  }

  const answers = buildAnswerIndex(lead);
  const hasAtLeastOnePropertyQuestion =
    lead.property.questionSets.flatMap((questionSet) => questionSet.questions).length > 0;

  if (!hasAtLeastOnePropertyQuestion) {
    return {
      fitResult: QualificationFit.UNKNOWN,
      recommendedStatus: LeadStatus.UNDER_REVIEW,
      summary:
        "Lead cannot be fully evaluated until the property has an active qualification question set.",
      issues: [
        {
          label: "Qualification question set",
          detail:
            "Add at least one active qualification question before running automated qualification.",
          severity: "required",
          outcome: "unknown",
        },
      ],
    };
  }

  const missingRequiredQuestions = resolveMissingRequiredQuestionsForLead(lead);

  for (const missingRequiredQuestion of missingRequiredQuestions) {
    issues.push({
      label: missingRequiredQuestion.label,
      detail: "Required qualification answer is still missing.",
      severity: "required",
      outcome: "unknown",
    });
  }

  if (missingRequiredQuestions.length > 0) {
    return {
      fitResult: QualificationFit.UNKNOWN,
      recommendedStatus: LeadStatus.INCOMPLETE,
      summary: "Lead still has missing information before a final fit call.",
      issues,
    };
  }

  const ruleEvaluation = evaluateLeadRules({
    rules: lead.property.rules.map((propertyRule) => ({
      id: propertyRule.id,
      label: propertyRule.label,
      ruleCategory: resolveRuleCategoryFromLabel(
        propertyRule.ruleCategory,
        propertyRule.category ?? propertyRule.label,
      ),
      mode: resolveRuleMode({
        explicitMode: propertyRule.mode,
        severity: propertyRule.severity,
        warningOnly: propertyRule.warningOnly,
        autoDecline: propertyRule.autoDecline,
      }),
      severity: propertyRule.severity,
      warningOnly: propertyRule.warningOnly,
      autoDecline: propertyRule.autoDecline,
      active: propertyRule.active,
    })),
    answersByFieldKey: answers,
    propertyDefaults: {
      smokingAllowed: lead.property.smokingAllowed,
      petsAllowed: lead.property.petsAllowed,
      parkingAvailable: lead.property.parkingAvailable,
      minimumStayMonths: 6,
    },
  });

  for (const ruleIssue of ruleEvaluation.issues) {
    issues.push({
      label: ruleIssue.ruleLabel,
      detail: ruleIssue.explanation,
      severity: toSeverityLabel(ruleIssue.severity),
      outcome:
        ruleIssue.triggered && ruleIssue.blocking
          ? "mismatch"
          : ruleIssue.triggered
            ? "caution"
            : "pass",
    });
  }

  if (ruleEvaluation.fitResult === QualificationFit.MISMATCH) {
    return {
      fitResult: QualificationFit.MISMATCH,
      recommendedStatus: LeadStatus.UNDER_REVIEW,
      summary: "Lead misses one or more blocking property rules and needs review.",
      issues,
      ruleEvaluation,
    };
  }

  if (ruleEvaluation.fitResult === QualificationFit.CAUTION) {
    return {
      fitResult: QualificationFit.CAUTION,
      recommendedStatus: LeadStatus.UNDER_REVIEW,
      summary: "Lead looks workable, but there are caution items to review.",
      issues,
      ruleEvaluation,
    };
  }

  return {
    fitResult: QualificationFit.PASS,
    recommendedStatus: LeadStatus.QUALIFIED,
    summary: "Lead currently matches the configured property rules.",
    issues,
    ruleEvaluation,
  };
}

function getTemplateFallback(
  type: TemplateType,
  lead: TemplateRenderLeadContext,
) {
  switch (type) {
    case TemplateType.MISSING_INFO_FOLLOW_UP:
      return {
        subject: "Quick follow-up on your room inquiry",
        body: "Thanks again. I still need a couple of missing details before I can confirm fit for this property.",
      };
    case TemplateType.TOUR_CONFIRMATION:
      return {
        subject: "Tour scheduling link",
        body: "You look like a strong fit so far. Here is the scheduling link for the next step: {{property.schedulingUrl}}",
      };
    case TemplateType.APPLICATION_INVITE:
      return {
        subject: "Application invite",
        body: "Thanks for moving forward. Here is the application step for {{property.name}}.",
      };
    case TemplateType.DECLINE:
      return {
        subject: "Update on your room inquiry",
        body: "Thanks for the interest. Based on the current property rules, I cannot move this inquiry forward for {{property.name}}.",
      };
    default:
      return {
        subject: `${formatEnumLabel(type)} message`,
        body: `Follow-up for ${lead.fullName}.`,
      };
  }
}

export function renderTemplateForLead(
  template: { subject: string | null; body: string; type: TemplateType },
  lead: TemplateRenderLeadContext,
) {
  const firstName = lead.fullName.split(" ")[0] || lead.fullName;
  const tokens = new Map<string, string>([
    ["lead.firstName", firstName],
    ["lead.fullName", lead.fullName],
    ["lead.moveInDate", formatDisplayDate(lead.moveInDate)],
    ["lead.monthlyBudget", formatDisplayCurrency(lead.monthlyBudget)],
    ["property.name", lead.property?.name ?? "this property"],
    ["property.schedulingUrl", lead.property?.schedulingUrl ?? "Scheduling link pending"],
    ["workspace.name", lead.workspace.name],
    ["lead.source", lead.leadSource?.name ?? "Manual intake"],
  ]);

  const replaceTokens = (value: string | null) =>
    (value ?? "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
      if (tokens.has(key)) {
        return tokens.get(key) ?? "";
      }

      return `{{${key}}}`;
    });

  return {
    subject: replaceTokens(template.subject),
    body: replaceTokens(template.body),
  };
}

function extractTemplateTokens(value: string) {
  const tokens = new Set<string>();
  const tokenRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match: RegExpExecArray | null = tokenRegex.exec(value);

  while (match) {
    tokens.add(match[1]);
    match = tokenRegex.exec(value);
  }

  return [...tokens];
}

export function renderTemplateForLeadSafely(
  template: { subject: string | null; body: string; type: TemplateType },
  lead: TemplateRenderLeadContext,
) {
  const rendered = renderTemplateForLead(template, lead);
  const unresolvedSubjectTokens = extractTemplateTokens(rendered.subject);
  const unresolvedBodyTokens = extractTemplateTokens(rendered.body);
  const unresolvedTokens = [
    ...new Set([...unresolvedSubjectTokens, ...unresolvedBodyTokens]),
  ];

  return {
    ...rendered,
    unresolvedTokens,
  };
}

function ensureSchedulingLinkInBody(body: string, schedulingUrl: string) {
  if (body.includes(schedulingUrl)) {
    return body;
  }

  return `${body.trim()}\n\n${schedulingUrl}`.trim();
}

async function appendAuditEvent(params: {
  workspaceId: string;
  leadId: string;
  propertyId: string | null;
  actorUserId: string;
  eventType: string;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      propertyId: params.propertyId,
      actorUserId: params.actorUserId,
      actorType: params.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      eventType: params.eventType,
      payload: params.payload,
    },
  });
}

async function appendNotificationEvent(params: {
  workspaceId: string;
  leadId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.notificationEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      type: params.type,
      title: params.title,
      body: params.body,
      payload: params.payload,
    },
  });

  try {
    await sendOwnerAdminNotificationEmail({
      workspaceId: params.workspaceId,
      subject: `[Roomflow] ${params.title}`,
      body: params.body,
    });
  } catch {
    // Email notifications are best-effort and should not block workflow actions.
  }
}

async function queueOutboundWorkflowWebhook(params: {
  workspaceId: string;
  leadId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  signingSecret: string | null | undefined;
}) {
  const destinationUrl = process.env.ROOMFLOW_OUTBOUND_WEBHOOK_URL;

  if (!destinationUrl) {
    return;
  }

  const payloadString = JSON.stringify(params.payload);
  const signature = params.signingSecret
    ? createHmac("sha256", params.signingSecret).update(payloadString).digest("hex")
    : null;

  await prisma.outboundWebhookDelivery.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      eventType: params.eventType,
      destinationUrl,
      signature,
      payload: params.payload,
      status: WebhookDeliveryStatus.PENDING,
      nextAttemptAt: new Date(),
    },
    select: {
      id: true,
    },
  }).then(async (createdWebhookDelivery) => {
    try {
      await enqueueOutboundWebhookDelivery({
        outboundWebhookDeliveryId: createdWebhookDelivery.id,
      });
    } catch {
      // Worker enqueue is best effort; the row is still persisted for retry jobs.
    }
  });
}

async function transitionLeadStatus(params: {
  lead: NonNullable<WorkflowLead>;
  workspaceId: string;
  propertyId: string | null;
  actorUserId: string;
  nextStatus: LeadStatus;
  transitionReason: string;
}) {
  if (params.lead.status === params.nextStatus) {
    return;
  }

  try {
    assertLeadStatusTransitionIsAllowed(params.lead.status, params.nextStatus);
  } catch {
    throw new LeadWorkflowError(
      "INVALID_STATUS_TRANSITION",
      `Lead status transition is not allowed: ${params.lead.status} -> ${params.nextStatus}`,
    );
  }

  await prisma.leadStatusHistory.create({
    data: {
      leadId: params.lead.id,
      fromStatus: params.lead.status,
      toStatus: params.nextStatus,
      reason: params.transitionReason,
    },
  });

  // Every material status transition gets a canonical audit event payload so
  // operators can trace who changed state, from what, to what, and why.
  await appendAuditEvent({
    workspaceId: params.workspaceId,
    leadId: params.lead.id,
    propertyId: params.propertyId,
    actorUserId: params.actorUserId,
    eventType: workflowEventTypes.statusChanged,
    payload: buildLeadStatusTransitionAuditPayload({
      actorUserId: params.actorUserId,
      fromStatus: params.lead.status,
      toStatus: params.nextStatus,
      transitionReason: params.transitionReason,
    }),
  });
}

function getTemplateTypeForAction(action: WorkflowActionName): TemplateType | null {
  switch (action) {
    case "request_info":
      return TemplateType.MISSING_INFO_FOLLOW_UP;
    case "schedule_tour":
      return TemplateType.TOUR_CONFIRMATION;
    case "send_application":
      return TemplateType.APPLICATION_INVITE;
    default:
      return null;
  }
}

export async function applyLeadEvaluation(params: {
  workspaceId: string;
  leadId: string;
  actorUserId: string;
}) {
  const lead = await getLeadWorkflowContext(params.workspaceId, params.leadId);

  if (!lead) {
    throw new LeadWorkflowError(
      "LEAD_NOT_FOUND",
      `Lead ${params.leadId} was not found in workspace ${params.workspaceId}.`,
    );
  }

  const evaluation = evaluateLeadQualification(lead);
  const nextStatus = resolveLeadStatusAfterEvaluation(
    lead.status,
    evaluation.recommendedStatus,
  );
  const missingRequiredQuestions = resolveMissingRequiredQuestionsForLead(lead);
  const qualificationCompletedAfterRouting = isQualificationCompleted({
    missingRequiredQuestionCount: missingRequiredQuestions.length,
    fitResult: evaluation.fitResult,
    currentLeadStatus: nextStatus,
  });

  await prisma.lead.update({
    where: {
      id: lead.id,
    },
    data: {
      fitResult: evaluation.fitResult,
      status: nextStatus,
      lastActivityAt: new Date(),
    },
  });

  await transitionLeadStatus({
    lead,
    workspaceId: params.workspaceId,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    nextStatus,
    transitionReason: evaluation.summary,
  });

  await appendAuditEvent({
    workspaceId: params.workspaceId,
    leadId: lead.id,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    eventType: workflowEventTypes.fitComputed,
    payload: {
      summary: evaluation.summary,
      previousStatus: lead.status,
      nextStatus,
      previousFitResult: lead.fitResult,
      nextFitResult: evaluation.fitResult,
      recommendedStatus: evaluation.recommendedStatus,
      missingRequiredQuestionCount: missingRequiredQuestions.length,
      qualificationCompleted: qualificationCompletedAfterRouting,
      ruleEvaluation: evaluation.ruleEvaluation
        ? {
            triggeredRuleIds: evaluation.ruleEvaluation.triggeredRuleIds,
            blockingRuleIds: evaluation.ruleEvaluation.blockingRuleIds,
            warningRuleIds: evaluation.ruleEvaluation.warningRuleIds,
            issues: evaluation.ruleEvaluation.issues.map((ruleIssue) => ({
              ruleId: ruleIssue.ruleId,
              category: ruleIssue.category,
              mode: ruleIssue.mode,
              severity: ruleIssue.severity,
              explanation: ruleIssue.explanation,
              triggered: ruleIssue.triggered,
            })),
          }
        : null,
    },
  });

  if ((evaluation.ruleEvaluation?.warningRuleIds.length ?? 0) > 0) {
    await appendAuditEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      propertyId: lead.propertyId,
      actorUserId: params.actorUserId,
      eventType: workflowEventTypes.warningTriggered,
      payload: {
        warningRuleIds: evaluation.ruleEvaluation?.warningRuleIds ?? [],
      },
    });
  }

  if ((evaluation.ruleEvaluation?.blockingRuleIds.length ?? 0) > 0) {
    await appendAuditEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      propertyId: lead.propertyId,
      actorUserId: params.actorUserId,
      eventType: workflowEventTypes.mismatchTriggered,
      payload: {
        blockingRuleIds: evaluation.ruleEvaluation?.blockingRuleIds ?? [],
      },
    });
  }

  if (evaluation.fitResult === QualificationFit.CAUTION) {
    await appendNotificationEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      type: NotificationType.CAUTION_REVIEW,
      title: "Lead requires caution review",
      body: `${lead.fullName} triggered caution rules and is routed to review.`,
      payload: {
        leadId: lead.id,
      },
    });
  }

  if (evaluation.fitResult === QualificationFit.MISMATCH) {
    await appendNotificationEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      type: NotificationType.MISMATCH_REVIEW,
      title: "Lead mismatch detected",
      body: `${lead.fullName} triggered blocking mismatch conditions.`,
      payload: {
        leadId: lead.id,
      },
    });

    await queueOutboundWorkflowWebhook({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      eventType: "lead.declined",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        leadId: lead.id,
        workspaceId: params.workspaceId,
        fitResult: evaluation.fitResult,
      },
    });
  }

  if (nextStatus === LeadStatus.QUALIFIED) {
    await queueOutboundWorkflowWebhook({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      eventType: "lead.qualified",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        leadId: lead.id,
        workspaceId: params.workspaceId,
      },
    });
  }

  return {
    leadId: lead.id,
    evaluation,
  };
}

export async function performLeadWorkflowAction(params: {
  workspaceId: string;
  leadId: string;
  actorUserId: string;
  action: Exclude<WorkflowActionName, "evaluate_fit">;
}) {
  const lead = await getLeadWorkflowContext(params.workspaceId, params.leadId);

  if (!lead) {
    throw new LeadWorkflowError(
      "LEAD_NOT_FOUND",
      `Lead ${params.leadId} was not found in workspace ${params.workspaceId}.`,
    );
  }

  const evaluation = evaluateLeadQualification(lead);
  const actionTemplateType = getTemplateTypeForAction(params.action);
  const manualOnlyModeEnabled = isManualOnlyAutomationModeEnabled(
    process.env.ROOMFLOW_MANUAL_ONLY_MODE,
  );
  const qualificationAutomationGateResult = resolveQualificationAutomationGate({
    leadPropertyId: lead.propertyId,
    propertyQuestionSets: lead.property?.questionSets ?? [],
    leadEmailAddress: lead.email,
    leadPhoneNumber: lead.phone,
    contactEmailAddress: lead.contact?.email ?? null,
    contactPhoneNumber: lead.contact?.phone ?? null,
    manualOnlyModeEnabled,
  });
  const missingRequiredQuestions = resolveMissingRequiredQuestionsForLead(lead);
  const invalidAnswerIssues = evaluation.issues.filter((evaluationIssue) =>
    evaluationIssue.detail.toLowerCase().includes("could not be parsed"),
  );
  const outboundMessageChannelPriorityOrder = resolveChannelPriorityOrder(
    lead.property?.channelPriority ?? lead.workspace.channelPriority,
  );
  const outboundMessageChannel = resolveOutboundMessageChannelForAction({
    action: params.action,
    templateChannel: null,
    lead,
    manualOnlyModeEnabled,
    channelPriorityOrder: outboundMessageChannelPriorityOrder,
  });
  const now = new Date();

  if (
    (params.action === "schedule_tour" || params.action === "send_application") &&
    evaluation.fitResult === QualificationFit.MISMATCH
  ) {
    throw new LeadWorkflowError(
      "ACTION_NOT_ALLOWED_FOR_MISMATCH",
      `Action ${params.action} is not allowed for mismatch fit results.`,
    );
  }

  if (!qualificationAutomationGateResult.canRunAutomation) {
    const qualificationAutomationBlockingReason =
      qualificationAutomationGateResult.blockingReason;

    if (!qualificationAutomationBlockingReason) {
      throw new Error(
        "Qualification automation gate returned blocked without a reason.",
      );
    }

    throw new LeadWorkflowError(
      resolveWorkflowErrorCodeForQualificationAutomationBlockingReason(
        qualificationAutomationBlockingReason,
      ),
      qualificationAutomationGateResult.detail ??
        `Action ${params.action} is blocked because qualification prerequisites are not met.`,
    );
  }

  if (
    (params.action === "schedule_tour" || params.action === "send_application") &&
    evaluation.recommendedStatus === LeadStatus.INCOMPLETE
  ) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_MISSING_INFO",
      `Action ${params.action} is blocked because the lead is missing required information.`,
    );
  }

  if (params.action === "request_info") {
    const mostRecentMissingInfoRequestAt = resolveMostRecentMissingInfoRequestTimestamp(
      lead.auditEvents.map((auditEvent) => ({
        eventType: auditEvent.eventType,
        createdAt: auditEvent.createdAt,
      })),
    );
    const missingInfoPromptIsThrottled = isMissingInfoPromptThrottled({
      mostRecentMissingInfoRequestAt,
      referenceTime: new Date(),
      throttleWindowMinutes: getMissingInfoPromptThrottleWindowMinutes(),
    });

    if (missingInfoPromptIsThrottled) {
      throw new LeadWorkflowError(
        "MISSING_INFO_PROMPT_THROTTLED",
        "A missing-information prompt was sent recently. Wait for the throttle window before sending another.",
      );
    }
  }

  if (!isLeadActiveForAutomation(lead.status)) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_INACTIVE_LEAD",
      `Lead status ${lead.status} is not active for automation.`,
    );
  }

  if (lead.optOutAt) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_OPT_OUT",
      "Lead has opted out and cannot receive automated outbound messages.",
    );
  }

  if (
    !isChannelDeliverableForLead({
      outboundMessageChannel,
      lead,
    })
  ) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_CHANNEL_INVALID",
      `Lead is missing required contact information for ${outboundMessageChannel}.`,
    );
  }

  if (
    lead.automatedSendCountDate &&
    isSameUtcDay(lead.automatedSendCountDate, now) &&
    lead.automatedSendCount >= lead.workspace.dailyAutomatedSendCap
  ) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_DAILY_SEND_CAP",
      `Daily automated send cap (${lead.workspace.dailyAutomatedSendCap}) is reached for this lead.`,
    );
  }

  if (params.action === "schedule_tour") {
    if (!lead.property) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_PROPERTY",
        "Lead needs a property assignment before scheduling.",
      );
    }

    if (!lead.property.schedulingEnabled || !lead.property.schedulingUrl) {
      throw new LeadWorkflowError(
        "SCHEDULING_LINK_REQUIRED",
        "The assigned property is missing an enabled scheduling link.",
      );
    }

    if (!schedulableLeadStatuses.has(lead.status)) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        `Lead status ${lead.status} is not eligible for schedule_tour.`,
      );
    }
  }

  let nextStatus = lead.status;
  let eventType = "";
  let reason = "";

  switch (params.action) {
    case "request_info":
      nextStatus = LeadStatus.AWAITING_RESPONSE;
      eventType = workflowEventTypes.qualificationQuestionSent;
      reason =
        invalidAnswerIssues.length > 0
          ? "Requested clarification for invalid or ambiguous answers."
          : "Requested the remaining qualification details.";
      break;
    case "schedule_tour":
      nextStatus = LeadStatus.TOUR_SCHEDULED;
      eventType = workflowEventTypes.tourScheduled;
      reason = "Sent the tour scheduling handoff.";
      break;
    case "send_application":
      nextStatus = LeadStatus.APPLICATION_SENT;
      eventType = workflowEventTypes.applicationSent;
      reason = "Sent the application invite.";
      break;
  }

  try {
    assertLeadStatusTransitionIsAllowed(lead.status, nextStatus);
  } catch {
    throw new LeadWorkflowError(
      "INVALID_STATUS_TRANSITION",
      `Lead status transition is not allowed: ${lead.status} -> ${nextStatus}`,
    );
  }

  const template = actionTemplateType
    ? await prisma.messageTemplate.findFirst({
        where: {
          workspaceId: params.workspaceId,
          type: actionTemplateType,
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : null;

  const finalOutboundMessageChannel = resolveOutboundMessageChannelForAction({
    action: params.action,
    templateChannel: template?.channel,
    lead,
    manualOnlyModeEnabled,
    channelPriorityOrder: outboundMessageChannelPriorityOrder,
  });

  if (
    !isChannelDeliverableForLead({
      outboundMessageChannel: finalOutboundMessageChannel,
      lead,
    })
  ) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_CHANNEL_INVALID",
      `Lead is missing required contact information for ${finalOutboundMessageChannel}.`,
    );
  }

  const rendered = renderTemplateForLeadSafely(
    template ?? {
      ...getTemplateFallback(actionTemplateType ?? TemplateType.REMINDER, lead),
      type: actionTemplateType ?? TemplateType.REMINDER,
    },
    lead,
  );

  if (rendered.unresolvedTokens.length > 0) {
    await appendAuditEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      propertyId: lead.propertyId,
      actorUserId: params.actorUserId,
      eventType: workflowEventTypes.templateRenderFailed,
      payload: {
        templateType: actionTemplateType,
        unresolvedTokens: rendered.unresolvedTokens,
      },
    });
    throw new LeadWorkflowError(
      "TEMPLATE_UNRESOLVED_TOKENS",
      `Template rendering failed because unresolved tokens remain: ${rendered.unresolvedTokens.join(", ")}`,
    );
  }

  const schedulingUrl = lead.property?.schedulingUrl ?? null;
  const body =
    params.action === "schedule_tour" && schedulingUrl
      ? ensureSchedulingLinkInBody(rendered.body, schedulingUrl)
      : rendered.body;
  const stateSignature = `${params.action}|${lead.status}|${evaluation.fitResult}|${missingRequiredQuestions.length}`;

  if (
    lead.conversation?.messages.some((message) => {
      if (
        message.direction !== MessageDirection.OUTBOUND ||
        message.origin !== MessageOrigin.OUTBOUND_AUTOMATED
      ) {
        return false;
      }

      if (message.stateSignature !== stateSignature) {
        return false;
      }

      return now.getTime() - message.createdAt.getTime() < 24 * 60 * 60 * 1000;
    })
  ) {
    throw new LeadWorkflowError(
      "ACTION_BLOCKED_DUPLICATE_TEMPLATE",
      "An equivalent automated template was already sent recently without a meaningful state change.",
    );
  }

  const conversation = lead.conversation
    ? lead.conversation
    : await prisma.conversation.create({
        data: {
          leadId: lead.id,
          subject: rendered.subject,
        },
      });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      templateId: template?.id,
      direction: MessageDirection.OUTBOUND,
      origin: MessageOrigin.OUTBOUND_AUTOMATED,
      channel: finalOutboundMessageChannel,
      subject: rendered.subject || null,
      body,
      stateSignature,
      renderedSnapshot: {
        templateType: actionTemplateType,
        subject: rendered.subject,
        body,
        unresolvedTokens: rendered.unresolvedTokens,
      },
      deliveryStatus: serializeDeliveryStatus({
        state: "queued",
        provider: finalOutboundMessageChannel,
      }),
    },
  });

  try {
    await enqueueOutboundMessageSend(
      {
        messageId: message.id,
      },
      {
        retryLimit: 3,
        retryDelay: 10,
        retryBackoff: true,
      },
    );
  } catch {
    try {
      await sendQueuedMessage(message.id);
    } catch (error) {
      const deliveryErrorMessage =
        error instanceof Error ? error.message : "Inline delivery failed";

      if (isProviderConfigurationError(deliveryErrorMessage)) {
        await markMessageProviderUnresolved({
          messageId: message.id,
          error: deliveryErrorMessage,
        });
      } else {
        await markMessageDeliveryFailure({
          messageId: message.id,
          retryCount: 0,
          error: deliveryErrorMessage,
        });
      }
    }
  }

  await prisma.lead.update({
    where: {
      id: lead.id,
    },
    data: {
      status: nextStatus,
      fitResult: evaluation.fitResult,
      lastActivityAt: now,
      applicationInviteSentAt:
        params.action === "send_application" ? now : lead.applicationInviteSentAt,
      applicationInviteChannel:
        params.action === "send_application"
          ? finalOutboundMessageChannel
          : lead.applicationInviteChannel,
      automatedSendCountDate: now,
      automatedSendCount:
        lead.automatedSendCountDate &&
        isSameUtcDay(lead.automatedSendCountDate, now)
          ? lead.automatedSendCount + 1
          : 1,
    },
  });

  await transitionLeadStatus({
    lead,
    workspaceId: params.workspaceId,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    nextStatus,
    transitionReason: reason,
  });

  const qualificationCompletedAfterAction = isQualificationCompleted({
    missingRequiredQuestionCount: missingRequiredQuestions.length,
    fitResult: evaluation.fitResult,
    currentLeadStatus: nextStatus,
  });

  await appendAuditEvent({
    workspaceId: params.workspaceId,
    leadId: lead.id,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    eventType,
    payload: {
      templateType: actionTemplateType,
      fitResult: evaluation.fitResult,
      missingRequiredQuestionCount: missingRequiredQuestions.length,
      qualificationCompleted: qualificationCompletedAfterAction,
      renderedMessageSnapshot: {
        subject: rendered.subject,
        body,
      },
      schedulingUrl:
        params.action === "schedule_tour" ? schedulingUrl : null,
    },
  });

  if (params.action === "request_info" && invalidAnswerIssues.length > 0) {
    await appendAuditEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      propertyId: lead.propertyId,
      actorUserId: params.actorUserId,
      eventType: workflowEventTypes.qualificationAnswerInvalid,
      payload: {
        invalidQuestions: invalidAnswerIssues.map((invalidIssue) => invalidIssue.label),
        clarificationPrompt:
          "Some answers were unclear. Please reply with a clear value for the highlighted fields.",
      },
    });
  }

  await appendAuditEvent({
    workspaceId: params.workspaceId,
    leadId: lead.id,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    eventType: workflowEventTypes.outboundMessageQueued,
    payload: {
      messageId: message.id,
      channel: finalOutboundMessageChannel,
      stateSignature,
      templateType: actionTemplateType,
    },
  });

  if (params.action === "schedule_tour") {
    await prisma.tourEvent.create({
      data: {
        workspaceId: params.workspaceId,
        leadId: lead.id,
        propertyId: lead.propertyId,
        status: TourEventStatus.SCHEDULED,
        scheduledAt: now,
      },
    });

    await appendNotificationEvent({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      type: NotificationType.TOUR_SCHEDULED,
      title: "Tour scheduled",
      body: `${lead.fullName} has been moved to tour scheduled.`,
      payload: {
        leadId: lead.id,
      },
    });

    await queueOutboundWorkflowWebhook({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      eventType: "tour.scheduled",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        leadId: lead.id,
        workspaceId: params.workspaceId,
        scheduledAt: now.toISOString(),
      },
    });
  }

  if (params.action === "send_application") {
    try {
      await scheduleReminderSend(
        {
          leadId: lead.id,
          templateType: TemplateType.REMINDER,
        },
        Number(process.env.APPLICATION_INVITE_REMINDER_SECONDS ?? "172800"),
      );
    } catch {
      // Reminder enqueue is best-effort and should not block the action.
    }

    await queueOutboundWorkflowWebhook({
      workspaceId: params.workspaceId,
      leadId: lead.id,
      eventType: "application.sent",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        leadId: lead.id,
        workspaceId: params.workspaceId,
        sentAt: now.toISOString(),
        channel: finalOutboundMessageChannel,
      },
    });
  }

  return {
    leadId: lead.id,
  };
}

export function buildLeadTimeline(lead: NonNullable<WorkflowLead>) {
  const timelineEvents = [
    ...lead.statusHistory.map((entry) => ({
      id: entry.id,
      leadId: lead.id,
      eventType: workflowEventTypes.statusChanged,
      createdAt: entry.createdAt,
      at: formatRelativeTime(entry.createdAt),
      date: entry.createdAt,
      event: `Status changed to ${formatEnumLabel(entry.toStatus)}${
        entry.reason ? `: ${entry.reason}` : ""
      }`,
    })),
    ...lead.auditEvents.map((event) => ({
      id: event.id,
      leadId: lead.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      at: formatRelativeTime(event.createdAt),
      date: event.createdAt,
      event: event.eventType,
    })),
    ...(lead.conversation?.messages.map((message) => ({
      id: message.id,
      leadId: lead.id,
      eventType: "message_event",
      createdAt: message.sentAt ?? message.receivedAt ?? message.createdAt,
      at: formatRelativeTime(message.sentAt ?? message.receivedAt ?? message.createdAt),
      date: message.sentAt ?? message.receivedAt ?? message.createdAt,
      event: `${formatEnumLabel(message.direction)} ${formatEnumLabel(message.channel)} message`,
    })) ?? []),
  ];

  const dedupedEvents = dedupeNearSimultaneousTimelineEvents(timelineEvents);
  const orderedEvents = sortTimelineEventsDeterministically(dedupedEvents);

  return orderedEvents.map(({ at, date, event }) => ({
    at,
    date,
    event,
  }));
}

export function getLeadActionAvailability(
  lead: NonNullable<WorkflowLead>,
  evaluation: EvaluationResult,
) {
  const manualOnlyModeEnabled = isManualOnlyAutomationModeEnabled(
    process.env.ROOMFLOW_MANUAL_ONLY_MODE,
  );
  const qualificationAutomationGateResult = resolveQualificationAutomationGate({
    leadPropertyId: lead.propertyId,
    propertyQuestionSets: lead.property?.questionSets ?? [],
    leadEmailAddress: lead.email,
    leadPhoneNumber: lead.phone,
    contactEmailAddress: lead.contact?.email ?? null,
    contactPhoneNumber: lead.contact?.phone ?? null,
    manualOnlyModeEnabled,
  });
  const missingRequiredQuestions = resolveMissingRequiredQuestionsForLead(lead);
  const qualificationCompleted = isQualificationCompleted({
    missingRequiredQuestionCount: missingRequiredQuestions.length,
    fitResult: evaluation.fitResult,
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
    throttleWindowMinutes: getMissingInfoPromptThrottleWindowMinutes(),
  });
  const leadStatusIsInactive =
    lead.status === LeadStatus.DECLINED ||
    lead.status === LeadStatus.ARCHIVED ||
    lead.status === LeadStatus.CLOSED;
  const currentTime = new Date();
  const channelPriorityOrder = resolveChannelPriorityOrder(
    lead.property?.channelPriority ?? lead.workspace.channelPriority,
  );
  const defaultOutboundChannel = resolveOutboundMessageChannelForAction({
    action: "request_info",
    templateChannel: null,
    lead,
    manualOnlyModeEnabled,
    channelPriorityOrder,
  });
  const hasDeliverableDefaultOutboundChannel = isChannelDeliverableForLead({
    outboundMessageChannel: defaultOutboundChannel,
    lead,
  });
  const dailySendCapReached =
    lead.automatedSendCountDate &&
    isSameUtcDay(lead.automatedSendCountDate, currentTime) &&
    lead.automatedSendCount >= lead.workspace.dailyAutomatedSendCap;
  const blockedByOptOut = Boolean(lead.optOutAt);
  const canAutomateOutbound =
    !blockedByOptOut &&
    !dailySendCapReached &&
    hasDeliverableDefaultOutboundChannel;

  return {
    evaluateFit: true,
    requestInfo:
      qualificationAutomationGateResult.canRunAutomation &&
      !leadStatusIsInactive &&
      !qualificationCompleted &&
      !missingInfoPromptIsThrottled &&
      canAutomateOutbound,
    scheduleTour:
      qualificationAutomationGateResult.canRunAutomation &&
      !leadStatusIsInactive &&
      Boolean(lead.property?.schedulingUrl) &&
      Boolean(lead.property?.schedulingEnabled) &&
      evaluation.fitResult !== QualificationFit.MISMATCH &&
      evaluation.recommendedStatus !== LeadStatus.INCOMPLETE &&
      schedulableLeadStatuses.has(lead.status) &&
      lead.status !== LeadStatus.APPLICATION_SENT &&
      canAutomateOutbound,
    sendApplication:
      qualificationAutomationGateResult.canRunAutomation &&
      !leadStatusIsInactive &&
      evaluation.fitResult !== QualificationFit.MISMATCH &&
      evaluation.recommendedStatus !== LeadStatus.INCOMPLETE &&
      lead.status !== LeadStatus.APPLICATION_SENT &&
      canAutomateOutbound,
  };
}
