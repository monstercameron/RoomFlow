import assert from "node:assert/strict";
import test from "node:test";
import { PropertyLifecycleStatus } from "@/generated/prisma/client";
import {
  formatPropertyLifecycleStatus,
  isPropertyLifecycleStatus,
  propertyAcceptsNewLeads,
} from "@/lib/property-lifecycle";

test("recognizes supported property lifecycle values", () => {
  assert.equal(isPropertyLifecycleStatus(PropertyLifecycleStatus.ACTIVE), true);
  assert.equal(isPropertyLifecycleStatus("PAUSED"), false);
});

test("formats property lifecycle labels", () => {
  assert.equal(
    formatPropertyLifecycleStatus(PropertyLifecycleStatus.INACTIVE),
    "Inactive",
  );
});

test("only active properties accept new leads", () => {
  assert.equal(propertyAcceptsNewLeads(PropertyLifecycleStatus.ACTIVE), true);
  assert.equal(propertyAcceptsNewLeads(PropertyLifecycleStatus.INACTIVE), false);
  assert.equal(propertyAcceptsNewLeads(PropertyLifecycleStatus.ARCHIVED), false);
});