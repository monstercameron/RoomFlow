import {
  LeadStatus,
  MessageChannel,
  MessageDirection,
  QualificationFit,
  RuleSeverity,
  TemplateType,
} from "@/generated/prisma/client";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import { enqueueOutboundMessageSend } from "@/lib/jobs";
import { markMessageDeliveryFailure, sendQueuedMessage } from "@/lib/message-delivery";
import { prisma } from "@/lib/prisma";

type WorkflowLead = Awaited<ReturnType<typeof getLeadWorkflowContext>>;

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

function isAffirmative(value: string) {
  const normalized = normalizeText(value);
  return ["yes", "y", "true", "smoker", "allowed", "need", "needs"].some(
    (token) => normalized === token || normalized.includes(token),
  );
}

function isNegative(value: string) {
  const normalized = normalizeText(value);
  return ["no", "n", "false", "none", "not needed", "not okay"].some(
    (token) => normalized === token || normalized.includes(token),
  );
}

function hasPets(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  if (
    ["no", "none", "no pets", "n/a", "na"].includes(normalized) ||
    normalized.includes("no pet")
  ) {
    return false;
  }

  return true;
}

function needsParking(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  if (
    ["no", "none", "no parking needed", "street only is fine"].includes(
      normalized,
    ) ||
    normalized.includes("street only")
  ) {
    return false;
  }

  return normalized.includes("parking") || isAffirmative(normalized);
}

function acceptsSharedBathroom(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (
    isAffirmative(normalized) ||
    normalized.includes("okay") ||
    normalized.includes("shared bathroom is fine")
  ) {
    return true;
  }

  if (isNegative(normalized) || normalized.includes("not okay")) {
    return false;
  }

  return null;
}

