import assert from "node:assert/strict";
import test from "node:test";

import { MessageChannel } from "@/generated/prisma/client";

import {
  buildLeadChannelOptOutUpdate,
  formatMessageChannelLabel,
  isLeadChannelOptedOut,
  resolveLeadChannelOptOutState,
  resolveLeadOptOutSummary,
} from "./lead-channel-opt-outs";

test(
  "lead-channel-opt-outs falls back to legacy global opt-out state when channel-specific fields are empty",
  () => {
    const optedOutAt = new Date("2026-03-08T08:15:00.000Z");

    assert.deepEqual(
      resolveLeadChannelOptOutState(
        {
          optOutAt: optedOutAt,
          optOutReason: "Legacy unsubscribe",
        },
        MessageChannel.EMAIL,
      ),
      {
        optedOutAt,
        reason: "Legacy unsubscribe",
      },
    );
  },
);

test("lead-channel-opt-outs prefers channel-specific state over the legacy aggregate fields", () => {
    const legacyOptOutAt = new Date("2026-03-08T08:15:00.000Z");
    const emailOptOutAt = new Date("2026-03-08T09:15:00.000Z");

    assert.deepEqual(
      resolveLeadChannelOptOutState(
        {
          optOutAt: legacyOptOutAt,
          optOutReason: "Legacy unsubscribe",
          emailOptOutAt,
          emailOptOutReason: "Email unsubscribe",
        },
        MessageChannel.EMAIL,
      ),
      {
        optedOutAt: emailOptOutAt,
        reason: "Email unsubscribe",
      },
    );
  });

test("lead-channel-opt-outs does not treat internal notes as opted out", () => {
  assert.equal(
    isLeadChannelOptedOut(
      {
        optOutAt: new Date("2026-03-08T08:15:00.000Z"),
        optOutReason: "Do not contact",
      },
      MessageChannel.INTERNAL_NOTE,
    ),
    false,
  );
});

test("lead-channel-opt-outs updates aggregate state when a channel is opted out", () => {
  const changedAt = new Date("2026-03-08T10:15:00.000Z");

  assert.deepEqual(
    buildLeadChannelOptOutUpdate({
      lead: {},
      channel: MessageChannel.WHATSAPP,
      isOptedOut: true,
      changedAt,
      reason: "Requested in chat",
    }),
    {
      emailOptOutAt: null,
      emailOptOutReason: null,
      smsOptOutAt: null,
      smsOptOutReason: null,
      whatsappOptOutAt: changedAt,
      whatsappOptOutReason: "Requested in chat",
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: changedAt,
      optOutReason: "Requested in chat",
    },
  );
});

test("lead-channel-opt-outs keeps aggregate state aligned with the latest remaining channel opt-out", () => {
  const emailOptOutAt = new Date("2026-03-08T09:15:00.000Z");
  const smsOptOutAt = new Date("2026-03-08T10:15:00.000Z");

  assert.deepEqual(
    buildLeadChannelOptOutUpdate({
      lead: {
        emailOptOutAt,
        emailOptOutReason: "Email unsubscribe",
        smsOptOutAt,
        smsOptOutReason: "SMS stop",
        optOutAt: smsOptOutAt,
        optOutReason: "SMS stop",
      },
      channel: MessageChannel.SMS,
      isOptedOut: false,
      changedAt: new Date("2026-03-08T11:15:00.000Z"),
    }),
    {
      emailOptOutAt,
      emailOptOutReason: "Email unsubscribe",
      smsOptOutAt: null,
      smsOptOutReason: null,
      whatsappOptOutAt: null,
      whatsappOptOutReason: null,
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: emailOptOutAt,
      optOutReason: "Email unsubscribe",
    },
  );
});

test("lead-channel-opt-outs clears aggregate state when all channel opt-outs are removed", () => {
  const changedAt = new Date("2026-03-08T11:15:00.000Z");

  assert.deepEqual(
    buildLeadChannelOptOutUpdate({
      lead: {
        emailOptOutAt: new Date("2026-03-08T09:15:00.000Z"),
        emailOptOutReason: "Email unsubscribe",
        optOutAt: new Date("2026-03-08T09:15:00.000Z"),
        optOutReason: "Email unsubscribe",
      },
      channel: MessageChannel.EMAIL,
      isOptedOut: false,
      changedAt,
    }),
    {
      emailOptOutAt: null,
      emailOptOutReason: null,
      smsOptOutAt: null,
      smsOptOutReason: null,
      whatsappOptOutAt: null,
      whatsappOptOutReason: null,
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: null,
      optOutReason: null,
    },
  );
});

test("lead-channel-opt-outs derives an aggregate summary from the latest channel-specific opt-out", () => {
  const instagramOptOutAt = new Date("2026-03-08T12:15:00.000Z");

  assert.deepEqual(
    resolveLeadOptOutSummary({
      emailOptOutAt: new Date("2026-03-08T09:15:00.000Z"),
      emailOptOutReason: "Email unsubscribe",
      instagramOptOutAt,
      instagramOptOutReason: "Instagram block",
    }),
    {
      optOutAt: instagramOptOutAt,
      optOutReason: "Instagram block",
    },
  );
});

test("lead-channel-opt-outs formats human-readable labels for new channels", () => {
  assert.equal(formatMessageChannelLabel(MessageChannel.WHATSAPP), "WhatsApp");
  assert.equal(formatMessageChannelLabel(MessageChannel.INSTAGRAM), "Instagram");
  assert.equal(
    formatMessageChannelLabel(MessageChannel.INTERNAL_NOTE),
    "Internal note",
  );
});
