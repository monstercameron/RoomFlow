import assert from "node:assert/strict";
import test from "node:test";
import { MessageChannel, TemplateType } from "@/generated/prisma/client";
import type { TourCommunicationDependencies } from "@/lib/tour-communications";

function getTourCommunicationsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./tour-communications") as typeof import("@/lib/tour-communications");
}

function createDependencies(overrides: Partial<TourCommunicationDependencies> = {}): TourCommunicationDependencies {
  return {
    createConversation: async () => ({ id: "conversation-1" }),
    createMessage: async () => ({ id: "message-1" }),
    findLead: async () => ({
      contact: {
        email: "lead@example.com",
        phone: null,
        preferredChannel: "EMAIL",
      },
      conversation: null,
      email: "lead@example.com",
      id: "lead-1",
      phone: null,
    }),
    isProviderConfigurationError: () => false,
    markMessageDeliveryFailure: async () => undefined,
    markMessageProviderUnresolved: async () => undefined,
    sendQueuedMessage: async () => undefined,
    ...overrides,
  };
}

test("resolveLeadProspectChannel prefers an available preferred channel", () => {
  const { resolveLeadProspectChannel } = getTourCommunicationsModule();
  assert.equal(
    resolveLeadProspectChannel({
      contact: {
        email: null,
        phone: "5551112222",
        preferredChannel: "SMS",
      },
      email: "lead@example.com",
      phone: null,
    }),
    MessageChannel.SMS,
  );
});

test("createAndDeliverTourMessage throws when the lead does not exist", async () => {
  const { createAndDeliverTourMessage } = getTourCommunicationsModule();
  const dependencies = createDependencies({
    findLead: async () => null,
  });

  await assert.rejects(
    createAndDeliverTourMessage(
      {
        body: "Body",
        leadId: "missing",
        subject: "Subject",
        templateType: TemplateType.TOUR_CONFIRMATION,
      },
      dependencies,
    ),
    /Lead not found/,
  );
});

test("createAndDeliverTourMessage returns false when the lead has no deliverable channel", async () => {
  const { createAndDeliverTourMessage } = getTourCommunicationsModule();
  let createMessageCalled = false;
  const dependencies = createDependencies({
    createMessage: async () => {
      createMessageCalled = true;
      return { id: "message-1" };
    },
    findLead: async () => ({
      contact: {
        email: null,
        phone: null,
        preferredChannel: null,
      },
      conversation: null,
      email: null,
      id: "lead-1",
      phone: null,
    }),
  });

  const result = await createAndDeliverTourMessage(
    {
      body: "Body",
      leadId: "lead-1",
      subject: "Subject",
      templateType: TemplateType.TOUR_CONFIRMATION,
    },
    dependencies,
  );

  assert.equal(result, false);
  assert.equal(createMessageCalled, false);
});

test("createAndDeliverTourMessage marks provider-unresolved errors without failing the message", async () => {
  const { createAndDeliverTourMessage } = getTourCommunicationsModule();
  const unresolvedPayloads: Array<{ error: string; messageId: string }> = [];
  const failurePayloads: Array<{ error: string; messageId: string; retryCount: number }> = [];
  const dependencies = createDependencies({
    isProviderConfigurationError: (message) => message.includes("RESEND_API_KEY"),
    markMessageDeliveryFailure: async (payload) => {
      failurePayloads.push(payload);
    },
    markMessageProviderUnresolved: async (payload) => {
      unresolvedPayloads.push(payload);
    },
    sendQueuedMessage: async () => {
      throw new Error("RESEND_API_KEY is not configured.");
    },
  });

  const result = await createAndDeliverTourMessage(
    {
      body: "Body",
      leadId: "lead-1",
      subject: "Subject",
      templateType: TemplateType.TOUR_CONFIRMATION,
    },
    dependencies,
  );

  assert.equal(result, false);
  assert.deepEqual(unresolvedPayloads, [
    {
      error: "RESEND_API_KEY is not configured.",
      messageId: "message-1",
    },
  ]);
  assert.deepEqual(failurePayloads, []);
});