function acknowledgesQuietHours(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (
    isAffirmative(normalized) ||
    normalized.includes("understand") ||
    normalized.includes("acknowledge")
  ) {
    return true;
  }

  if (isNegative(normalized)) {
    return false;
  }

  return null;
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

function getRequiredRule(lead: NonNullable<WorkflowLead>, pattern: RegExp) {
  return lead.property?.rules.find((rule) => pattern.test(rule.label.toLowerCase())) ?? null;
}

function pushIssue(
  issues: EvaluationIssue[],
  issue: EvaluationIssue | null,
) {
  if (issue) {
    issues.push(issue);
  }
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
        },
      },
      property: {
        include: {
          rules: {
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
              fieldKey: true,
              label: true,
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
  const answers = buildAnswerIndex(lead);

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

  const smokingAnswer = answers.get("smoking");
  const petsAnswer = answers.get("pets");
  const parkingAnswer =
    answers.get("parking_need") ?? answers.get("parking need");
  const bathroomAnswer =
    answers.get("shared_bathroom_acceptance") ??
    answers.get("shared bathroom acceptance");
  const quietHoursAnswer =
    answers.get("quiet_hours") ?? answers.get("quiet hours acknowledgment");

  const smokingRule = getRequiredRule(lead, /smoking/);
  const petRule = getRequiredRule(lead, /pet/);
  const bathroomRule = getRequiredRule(lead, /bathroom/);
  const quietHoursRule = getRequiredRule(lead, /quiet hours/);
  const minimumStayRule = getRequiredRule(lead, /minimum stay/);

  pushIssue(
    issues,
    smokingRule
      ? !smokingAnswer
        ? {
            label: smokingRule.label,
            detail: "Smoking answer is still missing.",
            severity: toSeverityLabel(smokingRule.severity),
            outcome: "unknown",
          }
        : isAffirmative(smokingAnswer) && !lead.property.smokingAllowed
          ? {
              label: smokingRule.label,
              detail: "Lead indicated smoking for a non-smoking property.",
              severity: toSeverityLabel(smokingRule.severity),
              outcome: smokingRule.autoDecline ? "mismatch" : "caution",
            }
          : {
              label: smokingRule.label,
              detail: "Lead confirmed the no-smoking requirement.",
              severity: toSeverityLabel(smokingRule.severity),
              outcome: "pass",
            }
      : null,
  );

  pushIssue(
    issues,
    petRule
      ? !petsAnswer
        ? {
            label: petRule.label,
            detail: "Pet information is still missing.",
            severity: toSeverityLabel(petRule.severity),
            outcome: "unknown",
          }
        : hasPets(petsAnswer) && !lead.property.petsAllowed
          ? {
              label: petRule.label,
              detail: "Lead reported a pet for a pet-free property.",
              severity: toSeverityLabel(petRule.severity),
              outcome: petRule.autoDecline ? "mismatch" : "caution",
            }
          : {
              label: petRule.label,
              detail: "Lead matches the current pet policy.",
              severity: toSeverityLabel(petRule.severity),
              outcome: "pass",
            }
      : null,
  );

  pushIssue(
    issues,
    bathroomRule
      ? !bathroomAnswer
        ? {
            label: bathroomRule.label,
            detail: "Bathroom-sharing answer is still missing.",
            severity: toSeverityLabel(bathroomRule.severity),
            outcome: "unknown",
          }
        : acceptsSharedBathroom(bathroomAnswer) === false
          ? {
              label: bathroomRule.label,
              detail: "Lead is not comfortable with the shared bathroom setup.",
              severity: toSeverityLabel(bathroomRule.severity),
              outcome: bathroomRule.severity === RuleSeverity.REQUIRED
                ? "mismatch"
                : "caution",
            }
          : {
              label: bathroomRule.label,
              detail: "Lead is okay with the shared bathroom setup.",
              severity: toSeverityLabel(bathroomRule.severity),
              outcome: acceptsSharedBathroom(bathroomAnswer) === null ? "unknown" : "pass",
            }
      : null,
  );

  pushIssue(
    issues,
    quietHoursRule
      ? !quietHoursAnswer
        ? {
            label: quietHoursRule.label,
            detail: "Quiet-hours acknowledgment is still missing.",
            severity: toSeverityLabel(quietHoursRule.severity),
            outcome: "unknown",
          }
        : acknowledgesQuietHours(quietHoursAnswer) === false
          ? {
              label: quietHoursRule.label,
              detail: "Lead pushed back on quiet-hours expectations.",
              severity: toSeverityLabel(quietHoursRule.severity),
              outcome: "caution",
            }
          : {
              label: quietHoursRule.label,
              detail: "Lead acknowledged quiet-hours expectations.",
              severity: toSeverityLabel(quietHoursRule.severity),
              outcome: acknowledgesQuietHours(quietHoursAnswer) === null ? "unknown" : "pass",
            }
      : null,
  );

  pushIssue(
    issues,
    minimumStayRule
      ? lead.stayLengthMonths === null
        ? {
            label: minimumStayRule.label,
            detail: "Stay length is still missing.",
            severity: toSeverityLabel(minimumStayRule.severity),
            outcome: "unknown",
          }
        : lead.stayLengthMonths < 6
          ? {
              label: minimumStayRule.label,
              detail: "Requested stay length is shorter than the preferred floor.",
              severity: toSeverityLabel(minimumStayRule.severity),
              outcome: minimumStayRule.severity === RuleSeverity.REQUIRED
                ? "mismatch"
                : "caution",
            }
          : {
              label: minimumStayRule.label,
              detail: "Stay length meets the preferred floor.",
              severity: toSeverityLabel(minimumStayRule.severity),
              outcome: "pass",
            }
      : null,
  );

  if (!lead.property.parkingAvailable && parkingAnswer) {
    pushIssue(issues, {
      label: "Parking availability",
      detail: needsParking(parkingAnswer)
        ? "Lead asked for parking but the property does not include it."
        : "Lead does not require on-site parking.",
      severity: "warning",
      outcome: needsParking(parkingAnswer) ? "caution" : "pass",
    });
  }

  const hasMismatch = issues.some((issue) => issue.outcome === "mismatch");
  const hasUnknownRequired = issues.some(
    (issue) => issue.outcome === "unknown" && issue.severity === "required",
  );
  const hasCaution = issues.some((issue) => issue.outcome === "caution");

  if (hasMismatch) {
    return {
      fitResult: QualificationFit.MISMATCH,
      recommendedStatus: LeadStatus.DECLINED,
      summary: "Lead misses one or more required property rules.",
      issues,
    };
  }

  if (hasUnknownRequired) {
    return {
      fitResult: QualificationFit.UNKNOWN,
      recommendedStatus: LeadStatus.INCOMPLETE,
      summary: "Lead still has missing information before a final fit call.",
      issues,
    };
  }

  if (hasCaution) {
    return {
      fitResult: QualificationFit.CAUTION,
      recommendedStatus: LeadStatus.QUALIFIED,
      summary: "Lead looks workable, but there are caution items to review.",
      issues,
    };
  }

  return {
    fitResult: QualificationFit.PASS,
    recommendedStatus: LeadStatus.QUALIFIED,
    summary: "Lead currently matches the configured property rules.",
    issues,
  };
}

function getTemplateFallback(
  type: TemplateType,
  lead: NonNullable<WorkflowLead>,
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
  lead: NonNullable<WorkflowLead>,
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
      return tokens.get(key) ?? "";
    });

  return {
    subject: replaceTokens(template.subject),
    body: replaceTokens(template.body),
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
  payload?: Record<string, string | null>;
}) {
  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      propertyId: params.propertyId,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      payload: params.payload,
    },
  });
}

