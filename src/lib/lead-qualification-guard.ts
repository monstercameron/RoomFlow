import { LeadStatus, QualificationFit } from "@/generated/prisma/client";

export const DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES = 60;

type QualificationQuestionSnapshot = {
  id: string;
  fieldKey: string;
  label: string;
  required: boolean;
};

type QualificationQuestionSetSnapshot = {
  id: string;
  questions: QualificationQuestionSnapshot[];
};

type QualificationAnswerSnapshot = {
  questionId: string;
  value: unknown;
};

type QualificationAuditEventSnapshot = {
  eventType: string;
  createdAt: Date;
};

export type MissingRequiredQualificationQuestion = {
  questionId: string;
  fieldKey: string;
  label: string;
};

export type QualificationAutomationBlockingReason =
  | "missing_property"
  | "missing_active_question_set"
  | "missing_contact_channel";

export type QualificationAutomationGateResult = {
  canRunAutomation: boolean;
  blockingReason: QualificationAutomationBlockingReason | null;
  detail: string | null;
};

function hasAtLeastOneContactableChannel(params: {
  leadEmailAddress: string | null;
  leadPhoneNumber: string | null;
  contactEmailAddress: string | null;
  contactPhoneNumber: string | null;
}) {
  return Boolean(
    params.leadEmailAddress ||
      params.leadPhoneNumber ||
      params.contactEmailAddress ||
      params.contactPhoneNumber,
  );
}

function hasAtLeastOneActiveQuestionSet(
  propertyQuestionSets: QualificationQuestionSetSnapshot[],
) {
  return propertyQuestionSets.some(
    (questionSet) => questionSet.questions.length > 0,
  );
}

export function isManualOnlyAutomationModeEnabled(
  manualOnlyEnvironmentFlag: string | undefined,
) {
  if (!manualOnlyEnvironmentFlag) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(
    manualOnlyEnvironmentFlag.trim().toLowerCase(),
  );
}

export function resolveQualificationAutomationGate(params: {
  leadPropertyId: string | null;
  propertyQuestionSets: QualificationQuestionSetSnapshot[];
  leadEmailAddress: string | null;
  leadPhoneNumber: string | null;
  contactEmailAddress: string | null;
  contactPhoneNumber: string | null;
  manualOnlyModeEnabled: boolean;
}): QualificationAutomationGateResult {
  if (!params.leadPropertyId) {
    return {
      canRunAutomation: false,
      blockingReason: "missing_property",
      detail: "Assign a property before qualification automation can run.",
    };
  }

  if (!hasAtLeastOneActiveQuestionSet(params.propertyQuestionSets)) {
    return {
      canRunAutomation: false,
      blockingReason: "missing_active_question_set",
      detail:
        "The assigned property needs at least one qualification question before automation can run.",
    };
  }

  const hasContactableChannel = hasAtLeastOneContactableChannel({
    leadEmailAddress: params.leadEmailAddress,
    leadPhoneNumber: params.leadPhoneNumber,
    contactEmailAddress: params.contactEmailAddress,
    contactPhoneNumber: params.contactPhoneNumber,
  });

  if (!hasContactableChannel && !params.manualOnlyModeEnabled) {
    return {
      canRunAutomation: false,
      blockingReason: "missing_contact_channel",
      detail:
        "Add an email or SMS contact channel, or enable manual-only mode before automation can run.",
    };
  }

  return {
    canRunAutomation: true,
    blockingReason: null,
    detail: null,
  };
}

function isAnswerValuePresent(answerValue: unknown): boolean {
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
    return answerValue.some((arrayEntry) => isAnswerValuePresent(arrayEntry));
  }

  if (typeof answerValue === "object") {
    return Object.keys(answerValue).length > 0;
  }

  return false;
}

export function resolveMissingRequiredQualificationQuestions(params: {
  propertyQuestionSets: QualificationQuestionSetSnapshot[];
  leadAnswers: QualificationAnswerSnapshot[];
}) {
  const answerValueByQuestionId = new Map<string, unknown>();

  for (const leadAnswer of params.leadAnswers) {
    answerValueByQuestionId.set(leadAnswer.questionId, leadAnswer.value);
  }

  const missingRequiredQuestions: MissingRequiredQualificationQuestion[] = [];

  for (const propertyQuestionSet of params.propertyQuestionSets) {
    for (const qualificationQuestion of propertyQuestionSet.questions) {
      if (!qualificationQuestion.required) {
        continue;
      }

      const answerValue = answerValueByQuestionId.get(qualificationQuestion.id);

      if (isAnswerValuePresent(answerValue)) {
        continue;
      }

      missingRequiredQuestions.push({
        questionId: qualificationQuestion.id,
        fieldKey: qualificationQuestion.fieldKey,
        label: qualificationQuestion.label,
      });
    }
  }

  return missingRequiredQuestions;
}

export function resolveMostRecentMissingInfoRequestTimestamp(
  auditEvents: QualificationAuditEventSnapshot[],
) {
  return auditEvents
    .filter(
      (auditEvent) =>
        auditEvent.eventType.toLowerCase() ===
        "missing information requested".toLowerCase(),
    )
    .sort((leftAuditEvent, rightAuditEvent) => {
      return rightAuditEvent.createdAt.getTime() - leftAuditEvent.createdAt.getTime();
    })[0]?.createdAt;
}

export function isMissingInfoPromptThrottled(params: {
  mostRecentMissingInfoRequestAt: Date | undefined;
  referenceTime: Date;
  throttleWindowMinutes: number;
}) {
  if (!params.mostRecentMissingInfoRequestAt) {
    return false;
  }

  const elapsedMilliseconds =
    params.referenceTime.getTime() - params.mostRecentMissingInfoRequestAt.getTime();
  const throttleWindowMilliseconds = params.throttleWindowMinutes * 60 * 1000;

  return elapsedMilliseconds < throttleWindowMilliseconds;
}

const routedQualificationOutcomeStatuses = new Set<LeadStatus>([
  LeadStatus.UNDER_REVIEW,
  LeadStatus.CAUTION,
  LeadStatus.QUALIFIED,
  LeadStatus.TOUR_SCHEDULED,
  LeadStatus.APPLICATION_SENT,
  LeadStatus.DECLINED,
  LeadStatus.CLOSED,
]);

export function isQualificationCompleted(params: {
  missingRequiredQuestionCount: number;
  fitResult: QualificationFit;
  currentLeadStatus: LeadStatus;
}) {
  if (params.missingRequiredQuestionCount > 0) {
    return false;
  }

  if (params.fitResult === QualificationFit.UNKNOWN) {
    return false;
  }

  return routedQualificationOutcomeStatuses.has(params.currentLeadStatus);
}