test("createAndDeliverTourMessage marks delivery failures for non-configuration errors", async () => {
  const { createAndDeliverTourMessage } = getTourCommunicationsModule();
  const unresolvedPayloads: Array<{ error: string; messageId: string }> = [];
  const failurePayloads: Array<{ error: string; messageId: string; retryCount: number }> = [];
  const dependencies = createDependencies({
    markMessageDeliveryFailure: async (payload) => {
      failurePayloads.push(payload);
    },
    markMessageProviderUnresolved: async (payload) => {
      unresolvedPayloads.push(payload);
    },
    sendQueuedMessage: async () => {
      throw new Error("503 upstream provider timeout.");
    },
  });

  const result = await createAndDeliverTourMessage(
    {
      body: "Body",
      leadId: "lead-1",
      subject: "Subject",
      templateType: TemplateType.TOUR_CONFIRMATION,
    },
    dependencies,
  );

  assert.equal(result, false);
  assert.deepEqual(unresolvedPayloads, []);
  assert.deepEqual(failurePayloads, [
    {
      error: "503 upstream provider timeout.",
      messageId: "message-1",
      retryCount: 0,
    },
  ]);
});

test("sendTourScheduledConfirmation creates and queues a confirmation message", async () => {
  const { sendTourScheduledConfirmation } = getTourCommunicationsModule();
  const createdMessages: Array<{
    body: string;
    channel: MessageChannel;
    subject: string | null;
  }> = [];
  let queuedMessageId: string | null = null;
  const dependencies = createDependencies({
    createMessage: async (payload) => {
      createdMessages.push({
        body: payload.body,
        channel: payload.channel,
        subject: payload.subject,
      });
      return { id: "message-1" };
    },
    sendQueuedMessage: async (messageId) => {
      queuedMessageId = messageId;
    },
  });

  const result = await sendTourScheduledConfirmation(
    {
      leadId: "lead-1",
      propertyName: "Maple Court",
      scheduledAt: new Date("2026-03-08T17:30:00.000Z"),
    },
    dependencies,
  );

  assert.equal(result, true);
  assert.equal(createdMessages.length, 1);
  assert.equal(createdMessages[0]?.channel, MessageChannel.EMAIL);
  assert.match(createdMessages[0]?.body ?? "", /Maple Court/);
  assert.match(createdMessages[0]?.subject ?? "", /Tour confirmed/);
  assert.equal(queuedMessageId, "message-1");
});

test("rescheduled and canceled tour notifications use operator overrides when present", async () => {
  const {
    sendTourCanceledNotification,
    sendTourRescheduledNotification,
  } = getTourCommunicationsModule();
  const createdMessages: Array<{ body: string; subject: string | null }> = [];
  const dependencies = createDependencies({
    createMessage: async (payload) => {
      createdMessages.push({ body: payload.body, subject: payload.subject });
      return { id: `message-${createdMessages.length}` };
    },
  });

  await sendTourRescheduledNotification(
    {
      leadId: "lead-1",
      propertyName: "Maple Court",
      prospectMessage: "Custom reschedule note",
      scheduledAt: new Date("2026-03-08T17:30:00.000Z"),
    },
    dependencies,
  );
  await sendTourCanceledNotification(
    {
      leadId: "lead-1",
      propertyName: "Maple Court",
      prospectMessage: "Custom cancel note",
    },
    dependencies,
  );

  assert.equal(createdMessages[0]?.body, "Custom reschedule note");
  assert.match(createdMessages[0]?.subject ?? "", /Tour rescheduled/);
  assert.equal(createdMessages[1]?.body, "Custom cancel note");
  assert.equal(createdMessages[1]?.subject, "Tour canceled for Maple Court");
});