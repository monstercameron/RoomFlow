import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus, QualificationFit } from "@/generated/prisma/client";
import {
  DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES,
  isManualOnlyAutomationModeEnabled,
  isMissingInfoPromptThrottled,
  isQualificationCompleted,
  resolveMissingRequiredQualificationQuestions,
  resolveMostRecentMissingInfoRequestTimestamp,
  resolveQualificationAutomationGate,
} from "./lead-qualification-guard";

test("isManualOnlyAutomationModeEnabled accepts common truthy values", () => {
  assert.equal(isManualOnlyAutomationModeEnabled("true"), true);
  assert.equal(isManualOnlyAutomationModeEnabled(" YES "), true);
  assert.equal(isManualOnlyAutomationModeEnabled("0"), false);
  assert.equal(isManualOnlyAutomationModeEnabled(undefined), false);
});

test("resolveQualificationAutomationGate blocks missing property assignment", () => {
  const qualificationAutomationGateResult = resolveQualificationAutomationGate({
    leadPropertyId: null,
    propertyQuestionSets: [],
    leadEmailAddress: "lead@example.com",
    leadPhoneNumber: null,
    contactEmailAddress: null,
    contactPhoneNumber: null,
    manualOnlyModeEnabled: false,
  });

  assert.equal(qualificationAutomationGateResult.canRunAutomation, false);
  assert.equal(
    qualificationAutomationGateResult.blockingReason,
    "missing_property",
  );
});

test("resolveQualificationAutomationGate blocks properties without an active question set", () => {
  const qualificationAutomationGateResult = resolveQualificationAutomationGate({
    leadPropertyId: "property_1",
    propertyQuestionSets: [{ id: "set_1", questions: [] }],
    leadEmailAddress: "lead@example.com",
    leadPhoneNumber: null,
    contactEmailAddress: null,
    contactPhoneNumber: null,
    manualOnlyModeEnabled: false,
  });

  assert.equal(qualificationAutomationGateResult.canRunAutomation, false);
  assert.equal(
    qualificationAutomationGateResult.blockingReason,
    "missing_active_question_set",
  );
});

test("resolveQualificationAutomationGate blocks missing contact channels unless manual-only mode is enabled", () => {
  const blockedAutomationResult = resolveQualificationAutomationGate({
    leadPropertyId: "property_1",
    propertyQuestionSets: [
      {
        id: "set_1",
        questions: [
          {
            id: "question_1",
            fieldKey: "move_in_date",
            label: "Move-in date",
            required: true,
          },
        ],
      },
    ],
    leadEmailAddress: null,
    leadPhoneNumber: null,
    contactEmailAddress: null,
    contactPhoneNumber: null,
    manualOnlyModeEnabled: false,
  });
  const allowedAutomationResult = resolveQualificationAutomationGate({
    leadPropertyId: "property_1",
    propertyQuestionSets: [
      {
        id: "set_1",
        questions: [
          {
            id: "question_1",
            fieldKey: "move_in_date",
            label: "Move-in date",
            required: true,
          },
        ],
      },
    ],
    leadEmailAddress: null,
    leadPhoneNumber: null,
    contactEmailAddress: null,
    contactPhoneNumber: null,
    manualOnlyModeEnabled: true,
  });

  assert.equal(blockedAutomationResult.canRunAutomation, false);
  assert.equal(
    blockedAutomationResult.blockingReason,
    "missing_contact_channel",
  );
  assert.equal(allowedAutomationResult.canRunAutomation, true);
  assert.equal(allowedAutomationResult.blockingReason, null);
});

test("resolveMissingRequiredQualificationQuestions returns required questions without substantive answers", () => {
  const missingRequiredQuestions = resolveMissingRequiredQualificationQuestions({
    propertyQuestionSets: [
      {
        id: "set_1",
        questions: [
          {
            id: "question_required_missing",
            fieldKey: "budget",
            label: "Monthly budget",
            required: true,
          },
          {
            id: "question_required_answered",
            fieldKey: "move_in",
            label: "Move-in date",
            required: true,
          },
          {
            id: "question_optional_missing",
            fieldKey: "parking_need",
            label: "Do you need parking?",
            required: false,
          },
        ],
      },
    ],
    leadAnswers: [
      {
        questionId: "question_required_answered",
        value: "2026-04-01",
      },
      {
        questionId: "question_optional_missing",
        value: "",
      },
    ],
  });

  assert.deepEqual(missingRequiredQuestions, [
    {
      questionId: "question_required_missing",
      fieldKey: "budget",
      label: "Monthly budget",
    },
  ]);
});

test("resolveMostRecentMissingInfoRequestTimestamp finds the latest matching event", () => {
  const mostRecentMissingInfoRequestAt = resolveMostRecentMissingInfoRequestTimestamp([
    {
      eventType: "lead_created",
      createdAt: new Date("2026-03-05T14:00:00.000Z"),
    },
    {
      eventType: "Missing information requested",
      createdAt: new Date("2026-03-05T15:00:00.000Z"),
    },
    {
      eventType: "missing information requested",
      createdAt: new Date("2026-03-05T16:30:00.000Z"),
    },
  ]);

  assert.equal(
    mostRecentMissingInfoRequestAt?.toISOString(),
    "2026-03-05T16:30:00.000Z",
  );
});

test("isMissingInfoPromptThrottled applies the configured throttle window", () => {
  const referenceTime = new Date("2026-03-05T17:00:00.000Z");

  assert.equal(
    isMissingInfoPromptThrottled({
      mostRecentMissingInfoRequestAt: new Date("2026-03-05T16:30:00.000Z"),
      referenceTime,
      throttleWindowMinutes: DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES,
    }),
    true,
  );
  assert.equal(
    isMissingInfoPromptThrottled({
      mostRecentMissingInfoRequestAt: new Date("2026-03-05T15:00:00.000Z"),
      referenceTime,
      throttleWindowMinutes: DEFAULT_MISSING_INFO_PROMPT_THROTTLE_MINUTES,
    }),
    false,
  );
});

test("isQualificationCompleted requires answers, computed fit, and routed outcome status", () => {
  assert.equal(
    isQualificationCompleted({
      missingRequiredQuestionCount: 0,
      fitResult: QualificationFit.PASS,
      currentLeadStatus: LeadStatus.QUALIFIED,
    }),
    true,
  );
  assert.equal(
    isQualificationCompleted({
      missingRequiredQuestionCount: 1,
      fitResult: QualificationFit.PASS,
      currentLeadStatus: LeadStatus.QUALIFIED,
    }),
    false,
  );
  assert.equal(
    isQualificationCompleted({
      missingRequiredQuestionCount: 0,
      fitResult: QualificationFit.UNKNOWN,
      currentLeadStatus: LeadStatus.UNDER_REVIEW,
    }),
    false,
  );
  assert.equal(
    isQualificationCompleted({
      missingRequiredQuestionCount: 0,
      fitResult: QualificationFit.CAUTION,
      currentLeadStatus: LeadStatus.AWAITING_RESPONSE,
    }),
    false,
  );
});
