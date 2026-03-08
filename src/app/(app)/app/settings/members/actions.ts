"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole, WorkspaceCapability } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import {
  canMembershipRoleManageWorkspaceInvites,
  getAssignableWorkspaceInviteRoles,
  getWorkspaceInviteStatus,
} from "@/lib/workspace-invites";

type MemberSettingsActionMembership = {
  id: string;
  role: MembershipRole;
  workspaceId: string;
  workspace: {
    enabledCapabilities: WorkspaceCapability[];
  };
};

type MemberSettingsActionWorkspaceState = {
  user: {
    id: string;
  };
};

export type UpdateMemberSharedTourCoverageActionDependencies = {
  canMembershipRoleManageWorkspaceInvites: (role: MembershipRole) => boolean;
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findTargetMembership: (input: {
    membershipId: string;
    workspaceId: string;
  }) => Promise<{
    id: string;
    user: {
      name: string | null;
    };
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<MemberSettingsActionMembership>;
  getCurrentWorkspaceState: () => Promise<MemberSettingsActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateMembership: (input: {
    membershipId: string;
    sharedTourCoverageEnabled: boolean;
  }) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

export type UpdateMemberRoleActionDependencies = {
  canMembershipRoleManageWorkspaceInvites: (role: MembershipRole) => boolean;
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findTargetMembership: (input: {
    membershipId: string;
    workspaceId: string;
  }) => Promise<{
    id: string;
    role: MembershipRole;
    user: {
      email: string;
      name: string | null;
    };
  } | null>;
  getAssignableWorkspaceInviteRoles: typeof getAssignableWorkspaceInviteRoles;
  getCurrentWorkspaceMembership: () => Promise<MemberSettingsActionMembership>;
  getCurrentWorkspaceState: () => Promise<MemberSettingsActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateMembershipRole: (input: {
    membershipId: string;
    membershipRole: MembershipRole;
  }) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

export type RevokeWorkspaceInviteActionDependencies = {
  canMembershipRoleManageWorkspaceInvites: (role: MembershipRole) => boolean;
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findWorkspaceInvite: (input: {
    workspaceId: string;
    workspaceInviteId: string;
  }) => Promise<{
    email: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    id: string;
    revokedAt: Date | null;
    role: MembershipRole;
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<MemberSettingsActionMembership>;
  getCurrentWorkspaceState: () => Promise<MemberSettingsActionWorkspaceState>;
  getWorkspaceInviteStatus: typeof getWorkspaceInviteStatus;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  revokeWorkspaceInvite: (workspaceInviteId: string) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultUpdateMemberSharedTourCoverageActionDependencies: UpdateMemberSharedTourCoverageActionDependencies = {
  canMembershipRoleManageWorkspaceInvites,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findTargetMembership: ({ membershipId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateMembership: ({ membershipId, sharedTourCoverageEnabled }) =>
    prisma.membership.update({
      where: {
        id: membershipId,
      },
      data: {
        sharedTourCoverageEnabled,
      },
    }),
  workspaceHasCapability,
};

const defaultUpdateMemberRoleActionDependencies: UpdateMemberRoleActionDependencies = {
  canMembershipRoleManageWorkspaceInvites,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findTargetMembership: ({ membershipId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  getAssignableWorkspaceInviteRoles,
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateMembershipRole: ({ membershipId, membershipRole }) =>
    prisma.membership.update({
      where: {
        id: membershipId,
      },
      data: {
        role: membershipRole,
      },
    }),
  workspaceHasCapability,
};

const defaultRevokeWorkspaceInviteActionDependencies: RevokeWorkspaceInviteActionDependencies = {
  canMembershipRoleManageWorkspaceInvites,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findWorkspaceInvite: ({ workspaceId, workspaceInviteId }) =>
    prisma.workspaceInvite.findFirst({
      where: {
        id: workspaceInviteId,
        workspaceId,
      },
      select: {
        acceptedAt: true,
        email: true,
        expiresAt: true,
        id: true,
        revokedAt: true,
        role: true,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  getWorkspaceInviteStatus,
  redirect,
  revalidatePath,
  revokeWorkspaceInvite: (workspaceInviteId) =>
    prisma.workspaceInvite.update({
      where: {
        id: workspaceInviteId,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  workspaceHasCapability,
};

export async function handleUpdateMemberSharedTourCoverageAction(
  membershipId: string,
  formData: FormData,
  dependencies: UpdateMemberSharedTourCoverageActionDependencies = defaultUpdateMemberSharedTourCoverageActionDependencies,
) {
  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const sharedTourCoverageEnabled = formData.get("sharedTourCoverageEnabled") === "on";

  if (
    !dependencies.workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Shared tour coverage is only available on Org workspaces.");
  }

  if (!dependencies.canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can manage shared tour coverage.");
  }

  const targetMembership = await dependencies.findTargetMembership({
    membershipId,
    workspaceId: currentWorkspaceMembership.workspaceId,
  });

  if (!targetMembership) {
    throw new Error("Workspace member not found.");
  }

  await dependencies.updateMembership({
    membershipId: targetMembership.id,
    sharedTourCoverageEnabled,
  });

  await dependencies.createAuditEvent({
    workspaceId: currentWorkspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_member_shared_tour_coverage_updated",
    payload: {
      membershipId: targetMembership.id,
      memberName: targetMembership.user.name,
      sharedTourCoverageEnabled,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/settings/members");
  dependencies.revalidatePath("/app/settings/team");
  dependencies.revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/team";

  dependencies.redirect(redirectTarget);
}

export async function handleUpdateMemberRoleAction(
  membershipId: string,
  formData: FormData,
  dependencies: UpdateMemberRoleActionDependencies = defaultUpdateMemberRoleActionDependencies,
) {
  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const membershipRoleValue = formData.get("membershipRole");

  if (
    !dependencies.workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Team role management is only available on Org workspaces.");
  }

  if (!dependencies.canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can update teammate roles.");
  }

  if (
    membershipRoleValue !== MembershipRole.ADMIN &&
    membershipRoleValue !== MembershipRole.MANAGER &&
    membershipRoleValue !== MembershipRole.VIEWER
  ) {
    throw new Error("Select a valid workspace role.");
  }

  const targetMembership = await dependencies.findTargetMembership({
    membershipId,
    workspaceId: currentWorkspaceMembership.workspaceId,
  });

  if (!targetMembership) {
    throw new Error("Workspace member not found.");
  }

  const manageableRoles = dependencies.getAssignableWorkspaceInviteRoles(
    currentWorkspaceMembership.role,
  );

  if (!manageableRoles.includes(targetMembership.role)) {
    throw new Error("This workspace role cannot update the selected teammate.");
  }

  if (!manageableRoles.includes(membershipRoleValue)) {
    throw new Error("This workspace role cannot assign the requested teammate role.");
  }

  await dependencies.updateMembershipRole({
    membershipId: targetMembership.id,
    membershipRole: membershipRoleValue,
  });

  await dependencies.createAuditEvent({
    workspaceId: currentWorkspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_member_role_updated",
    payload: {
      memberEmailAddress: targetMembership.user.email,
      memberName: targetMembership.user.name,
      membershipId: targetMembership.id,
      nextRole: membershipRoleValue,
      previousRole: targetMembership.role,
    },
  });

  dependencies.revalidatePath("/app/settings");
  dependencies.revalidatePath("/app/settings/members");
  dependencies.revalidatePath("/app/settings/team");
  dependencies.revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/team";

  dependencies.redirect(redirectTarget);
}

export async function handleRevokeWorkspaceInviteAction(
  workspaceInviteId: string,
  formData: FormData,
  dependencies: RevokeWorkspaceInviteActionDependencies = defaultRevokeWorkspaceInviteActionDependencies,
) {
  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");

  if (
    !dependencies.workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Workspace invite management is only available on Org workspaces.");
  }

  if (!dependencies.canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can revoke teammate invites.");
  }

  const workspaceInvite = await dependencies.findWorkspaceInvite({
    workspaceId: currentWorkspaceMembership.workspaceId,
    workspaceInviteId,
  });

  if (!workspaceInvite) {
    throw new Error("Workspace invite not found.");
  }

  if (dependencies.getWorkspaceInviteStatus(workspaceInvite) !== "pending") {
    throw new Error("Only pending workspace invites can be revoked.");
  }

  await dependencies.revokeWorkspaceInvite(workspaceInvite.id);

  await dependencies.createAuditEvent({
    workspaceId: currentWorkspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_invite_revoked",
    payload: {
      emailAddress: workspaceInvite.email,
      membershipRole: workspaceInvite.role,
      workspaceInviteId: workspaceInvite.id,
    },
  });

  dependencies.revalidatePath("/app/settings");
  dependencies.revalidatePath("/app/settings/members");
  dependencies.revalidatePath("/app/settings/team");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/team";

  dependencies.redirect(redirectTarget);
}

export async function updateMemberSharedTourCoverageAction(
  membershipId: string,
  formData: FormData,
) {
  return handleUpdateMemberSharedTourCoverageAction(membershipId, formData);
}

export async function updateMemberRoleAction(membershipId: string, formData: FormData) {
  return handleUpdateMemberRoleAction(membershipId, formData);
}

export async function revokeWorkspaceInviteAction(
  workspaceInviteId: string,
  formData: FormData,
) {
  return handleRevokeWorkspaceInviteAction(workspaceInviteId, formData);
}