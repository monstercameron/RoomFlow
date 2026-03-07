import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus } from "@/generated/prisma/client";
import {
  assertLeadStatusTransitionIsAllowed,
  canTransitionLeadStatus,
  getAllowedLeadStatusTransitions,
  resolveLeadStatusAfterEvaluation,
} from "./lead-status-machine";

test("canTransitionLeadStatus allows no-op transitions", () => {
  assert.equal(
    canTransitionLeadStatus(LeadStatus.QUALIFIED, LeadStatus.QUALIFIED),
    true,
  );
});

test("canTransitionLeadStatus allows configured forward transitions", () => {
  assert.equal(
    canTransitionLeadStatus(LeadStatus.NEW, LeadStatus.AWAITING_RESPONSE),
    true,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.NEW, LeadStatus.UNDER_REVIEW),
    true,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.UNDER_REVIEW, LeadStatus.CAUTION),
    true,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.QUALIFIED, LeadStatus.TOUR_SCHEDULED),
    true,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.TOUR_SCHEDULED, LeadStatus.APPLICATION_SENT),
    true,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.APPLICATION_SENT, LeadStatus.CLOSED),
    true,
  );
});

test("canTransitionLeadStatus blocks invalid transitions", () => {
  assert.equal(
    canTransitionLeadStatus(LeadStatus.DECLINED, LeadStatus.QUALIFIED),
    false,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.ARCHIVED, LeadStatus.NEW),
    false,
  );
  assert.equal(
    canTransitionLeadStatus(LeadStatus.CLOSED, LeadStatus.NEW),
    false,
  );
});

test("getAllowedLeadStatusTransitions defines a transition set for every status", () => {
  const allowedStatusTransitionsByCurrentStatus = getAllowedLeadStatusTransitions();

  for (const statusValue of Object.values(LeadStatus)) {
    assert.ok(allowedStatusTransitionsByCurrentStatus[statusValue] instanceof Set);
  }
});

test("assertLeadStatusTransitionIsAllowed throws for blocked transitions", () => {
  assert.throws(
    () =>
      assertLeadStatusTransitionIsAllowed(
        LeadStatus.DECLINED,
        LeadStatus.QUALIFIED,
      ),
    /Lead status transition is not allowed/,
  );
});

test("resolveLeadStatusAfterEvaluation preserves archived leads", () => {
  const resolvedLeadStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.ARCHIVED,
    LeadStatus.DECLINED,
  );

  assert.equal(resolvedLeadStatus, LeadStatus.ARCHIVED);
});

test("resolveLeadStatusAfterEvaluation preserves closed leads", () => {
  const resolvedLeadStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.CLOSED,
    LeadStatus.QUALIFIED,
  );

  assert.equal(resolvedLeadStatus, LeadStatus.CLOSED);
});

test("resolveLeadStatusAfterEvaluation applies decline recommendation", () => {
  const resolvedLeadStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.QUALIFIED,
    LeadStatus.DECLINED,
  );

  assert.equal(resolvedLeadStatus, LeadStatus.DECLINED);
});

test("resolveLeadStatusAfterEvaluation keeps advanced statuses stable", () => {
  const resolvedLeadStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.APPLICATION_SENT,
    LeadStatus.INCOMPLETE,
  );

  assert.equal(resolvedLeadStatus, LeadStatus.APPLICATION_SENT);
});

test("resolveLeadStatusAfterEvaluation falls back to current status when recommendation is not allowed", () => {
  const resolvedLeadStatus = resolveLeadStatusAfterEvaluation(
    LeadStatus.NEW,
    LeadStatus.TOUR_SCHEDULED,
  );

  assert.equal(resolvedLeadStatus, LeadStatus.NEW);
});

test("each status has at least one blocked transition to enforce guard behavior", () => {
  const allLeadStatuses = Object.values(LeadStatus);

  for (const currentLeadStatus of allLeadStatuses) {
    const hasBlockedTransition = allLeadStatuses.some((targetLeadStatus) => {
      if (currentLeadStatus === targetLeadStatus) {
        return false;
      }

      return !canTransitionLeadStatus(currentLeadStatus, targetLeadStatus);
    });

    assert.equal(
      hasBlockedTransition,
      true,
      `Expected at least one blocked transition for ${currentLeadStatus}`,
    );
  }
});

test("every configured allowed transition is accepted by canTransitionLeadStatus", () => {
  const allowedStatusTransitionsByCurrentStatus = getAllowedLeadStatusTransitions();

  for (const [currentLeadStatus, allowedTargetStatuses] of Object.entries(
    allowedStatusTransitionsByCurrentStatus,
  )) {
    for (const allowedTargetStatus of allowedTargetStatuses) {
      assert.equal(
        canTransitionLeadStatus(
          currentLeadStatus as LeadStatus,
          allowedTargetStatus,
        ),
        true,
      );
    }
  }
});
