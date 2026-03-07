import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadFieldMetadataRows } from "./lead-field-metadata-view";

test("buildLeadFieldMetadataRows maps metadata entries into display rows", () => {
  const rows = buildLeadFieldMetadataRows({
    fullName: {
      value: "Jordan Kim",
      source: "Inbound email",
      confidence: 0.75,
      lastUpdatedAt: "2026-03-07T12:00:00.000Z",
      isSuggested: true,
    },
    email: {
      value: "jordan@example.com",
      source: "Inbound email",
      confidence: 0.99,
      lastUpdatedAt: "2026-03-07T12:00:00.000Z",
      isSuggested: false,
    },
  });

  const fullNameRow = rows.find((row) => row.key === "fullName");
  const emailRow = rows.find((row) => row.key === "email");

  assert.equal(fullNameRow?.label, "Full name");
  assert.equal(fullNameRow?.value, "Jordan Kim");
  assert.equal(fullNameRow?.confidencePercent, 75);
  assert.equal(fullNameRow?.isSuggested, true);

  assert.equal(emailRow?.label, "Email");
  assert.equal(emailRow?.confidencePercent, 99);
  assert.equal(emailRow?.isSuggested, false);
});

test("buildLeadFieldMetadataRows returns empty rows for invalid metadata payloads", () => {
  assert.deepEqual(buildLeadFieldMetadataRows(null), []);
  assert.deepEqual(buildLeadFieldMetadataRows("invalid"), []);
});
