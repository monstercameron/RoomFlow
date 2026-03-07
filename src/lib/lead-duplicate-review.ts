import { LeadStatus } from "@/generated/prisma/client";

export function extractDuplicateCandidateLeadIdFromAuditPayload(
  payload: unknown,
) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const payloadRecord = payload as Record<string, unknown>;
  const candidateLeadIdValue = payloadRecord.candidateLeadId;

  if (typeof candidateLeadIdValue !== "string" || candidateLeadIdValue.length === 0) {
    return null;
  }

  return candidateLeadIdValue;
}

export function shouldShowDuplicateReviewPrompt(params: {
  leadStatus: LeadStatus;
  hasPossibleDuplicateEvent: boolean;
  hasDuplicateConfirmedEvent: boolean;
}) {
  if (
    params.leadStatus === LeadStatus.ARCHIVED ||
    params.leadStatus === LeadStatus.CLOSED
  ) {
    return false;
  }

  if (!params.hasPossibleDuplicateEvent) {
    return false;
  }

  if (params.hasDuplicateConfirmedEvent) {
    return false;
  }

  return true;
}
