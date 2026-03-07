import assert from "node:assert/strict";
import test from "node:test";
import { RuleCategory, RuleMode, RuleSeverity } from "@/generated/prisma/client";
import {
  evaluateLeadRules,
  resolveRuleCategoryFromLabel,
  resolveRuleMode,
  shouldRecomputeFitForTrigger,
} from "./lead-rule-engine";

test("resolveRuleCategoryFromLabel maps legacy labels into standardized categories", () => {
  assert.equal(resolveRuleCategoryFromLabel(null, "No smoking"), RuleCategory.SMOKING);
  assert.equal(resolveRuleCategoryFromLabel(null, "Pet policy"), RuleCategory.PETS);
  assert.equal(
    resolveRuleCategoryFromLabel(null, "Bathroom sharing required"),
    RuleCategory.BATHROOM_SHARING,
  );
});

test("resolveRuleMode derives rule behavior from legacy severity flags", () => {
  assert.equal(
    resolveRuleMode({
      explicitMode: null,
      severity: RuleSeverity.REQUIRED,
      warningOnly: false,
      autoDecline: true,
    }),
    RuleMode.BLOCKING,
  );
  assert.equal(
    resolveRuleMode({
      explicitMode: null,
      severity: RuleSeverity.WARNING,
      warningOnly: true,
      autoDecline: false,
    }),
    RuleMode.WARNING_ONLY,
  );
  assert.equal(
    resolveRuleMode({
      explicitMode: null,
      severity: RuleSeverity.PREFERENCE,
      warningOnly: false,
      autoDecline: false,
    }),
    RuleMode.INFORMATIONAL,
  );
});

test("evaluateLeadRules returns mismatch when a blocking rule is triggered", () => {
  const result = evaluateLeadRules({
    rules: [
      {
        id: "rule_smoking",
        label: "No smoking",
        ruleCategory: RuleCategory.SMOKING,
        mode: RuleMode.BLOCKING,
        severity: RuleSeverity.REQUIRED,
        warningOnly: false,
        autoDecline: true,
        active: true,
      },
    ],
    answersByFieldKey: new Map([["smoking", "yes"]]),
    propertyDefaults: {
      smokingAllowed: false,
      petsAllowed: false,
      parkingAvailable: false,
      minimumStayMonths: 6,
    },
  });

  assert.equal(result.fitResult, "MISMATCH");
  assert.deepEqual(result.blockingRuleIds, ["rule_smoking"]);
});

test("evaluateLeadRules returns caution for warning-only triggers and ignores informational rules", () => {
  const result = evaluateLeadRules({
    rules: [
      {
        id: "rule_parking_warning",
        label: "Parking preference",
        ruleCategory: RuleCategory.PARKING,
        mode: RuleMode.WARNING_ONLY,
        severity: RuleSeverity.WARNING,
        warningOnly: true,
        autoDecline: false,
        active: true,
      },
      {
        id: "rule_info",
        label: "Acknowledgment",
        ruleCategory: RuleCategory.ACKNOWLEDGMENT,
        mode: RuleMode.INFORMATIONAL,
        severity: RuleSeverity.PREFERENCE,
        warningOnly: false,
        autoDecline: false,
        active: true,
      },
    ],
    answersByFieldKey: new Map([["parking_need", "yes"]]),
    propertyDefaults: {
      smokingAllowed: false,
      petsAllowed: false,
      parkingAvailable: false,
      minimumStayMonths: 6,
    },
  });

  assert.equal(result.fitResult, "CAUTION");
  assert.deepEqual(result.warningRuleIds, ["rule_parking_warning"]);
  assert.equal(result.issues.find((issue) => issue.ruleId === "rule_info")?.blocking, false);
});

test("shouldRecomputeFitForTrigger only allows deterministic recompute triggers", () => {
  assert.equal(shouldRecomputeFitForTrigger("answer_changed"), true);
  assert.equal(shouldRecomputeFitForTrigger("rule_changed"), true);
  assert.equal(shouldRecomputeFitForTrigger("unknown"), false);
});
