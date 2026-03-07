import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus } from "@/generated/prisma/client";
import {
  extractDuplicateCandidateLeadIdFromAuditPayload,
  shouldShowDuplicateReviewPrompt,
} from "./lead-duplicate-review";

test("extractDuplicateCandidateLeadIdFromAuditPayload reads candidate id when present", () => {
  const candidateLeadId = extractDuplicateCandidateLeadIdFromAuditPayload({
    candidateLeadId: "lead_target_1",
  });

  assert.equal(candidateLeadId, "lead_target_1");
});

test("extractDuplicateCandidateLeadIdFromAuditPayload returns null for invalid payloads", () => {
  assert.equal(extractDuplicateCandidateLeadIdFromAuditPayload(null), null);
  assert.equal(
    extractDuplicateCandidateLeadIdFromAuditPayload({ candidateLeadId: "" }),
    null,
  );
  assert.equal(
    extractDuplicateCandidateLeadIdFromAuditPayload({ candidateLeadId: 44 }),
    null,
  );
});

test("shouldShowDuplicateReviewPrompt is true for active leads with unresolved duplicate flag", () => {
  const shouldShowPrompt = shouldShowDuplicateReviewPrompt({
    leadStatus: LeadStatus.NEW,
    hasPossibleDuplicateEvent: true,
    hasDuplicateConfirmedEvent: false,
  });

  assert.equal(shouldShowPrompt, true);
});

test("shouldShowDuplicateReviewPrompt is false for archived or already-confirmed leads", () => {
  assert.equal(
    shouldShowDuplicateReviewPrompt({
      leadStatus: LeadStatus.ARCHIVED,
      hasPossibleDuplicateEvent: true,
      hasDuplicateConfirmedEvent: false,
    }),
    false,
  );

  assert.equal(
    shouldShowDuplicateReviewPrompt({
      leadStatus: LeadStatus.CLOSED,
      hasPossibleDuplicateEvent: true,
      hasDuplicateConfirmedEvent: false,
    }),
    false,
  );

  assert.equal(
    shouldShowDuplicateReviewPrompt({
      leadStatus: LeadStatus.INCOMPLETE,
      hasPossibleDuplicateEvent: true,
      hasDuplicateConfirmedEvent: true,
    }),
    false,
  );
});
