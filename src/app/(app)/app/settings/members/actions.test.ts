import assert from "node:assert/strict";
import test from "node:test";

import { MembershipRole, WorkspaceCapability } from "@/generated/prisma/client";
import type {
  RevokeWorkspaceInviteActionDependencies,
  UpdateMemberRoleActionDependencies,
  UpdateMemberSharedTourCoverageActionDependencies,
} from "./actions";

function getMembersActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./actions") as typeof import("./actions");
}

function createWorkspaceMembership(overrides: Partial<{
  enabledCapabilities: WorkspaceCapability[];
  id: string;
  role: MembershipRole;
  workspaceId: string;
}> = {}) {
  return {
    id: "membership-1",
    role: MembershipRole.OWNER,
    workspaceId: "workspace-1",
    workspace: {
      enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
    },
    ...overrides,
  };
}

function createWorkspaceState() {
  return {
    user: {
      id: "user-1",
    },
  };
}

function createDependencies(
  overrides: Partial<UpdateMemberSharedTourCoverageActionDependencies> = {},
): UpdateMemberSharedTourCoverageActionDependencies {
  return {
    canMembershipRoleManageWorkspaceInvites: () => true,
    createAuditEvent: async () => undefined,
    findTargetMembership: async () => ({
      id: "membership-2",
      user: {
        name: "Taylor Admin",
      },
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateMembership: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createRoleDependencies(
  overrides: Partial<UpdateMemberRoleActionDependencies> = {},
): UpdateMemberRoleActionDependencies {
  return {
    canMembershipRoleManageWorkspaceInvites: () => true,
    createAuditEvent: async () => undefined,
    findTargetMembership: async () => ({
      id: "membership-2",
      role: MembershipRole.MANAGER,
      user: {
        email: "taylor@roomflow.local",
        name: "Taylor Admin",
      },
    }),
    getAssignableWorkspaceInviteRoles: (membershipRole) => {
      if (membershipRole === MembershipRole.OWNER) {
        return [MembershipRole.ADMIN, MembershipRole.MANAGER, MembershipRole.VIEWER];
      }

      if (membershipRole === MembershipRole.ADMIN) {
        return [MembershipRole.MANAGER, MembershipRole.VIEWER];
      }

      return [];
    },
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateMembershipRole: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createInviteDependencies(
  overrides: Partial<RevokeWorkspaceInviteActionDependencies> = {},
): RevokeWorkspaceInviteActionDependencies {
  return {
    canMembershipRoleManageWorkspaceInvites: () => true,
    createAuditEvent: async () => undefined,
    findWorkspaceInvite: async () => ({
      acceptedAt: null,
      email: "teammate@roomflow.local",
      expiresAt: new Date("2026-03-15T00:00:00.000Z"),
      id: "invite-1",
      revokedAt: null,
      role: MembershipRole.MANAGER,
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership(),
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    getWorkspaceInviteStatus: () => "pending",
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    revokeWorkspaceInvite: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

test("handleUpdateMemberSharedTourCoverageAction enforces Org capability and role permissions", async () => {
  const { handleUpdateMemberSharedTourCoverageAction } = getMembersActionsModule();

  await assert.rejects(
    handleUpdateMemberSharedTourCoverageAction(
      "membership-2",
      new FormData(),
      createDependencies({
        workspaceHasCapability: () => false,
      }),
    ),
    /Shared tour coverage is only available on Org workspaces/,
  );

  await assert.rejects(
    handleUpdateMemberSharedTourCoverageAction(
      "membership-2",
      new FormData(),
      createDependencies({
        canMembershipRoleManageWorkspaceInvites: () => false,
      }),
    ),
    /Only workspace owners and admins can manage shared tour coverage/,
  );
});

test("handleUpdateMemberSharedTourCoverageAction updates the member, audits the change, and redirects", async () => {
  const { handleUpdateMemberSharedTourCoverageAction } = getMembersActionsModule();
  const membershipUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("sharedTourCoverageEnabled", "on");
  formData.set("redirectTo", "/app/settings/members?tab=coverage");

  await handleUpdateMemberSharedTourCoverageAction(
    "membership-2",
    formData,
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      updateMembership: async (input) => {
        membershipUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(membershipUpdates, [
    {
      membershipId: "membership-2",
      sharedTourCoverageEnabled: true,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_member_shared_tour_coverage_updated",
      payload: {
        membershipId: "membership-2",
        memberName: "Taylor Admin",
        sharedTourCoverageEnabled: true,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings/integrations",
    "/app/settings/members",
    "/app/settings/team",
    "/app/leads",
  ]);
  assert.deepEqual(redirects, ["/app/settings/members?tab=coverage"]);
});

test("handleUpdateMemberSharedTourCoverageAction rejects unknown workspace members", async () => {
  const { handleUpdateMemberSharedTourCoverageAction } = getMembersActionsModule();

  await assert.rejects(
    handleUpdateMemberSharedTourCoverageAction(
      "missing-membership",
      new FormData(),
      createDependencies({
        findTargetMembership: async () => null,
      }),
    ),
    /Workspace member not found/,
  );
});

test("handleUpdateMemberRoleAction enforces Org permissions and manageable roles", async () => {
  const { handleUpdateMemberRoleAction } = getMembersActionsModule();
  const formData = new FormData();
  formData.set("membershipRole", MembershipRole.ADMIN);

  await assert.rejects(
    handleUpdateMemberRoleAction(
      "membership-2",
      formData,
      createRoleDependencies({
        workspaceHasCapability: () => false,
      }),
    ),
    /Team role management is only available on Org workspaces/,
  );

  await assert.rejects(
    handleUpdateMemberRoleAction(
      "membership-2",
      formData,
      createRoleDependencies({
        canMembershipRoleManageWorkspaceInvites: () => false,
      }),
    ),
    /Only workspace owners and admins can update teammate roles/,
  );

  await assert.rejects(
    handleUpdateMemberRoleAction(
      "membership-2",
      formData,
      createRoleDependencies({
        findTargetMembership: async () => ({
          id: "membership-2",
          role: MembershipRole.ADMIN,
          user: {
            email: "admin@roomflow.local",
            name: "Admin User",
          },
        }),
        getCurrentWorkspaceMembership: async () =>
          createWorkspaceMembership({ role: MembershipRole.ADMIN }),
      }),
    ),
    /cannot update the selected teammate/,
  );
});

test("handleUpdateMemberRoleAction updates the membership role, audits it, and redirects", async () => {
  const { handleUpdateMemberRoleAction } = getMembersActionsModule();
  const membershipUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("membershipRole", MembershipRole.VIEWER);
  formData.set("redirectTo", "/app/settings/team?tab=roles");

  await handleUpdateMemberRoleAction(
    "membership-2",
    formData,
    createRoleDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      updateMembershipRole: async (input) => {
        membershipUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(membershipUpdates, [
    {
      membershipId: "membership-2",
      membershipRole: MembershipRole.VIEWER,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_member_role_updated",
      payload: {
        memberEmailAddress: "taylor@roomflow.local",
        memberName: "Taylor Admin",
        membershipId: "membership-2",
        nextRole: MembershipRole.VIEWER,
        previousRole: MembershipRole.MANAGER,
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings",
    "/app/settings/members",
    "/app/settings/team",
    "/app/leads",
  ]);
  assert.deepEqual(redirects, ["/app/settings/team?tab=roles"]);
});

test("handleRevokeWorkspaceInviteAction rejects non-pending invites and revokes pending ones", async () => {
  const { handleRevokeWorkspaceInviteAction } = getMembersActionsModule();

  await assert.rejects(
    handleRevokeWorkspaceInviteAction(
      "invite-1",
      new FormData(),
      createInviteDependencies({
        getWorkspaceInviteStatus: () => "accepted",
      }),
    ),
    /Only pending workspace invites can be revoked/,
  );

  const auditEvents: unknown[] = [];
  const revokedInvites: string[] = [];
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("redirectTo", "/app/settings/team?tab=invites");

  await handleRevokeWorkspaceInviteAction(
    "invite-1",
    formData,
    createInviteDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      revokeWorkspaceInvite: async (workspaceInviteId) => {
        revokedInvites.push(workspaceInviteId);
      },
    }),
  );

  assert.deepEqual(revokedInvites, ["invite-1"]);
  assert.deepEqual(auditEvents, [
    {
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      eventType: "workspace_invite_revoked",
      payload: {
        emailAddress: "teammate@roomflow.local",
        membershipRole: MembershipRole.MANAGER,
        workspaceInviteId: "invite-1",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings",
    "/app/settings/members",
    "/app/settings/team",
  ]);
  assert.deepEqual(redirects, ["/app/settings/team?tab=invites"]);
});