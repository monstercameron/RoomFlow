"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole, WorkspacePlanType } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  resolveDisabledCapabilitiesForWorkspacePlanChange,
  resolveEnabledCapabilitiesForWorkspacePlanChange,
} from "@/lib/workspace-plan";

function redirectToSettings(status?: string): never {
  redirect(status ? `/app/settings?planChange=${status}` : "/app/settings");
}

export async function updateWorkspacePlanAction(formData: FormData) {
  const targetWorkspacePlanType = String(formData.get("targetWorkspacePlanType") ?? "").trim();

  if (
    targetWorkspacePlanType !== WorkspacePlanType.PERSONAL &&
    targetWorkspacePlanType !== WorkspacePlanType.ORG
  ) {
    redirectToSettings();
  }

  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();

  if (
    currentWorkspaceMembership.role !== MembershipRole.OWNER &&
    currentWorkspaceMembership.workspace.billingOwnerUserId !== currentWorkspaceMembership.userId
  ) {
    redirectToSettings();
  }

  const disabledCapabilities = resolveDisabledCapabilitiesForWorkspacePlanChange({
    currentEnabledCapabilities: currentWorkspaceMembership.workspace.enabledCapabilities,
    targetWorkspacePlanType,
  });
  const nextEnabledCapabilities = resolveEnabledCapabilitiesForWorkspacePlanChange({
    currentEnabledCapabilities: currentWorkspaceMembership.workspace.enabledCapabilities,
    targetWorkspacePlanType,
  });

  await prisma.workspace.update({
    where: {
      id: currentWorkspaceMembership.workspaceId,
    },
    data: {
      enabledCapabilities: nextEnabledCapabilities,
      planType: targetWorkspacePlanType,
    },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/settings/members");

  redirectToSettings(
    targetWorkspacePlanType === WorkspacePlanType.PERSONAL && disabledCapabilities.length > 0
      ? "downgraded"
      : targetWorkspacePlanType === WorkspacePlanType.ORG
        ? "upgraded"
        : "updated",
  );
}