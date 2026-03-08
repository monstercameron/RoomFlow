"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole, WorkspaceCapability, WorkspacePlanType } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  resolveDisabledCapabilitiesForWorkspacePlanChange,
  resolveEnabledCapabilitiesForWorkspacePlanChange,
} from "@/lib/workspace-plan";

function redirectToSettings(status?: string): never {
  redirect(status ? `/app/settings?planChange=${status}` : "/app/settings");
}

type WorkspacePlanActionMembership = {
  role: MembershipRole;
  userId: string;
  workspaceId: string;
  workspace: {
    billingOwnerUserId: string | null;
    enabledCapabilities: WorkspaceCapability[];
  };
};

export type UpdateWorkspacePlanActionDependencies = {
  getCurrentWorkspaceMembership: () => Promise<WorkspacePlanActionMembership>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  resolveDisabledCapabilitiesForWorkspacePlanChange: typeof resolveDisabledCapabilitiesForWorkspacePlanChange;
  resolveEnabledCapabilitiesForWorkspacePlanChange: typeof resolveEnabledCapabilitiesForWorkspacePlanChange;
  updateWorkspace: (input: {
    workspaceId: string;
    enabledCapabilities: WorkspaceCapability[];
    planType: WorkspacePlanType;
  }) => Promise<unknown>;
};

const defaultUpdateWorkspacePlanActionDependencies: UpdateWorkspacePlanActionDependencies = {
  getCurrentWorkspaceMembership,
  redirect,
  revalidatePath,
  resolveDisabledCapabilitiesForWorkspacePlanChange,
  resolveEnabledCapabilitiesForWorkspacePlanChange,
  updateWorkspace: ({ workspaceId, enabledCapabilities, planType }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        enabledCapabilities,
        planType,
      },
    }),
};

export type TransferBillingOwnerActionDependencies = {
  findTargetMembership: (input: {
    targetUserId: string;
    workspaceId: string;
  }) => Promise<{ userId: string } | null>;
  getCurrentWorkspaceMembership: () => Promise<WorkspacePlanActionMembership>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateWorkspaceBillingOwner: (input: { workspaceId: string; billingOwnerUserId: string }) => Promise<unknown>;
};

const defaultTransferBillingOwnerActionDependencies: TransferBillingOwnerActionDependencies = {
  findTargetMembership: ({ targetUserId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        userId: targetUserId,
        workspaceId,
        role: {
          in: [MembershipRole.OWNER, MembershipRole.ADMIN],
        },
      },
    }),
  getCurrentWorkspaceMembership,
  redirect,
  revalidatePath,
  updateWorkspaceBillingOwner: ({ workspaceId, billingOwnerUserId }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        billingOwnerUserId,
      },
    }),
};

function redirectToSettingsWithDependency(
  redirectDependency: typeof redirect,
  status?: string,
): never {
  redirectDependency(status ? `/app/settings?planChange=${status}` : "/app/settings");
}

export async function handleUpdateWorkspacePlanAction(
  formData: FormData,
  dependencies: UpdateWorkspacePlanActionDependencies = defaultUpdateWorkspacePlanActionDependencies,
) {
  const targetWorkspacePlanType = String(formData.get("targetWorkspacePlanType") ?? "").trim();

  if (
    targetWorkspacePlanType !== WorkspacePlanType.PERSONAL &&
    targetWorkspacePlanType !== WorkspacePlanType.ORG
  ) {
    redirectToSettingsWithDependency(dependencies.redirect);
  }

  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();

  if (
    currentWorkspaceMembership.role !== MembershipRole.OWNER &&
    currentWorkspaceMembership.workspace.billingOwnerUserId !== currentWorkspaceMembership.userId
  ) {
    redirectToSettingsWithDependency(dependencies.redirect);
  }

  const disabledCapabilities = dependencies.resolveDisabledCapabilitiesForWorkspacePlanChange({
    currentEnabledCapabilities: currentWorkspaceMembership.workspace.enabledCapabilities,
    targetWorkspacePlanType,
  });
  const nextEnabledCapabilities = dependencies.resolveEnabledCapabilitiesForWorkspacePlanChange({
    currentEnabledCapabilities: currentWorkspaceMembership.workspace.enabledCapabilities,
    targetWorkspacePlanType,
  });

  await dependencies.updateWorkspace({
    workspaceId: currentWorkspaceMembership.workspaceId,
    enabledCapabilities: nextEnabledCapabilities,
    planType: targetWorkspacePlanType,
  });

  dependencies.revalidatePath("/app/settings");
  dependencies.revalidatePath("/app/settings/members");

  redirectToSettingsWithDependency(
    dependencies.redirect,
    targetWorkspacePlanType === WorkspacePlanType.PERSONAL && disabledCapabilities.length > 0
      ? "downgraded"
      : targetWorkspacePlanType === WorkspacePlanType.ORG
        ? "upgraded"
        : "updated",
  );
}

export async function updateWorkspacePlanAction(formData: FormData) {
  return handleUpdateWorkspacePlanAction(formData);
}

export async function handleTransferBillingOwnerAction(
  formData: FormData,
  dependencies: TransferBillingOwnerActionDependencies = defaultTransferBillingOwnerActionDependencies,
) {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();

  if (!targetUserId) {
    redirectToSettingsWithDependency(dependencies.redirect, "billing-owner-unchanged");
  }

  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();

  if (
    currentWorkspaceMembership.role !== MembershipRole.OWNER &&
    currentWorkspaceMembership.workspace.billingOwnerUserId !== currentWorkspaceMembership.userId
  ) {
    redirectToSettingsWithDependency(dependencies.redirect, "billing-owner-unchanged");
  }

  const targetMembership = await dependencies.findTargetMembership({
    targetUserId,
    workspaceId: currentWorkspaceMembership.workspaceId,
  });

  if (!targetMembership) {
    redirectToSettingsWithDependency(dependencies.redirect, "billing-owner-unchanged");
  }

  await dependencies.updateWorkspaceBillingOwner({
    workspaceId: currentWorkspaceMembership.workspaceId,
    billingOwnerUserId: targetMembership.userId,
  });

  dependencies.revalidatePath("/app/settings");
  redirectToSettingsWithDependency(dependencies.redirect, "billing-owner-transferred");
}

export async function transferBillingOwnerAction(formData: FormData) {
  return handleTransferBillingOwnerAction(formData);
}