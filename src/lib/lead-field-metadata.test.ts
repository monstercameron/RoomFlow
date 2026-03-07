import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNormalizedLeadFieldMetadata,
  extractConflictedNormalizedLeadFieldKeys,
  normalizedLeadFieldKeys,
} from "./lead-field-metadata";

type MetadataRecord = Record<
  (typeof normalizedLeadFieldKeys)[number],
  {
    value: string | number | boolean | null;
    source: string;
    confidence: number;
    lastUpdatedAt: string;
    isSuggested: boolean;
    isConflicted: boolean;
  }
>;

test("buildNormalizedLeadFieldMetadata defines the full normalized field schema", () => {
  const normalizedAt = new Date("2026-03-07T12:00:00.000Z");

  const metadata = buildNormalizedLeadFieldMetadata({
    existingFieldMetadata: null,
    normalizedAt,
    sourceLabel: "Inbound email",
    fieldValues: {
      fullName: "Avery Mason",
      email: "avery@example.com",
      phone: "+14015550101",
    },
    fieldConfidences: {
      fullName: 0.75,
      email: 0.99,
      phone: 0.99,
    },
  }) as MetadataRecord;

  for (const fieldKey of normalizedLeadFieldKeys) {
    assert.equal(typeof metadata[fieldKey].source, "string");
    assert.equal(typeof metadata[fieldKey].confidence, "number");
    assert.equal(typeof metadata[fieldKey].lastUpdatedAt, "string");
    assert.equal(
      metadata[fieldKey].lastUpdatedAt,
      "2026-03-07T12:00:00.000Z",
    );
    assert.equal(typeof metadata[fieldKey].isSuggested, "boolean");
    assert.equal(typeof metadata[fieldKey].isConflicted, "boolean");
  }

  assert.equal(metadata.fullName.value, "Avery Mason");
  assert.equal(metadata.fullName.isSuggested, true);
  assert.equal(metadata.email.value, "avery@example.com");
  assert.equal(metadata.email.isSuggested, false);
  assert.equal(metadata.phone.value, "+14015550101");
  assert.equal(metadata.moveInDate.value, null);
});

test("buildNormalizedLeadFieldMetadata preserves existing values when no new value is provided", () => {
  const normalizedAt = new Date("2026-03-07T13:00:00.000Z");

  const metadata = buildNormalizedLeadFieldMetadata({
    existingFieldMetadata: {
      workStatus: {
        value: "Nurse",
        source: "manual_operator_update",
        confidence: 0.95,
        lastUpdatedAt: "2026-03-06T11:00:00.000Z",
        isSuggested: false,
        isConflicted: false,
      },
    },
    normalizedAt,
    sourceLabel: "Inbound SMS",
    fieldValues: {
      fullName: "Jordan Kim",
    },
    fieldConfidences: {
      fullName: 0.8,
    },
  }) as MetadataRecord;

  assert.equal(metadata.workStatus.value, "Nurse");
  assert.equal(metadata.workStatus.source, "manual_operator_update");
  assert.equal(metadata.workStatus.confidence, 0.95);
  assert.equal(metadata.workStatus.lastUpdatedAt, "2026-03-06T11:00:00.000Z");
  assert.equal(metadata.workStatus.isSuggested, false);
  assert.equal(metadata.workStatus.isConflicted, false);
});

test("buildNormalizedLeadFieldMetadata does not overwrite existing high-confidence values with lower-confidence input", () => {
  const metadata = buildNormalizedLeadFieldMetadata({
    existingFieldMetadata: {
      fullName: {
        value: "Operator Confirmed Name",
        source: "manual_operator_update",
        confidence: 0.98,
        lastUpdatedAt: "2026-03-06T11:00:00.000Z",
        isSuggested: false,
        isConflicted: false,
      },
    },
    normalizedAt: new Date("2026-03-07T14:00:00.000Z"),
    sourceLabel: "Inbound email",
    fieldValues: {
      fullName: "Lower confidence extracted name",
    },
    fieldConfidences: {
      fullName: 0.65,
    },
  }) as MetadataRecord;

  assert.equal(metadata.fullName.value, "Operator Confirmed Name");
  assert.equal(metadata.fullName.source, "manual_operator_update");
  assert.equal(metadata.fullName.confidence, 0.98);
  assert.equal(metadata.fullName.lastUpdatedAt, "2026-03-06T11:00:00.000Z");
  assert.equal(metadata.fullName.isSuggested, false);
  assert.equal(metadata.fullName.isConflicted, true);
});

test("extractConflictedNormalizedLeadFieldKeys returns fields marked as conflicted", () => {
  const conflictedFieldKeys = extractConflictedNormalizedLeadFieldKeys({
    fullName: {
      value: "Jordan",
      source: "Inbound email",
      confidence: 0.9,
      lastUpdatedAt: "2026-03-07T12:00:00.000Z",
      isSuggested: false,
      isConflicted: true,
    },
    email: {
      value: "jordan@example.com",
      source: "Inbound email",
      confidence: 0.99,
      lastUpdatedAt: "2026-03-07T12:00:00.000Z",
      isSuggested: false,
      isConflicted: false,
    },
  });

  assert.deepEqual(conflictedFieldKeys, ["fullName"]);
});
