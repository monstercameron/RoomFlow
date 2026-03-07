import assert from "node:assert/strict";
import test from "node:test";
import {
  LeadStatus,
  QualificationFit,
  RuleCategory,
  RuleMode,
  RuleSeverity,
} from "@/generated/prisma/client";
import { evaluateLeadRules } from "@/lib/lead-rule-engine";
import {
  assertLeadStatusTransitionIsAllowed,
  resolveLeadStatusAfterEvaluation,
} from "@/lib/lead-status-machine";

async function getLeadNormalizationModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  return import("./lead-normalization");
}

test("integration path supports inquiry to qualified to tour to application", async () => {
  const { normalizeInboundWebFormPayload } = await getLeadNormalizationModule();
  const normalizedInboundPayload = normalizeInboundWebFormPayload({
    workspaceId: "workspace_integration",
    fullName: "Taylor Brooks",
    email: "taylor@example.com",
    message: "I can move in next month and do not smoke.",
    submissionId: "integration_form_1",
  });

  assert.equal(normalizedInboundPayload.channel, "EMAIL");

  const ruleEvaluation = evaluateLeadRules({
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
    answersByFieldKey: new Map([["smoking", "no"]]),
    propertyDefaults: {
      smokingAllowed: false,
      petsAllowed: false,
      parkingAvailable: false,
      minimumStayMonths: 6,
    },
  });

  assert.equal(ruleEvaluation.fitResult, QualificationFit.PASS);

  assert.doesNotThrow(() =>
    assertLeadStatusTransitionIsAllowed(LeadStatus.NEW, LeadStatus.AWAITING_RESPONSE),
  );

  const routedStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.QUALIFIED,
  );
  assert.equal(routedStatus, LeadStatus.QUALIFIED);
  assert.doesNotThrow(() =>
    assertLeadStatusTransitionIsAllowed(routedStatus, LeadStatus.TOUR_SCHEDULED),
  );
  assert.doesNotThrow(() =>
    assertLeadStatusTransitionIsAllowed(
      LeadStatus.TOUR_SCHEDULED,
      LeadStatus.APPLICATION_SENT,
    ),
  );
});

test("integration path supports inquiry mismatch to review to decline", () => {
  const ruleEvaluation = evaluateLeadRules({
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

  assert.equal(ruleEvaluation.fitResult, QualificationFit.MISMATCH);

  const reviewStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.NEW,
    LeadStatus.UNDER_REVIEW,
  );
  assert.equal(reviewStatus, LeadStatus.UNDER_REVIEW);
  assert.doesNotThrow(() =>
    assertLeadStatusTransitionIsAllowed(LeadStatus.NEW, LeadStatus.UNDER_REVIEW),
  );
  assert.doesNotThrow(() =>
    assertLeadStatusTransitionIsAllowed(LeadStatus.UNDER_REVIEW, LeadStatus.DECLINED),
  );
});
