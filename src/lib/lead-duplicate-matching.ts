const highConfidenceThreshold = 80;
const mediumConfidenceThreshold = 55;
const recentThreadWindowInDays = 30;

const duplicateSignalWeights = {
  exactEmail: 80,
  exactPhone: 80,
  recentThreadAssociation: 55,
} as const;

export type DuplicateConfidenceBand = "high" | "medium" | "low";

export type DuplicateCandidateLead = {
  id: string;
  email: string | null;
  phone: string | null;
  lastActivityAt: Date | null;
  conversationSubject: string | null;
};

type EvaluateDuplicateCandidateConfidenceParams = {
  incomingEmailAddress: string | null;
  incomingPhoneNumber: string | null;
  incomingExternalThreadId: string | null;
  candidateLead: DuplicateCandidateLead;
  now?: Date;
};

type DuplicateConfidenceResult = {
  candidateLeadId: string;
  confidenceScore: number;
  confidenceBand: DuplicateConfidenceBand;
  matchedSignals: string[];
};

export type BestDuplicateCandidate = DuplicateConfidenceResult & {
  candidateLead: DuplicateCandidateLead;
};

export type DuplicateHandlingOutcome =
  | "attach_existing"
  | "flag_possible_duplicate"
  | "create_new";

function normalizeForExactStringMatch(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isRecentDate(params: {
  currentDate: Date;
  candidateDate: Date | null;
  recencyWindowInDays: number;
}) {
  if (!params.candidateDate) {
    return false;
  }

  const recencyWindowInMilliseconds =
    params.recencyWindowInDays * 24 * 60 * 60 * 1000;

  return (
    params.currentDate.getTime() - params.candidateDate.getTime() <=
    recencyWindowInMilliseconds
  );
}

function getDuplicateConfidenceBand(
  confidenceScore: number,
): DuplicateConfidenceBand {
  if (confidenceScore >= highConfidenceThreshold) {
    return "high";
  }

  if (confidenceScore >= mediumConfidenceThreshold) {
    return "medium";
  }

  return "low";
}

export function evaluateDuplicateCandidateConfidence(
  params: EvaluateDuplicateCandidateConfidenceParams,
): DuplicateConfidenceResult {
  const normalizedIncomingEmailAddress = normalizeForExactStringMatch(
    params.incomingEmailAddress,
  );
  const normalizedIncomingPhoneNumber = normalizeForExactStringMatch(
    params.incomingPhoneNumber,
  );
  const normalizedIncomingExternalThreadId = normalizeForExactStringMatch(
    params.incomingExternalThreadId,
  );

  const normalizedCandidateEmailAddress = normalizeForExactStringMatch(
    params.candidateLead.email,
  );
  const normalizedCandidatePhoneNumber = normalizeForExactStringMatch(
    params.candidateLead.phone,
  );
  const normalizedCandidateConversationSubject = normalizeForExactStringMatch(
    params.candidateLead.conversationSubject,
  );

  let confidenceScore = 0;
  const matchedSignals: string[] = [];

  if (
    normalizedIncomingEmailAddress &&
    normalizedIncomingEmailAddress === normalizedCandidateEmailAddress
  ) {
    confidenceScore += duplicateSignalWeights.exactEmail;
    matchedSignals.push("exact_email");
  }

  if (
    normalizedIncomingPhoneNumber &&
    normalizedIncomingPhoneNumber === normalizedCandidatePhoneNumber
  ) {
    confidenceScore += duplicateSignalWeights.exactPhone;
    matchedSignals.push("exact_phone");
  }

  const nowDate = params.now ?? new Date();
  const hasRecentThreadAssociation =
    Boolean(normalizedIncomingExternalThreadId) &&
    normalizedIncomingExternalThreadId === normalizedCandidateConversationSubject &&
    isRecentDate({
      currentDate: nowDate,
      candidateDate: params.candidateLead.lastActivityAt,
      recencyWindowInDays: recentThreadWindowInDays,
    });

  if (hasRecentThreadAssociation) {
    confidenceScore += duplicateSignalWeights.recentThreadAssociation;
    matchedSignals.push("recent_thread_association");
  }

  return {
    candidateLeadId: params.candidateLead.id,
    confidenceScore,
    confidenceBand: getDuplicateConfidenceBand(confidenceScore),
    matchedSignals,
  };
}

export function chooseBestDuplicateCandidate(params: {
  incomingEmailAddress: string | null;
  incomingPhoneNumber: string | null;
  incomingExternalThreadId: string | null;
  duplicateCandidates: DuplicateCandidateLead[];
  now?: Date;
}): BestDuplicateCandidate | null {
  let bestMatch: BestDuplicateCandidate | null = null;

  for (const duplicateCandidate of params.duplicateCandidates) {
    const confidenceResult = evaluateDuplicateCandidateConfidence({
      incomingEmailAddress: params.incomingEmailAddress,
      incomingPhoneNumber: params.incomingPhoneNumber,
      incomingExternalThreadId: params.incomingExternalThreadId,
      candidateLead: duplicateCandidate,
      now: params.now,
    });

    if (!bestMatch) {
      bestMatch = {
        ...confidenceResult,
        candidateLead: duplicateCandidate,
      };
      continue;
    }

    if (confidenceResult.confidenceScore > bestMatch.confidenceScore) {
      bestMatch = {
        ...confidenceResult,
        candidateLead: duplicateCandidate,
      };
      continue;
    }

    if (confidenceResult.confidenceScore === bestMatch.confidenceScore) {
      const bestMatchLastActivityTime =
        bestMatch.candidateLead.lastActivityAt?.getTime() ?? 0;
      const duplicateCandidateLastActivityTime =
        duplicateCandidate.lastActivityAt?.getTime() ?? 0;

      if (duplicateCandidateLastActivityTime > bestMatchLastActivityTime) {
        bestMatch = {
          ...confidenceResult,
          candidateLead: duplicateCandidate,
        };
      }
    }
  }

  return bestMatch;
}

export function shouldAttachToExistingLead(
  duplicateConfidenceBand: DuplicateConfidenceBand,
) {
  return duplicateConfidenceBand === "high";
}

export function classifyDuplicateHandlingOutcome(
  bestDuplicateCandidate: BestDuplicateCandidate | null,
): DuplicateHandlingOutcome {
  if (!bestDuplicateCandidate) {
    return "create_new";
  }

  if (bestDuplicateCandidate.confidenceBand === "high") {
    return "attach_existing";
  }

  if (bestDuplicateCandidate.confidenceBand === "medium") {
    return "flag_possible_duplicate";
  }

  return "create_new";
}
