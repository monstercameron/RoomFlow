import assert from "node:assert/strict";
import test from "node:test";
import {
  LeadStatus,
  MessageChannel,
  PropertyLifecycleStatus,
  QualificationFit,
  TemplateType,
} from "@/generated/prisma/client";

async function getLeadWorkflowModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  return import("./lead-workflow");
}

const baseLeadContext = {
  fullName: "Jordan Lane",
  moveInDate: null,
  monthlyBudget: 1200,
  property: {
    name: "Maple House",
    schedulingUrl: "https://calendar.example.com/maple",
  },
  workspace: {
    name: "Roomflow Demo",
  },
  leadSource: {
    name: "Inbound email",
  },
} as const;

test("renderTemplateForLead substitutes known template variables", async () => {
  const { renderTemplateForLead } = await getLeadWorkflowModule();

  const rendered = renderTemplateForLead(
    {
      subject: "Hi {{lead.firstName}}",
      body: "Property: {{property.name}}",
      channel: MessageChannel.EMAIL,
      type: TemplateType.SCREENING_INVITE,
    },
    baseLeadContext,
  );

  assert.equal(rendered.subject, "Hi Jordan");
  assert.match(rendered.body, /^Hi Jordan,/);
  assert.match(rendered.body, /Property: Maple House/);
  assert.match(rendered.body, /What I need/);
  assert.match(rendered.body, /Roomflow Demo leasing desk$/);
});

test("renderTemplateForLeadSafely surfaces unresolved tokens", async () => {
  const { renderTemplateForLeadSafely } = await getLeadWorkflowModule();

  const rendered = renderTemplateForLeadSafely(
    {
      subject: "Hi {{lead.firstName}}",
      body: "Unknown token: {{lead.missingField}}",
      channel: MessageChannel.EMAIL,
      type: TemplateType.REMINDER,
    },
    baseLeadContext,
  );

  assert.deepEqual(rendered.unresolvedTokens, ["lead.missingField"]);
});

test("getLeadAutomationSuppressionSummaries includes configured throttle and delivery blockers", async () => {
  const { getLeadAutomationSuppressionSummaries } = await getLeadWorkflowModule();

  const summaries = getLeadAutomationSuppressionSummaries(
    {
      propertyId: "property_1",
      email: "lead@example.com",
      phone: null,
      contact: {
        email: null,
        phone: null,
      },
      preferredContactChannel: null,
      answers: [
        {
          questionId: "question_1",
          value: "2026-04-01",
          question: {
            fieldKey: "move_in_date",
            label: "Move-in date",
          },
        },
      ],
      auditEvents: [
        {
          eventType: "missing information requested",
          createdAt: new Date(),
        },
      ],
      automatedSendCount: 3,
      automatedSendCountDate: new Date(),
      optOutAt: null,
      status: LeadStatus.QUALIFIED,
      property: {
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
        schedulingUrl: null,
        schedulingEnabled: false,
        channelPriority: null,
        quietHoursStartLocal: null,
        quietHoursEndLocal: null,
        quietHoursTimeZone: null,
        questionSets: [
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
      },
      workspace: {
        channelPriority: null,
        dailyAutomatedSendCap: 3,
        missingInfoPromptThrottleMinutes: 180,
        quietHoursStartLocal: null,
        quietHoursEndLocal: null,
        quietHoursTimeZone: null,
      },
    } as never,
    {
      fitResult: QualificationFit.PASS,
      recommendedStatus: LeadStatus.QUALIFIED,
      summary: "Lead qualifies.",
      issues: [],
    },
  );

  assert.deepEqual(
    summaries.find((summary) => summary.actionKey === "request_info")?.reasons,
    [
      "Daily automated send cap (3) has been reached.",
      "Qualification is already complete for this lead.",
      "A missing-information prompt was sent within the 180-minute throttle window.",
    ],
  );
  assert.match(
    summaries
      .find((summary) => summary.actionKey === "schedule_tour")
      ?.reasons.join(" ") ?? "",
    /Property scheduling handoff is not enabled yet/,
  );
});
