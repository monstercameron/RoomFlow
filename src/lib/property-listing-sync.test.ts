import assert from "node:assert/strict";
import test from "node:test";
import { PropertyListingSyncStatus } from "@/generated/prisma/client";
import {
  formatPropertyListingSyncStatus,
  isPropertyListingSyncStatus,
} from "@/lib/property-listing-sync";

test("recognizes valid property listing sync statuses", () => {
  assert.equal(isPropertyListingSyncStatus(PropertyListingSyncStatus.HEALTHY), true);
  assert.equal(isPropertyListingSyncStatus("BROKEN"), false);
});

test("formats property listing sync statuses for the UI", () => {
  assert.equal(
    formatPropertyListingSyncStatus(PropertyListingSyncStatus.OUT_OF_DATE),
    "Out of date",
  );
});