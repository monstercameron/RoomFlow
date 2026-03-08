import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  IntegrationSyncStatus,
  NotificationType,
  WebhookDeliveryStatus,
} from "@/generated/prisma/client";
import type {
  AppendNotificationEventDependencies,
  QueueOutboundWorkflowWebhookDependencies,
} from "./lead-workflow";

function getLeadWorkflowModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./lead-workflow") as typeof import("@/lib/lead-workflow");
}

function createAppendNotificationDependencies(
  overrides: Partial<AppendNotificationEventDependencies> = {},
): AppendNotificationEventDependencies {
  return {
    createNotificationEvent: async () => undefined,
    sendOwnerAdminNotificationEmail: async () => undefined,
    sendSlackNotification: async () => undefined,
    ...overrides,
  };
}

function createQueueOutboundWebhookDependencies(
  overrides: Partial<QueueOutboundWorkflowWebhookDependencies> = {},
): QueueOutboundWorkflowWebhookDependencies {
  return {
    createOutboundWebhookDelivery: async () => ({ id: "delivery-1" }),
    enqueueOutboundWebhookDelivery: async () => null,
    findOutboundWebhookIntegrationConnection: async () => null,
    findWorkspaceWebhookSecret: async () => null,
    updateOutboundWebhookIntegrationConnection: async () => undefined,
    ...overrides,
  };
}

test("handleAppendNotificationEvent persists the event and swallows email and Slack delivery failures", async () => {
  const { handleAppendNotificationEvent } = getLeadWorkflowModule();
  const notificationEvents: unknown[] = [];
  const emailNotifications: unknown[] = [];
  const slackNotifications: unknown[] = [];

  await handleAppendNotificationEvent(
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      type: NotificationType.CAUTION_REVIEW,
      title: "Lead requires review",
      body: "A caution review needs operator attention.",
      payload: {
        leadId: "lead-1",
      },
    },
    createAppendNotificationDependencies({
      createNotificationEvent: async (input) => {
        notificationEvents.push(input);
      },
      sendOwnerAdminNotificationEmail: async (input) => {
        emailNotifications.push(input);
        throw new Error("SMTP unavailable");
      },
      sendSlackNotification: async (input) => {
        slackNotifications.push(input);
        throw new Error("Slack unavailable");
      },
    }),
  );

  assert.deepEqual(notificationEvents, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      type: NotificationType.CAUTION_REVIEW,
      title: "Lead requires review",
      body: "A caution review needs operator attention.",
      payload: {
        leadId: "lead-1",
      },
    },
  ]);
  assert.deepEqual(emailNotifications, [
    {
      workspaceId: "workspace-1",
      subject: "[Roomflow] Lead requires review",
      body: "A caution review needs operator attention.",
    },
  ]);
  assert.deepEqual(slackNotifications, [
    {
      workspaceId: "workspace-1",
      type: NotificationType.CAUTION_REVIEW,
      title: "Lead requires review",
      body: "A caution review needs operator attention.",
    },
  ]);
});

test("handleQueueOutboundWorkflowWebhook queues configured destinations with signatures and updates integration sync state", async () => {
  const { handleQueueOutboundWorkflowWebhook } = getLeadWorkflowModule();
  const createdDeliveries: unknown[] = [];
  const enqueuedDeliveries: unknown[] = [];
  const integrationUpdates: unknown[] = [];
  const payload = {
    leadId: "lead-1",
    workspaceId: "workspace-1",
  };

  await handleQueueOutboundWorkflowWebhook(
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "lead.qualified",
      payload,
    },
    createQueueOutboundWebhookDependencies({
      createOutboundWebhookDelivery: async (input) => {
        createdDeliveries.push(input);
        return { id: `delivery-${createdDeliveries.length}` };
      },
      enqueueOutboundWebhookDelivery: async (input) => {
        enqueuedDeliveries.push(input);
        return null;
      },
      findOutboundWebhookIntegrationConnection: async () => ({
        config: {
          destinations: [
            {
              enabled: true,
              label: "CRM",
              url: "https://example.test/webhooks/roomflow",
            },
          ],
          eventTypes: ["lead.qualified"],
          secretHint: "configured",
        },
        enabled: true,
      }),
      findWorkspaceWebhookSecret: async () => "workspace-secret",
      updateOutboundWebhookIntegrationConnection: async (input) => {
        integrationUpdates.push(input);
      },
    }),
  );

  const expectedSignature = createHmac("sha256", "workspace-secret")
    .update(JSON.stringify(payload))
    .digest("hex");

  assert.equal(createdDeliveries.length, 1);
  assert.equal(
    (createdDeliveries[0] as { workspaceId: string }).workspaceId,
    "workspace-1",
  );
  assert.equal(
    (createdDeliveries[0] as { leadId: string }).leadId,
    "lead-1",
  );
  assert.equal(
    (createdDeliveries[0] as { eventType: string }).eventType,
    "lead.qualified",
  );
  assert.equal(
    (createdDeliveries[0] as { destinationUrl: string }).destinationUrl,
    "https://example.test/webhooks/roomflow",
  );
  assert.equal(
    (createdDeliveries[0] as { signature: string }).signature,
    expectedSignature,
  );
  assert.equal(
    (createdDeliveries[0] as { status: WebhookDeliveryStatus }).status,
    WebhookDeliveryStatus.PENDING,
  );
  assert.deepEqual(
    (createdDeliveries[0] as { payload: typeof payload }).payload,
    payload,
  );
  assert.equal(
    (createdDeliveries[0] as { nextAttemptAt: Date }).nextAttemptAt instanceof Date,
    true,
  );
  assert.deepEqual(enqueuedDeliveries, [{ outboundWebhookDeliveryId: "delivery-1" }]);
  assert.deepEqual(integrationUpdates, [
    {
      workspaceId: "workspace-1",
      lastSyncMessage: "1 outbound webhook delivery queued for lead.qualified.",
      syncStatus: IntegrationSyncStatus.PENDING,
    },
  ]);
});

test("handleQueueOutboundWorkflowWebhook returns early when no configured or fallback destinations exist", async () => {
  const { handleQueueOutboundWorkflowWebhook } = getLeadWorkflowModule();
  const createdDeliveries: unknown[] = [];
  const integrationUpdates: unknown[] = [];
  const previousFallbackUrl = process.env.ROOMFLOW_OUTBOUND_WEBHOOK_URL;
  delete process.env.ROOMFLOW_OUTBOUND_WEBHOOK_URL;

  try {
    await handleQueueOutboundWorkflowWebhook(
      {
        workspaceId: "workspace-1",
        leadId: "lead-1",
        eventType: "lead.qualified",
        payload: {
          leadId: "lead-1",
        },
      },
      createQueueOutboundWebhookDependencies({
        createOutboundWebhookDelivery: async (input) => {
          createdDeliveries.push(input);
          return { id: "delivery-1" };
        },
        findOutboundWebhookIntegrationConnection: async () => ({
          config: {
            destinations: [],
            eventTypes: [],
            secretHint: null,
          },
          enabled: false,
        }),
        updateOutboundWebhookIntegrationConnection: async (input) => {
          integrationUpdates.push(input);
        },
      }),
    );
  } finally {
    if (previousFallbackUrl) {
      process.env.ROOMFLOW_OUTBOUND_WEBHOOK_URL = previousFallbackUrl;
    }
  }

  assert.deepEqual(createdDeliveries, []);
  assert.deepEqual(integrationUpdates, []);
});
