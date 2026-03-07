import { MembershipRole } from "@/generated/prisma/client";

export type LeadActionPermissionKey =
  | "evaluateFit"
  | "requestInfo"
  | "scheduleTour"
  | "sendApplication"
  | "assignProperty"
  | "overrideFit"
  | "declineLead"
  | "archiveLead";

type LeadActionPermissionMap = Record<LeadActionPermissionKey, boolean>;

const leadActionPermissionsByMembershipRole: Readonly<
  Record<MembershipRole, LeadActionPermissionMap>
> = {
  [MembershipRole.OWNER]: {
    evaluateFit: true,
    requestInfo: true,
    scheduleTour: true,
    sendApplication: true,
    assignProperty: true,
    overrideFit: true,
    declineLead: true,
    archiveLead: true,
  },
  [MembershipRole.ADMIN]: {
    evaluateFit: true,
    requestInfo: true,
    scheduleTour: true,
    sendApplication: true,
    assignProperty: true,
    overrideFit: true,
    declineLead: true,
    archiveLead: true,
  },
  [MembershipRole.MANAGER]: {
    evaluateFit: true,
    requestInfo: true,
    scheduleTour: true,
    sendApplication: true,
    assignProperty: true,
    overrideFit: true,
    declineLead: true,
    archiveLead: true,
  },
  [MembershipRole.VIEWER]: {
    evaluateFit: false,
    requestInfo: false,
    scheduleTour: false,
    sendApplication: false,
    assignProperty: false,
    overrideFit: false,
    declineLead: false,
    archiveLead: false,
  },
};

export function getLeadActionPermissionsForMembershipRole(
  membershipRole: MembershipRole,
) {
  return leadActionPermissionsByMembershipRole[membershipRole];
}

export function canMembershipRolePerformLeadAction(
  membershipRole: MembershipRole,
  leadActionPermissionKey: LeadActionPermissionKey,
) {
  return getLeadActionPermissionsForMembershipRole(membershipRole)[
    leadActionPermissionKey
  ];
}
