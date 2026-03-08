import { MembershipRole } from "@/generated/prisma/client";

export function canMembershipRoleManagePropertyScopes(
  membershipRole: MembershipRole,
) {
  return (
    membershipRole === MembershipRole.OWNER ||
    membershipRole === MembershipRole.ADMIN
  );
}

export function membershipRoleSupportsPropertyScopes(
  membershipRole: MembershipRole,
) {
  return (
    membershipRole === MembershipRole.MANAGER ||
    membershipRole === MembershipRole.VIEWER
  );
}