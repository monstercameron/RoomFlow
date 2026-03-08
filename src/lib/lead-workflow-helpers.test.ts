import assert from "node:assert/strict";
import test from "node:test";
import { ContactChannel, LeadStatus, MessageChannel } from "@/generated/prisma/client";

function getLeadWorkflowModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./lead-workflow") as typeof import("@/lib/lead-workflow");
}

test("resolveChannelPriorityOrder keeps supported channels and falls back when invalid", () => {
  const { resolveChannelPriorityOrder } = getLeadWorkflowModule();

  assert.deepEqual(resolveChannelPriorityOrder(["email", "sms"]), [
    MessageChannel.EMAIL,
    MessageChannel.SMS,
  ]);
  assert.deepEqual(resolveChannelPriorityOrder(["push"]), [
    MessageChannel.SMS,
    MessageChannel.EMAIL,
  ]);
});

test("resolveOutboundMessageChannelForAction respects preferred and available channels", () => {
  const { resolveOutboundMessageChannelForAction } = getLeadWorkflowModule();

  assert.equal(
    resolveOutboundMessageChannelForAction({
      action: "request_info",
      channelPriorityOrder: [MessageChannel.EMAIL, MessageChannel.SMS],
      lead: {
        contact: {
          email: null,
          phone: "5551112222",
        },
        email: "lead@example.com",
        phone: null,
        preferredContactChannel: ContactChannel.SMS,
      },
      manualOnlyModeEnabled: false,
      templateChannel: null,
    }),
    MessageChannel.SMS,
  );

  assert.equal(
    resolveOutboundMessageChannelForAction({
      action: "send_application",
      channelPriorityOrder: [MessageChannel.EMAIL, MessageChannel.SMS],
      lead: {
        contact: null,
        email: null,
        phone: null,
        preferredContactChannel: null,
      },
      manualOnlyModeEnabled: true,
      templateChannel: null,
    }),
    MessageChannel.INTERNAL_NOTE,
  );
});

test("lead activity and deliverability helpers reflect automation constraints", () => {
  const {
    isChannelDeliverableForLead,
    isLeadActiveForAutomation,
    isSameUtcDay,
  } = getLeadWorkflowModule();

  assert.equal(isLeadActiveForAutomation(LeadStatus.QUALIFIED), true);
  assert.equal(isLeadActiveForAutomation(LeadStatus.CLOSED), false);
  assert.equal(
    isChannelDeliverableForLead({
      outboundMessageChannel: MessageChannel.EMAIL,
      lead: {
        contact: null,
        email: "lead@example.com",
        phone: null,
        preferredContactChannel: null,
      },
    }),
    true,
  );
  assert.equal(
    isChannelDeliverableForLead({
      outboundMessageChannel: MessageChannel.SMS,
      lead: {
        contact: null,
        email: "lead@example.com",
        phone: null,
        preferredContactChannel: null,
      },
    }),
    false,
  );
  assert.equal(
    isSameUtcDay(
      new Date("2026-03-08T00:15:00.000Z"),
      new Date("2026-03-08T23:45:00.000Z"),
    ),
    true,
  );
});

test("text and formatting helpers normalize user-facing values", () => {
  const {
    formatDisplayCurrency,
    formatDisplayDate,
    normalizeText,
    stringifyAnswerValue,
  } = getLeadWorkflowModule();

  assert.equal(normalizeText("  HELLO There  "), "hello there");
  assert.equal(stringifyAnswerValue(["one", 2, true]), "one, 2, yes");
  assert.equal(
    stringifyAnswerValue({ pets: true, rooms: 2 }),
    JSON.stringify({ pets: true, rooms: 2 }),
  );
  assert.equal(formatDisplayDate(null), "not set");
  assert.equal(formatDisplayDate(new Date("2026-03-08T12:00:00.000Z")), "Mar 8, 2026");
  assert.equal(formatDisplayCurrency(null), "not set");
  assert.equal(formatDisplayCurrency(2450), "$2,450");
});