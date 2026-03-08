import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://roomflow:roomflow@127.0.0.1:5432/roomflow";

const workspaceInviteModulePromise = import("@/lib/workspace-invites");

test("normalizeWorkspaceInviteEmailAddress trims and lowercases emails", async () => {
  const { normalizeWorkspaceInviteEmailAddress } = await workspaceInviteModulePromise;

  assert.equal(
    normalizeWorkspaceInviteEmailAddress("  TeamMate@Roomflow.App  "),
    "teammate@roomflow.app",
  );
});

test("buildWorkspaceInvitePath encodes the invite token into a public route", async () => {
  const { buildWorkspaceInvitePath } = await workspaceInviteModulePromise;

  assert.equal(buildWorkspaceInvitePath("invite-token-123"), "/invite/invite-token-123");
});

test("hashWorkspaceInviteToken is deterministic for the same raw token", async () => {
  const { hashWorkspaceInviteToken } = await workspaceInviteModulePromise;

  assert.equal(
    hashWorkspaceInviteToken("invite-token-123"),
    hashWorkspaceInviteToken("invite-token-123"),
  );
});

test("getWorkspaceInviteStatus resolves pending, accepted, revoked, and expired states", async () => {
  const { getWorkspaceInviteStatus } = await workspaceInviteModulePromise;
  const now = new Date("2026-03-08T12:00:00.000Z");

  assert.equal(
    getWorkspaceInviteStatus(
      {
        acceptedAt: null,
        expiresAt: new Date("2026-03-09T12:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    "pending",
  );

  assert.equal(
    getWorkspaceInviteStatus(
      {
        acceptedAt: new Date("2026-03-08T11:00:00.000Z"),
        expiresAt: new Date("2026-03-09T12:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    "accepted",
  );

  assert.equal(
    getWorkspaceInviteStatus(
      {
        acceptedAt: null,
        expiresAt: new Date("2026-03-09T12:00:00.000Z"),
        revokedAt: new Date("2026-03-08T11:00:00.000Z"),
      },
      now,
    ),
    "revoked",
  );

  assert.equal(
    getWorkspaceInviteStatus(
      {
        acceptedAt: null,
        expiresAt: new Date("2026-03-08T11:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    "expired",
  );
});

test("owner and admin can manage invites, but manager and viewer cannot", async () => {
  const { canMembershipRoleManageWorkspaceInvites } = await workspaceInviteModulePromise;

  assert.equal(canMembershipRoleManageWorkspaceInvites(MembershipRole.OWNER), true);
  assert.equal(canMembershipRoleManageWorkspaceInvites(MembershipRole.ADMIN), true);
  assert.equal(canMembershipRoleManageWorkspaceInvites(MembershipRole.MANAGER), false);
  assert.equal(canMembershipRoleManageWorkspaceInvites(MembershipRole.VIEWER), false);
});

test("assignable invite roles stay constrained by inviter role", async () => {
  const { getAssignableWorkspaceInviteRoles } = await workspaceInviteModulePromise;

  assert.deepEqual(getAssignableWorkspaceInviteRoles(MembershipRole.OWNER), [
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.VIEWER,
  ]);
  assert.deepEqual(getAssignableWorkspaceInviteRoles(MembershipRole.ADMIN), [
    MembershipRole.MANAGER,
    MembershipRole.VIEWER,
  ]);
  assert.deepEqual(getAssignableWorkspaceInviteRoles(MembershipRole.MANAGER), []);
});