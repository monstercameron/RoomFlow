import assert from "node:assert/strict";
import test from "node:test";
import { LeadSourceType, MessageChannel } from "@/generated/prisma/client";
import type { JobWithMetadata } from "pg-boss";
import type { NormalizedLeadPayload } from "@/lib/lead-normalization";
import type { RegisterWorkerHandlersDependencies } from "@/lib/jobs";

function getJobsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./jobs") as typeof import("@/lib/jobs");
}

function createJob<T>(data: T, retryCount = 0): JobWithMetadata<T> {
  return {
    data,
    retryCount,
  } as JobWithMetadata<T>;
}

function createNormalizedLeadPayload(overrides: Partial<NormalizedLeadPayload> = {}): NormalizedLeadPayload {
  return {
    body: "Inbound message body",
    channel: MessageChannel.EMAIL,
    email: "lead@example.com",
    externalMessageId: null,
    externalThreadId: null,
    fullName: "Lead Prospect",
    leadSourceName: "Web",
    leadSourceType: LeadSourceType.WEB_FORM,
    metadata: {},
    phone: null,
    propertyId: null,
    receivedAt: new Date("2026-03-08T12:00:00.000Z"),
    subject: null,
    workspaceId: "workspace-1",
    ...overrides,
  };
}

test("getBossConnectionString throws when DATABASE_URL is missing", () => {
  const { getBossConnectionString } = getJobsModule();
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    assert.throws(() => getBossConnectionString(), /DATABASE_URL is not configured/);
  } finally {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("processWebhookJob forwards every payload to inbound processing", async () => {
  const { processWebhookJob } = getJobsModule();
  const processedPayloads: NormalizedLeadPayload[] = [];

  await processWebhookJob(
    [
      createJob(createNormalizedLeadPayload({ email: "one@example.com", fullName: "Lead One" })),
      createJob(createNormalizedLeadPayload({ email: "two@example.com", fullName: "Lead Two" })),
    ],
    {
      isProviderConfigurationError: () => false,
      markMessageDeliveryFailure: async () => undefined,
      markMessageProviderUnresolved: async () => undefined,
      processNormalizedInboundLead: async (payload) => {
        processedPayloads.push(payload);
        return {
          conversationId: "conversation-1",
          idempotentReplay: false,
          leadId: "lead-1",
          messageId: "message-1",
        };
      },
      sendQueuedMessage: async () => undefined,
    },
  );

  assert.equal(processedPayloads.length, 2);
  assert.equal(processedPayloads[0]?.fullName, "Lead One");
  assert.equal(processedPayloads[1]?.fullName, "Lead Two");
});

test("processOutboundMessageJobs marks provider unresolved errors and continues", async () => {
  const { processOutboundMessageJobs } = getJobsModule();
  const unresolvedPayloads: Array<{ error: string; messageId: string }> = [];
  const deliveryFailures: Array<{ error: string; messageId: string; retryCount: number }> = [];

  await processOutboundMessageJobs(
    [createJob({ messageId: "message-1" }, 2)],
    {
      isProviderConfigurationError: (message) => message.includes("RESEND_API_KEY"),
      markMessageDeliveryFailure: async (payload) => {
        deliveryFailures.push(payload);
      },
      markMessageProviderUnresolved: async (payload) => {
        unresolvedPayloads.push(payload);
      },
      processNormalizedInboundLead: async () => ({
        conversationId: "conversation-1",
        idempotentReplay: false,
        leadId: "lead-1",
        messageId: "message-1",
      }),
      sendQueuedMessage: async () => {
        throw new Error("RESEND_API_KEY is not configured.");
      },
    },
  );

  assert.deepEqual(unresolvedPayloads, [
    {
      error: "RESEND_API_KEY is not configured.",
      messageId: "message-1",
    },
  ]);
  assert.deepEqual(deliveryFailures, []);
});

test("processOutboundMessageJobs records retry failures and rethrows unexpected errors", async () => {
  const { processOutboundMessageJobs } = getJobsModule();
  const deliveryFailures: Array<{ error: string; messageId: string; retryCount: number }> = [];

  await assert.rejects(
    processOutboundMessageJobs(
      [createJob({ messageId: "message-1" }, 3)],
      {
        isProviderConfigurationError: () => false,
        markMessageDeliveryFailure: async (payload) => {
          deliveryFailures.push(payload);
        },
        markMessageProviderUnresolved: async () => undefined,
        processNormalizedInboundLead: async () => ({
          conversationId: "conversation-1",
          idempotentReplay: false,
          leadId: "lead-1",
          messageId: "message-1",
        }),
        sendQueuedMessage: async () => {
          throw new Error("503 upstream timeout");
        },
      },
    ),
    /503 upstream timeout/,
  );

  assert.deepEqual(deliveryFailures, [
    {
      error: "503 upstream timeout",
      messageId: "message-1",
      retryCount: 3,
    },
  ]);
});

test("registerWorkerHandlers wires every queue to the expected batch worker", async () => {
  const { jobNames, registerWorkerHandlers } = getJobsModule();
  const registrations: Array<{
    handler: (...args: unknown[]) => unknown;
    name: string;
    options: { batchSize: number; includeMetadata: boolean };
  }> = [];
  const boss = {
    stop: async () => undefined,
    work: async (
      name: string,
      options: { batchSize: number; includeMetadata: boolean },
      handler: (...args: unknown[]) => unknown,
    ) => {
      registrations.push({ handler, name, options });
    },
  } as unknown as Awaited<ReturnType<RegisterWorkerHandlersDependencies["getBoss"]>>;

  const result = await registerWorkerHandlers({
    getBoss: async () => boss,
  });

  assert.equal(result, boss);
  assert.deepEqual(
    registrations.map((registration) => ({
      name: registration.name,
      options: registration.options,
    })),
    [
      {
        name: jobNames.webhookProcessing,
        options: { batchSize: 1, includeMetadata: true },
      },
      {
        name: jobNames.outboundMessageSend,
        options: { batchSize: 1, includeMetadata: true },
      },
      {
        name: jobNames.reminderSend,
        options: { batchSize: 1, includeMetadata: true },
      },
      {
        name: jobNames.delayedFollowUp,
        options: { batchSize: 1, includeMetadata: true },
      },
      {
        name: jobNames.outboundWebhookDelivery,
        options: { batchSize: 1, includeMetadata: true },
      },
    ],
  );
  assert.equal(registrations.length, 5);
});