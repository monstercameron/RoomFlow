import assert from "node:assert/strict";
import test from "node:test";
import { MessageChannel, TemplateType } from "@/generated/prisma/client";
import { formatBrandedMessageForLead } from "./message-branding";

const baseLeadContext = {
  fullName: "Jordan Lane",
  property: {
    name: "Maple House",
    schedulingUrl: "https://calendar.example.com/maple",
  },
  workspace: {
    name: "Roomflow Demo",
  },
} as const;

test("formatBrandedMessageForLead adds structured email framing", () => {
  const formattedBody = formatBrandedMessageForLead({
    body: "You look like a strong fit so far.",
    channel: MessageChannel.EMAIL,
    type: TemplateType.TOUR_INVITE,
    lead: baseLeadContext,
  });

  assert.match(formattedBody, /^Hi Jordan,/);
  assert.match(formattedBody, /Next step/);
  assert.match(formattedBody, /Choose a tour time: https:\/\/calendar.example.com\/maple/);
  assert.match(formattedBody, /Roomflow Demo leasing desk$/);
});

test("formatBrandedMessageForLead keeps SMS compact while branding the sender", () => {
  const formattedBody = formatBrandedMessageForLead({
    body: "Please confirm the shared-house rules still work for you.",
    channel: MessageChannel.SMS,
    type: TemplateType.HOUSE_RULES_ACKNOWLEDGMENT,
    lead: baseLeadContext,
  });

  assert.equal(
    formattedBody,
    "Roomflow Demo: Please confirm the shared-house rules still work for you.",
  );
});