import assert from "node:assert/strict";
import test from "node:test";
import { NotificationType } from "@/generated/prisma/client";
import type {
  NotificationEmailDependencies,
  SlackNotificationDependencies,
} from "@/lib/notification-delivery";

function getNotificationDeliveryModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./notification-delivery") as typeof import("@/lib/notification-delivery");
}

test("sendOwnerAdminNotificationEmail skips membership lookup when email delivery is unavailable", async () => {
  const { sendOwnerAdminNotificationEmail } = getNotificationDeliveryModule();
  let findMembershipsCalled = false;

  const dependencies: NotificationEmailDependencies = {
    createEmailDeliveryClient: () => null,
    findOwnerAndAdminMemberships: async () => {
      findMembershipsCalled = true;
      return [];
    },
    getSenderEmailAddress: () => "alerts@roomflow.app",
  };

  await sendOwnerAdminNotificationEmail(
    {
      workspaceId: "workspace-1",
      subject: "Subject",
      body: "Body",
    },
    dependencies,
  );

  assert.equal(findMembershipsCalled, false);
});

test("sendOwnerAdminNotificationEmail filters blank recipients before sending", async () => {
  const { sendOwnerAdminNotificationEmail } = getNotificationDeliveryModule();
  const sentPayloads: Array<{
    from: string;
    subject: string;
    text: string;
    to: string[];
  }> = [];

  const dependencies: NotificationEmailDependencies = {
    createEmailDeliveryClient: () => ({
      provider: "ses",
      sendTextEmail: async (payload) => {
        sentPayloads.push(payload);
      },
    }),
    findOwnerAndAdminMemberships: async () => [
      { user: { email: "owner@example.com" } },
      { user: { email: "" } },
      { user: { email: "admin@example.com" } },
    ],
    getSenderEmailAddress: () => "alerts@roomflow.app",
  };

  await sendOwnerAdminNotificationEmail(
    {
      workspaceId: "workspace-1",
      subject: "Lease update",
      body: "Important body",
    },
    dependencies,
  );

  assert.deepEqual(sentPayloads, [
    {
      from: "alerts@roomflow.app",
      subject: "Lease update",
      text: "Important body",
      to: ["owner@example.com", "admin@example.com"],
    },
  ]);
});

test("sendOwnerAdminNotificationEmail propagates email delivery failures", async () => {
  const { sendOwnerAdminNotificationEmail } = getNotificationDeliveryModule();
  const dependencies: NotificationEmailDependencies = {
    createEmailDeliveryClient: () => ({
      provider: "resend",
      sendTextEmail: async () => {
        throw new Error("Email provider unavailable");
      },
    }),
    findOwnerAndAdminMemberships: async () => [{ user: { email: "owner@example.com" } }],
    getSenderEmailAddress: () => "alerts@roomflow.app",
  };

  await assert.rejects(
    sendOwnerAdminNotificationEmail(
      {
        workspaceId: "workspace-1",
        subject: "Lease update",
        body: "Important body",
      },
      dependencies,
    ),
    /Email provider unavailable/,
  );
});

test("sendSlackNotification sends the formatted Slack payload when enabled", async () => {
  const { sendSlackNotification } = getNotificationDeliveryModule();
  const fetchCalls: Array<{ input: string; init?: RequestInit }> = [];

  const dependencies: SlackNotificationDependencies = {
    fetchFn: async (input, init) => {
      fetchCalls.push({ input: String(input), init });
      return new Response(null, { status: 200 });
    },
    findSlackIntegrationConnection: async () => ({
      config: { webhookUrl: "https://slack.example/hooks/1" },
      enabled: true,
    }),
    parseSlackConfig: () => ({
      webhookUrl: "https://slack.example/hooks/1",
      channelLabel: "#leasing",
      notifyOnApplicationInviteStale: false,
      notifyOnNewLead: true,
      notifyOnReviewAlerts: false,
      notifyOnTourScheduled: false,
    }),
  };

  await sendSlackNotification(
    {
      workspaceId: "workspace-1",
      type: NotificationType.NEW_LEAD,
      title: "New lead",
      body: "Prospect replied",
    },
    dependencies,
  );

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.input, "https://slack.example/hooks/1");
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    channel: "#leasing",
    text: "New lead\nProspect replied",
  });
});

test("sendSlackNotification throws when Slack rejects the request", async () => {
  const { sendSlackNotification } = getNotificationDeliveryModule();
  const dependencies: SlackNotificationDependencies = {
    fetchFn: async () => new Response(null, { status: 503 }),
    findSlackIntegrationConnection: async () => ({
      config: {},
      enabled: true,
    }),
    parseSlackConfig: () => ({
      webhookUrl: "https://slack.example/hooks/1",
      channelLabel: null,
      notifyOnApplicationInviteStale: false,
      notifyOnNewLead: true,
      notifyOnReviewAlerts: false,
      notifyOnTourScheduled: false,
    }),
  };

  await assert.rejects(
    sendSlackNotification(
      {
        workspaceId: "workspace-1",
        type: NotificationType.NEW_LEAD,
        title: "New lead",
        body: "Prospect replied",
      },
      dependencies,
    ),
    /Slack notification failed with status 503/,
  );
});

test("sendSlackNotification skips delivery when Slack notifications are disabled", async () => {
  const { sendSlackNotification } = getNotificationDeliveryModule();
  let fetchCalled = false;
  const dependencies: SlackNotificationDependencies = {
    fetchFn: async () => {
      fetchCalled = true;
      return new Response(null, { status: 200 });
    },
    findSlackIntegrationConnection: async () => ({
      config: {},
      enabled: true,
    }),
    parseSlackConfig: () => ({
      webhookUrl: "https://slack.example/hooks/1",
      channelLabel: null,
      notifyOnApplicationInviteStale: false,
      notifyOnNewLead: false,
      notifyOnReviewAlerts: false,
      notifyOnTourScheduled: false,
    }),
  };

  await sendSlackNotification(
    {
      workspaceId: "workspace-1",
      type: NotificationType.NEW_LEAD,
      title: "New lead",
      body: "Prospect replied",
    },
    dependencies,
  );

  assert.equal(fetchCalled, false);
});