async function transitionLeadStatus(params: {
  lead: NonNullable<WorkflowLead>;
  nextStatus: LeadStatus;
  reason: string;
}) {
  if (params.lead.status === params.nextStatus) {
    return;
  }

  await prisma.leadStatusHistory.create({
    data: {
      leadId: params.lead.id,
      fromStatus: params.lead.status,
      toStatus: params.nextStatus,
      reason: params.reason,
    },
  });
}

function chooseNextStatus(current: LeadStatus, recommended: LeadStatus) {
  if (recommended === LeadStatus.DECLINED) {
    return LeadStatus.DECLINED;
  }

  if (current === LeadStatus.ARCHIVED) {
    return current;
  }

  if (
    current === LeadStatus.TOUR_SCHEDULED ||
    current === LeadStatus.APPLICATION_SENT
  ) {
    return current;
  }

  return recommended;
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
    throw new Error("Lead not found.");
  }

  const evaluation = evaluateLeadQualification(lead);
  const nextStatus = chooseNextStatus(lead.status, evaluation.recommendedStatus);

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
    nextStatus,
    reason: evaluation.summary,
  });

  await appendAuditEvent({
    workspaceId: params.workspaceId,
    leadId: lead.id,
    propertyId: lead.propertyId,
    actorUserId: params.actorUserId,
    eventType: `Lead re-evaluated: ${formatEnumLabel(evaluation.fitResult)}`,
    payload: {
      summary: evaluation.summary,
      recommendedStatus: evaluation.recommendedStatus,
    },
  });

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
    throw new Error("Lead not found.");
  }

  const evaluation = evaluateLeadQualification(lead);
  const actionTemplateType = getTemplateTypeForAction(params.action);

  if (
    (params.action === "schedule_tour" || params.action === "send_application") &&
    evaluation.fitResult === QualificationFit.MISMATCH
  ) {
    throw new Error("Lead is currently a mismatch and cannot advance.");
  }

  if (
    (params.action === "schedule_tour" || params.action === "send_application") &&
    evaluation.recommendedStatus === LeadStatus.INCOMPLETE
  ) {
    throw new Error("Lead is still missing information and cannot advance.");
  }

  if (params.action === "schedule_tour") {
    if (!lead.property) {
      throw new Error("Lead needs a property assignment before scheduling.");
    }

    if (!lead.property.schedulingUrl) {
      throw new Error("This property is missing a scheduling link.");
    }

    if (!schedulableLeadStatuses.has(lead.status)) {
      throw new Error("Only qualified leads can receive a scheduling handoff.");
    }
  }

  let nextStatus = lead.status;
  let eventType = "";
  let reason = "";

  switch (params.action) {
    case "request_info":
      nextStatus = LeadStatus.AWAITING_RESPONSE;
      eventType = "Missing information requested";
      reason = "Requested the remaining qualification details.";
      break;
    case "schedule_tour":
      nextStatus = LeadStatus.TOUR_SCHEDULED;
      eventType = "Scheduling handoff sent";
      reason = "Sent the tour scheduling handoff.";
      break;
    case "send_application":
      nextStatus = LeadStatus.APPLICATION_SENT;
      eventType = "Application invite sent";
      reason = "Sent the application invite.";
      break;
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

  const rendered = renderTemplateForLead(
    template ?? {
      ...getTemplateFallback(actionTemplateType ?? TemplateType.REMINDER, lead),
      type: actionTemplateType ?? TemplateType.REMINDER,
    },
    lead,
  );
  const schedulingUrl = lead.property?.schedulingUrl ?? null;
  const body =
    params.action === "schedule_tour" && schedulingUrl
      ? ensureSchedulingLinkInBody(rendered.body, schedulingUrl)
      : rendered.body;

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
      channel:
        template?.channel ??
        (params.action === "request_info" && lead.preferredContactChannel === "SMS"
          ? MessageChannel.SMS
          : MessageChannel.EMAIL),
      subject: rendered.subject || null,
      body,
      deliveryStatus: serializeDeliveryStatus({
        state: "queued",
        provider: template?.channel ?? null,
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
      await markMessageDeliveryFailure({
        messageId: message.id,
        retryCount: 0,
        error: error instanceof Error ? error.message : "Inline delivery failed",
      });
    }
  }

  await prisma.lead.update({
    where: {
      id: lead.id,
    },
    data: {
      status: nextStatus,
      fitResult: evaluation.fitResult,
      lastActivityAt: new Date(),
    },
  });

  await transitionLeadStatus({
    lead,
    nextStatus,
    reason,
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
      schedulingUrl:
        params.action === "schedule_tour" ? schedulingUrl : null,
    },
  });

  return {
    leadId: lead.id,
  };
}

