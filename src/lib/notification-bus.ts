import { NotificationType, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationBusEventInput = {
  body: string;
  leadId?: string | null;
  payload?: Prisma.InputJsonValue;
  title: string;
  type: NotificationType;
  workspaceId: string;
};

export type NotificationCenterItem = {
  body: string;
  categoryKey: "all" | "new_leads" | "review_alerts" | "tour_updates" | "other";
  categoryLabel: string;
  createdAtLabel: string;
  href: string | null;
  id: string;
  isUnread: boolean;
  title: string;
  typeLabel: string;
};

export type NotificationCenterData = {
  items: NotificationCenterItem[];
  unreadCount: number;
};

type NotificationBusDependencies = {
  countUnreadNotifications: (workspaceId: string) => Promise<number>;
  createNotificationEvent: (input: NotificationBusEventInput) => Promise<unknown>;
  findRecentNotifications: (params: {
    take: number;
    workspaceId: string;
  }) => Promise<
    Array<{
      body: string;
      createdAt: Date;
      id: string;
      leadId: string | null;
      readAt: Date | null;
      title: string;
      type: NotificationType;
    }>
  >;
  markAllWorkspaceNotificationsRead: (workspaceId: string) => Promise<number>;
  markNotificationRead: (params: {
    notificationId: string;
    workspaceId: string;
  }) => Promise<boolean>;
};

const defaultNotificationBusDependencies: NotificationBusDependencies = {
  countUnreadNotifications: (workspaceId) =>
    prisma.notificationEvent.count({
      where: {
        workspaceId,
        readAt: null,
      },
    }),
  createNotificationEvent: ({ body, leadId, payload, title, type, workspaceId }) =>
    prisma.notificationEvent.create({
      data: {
        body,
        leadId: leadId ?? null,
        payload,
        title,
        type,
        workspaceId,
      },
    }),
  findRecentNotifications: ({ take, workspaceId }) =>
    prisma.notificationEvent.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      select: {
        body: true,
        createdAt: true,
        id: true,
        leadId: true,
        readAt: true,
        title: true,
        type: true,
      },
    }),
  markAllWorkspaceNotificationsRead: async (workspaceId) => {
    const result = await prisma.notificationEvent.updateMany({
      where: {
        workspaceId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count;
  },
  markNotificationRead: async ({ notificationId, workspaceId }) => {
    const result = await prisma.notificationEvent.updateMany({
      where: {
        id: notificationId,
        workspaceId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count > 0;
  },
};

function formatNotificationTypeLabel(type: NotificationType) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveNotificationCategory(type: NotificationType): Pick<NotificationCenterItem, "categoryKey" | "categoryLabel"> {
  switch (type) {
    case NotificationType.NEW_LEAD:
      return {
        categoryKey: "new_leads",
        categoryLabel: "New leads",
      };
    case NotificationType.CAUTION_REVIEW:
    case NotificationType.MISMATCH_REVIEW:
      return {
        categoryKey: "review_alerts",
        categoryLabel: "Review alerts",
      };
    case NotificationType.TOUR_SCHEDULED:
      return {
        categoryKey: "tour_updates",
        categoryLabel: "Tours",
      };
    default:
      return {
        categoryKey: "other",
        categoryLabel: "Other",
      };
  }
}

function formatNotificationRelativeTime(value: Date) {
  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });

  if (diffMinutes < 60) {
    return formatter.format(-diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return formatter.format(-diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays < 7) {
    return formatter.format(-diffDays, "day");
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(value);
}

export async function publishNotificationBusEvent(
  input: NotificationBusEventInput,
  dependencies: NotificationBusDependencies = defaultNotificationBusDependencies,
) {
  return dependencies.createNotificationEvent(input);
}

export async function getNotificationCenterData(
  params: {
    take?: number;
    workspaceId: string;
  },
  dependencies: NotificationBusDependencies = defaultNotificationBusDependencies,
): Promise<NotificationCenterData> {
  const take = params.take ?? 6;
  const [items, unreadCount] = await Promise.all([
    dependencies.findRecentNotifications({
      take,
      workspaceId: params.workspaceId,
    }),
    dependencies.countUnreadNotifications(params.workspaceId),
  ]);

  return {
    items: items.map((notification) => {
      const category = resolveNotificationCategory(notification.type);

      return {
        body: notification.body,
        categoryKey: category.categoryKey,
        categoryLabel: category.categoryLabel,
        createdAtLabel: formatNotificationRelativeTime(notification.createdAt),
        href: notification.leadId ? `/app/leads/${notification.leadId}` : null,
        id: notification.id,
        isUnread: notification.readAt === null,
        title: notification.title,
        typeLabel: formatNotificationTypeLabel(notification.type),
      };
    }),
    unreadCount,
  };
}

export async function markNotificationBusEventRead(
  params: {
    notificationId: string;
    workspaceId: string;
  },
  dependencies: NotificationBusDependencies = defaultNotificationBusDependencies,
) {
  return dependencies.markNotificationRead(params);
}

export async function markAllNotificationBusEventsRead(
  workspaceId: string,
  dependencies: NotificationBusDependencies = defaultNotificationBusDependencies,
) {
  return dependencies.markAllWorkspaceNotificationsRead(workspaceId);
}