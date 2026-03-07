import assert from "node:assert/strict";
import test from "node:test";
import { RuleCategory, RuleMode, RuleSeverity } from "@/generated/prisma/client";

async function getLeadWorkflowModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  return import("./lead-workflow");
}

type TestPropertyRule = {
  id: string;
  label: string;
  category: string;
  ruleCategory: RuleCategory;
  mode: RuleMode;
  severity: RuleSeverity;
  warningOnly: boolean;
  autoDecline: boolean;
  active: boolean;
};

type TestLeadContext = {
  id: string;
  status: string;
  fitResult: string;
  propertyId: string;
  fullName: string;
  email: string;
  phone: string;
  contact: {
    email: string;
    phone: string;
  };
  property: {
    id: string;
    name: string;
    smokingAllowed: boolean;
    petsAllowed: boolean;
    parkingAvailable: boolean;
    schedulingUrl: string;
    schedulingEnabled: boolean;
    channelPriority: string[];
    questionSets: Array<{
      id: string;
      questions: Array<{
        id: string;
        fieldKey: string;
        label: string;
        required: boolean;
      }>;
    }>;
    rules: TestPropertyRule[];
  };
  answers: Array<{
    questionId: string;
    value: string;
    question: {
      id: string;
      fieldKey: string;
      label: string;
      required: boolean;
      sortOrder: number;
    };
  }>;
};

function createBaseLeadContext(): TestLeadContext {
  return {
    id: "lead_1",
    status: "NEW",
    fitResult: "UNKNOWN",
    propertyId: "property_1",
    fullName: "Jordan Lane",
    email: "jordan@example.com",
    phone: "+15550123456",
    contact: {
      email: "jordan@example.com",
      phone: "+15550123456",
    },
    property: {
      id: "property_1",
      name: "Maple House",
      smokingAllowed: false,
      petsAllowed: false,
      parkingAvailable: false,
      schedulingUrl: "https://calendar.example.com",
      schedulingEnabled: true,
      channelPriority: ["SMS", "EMAIL"],
      questionSets: [
        {
          id: "set_1",
          questions: [
            {
              id: "question_smoking",
              fieldKey: "smoking",
              label: "Do you smoke?",
              required: true,
            },
          ],
        },
      ],
      rules: [
        {
          id: "rule_smoking",
          label: "No smoking",
          category: "smoking",
          ruleCategory: RuleCategory.SMOKING,
          mode: RuleMode.BLOCKING,
          severity: RuleSeverity.REQUIRED,
          warningOnly: false,
          autoDecline: true,
          active: true,
        },
      ],
    },
    answers: [
      {
        questionId: "question_smoking",
        value: "no",
        question: {
          id: "question_smoking",
          fieldKey: "smoking",
          label: "Do you smoke?",
          required: true,
          sortOrder: 0,
        },
      },
    ],
  };
}

test("routing case A keeps fit unknown and status incomplete when required data is missing", async () => {
  const { evaluateLeadQualification } = await getLeadWorkflowModule();
  const lead = createBaseLeadContext();
  lead.answers = [];

  const evaluation = evaluateLeadQualification(lead as never);

  assert.equal(evaluation.fitResult, "UNKNOWN");
  assert.equal(evaluation.recommendedStatus, "INCOMPLETE");
});

test("routing case B sends blocking mismatch to under_review", async () => {
  const { evaluateLeadQualification } = await getLeadWorkflowModule();
  const lead = createBaseLeadContext();
  lead.answers = [
    {
      questionId: "question_smoking",
      value: "yes",
      question: {
        id: "question_smoking",
        fieldKey: "smoking",
        label: "Do you smoke?",
        required: true,
        sortOrder: 0,
      },
    },
  ];

  const evaluation = evaluateLeadQualification(lead as never);

  assert.equal(evaluation.fitResult, "MISMATCH");
  assert.equal(evaluation.recommendedStatus, "UNDER_REVIEW");
});

test("routing case C routes pass results to qualified", async () => {
  const { evaluateLeadQualification } = await getLeadWorkflowModule();
  const lead = createBaseLeadContext();

  const evaluation = evaluateLeadQualification(lead as never);

  assert.equal(evaluation.fitResult, "PASS");
  assert.equal(evaluation.recommendedStatus, "QUALIFIED");
});

test("routing case D routes warning-only triggers to under_review", async () => {
  const { evaluateLeadQualification } = await getLeadWorkflowModule();
  const lead = createBaseLeadContext();
  lead.property.rules = [
    {
      id: "rule_parking",
      label: "Parking preference",
      category: "parking",
      ruleCategory: RuleCategory.PARKING,
      mode: RuleMode.WARNING_ONLY,
      severity: RuleSeverity.WARNING,
      warningOnly: true,
      autoDecline: false,
      active: true,
    },
  ];
  lead.answers = [
    {
      questionId: "question_smoking",
      value: "yes",
      question: {
        id: "question_smoking",
        fieldKey: "parking_need",
        label: "Do you need parking?",
        required: true,
        sortOrder: 0,
      },
    },
  ];

  const evaluation = evaluateLeadQualification(lead as never);

  assert.equal(evaluation.fitResult, "CAUTION");
  assert.equal(evaluation.recommendedStatus, "UNDER_REVIEW");
});
