import type { Prisma } from "@/generated/prisma/client";

export const normalizedLeadFieldKeys = [
  "fullName",
  "email",
  "phone",
  "moveInDate",
  "monthlyBudget",
  "stayLengthMonths",
  "smokingStatus",
  "petStatus",
  "parkingNeed",
  "guestExpectations",
  "bathroomSharingAcceptance",
  "workStatus",
] as const;

export type NormalizedLeadFieldKey = (typeof normalizedLeadFieldKeys)[number];

export type NormalizedLeadFieldMetadataEntry = {
  value: string | number | boolean | null;
  source: string;
  confidence: number;
  lastUpdatedAt: string;
  isSuggested: boolean;
  isConflicted: boolean;
};

export type NormalizedLeadFieldMetadata = Record<
  NormalizedLeadFieldKey,
  NormalizedLeadFieldMetadataEntry
>;

type BuildNormalizedLeadFieldMetadataParams = {
  existingFieldMetadata: unknown;
  normalizedAt: Date;
  sourceLabel: string;
  fieldValues: Partial<Record<NormalizedLeadFieldKey, string | number | boolean | null>>;
  fieldConfidences?: Partial<Record<NormalizedLeadFieldKey, number>>;
};

function clampConfidence(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseExistingMetadataEntry(
  key: NormalizedLeadFieldKey,
  existingFieldMetadata: unknown,
): NormalizedLeadFieldMetadataEntry | null {
  if (!isObjectRecord(existingFieldMetadata)) {
    return null;
  }

  const existingEntry = existingFieldMetadata[key];

  if (!isObjectRecord(existingEntry)) {
    return null;
  }

  const valueCandidate = existingEntry.value;
  const sourceCandidate = existingEntry.source;
  const confidenceCandidate = existingEntry.confidence;
  const lastUpdatedAtCandidate = existingEntry.lastUpdatedAt;
  const isSuggestedCandidate = existingEntry.isSuggested;
  const isConflictedCandidate = existingEntry.isConflicted;

  const isAllowedValueType =
    valueCandidate === null ||
    typeof valueCandidate === "string" ||
    typeof valueCandidate === "number" ||
    typeof valueCandidate === "boolean";

  if (
    !isAllowedValueType ||
    typeof sourceCandidate !== "string" ||
    typeof lastUpdatedAtCandidate !== "string"
  ) {
    return null;
  }

  return {
    value: valueCandidate,
    source: sourceCandidate,
    confidence: clampConfidence(
      typeof confidenceCandidate === "number" ? confidenceCandidate : 0,
    ),
    lastUpdatedAt: lastUpdatedAtCandidate,
    isSuggested:
      typeof isSuggestedCandidate === "boolean" ? isSuggestedCandidate : false,
    isConflicted:
      typeof isConflictedCandidate === "boolean" ? isConflictedCandidate : false,
  };
}

function buildDefaultMetadataEntry(
  normalizedAtIsoString: string,
): NormalizedLeadFieldMetadataEntry {
  return {
    value: null,
    source: "unknown",
    confidence: 0,
    lastUpdatedAt: normalizedAtIsoString,
    isSuggested: false,
    isConflicted: false,
  };
}

function shouldTreatFieldConfidenceAsSuggested(confidenceValue: number) {
  return confidenceValue < 0.8;
}

function shouldPreserveExistingHighConfidenceValue(params: {
  existingMetadataEntry: NormalizedLeadFieldMetadataEntry | null;
  incomingConfidence: number;
}) {
  if (!params.existingMetadataEntry) {
    return false;
  }

  const existingConfidence = params.existingMetadataEntry.confidence;

  if (existingConfidence < 0.85) {
    return false;
  }

  return params.incomingConfidence < existingConfidence;
}

export function buildNormalizedLeadFieldMetadata(
  params: BuildNormalizedLeadFieldMetadataParams,
): Prisma.InputJsonValue {
  const normalizedAtIsoString = params.normalizedAt.toISOString();
  const normalizedLeadFieldMetadata =
    {} as Record<NormalizedLeadFieldKey, NormalizedLeadFieldMetadataEntry>;

  for (const normalizedLeadFieldKey of normalizedLeadFieldKeys) {
    const existingMetadataEntry = parseExistingMetadataEntry(
      normalizedLeadFieldKey,
      params.existingFieldMetadata,
    );
    const nextValue = params.fieldValues[normalizedLeadFieldKey];
    const hasIncomingValue = nextValue !== undefined;

    if (hasIncomingValue) {
      const incomingConfidence = clampConfidence(
        params.fieldConfidences?.[normalizedLeadFieldKey] ?? 0.5,
      );

      if (
        shouldPreserveExistingHighConfidenceValue({
          existingMetadataEntry,
          incomingConfidence,
        })
      ) {
        normalizedLeadFieldMetadata[normalizedLeadFieldKey] = {
          ...(existingMetadataEntry as NormalizedLeadFieldMetadataEntry),
          isConflicted: Boolean(
            existingMetadataEntry?.value !== (nextValue ?? null) &&
              existingMetadataEntry?.value !== null &&
              nextValue !== null,
          ),
        };
        continue;
      }

      const hasConflictingValue = Boolean(
        existingMetadataEntry &&
          existingMetadataEntry.value !== null &&
          nextValue !== null &&
          existingMetadataEntry.value !== nextValue,
      );

      normalizedLeadFieldMetadata[normalizedLeadFieldKey] = {
        value: nextValue ?? null,
        source: params.sourceLabel,
        confidence: incomingConfidence,
        lastUpdatedAt: normalizedAtIsoString,
        isSuggested: shouldTreatFieldConfidenceAsSuggested(incomingConfidence),
        isConflicted: hasConflictingValue,
      };
      continue;
    }

    normalizedLeadFieldMetadata[normalizedLeadFieldKey] =
      existingMetadataEntry ?? buildDefaultMetadataEntry(normalizedAtIsoString);
  }

  return normalizedLeadFieldMetadata;
}

export function extractConflictedNormalizedLeadFieldKeys(
  metadata: unknown,
): NormalizedLeadFieldKey[] {
  if (!isObjectRecord(metadata)) {
    return [];
  }

  return normalizedLeadFieldKeys.filter((normalizedLeadFieldKey) => {
    const metadataEntry = parseExistingMetadataEntry(
      normalizedLeadFieldKey,
      metadata,
    );

    return metadataEntry?.isConflicted === true;
  });
}
