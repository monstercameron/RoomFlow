import assert from "node:assert/strict";
import test from "node:test";
import {
  getPropertyStatusChips,
  isPropertyIndexFilter,
  matchesPropertyIndexFilter,
} from "@/lib/property-summary";

test("isPropertyIndexFilter accepts supported filters only", () => {
  assert.equal(isPropertyIndexFilter("ready"), true);
  assert.equal(isPropertyIndexFilter("archived"), false);
});

test("getPropertyStatusChips marks missing setup clearly", () => {
  assert.deepEqual(
    getPropertyStatusChips({
      activeLeads: 0,
      qualifiedLeads: 0,
      rulesCount: 0,
      schedulingUrl: null,
    }),
    [
      { label: "Setup needed", tone: "warning" },
      { label: "Rules missing", tone: "warning" },
      { label: "Scheduling missing", tone: "warning" },
    ],
  );
});

test("getPropertyStatusChips marks active and qualified demand", () => {
  assert.deepEqual(
    getPropertyStatusChips({
      activeLeads: 4,
      qualifiedLeads: 2,
      rulesCount: 3,
      schedulingUrl: "https://calendar.example.test/booking",
    }),
    [
      { label: "Ready", tone: "success" },
      { label: "Lead flow active", tone: "default" },
      { label: "Qualified demand", tone: "success" },
    ],
  );
});

test("matchesPropertyIndexFilter evaluates setup and activity filters", () => {
  const setupNeededProperty = {
    activeLeads: 0,
    qualifiedLeads: 0,
    rulesCount: 0,
    schedulingUrl: null,
  };
  const readyProperty = {
    activeLeads: 3,
    qualifiedLeads: 1,
    rulesCount: 2,
    schedulingUrl: "https://calendar.example.test/booking",
  };

  assert.equal(matchesPropertyIndexFilter(setupNeededProperty, "setup-needed"), true);
  assert.equal(matchesPropertyIndexFilter(setupNeededProperty, "ready"), false);
  assert.equal(matchesPropertyIndexFilter(readyProperty, "lead-active"), true);
  assert.equal(matchesPropertyIndexFilter(readyProperty, "qualified-demand"), true);
});