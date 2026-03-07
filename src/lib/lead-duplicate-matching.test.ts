import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDuplicateHandlingOutcome,
  chooseBestDuplicateCandidate,
  evaluateDuplicateCandidateConfidence,
  shouldAttachToExistingLead,
} from "./lead-duplicate-matching";

test("evaluateDuplicateCandidateConfidence returns high confidence for exact email matches", () => {
  const confidenceResult = evaluateDuplicateCandidateConfidence({
    incomingEmailAddress: "test@example.com",
    incomingPhoneNumber: null,
    incomingExternalThreadId: null,
    candidateLead: {
      id: "lead_1",
      email: "test@example.com",
      phone: null,
      lastActivityAt: new Date("2026-03-01T12:00:00.000Z"),
      conversationSubject: null,
    },
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(confidenceResult.confidenceBand, "high");
  assert.equal(confidenceResult.matchedSignals.includes("exact_email"), true);
});

test("evaluateDuplicateCandidateConfidence returns high confidence for exact phone matches", () => {
  const confidenceResult = evaluateDuplicateCandidateConfidence({
    incomingEmailAddress: null,
    incomingPhoneNumber: "+14015551234",
    incomingExternalThreadId: null,
    candidateLead: {
      id: "lead_2",
      email: null,
      phone: "+14015551234",
      lastActivityAt: new Date("2026-03-01T12:00:00.000Z"),
      conversationSubject: null,
    },
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(confidenceResult.confidenceBand, "high");
  assert.equal(confidenceResult.matchedSignals.includes("exact_phone"), true);
});

test("evaluateDuplicateCandidateConfidence returns medium confidence for recent thread association", () => {
  const confidenceResult = evaluateDuplicateCandidateConfidence({
    incomingEmailAddress: null,
    incomingPhoneNumber: null,
    incomingExternalThreadId: "thread_abc",
    candidateLead: {
      id: "lead_3",
      email: null,
      phone: null,
      lastActivityAt: new Date("2026-03-05T12:00:00.000Z"),
      conversationSubject: "thread_abc",
    },
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(confidenceResult.confidenceBand, "medium");
  assert.equal(
    confidenceResult.matchedSignals.includes("recent_thread_association"),
    true,
  );
});

test("chooseBestDuplicateCandidate prefers higher confidence score", () => {
  const bestDuplicateCandidate = chooseBestDuplicateCandidate({
    incomingEmailAddress: "match@example.com",
    incomingPhoneNumber: null,
    incomingExternalThreadId: null,
    duplicateCandidates: [
      {
        id: "lead_low",
        email: null,
        phone: null,
        lastActivityAt: new Date("2026-03-06T12:00:00.000Z"),
        conversationSubject: null,
      },
      {
        id: "lead_high",
        email: "match@example.com",
        phone: null,
        lastActivityAt: new Date("2026-03-01T12:00:00.000Z"),
        conversationSubject: null,
      },
    ],
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(bestDuplicateCandidate?.candidateLeadId, "lead_high");
  assert.equal(bestDuplicateCandidate?.confidenceBand, "high");
});

test("chooseBestDuplicateCandidate breaks score ties by most recent activity", () => {
  const bestDuplicateCandidate = chooseBestDuplicateCandidate({
    incomingEmailAddress: "match@example.com",
    incomingPhoneNumber: null,
    incomingExternalThreadId: null,
    duplicateCandidates: [
      {
        id: "lead_old",
        email: "match@example.com",
        phone: null,
        lastActivityAt: new Date("2026-03-01T12:00:00.000Z"),
        conversationSubject: null,
      },
      {
        id: "lead_recent",
        email: "match@example.com",
        phone: null,
        lastActivityAt: new Date("2026-03-06T12:00:00.000Z"),
        conversationSubject: null,
      },
    ],
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(bestDuplicateCandidate?.candidateLeadId, "lead_recent");
});

test("shouldAttachToExistingLead only returns true for high confidence", () => {
  assert.equal(shouldAttachToExistingLead("high"), true);
  assert.equal(shouldAttachToExistingLead("medium"), false);
  assert.equal(shouldAttachToExistingLead("low"), false);
});

test("classifyDuplicateHandlingOutcome returns attach_existing for high confidence matches", () => {
  const bestDuplicateCandidate = chooseBestDuplicateCandidate({
    incomingEmailAddress: "dup@example.com",
    incomingPhoneNumber: null,
    incomingExternalThreadId: null,
    duplicateCandidates: [
      {
        id: "lead_attach",
        email: "dup@example.com",
        phone: null,
        lastActivityAt: new Date("2026-03-06T12:00:00.000Z"),
        conversationSubject: null,
      },
    ],
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(
    classifyDuplicateHandlingOutcome(bestDuplicateCandidate),
    "attach_existing",
  );
});

test("classifyDuplicateHandlingOutcome returns flag_possible_duplicate for medium confidence matches", () => {
  const bestDuplicateCandidate = chooseBestDuplicateCandidate({
    incomingEmailAddress: null,
    incomingPhoneNumber: null,
    incomingExternalThreadId: "thread_medium",
    duplicateCandidates: [
      {
        id: "lead_flag",
        email: null,
        phone: null,
        lastActivityAt: new Date("2026-03-06T12:00:00.000Z"),
        conversationSubject: "thread_medium",
      },
    ],
    now: new Date("2026-03-07T12:00:00.000Z"),
  });

  assert.equal(
    classifyDuplicateHandlingOutcome(bestDuplicateCandidate),
    "flag_possible_duplicate",
  );
});

test("classifyDuplicateHandlingOutcome returns create_new when no duplicate candidate exists", () => {
  assert.equal(classifyDuplicateHandlingOutcome(null), "create_new");
});
