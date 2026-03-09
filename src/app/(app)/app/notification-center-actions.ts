"use server";

import { revalidatePath } from "next/cache";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import {
  markAllNotificationBusEventsRead,
  markNotificationBusEventRead,
} from "@/lib/notification-bus";

export async function markHeaderNotificationRead(notificationId: string) {
  const membership = await getCurrentWorkspaceMembership();

  await markNotificationBusEventRead({
    notificationId,
    workspaceId: membership.workspaceId,
  });

  revalidatePath("/app");
}

export async function markAllHeaderNotificationsRead() {
  const membership = await getCurrentWorkspaceMembership();

  await markAllNotificationBusEventsRead(membership.workspaceId);

  revalidatePath("/app");
}