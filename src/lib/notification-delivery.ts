import { IntegrationProvider, MembershipRole, NotificationType } from "@/generated/prisma/client";
import {
  getConfiguredEmailDeliveryClient,
  getConfiguredSenderEmailAddress,
  type EmailDeliveryClient,
} from "@/lib/email-delivery";
import { parseSlackIntegrationConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

export type NotificationEmailDependencies = {
  createEmailDeliveryClient: () => EmailDeliveryClient | null;
  findOwnerAndAdminMemberships: (workspaceId: string) => Promise<Array<{ user: { email: string } }>>;
  getSenderEmailAddress: () => string | null;
};

const defaultNotificationEmailDependencies: NotificationEmailDependencies = {
  createEmailDeliveryClient: getConfiguredEmailDeliveryClient,
  findOwnerAndAdminMemberships: (workspaceId) =>
    prisma.membership.findMany({
      where: {
        workspaceId,
        role: {
          in: [MembershipRole.OWNER, MembershipRole.ADMIN],
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
  getSenderEmailAddress: getConfiguredSenderEmailAddress,
};

export async function sendOwnerAdminNotificationEmail(params: {
  workspaceId: string;
  subject: string;
  body: string;
}, dependencies: NotificationEmailDependencies = defaultNotificationEmailDependencies) {
  const emailDeliveryClient = dependencies.createEmailDeliveryClient();
  const senderEmailAddress = dependencies.getSenderEmailAddress();

  if (!emailDeliveryClient || !senderEmailAddress) {
    return;
  }

  const ownerAndAdminMemberships = await dependencies.findOwnerAndAdminMemberships(params.workspaceId);

  const recipientEmailAddresses = ownerAndAdminMemberships
    .map((membership) => membership.user.email)
    .filter((emailAddress) => emailAddress.length > 0);

  if (recipientEmailAddresses.length === 0) {
    return;
  }

  await emailDeliveryClient.sendTextEmail({
    from: senderEmailAddress,
    to: recipientEmailAddresses,
    subject: params.subject,
    text: params.body,
  });
}

function shouldSendSlackNotification(params: {
  notificationType: NotificationType;
  slackConfig: ReturnType<typeof parseSlackIntegrationConfig>;
}) {
  switch (params.notificationType) {
    case NotificationType.NEW_LEAD:
      return params.slackConfig.notifyOnNewLead;
    case NotificationType.TOUR_SCHEDULED:
      return params.slackConfig.notifyOnTourScheduled;
    case NotificationType.CAUTION_REVIEW:
    case NotificationType.MISMATCH_REVIEW:
      return params.slackConfig.notifyOnReviewAlerts;
    case NotificationType.APPLICATION_INVITE_STALE:
      return params.slackConfig.notifyOnApplicationInviteStale;
    default:
      return false;
  }
}

export type SlackNotificationDependencies = {
  fetchFn: typeof fetch;
  findSlackIntegrationConnection: (workspaceId: string) => Promise<{
    config: unknown;
    enabled: boolean;
  } | null>;
  parseSlackConfig: typeof parseSlackIntegrationConfig;
};

const defaultSlackNotificationDependencies: SlackNotificationDependencies = {
  fetchFn: fetch,
  findSlackIntegrationConnection: (workspaceId) =>
    prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: IntegrationProvider.SLACK,
        },
      },
      select: {
        config: true,
        enabled: true,
      },
    }),
  parseSlackConfig: parseSlackIntegrationConfig,
};

export async function sendSlackNotification(params: {
  workspaceId: string;
  type: NotificationType;
  title: string;
  body: string;
}, dependencies: SlackNotificationDependencies = defaultSlackNotificationDependencies) {
  const integrationConnection = await dependencies.findSlackIntegrationConnection(params.workspaceId);

  if (!integrationConnection?.enabled) {
    return;
  }

  const slackConfig = dependencies.parseSlackConfig(integrationConnection.config);

  if (!slackConfig.webhookUrl || !shouldSendSlackNotification({ notificationType: params.type, slackConfig })) {
    return;
  }

  const response = await dependencies.fetchFn(slackConfig.webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: `${params.title}\n${params.body}`,
      ...(slackConfig.channelLabel ? { channel: slackConfig.channelLabel } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed with status ${response.status}.`);
  }
}