export function buildLeadTimeline(lead: NonNullable<WorkflowLead>) {
  const items = [
    ...lead.statusHistory.map((entry) => ({
      at: formatRelativeTime(entry.createdAt),
      date: entry.createdAt,
      event: `Status changed to ${formatEnumLabel(entry.toStatus)}${
        entry.reason ? `: ${entry.reason}` : ""
      }`,
    })),
    ...lead.auditEvents.map((event) => ({
      at: formatRelativeTime(event.createdAt),
      date: event.createdAt,
      event: event.eventType,
    })),
    ...(lead.conversation?.messages.map((message) => ({
      at: formatRelativeTime(message.sentAt ?? message.receivedAt ?? message.createdAt),
      date: message.sentAt ?? message.receivedAt ?? message.createdAt,
      event: `${formatEnumLabel(message.direction)} ${formatEnumLabel(message.channel)} message`,
    })) ?? []),
  ];

  return items.sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function getLeadActionAvailability(
  lead: NonNullable<WorkflowLead>,
  evaluation: EvaluationResult,
) {
  const hasConversationChannel =
    Boolean(lead.email) ||
    Boolean(lead.phone) ||
    Boolean(lead.contact?.email) ||
    Boolean(lead.contact?.phone);

  return {
    evaluateFit: true,
    requestInfo: hasConversationChannel && lead.status !== LeadStatus.DECLINED,
    scheduleTour:
      hasConversationChannel &&
      Boolean(lead.property?.schedulingUrl) &&
      evaluation.fitResult !== QualificationFit.MISMATCH &&
      evaluation.recommendedStatus !== LeadStatus.INCOMPLETE &&
      schedulableLeadStatuses.has(lead.status) &&
      lead.status !== LeadStatus.APPLICATION_SENT,
    sendApplication:
      hasConversationChannel &&
      evaluation.fitResult !== QualificationFit.MISMATCH &&
      evaluation.recommendedStatus !== LeadStatus.INCOMPLETE &&
      lead.status !== LeadStatus.DECLINED,
  };
}
