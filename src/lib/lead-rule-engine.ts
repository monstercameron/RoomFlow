import {
  type QualificationFit,
  RuleCategory,
  RuleMode,
  RuleSeverity,
} from "@/generated/prisma/client";

type RuleAnswerMap = Map<string, string>;

export type LeadRuleEvaluationInputRule = {
  id: string;
  label: string;
  ruleCategory: RuleCategory;
  mode: RuleMode;
  severity: RuleSeverity;
  warningOnly: boolean;
  autoDecline: boolean;
  active: boolean;
};

export type LeadRuleEvaluationIssue = {
  ruleId: string;
  ruleLabel: string;
  category: RuleCategory;
  mode: RuleMode;
  severity: RuleSeverity;
  triggered: boolean;
  blocking: boolean;
  explanation: string;
};

export type LeadRuleEvaluationResult = {
  fitResult: QualificationFit;
  issues: LeadRuleEvaluationIssue[];
  triggeredRuleIds: string[];
  blockingRuleIds: string[];
  warningRuleIds: string[];
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isAffirmative(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  return (
    normalizedValue === "yes" ||
    normalizedValue === "true" ||
    normalizedValue === "y" ||
    normalizedValue.includes("yes") ||
    normalizedValue.includes("smoke") ||
    normalizedValue.includes("need")
  );
}

function isNegative(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  return (
    normalizedValue === "no" ||
    normalizedValue === "false" ||
    normalizedValue === "n" ||
    normalizedValue.includes("no") ||
    normalizedValue.includes("none")
  );
}

export function resolveRuleCategoryFromLabel(
  explicitRuleCategory: RuleCategory | null | undefined,
  ruleLabel: string,
) {
  if (explicitRuleCategory) {
    return explicitRuleCategory;
  }

  const normalizedRuleLabel = normalizeText(ruleLabel);

  if (normalizedRuleLabel.includes("smok")) {
    return RuleCategory.SMOKING;
  }

  if (normalizedRuleLabel.includes("pet")) {
    return RuleCategory.PETS;
  }

  if (normalizedRuleLabel.includes("guest")) {
    return RuleCategory.GUESTS;
  }

  if (normalizedRuleLabel.includes("bathroom")) {
    return RuleCategory.BATHROOM_SHARING;
  }

  if (normalizedRuleLabel.includes("parking")) {
    return RuleCategory.PARKING;
  }

  if (normalizedRuleLabel.includes("stay")) {
    return RuleCategory.MINIMUM_STAY;
  }

  if (normalizedRuleLabel.includes("work") || normalizedRuleLabel.includes("schedule")) {
    return RuleCategory.WORK_SCHEDULE;
  }

  if (
    normalizedRuleLabel.includes("acknowledg") ||
    normalizedRuleLabel.includes("quiet")
  ) {
    return RuleCategory.ACKNOWLEDGMENT;
  }

  return RuleCategory.GENERAL;
}

export function resolveRuleMode(params: {
  explicitMode: RuleMode | null | undefined;
  severity: RuleSeverity;
  warningOnly: boolean;
  autoDecline: boolean;
}) {
  if (params.explicitMode) {
    return params.explicitMode;
  }

  if (params.warningOnly || params.severity === RuleSeverity.WARNING) {
    return RuleMode.WARNING_ONLY;
  }

  if (params.severity === RuleSeverity.PREFERENCE) {
    return RuleMode.INFORMATIONAL;
  }

  if (params.autoDecline || params.severity === RuleSeverity.REQUIRED) {
    return RuleMode.BLOCKING;
  }

  return RuleMode.WARNING_ONLY;
}

function getAnswerValue(
  answersByFieldKey: RuleAnswerMap,
  keys: string[],
): string | null {
  for (const key of keys) {
    const answerValue = answersByFieldKey.get(normalizeText(key));

    if (answerValue) {
      return answerValue;
    }
  }

  return null;
}

function evaluateRuleTrigger(params: {
  ruleCategory: RuleCategory;
  answersByFieldKey: RuleAnswerMap;
  propertyDefaults: {
    smokingAllowed: boolean;
    petsAllowed: boolean;
    parkingAvailable: boolean;
    minimumStayMonths: number;
  };
}) {
  switch (params.ruleCategory) {
    case RuleCategory.SMOKING: {
      const smokingAnswer = getAnswerValue(params.answersByFieldKey, ["smoking"]);

      if (!smokingAnswer) {
        return {
          triggered: false,
          explanation: "Smoking answer is missing.",
          missing: true,
        };
      }

      const triggered = isAffirmative(smokingAnswer) && !params.propertyDefaults.smokingAllowed;

      return {
        triggered,
        explanation: triggered
          ? "Lead indicated smoking for a non-smoking property."
          : "Smoking response passes current rule.",
        missing: false,
      };
    }
    case RuleCategory.PETS: {
      const petsAnswer = getAnswerValue(params.answersByFieldKey, ["pets", "pet_status"]);

      if (!petsAnswer) {
        return {
          triggered: false,
          explanation: "Pet answer is missing.",
          missing: true,
        };
      }

      const triggered =
        !isNegative(petsAnswer) && !params.propertyDefaults.petsAllowed;

      return {
        triggered,
        explanation: triggered
          ? "Lead indicated pets for a no-pets property."
          : "Pet response passes current rule.",
        missing: false,
      };
    }
    case RuleCategory.PARKING: {
      const parkingAnswer = getAnswerValue(params.answersByFieldKey, [
        "parking_need",
        "parking",
      ]);

      if (!parkingAnswer) {
        return {
          triggered: false,
          explanation: "Parking answer is missing.",
          missing: true,
        };
      }

      const triggered =
        isAffirmative(parkingAnswer) && !params.propertyDefaults.parkingAvailable;

      return {
        triggered,
        explanation: triggered
          ? "Lead requires parking but property has none."
          : "Parking response passes current rule.",
        missing: false,
      };
    }
    case RuleCategory.MINIMUM_STAY: {
      const stayLengthAnswer = getAnswerValue(params.answersByFieldKey, [
        "stay_length_months",
        "stay_length",
      ]);

      if (!stayLengthAnswer) {
        return {
          triggered: false,
          explanation: "Stay-length answer is missing.",
          missing: true,
        };
      }

      const stayLengthMonths = Number(stayLengthAnswer.replace(/[^\d.]/g, ""));

      if (!Number.isFinite(stayLengthMonths) || stayLengthMonths <= 0) {
        return {
          triggered: false,
          explanation: "Stay-length answer could not be parsed.",
          missing: true,
        };
      }

      const triggered = stayLengthMonths < params.propertyDefaults.minimumStayMonths;

      return {
        triggered,
        explanation: triggered
          ? `Lead requested ${stayLengthMonths} months, below minimum ${params.propertyDefaults.minimumStayMonths} months.`
          : "Stay-length response passes current rule.",
        missing: false,
      };
    }
    case RuleCategory.BATHROOM_SHARING: {
      const bathroomAnswer = getAnswerValue(params.answersByFieldKey, [
        "shared_bathroom_acceptance",
        "bathroom_sharing",
      ]);

      if (!bathroomAnswer) {
        return {
          triggered: false,
          explanation: "Bathroom-sharing answer is missing.",
          missing: true,
        };
      }

      const triggered = isNegative(bathroomAnswer);

      return {
        triggered,
        explanation: triggered
          ? "Lead is not comfortable with bathroom sharing."
          : "Bathroom-sharing response passes current rule.",
        missing: false,
      };
    }
    default:
      return {
        triggered: false,
        explanation: "Rule category is informational or requires operator review.",
        missing: false,
      };
  }
}

export function evaluateLeadRules(params: {
  rules: LeadRuleEvaluationInputRule[];
  answersByFieldKey: RuleAnswerMap;
  propertyDefaults: {
    smokingAllowed: boolean;
    petsAllowed: boolean;
    parkingAvailable: boolean;
    minimumStayMonths: number;
  };
}) {
  const issues: LeadRuleEvaluationIssue[] = [];
  const blockingRuleIds: string[] = [];
  const warningRuleIds: string[] = [];
  const triggeredRuleIds: string[] = [];

  for (const rule of params.rules) {
    if (!rule.active) {
      continue;
    }

    const triggerEvaluation = evaluateRuleTrigger({
      ruleCategory: rule.ruleCategory,
      answersByFieldKey: params.answersByFieldKey,
      propertyDefaults: params.propertyDefaults,
    });

    const isBlockingRule = rule.mode === RuleMode.BLOCKING;
    const isWarningRule = rule.mode === RuleMode.WARNING_ONLY;

    if (triggerEvaluation.triggered) {
      triggeredRuleIds.push(rule.id);

      if (isBlockingRule) {
        blockingRuleIds.push(rule.id);
      }

      if (isWarningRule) {
        warningRuleIds.push(rule.id);
      }
    }

    issues.push({
      ruleId: rule.id,
      ruleLabel: rule.label,
      category: rule.ruleCategory,
      mode: rule.mode,
      severity: rule.severity,
      triggered: triggerEvaluation.triggered,
      blocking: isBlockingRule && triggerEvaluation.triggered,
      explanation: triggerEvaluation.explanation,
    });
  }

  const fitResult: QualificationFit =
    blockingRuleIds.length > 0
      ? "MISMATCH"
      : warningRuleIds.length > 0
        ? "CAUTION"
        : "PASS";

  return {
    fitResult,
    issues,
    triggeredRuleIds,
    blockingRuleIds,
    warningRuleIds,
  } satisfies LeadRuleEvaluationResult;
}

export function shouldRecomputeFitForTrigger(triggerType: string) {
  return new Set([
    "answer_changed",
    "rule_changed",
    "property_reassigned",
    "override_confirmed",
  ]).has(triggerType);
}
