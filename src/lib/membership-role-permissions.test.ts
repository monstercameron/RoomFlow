import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole } from "@/generated/prisma/client";
import {
  canMembershipRolePerformLeadAction,
  getLeadActionPermissionsForMembershipRole,
} from "./membership-role-permissions";

test("owner has full lead-action permissions", () => {
  const ownerPermissions = getLeadActionPermissionsForMembershipRole(
    MembershipRole.OWNER,
  );

  for (const permissionValue of Object.values(ownerPermissions)) {
    assert.equal(permissionValue, true);
  }
});

test("manager has lead workflow permissions enabled", () => {
  assert.equal(
    canMembershipRolePerformLeadAction(MembershipRole.MANAGER, "scheduleTour"),
    true,
  );
  assert.equal(
    canMembershipRolePerformLeadAction(
      MembershipRole.MANAGER,
      "sendApplication",
    ),
    true,
  );
  assert.equal(
    canMembershipRolePerformLeadAction(
      MembershipRole.MANAGER,
      "launchScreening",
    ),
    true,
  );
  assert.equal(
    canMembershipRolePerformLeadAction(MembershipRole.MANAGER, "assignProperty"),
    true,
  );
});

test("viewer is read-only for lead actions", () => {
  const viewerPermissions = getLeadActionPermissionsForMembershipRole(
    MembershipRole.VIEWER,
  );

  for (const permissionValue of Object.values(viewerPermissions)) {
    assert.equal(permissionValue, false);
  }
});
