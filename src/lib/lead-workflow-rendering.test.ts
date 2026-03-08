import assert from "node:assert/strict";
import test from "node:test";
import { MessageChannel, TemplateType } from "@/generated/prisma/client";

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
