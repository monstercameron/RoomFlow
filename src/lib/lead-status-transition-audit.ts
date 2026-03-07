import { LeadStatus } from "@/generated/prisma/client";

type BuildLeadStatusTransitionAuditPayloadParams = {
  actorUserId: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  transitionReason: string;
};

export function buildLeadStatusTransitionAuditPayload(
  params: BuildLeadStatusTransitionAuditPayloadParams,
) {
  return {
    actorUserId: params.actorUserId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    reason: params.transitionReason,
  };
}
