import "dotenv/config";
import { NotificationType } from "../src/generated/prisma/client";
import { publishNotificationBusEvent } from "../src/lib/notification-bus";
import { prisma } from "../src/lib/prisma";

const DEFAULT_TEST_EMAIL = "test@roomflow.local";

type NotificationSeedTemplate = {
  body: string;
  createdAt: Date;
  markRead: boolean;
  title: string;
  type: NotificationType;
};

function minutesAgo(value: number) {
  return new Date(Date.now() - value * 60 * 1000);
}

async function main() {
  const targetEmail = process.env.DEV_NOTIFICATION_EMAIL ?? DEFAULT_TEST_EMAIL;

  const membership = await prisma.membership.findFirst({
    where: {
      user: {
        email: targetEmail,
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!membership) {
    throw new Error(`No workspace membership found for ${targetEmail}.`);
  }

  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 6,
    select: {
      fullName: true,
      id: true,
    },
  });

  const leadName = (index: number) => {
    const lead = leads[index % Math.max(leads.length, 1)];

    if (!lead) {
      return "Prospect";
    }

    return lead.fullName.trim() || "Prospect";
  };

  const leadIdFor = (index: number) => {
    const lead = leads[index % Math.max(leads.length, 1)];

    return lead?.id ?? null;
  };

  const templates: NotificationSeedTemplate[] = [
    {
      body: `${leadName(0)} submitted a fresh web inquiry and is waiting for first outreach.`,
      createdAt: minutesAgo(6),
      markRead: false,
      title: "New inquiry ready for follow-up",
      type: NotificationType.NEW_LEAD,
    },
    {
      body: `${leadName(1)} tripped a caution rule and should get a quick operator review today.`,
      createdAt: minutesAgo(18),
      markRead: false,
      title: "Caution review queued",
      type: NotificationType.CAUTION_REVIEW,
    },
    {
      body: `${leadName(2)} mismatched a required policy and needs a disposition decision.`,
      createdAt: minutesAgo(31),
      markRead: false,
      title: "Mismatch review needs attention",
      type: NotificationType.MISMATCH_REVIEW,
    },
    {
      body: `${leadName(3)} has been idle for 48 hours and may need a re-engagement touch.`,
      createdAt: minutesAgo(54),
      markRead: true,
      title: "Lead went stale",
      type: NotificationType.STALE_LEAD,
    },
    {
      body: `${leadName(4)} booked a tour window. Confirm reminders and host assignment.`,
      createdAt: minutesAgo(83),
      markRead: false,
      title: "Tour scheduled",
      type: NotificationType.TOUR_SCHEDULED,
    },
    {
      body: `${leadName(5)} has an application invite that will expire soon if untouched.`,
      createdAt: minutesAgo(112),
      markRead: true,
      title: "Application invite aging",
      type: NotificationType.APPLICATION_INVITE_STALE,
    },
    {
      body: `${leadName(0)} came in from a duplicate listing feed and should be sanity-checked.`,
      createdAt: minutesAgo(155),
      markRead: false,
      title: "New lead from listing feed",
      type: NotificationType.NEW_LEAD,
    },
    {
      body: `${leadName(1)} hit a house-rule caution after updated qualification answers.`,
      createdAt: minutesAgo(205),
      markRead: true,
      title: "House-rule caution detected",
      type: NotificationType.CAUTION_REVIEW,
    },
    {
      body: `${leadName(2)} missed the latest follow-up checkpoint and is at risk of slipping.`,
      createdAt: minutesAgo(286),
      markRead: false,
      title: "Follow-up SLA at risk",
      type: NotificationType.STALE_LEAD,
    },
    {
      body: `${leadName(3)} is still pending review before a tour confirmation can go out.`,
      createdAt: minutesAgo(410),
      markRead: true,
      title: "Tour confirmation blocked",
      type: NotificationType.MISMATCH_REVIEW,
    },
  ];

  const createdNotifications = [] as Array<{ id: string; markRead: boolean }>;

  for (const [index, template] of templates.entries()) {
    const createdNotification = await publishNotificationBusEvent({
      body: template.body,
      leadId: leadIdFor(index),
      payload: {
        devSeed: true,
        seededFor: membership.user.email,
        sequence: index + 1,
      },
      title: template.title,
      type: template.type,
      workspaceId: membership.workspaceId,
    });

    const normalizedNotification = createdNotification as { id: string };
    createdNotifications.push({
      id: normalizedNotification.id,
      markRead: template.markRead,
    });

    await prisma.notificationEvent.update({
      where: {
        id: normalizedNotification.id,
      },
      data: {
        createdAt: template.createdAt,
        readAt: template.markRead ? new Date(template.createdAt.getTime() + 5 * 60 * 1000) : null,
      },
    });
  }

  const unreadCount = createdNotifications.filter((notification) => !notification.markRead).length;

  console.log(
    `Seeded ${createdNotifications.length} dev notifications into ${membership.workspace.name} for ${membership.user.email}. ${unreadCount} unread, ${createdNotifications.length - unreadCount} read.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });