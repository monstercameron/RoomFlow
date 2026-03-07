import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadNormalizationDiff } from "./lead-normalization-diff";

test("buildLeadNormalizationDiff reports lead-level field changes", () => {
  const diffEntries = buildLeadNormalizationDiff({
    beforeLead: {
      propertyId: null,
      leadSourceId: "source_1",
      fullName: "Unknown lead",
      email: null,
      phone: null,
      preferredContactChannel: null,
    },
    afterLead: {
      propertyId: "property_1",
      leadSourceId: "source_2",
      fullName: "Jordan Kim",
      email: "jordan@example.com",
      phone: "+14015550123",
      preferredContactChannel: "EMAIL",
    },
    beforeFieldMetadata: null,
    afterFieldMetadata: null,
  });

  const changedFields = diffEntries.map((entry) => entry.field);

  assert.equal(changedFields.includes("propertyId"), true);
  assert.equal(changedFields.includes("leadSourceId"), true);
  assert.equal(changedFields.includes("fullName"), true);
  assert.equal(changedFields.includes("email"), true);
  assert.equal(changedFields.includes("phone"), true);
  assert.equal(changedFields.includes("preferredContactChannel"), true);
});

test("buildLeadNormalizationDiff reports metadata deltas", () => {
  const diffEntries = buildLeadNormalizationDiff({
    beforeLead: {
      propertyId: "property_1",
      leadSourceId: "source_1",
      fullName: "Jordan Kim",
      email: "jordan@example.com",
      phone: "+14015550123",
      preferredContactChannel: "EMAIL",
    },
    afterLead: {
      propertyId: "property_1",
      leadSourceId: "source_1",
      fullName: "Jordan Kim",
      email: "jordan@example.com",
      phone: "+14015550123",
      preferredContactChannel: "EMAIL",
    },
    beforeFieldMetadata: {
      fullName: {
        value: "Jordan Kim",
        source: "Inbound email",
        confidence: 0.7,
      },
    },
    afterFieldMetadata: {
      fullName: {
        value: "Jordan Kim",
        source: "manual_operator_update",
        confidence: 0.95,
      },
    },
  });

  assert.equal(
    diffEntries.some((entry) => entry.field === "fieldMetadata.fullName"),
    true,
  );
});
