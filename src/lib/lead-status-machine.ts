import { LeadStatus } from "@/generated/prisma/client";

// This matrix stays explicit so all workflow writes can share one transition
// source of truth and prevent accidental state jumps.
const allowedStatusTransitionsByCurrentStatus: Readonly<
  Record<LeadStatus, ReadonlySet<LeadStatus>>
> = {
  [LeadStatus.NEW]: new Set([
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.AWAITING_RESPONSE]: new Set([
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.INCOMPLETE]: new Set([
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.UNDER_REVIEW]: new Set([
    LeadStatus.CAUTION,
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.CAUTION]: new Set([
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.QUALIFIED]: new Set([
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.CAUTION,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.TOUR_SCHEDULED]: new Set([
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.APPLICATION_SENT]: new Set([
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.CLOSED,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ]),
  [LeadStatus.DECLINED]: new Set([LeadStatus.ARCHIVED]),
  [LeadStatus.ARCHIVED]: new Set([
    LeadStatus.NEW,
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.CAUTION,
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.DECLINED,
  ]),
  [LeadStatus.CLOSED]: new Set(),
};

export function canTransitionLeadStatus(
  currentLeadStatus: LeadStatus,
  targetLeadStatus: LeadStatus,
) {
  if (currentLeadStatus === targetLeadStatus) {
    return true;
  }

  return allowedStatusTransitionsByCurrentStatus[currentLeadStatus].has(
    targetLeadStatus,
  );
}

export function assertLeadStatusTransitionIsAllowed(
  currentLeadStatus: LeadStatus,
  targetLeadStatus: LeadStatus,
) {
  if (canTransitionLeadStatus(currentLeadStatus, targetLeadStatus)) {
    return;
  }

  throw new Error(
    `Lead status transition is not allowed: ${currentLeadStatus} -> ${targetLeadStatus}`,
  );
}

export function resolveLeadStatusAfterEvaluation(
  currentLeadStatus: LeadStatus,
  recommendedLeadStatus: LeadStatus,
) {
  if (
    currentLeadStatus === LeadStatus.ARCHIVED ||
    currentLeadStatus === LeadStatus.CLOSED
  ) {
    return currentLeadStatus;
  }

  if (recommendedLeadStatus === LeadStatus.DECLINED) {
    return LeadStatus.DECLINED;
  }

  if (
    currentLeadStatus === LeadStatus.TOUR_SCHEDULED ||
    currentLeadStatus === LeadStatus.APPLICATION_SENT
  ) {
    return currentLeadStatus;
  }

  if (canTransitionLeadStatus(currentLeadStatus, recommendedLeadStatus)) {
    return recommendedLeadStatus;
  }

  return currentLeadStatus;
}

export function getAllowedLeadStatusTransitions() {
  return allowedStatusTransitionsByCurrentStatus;
}
