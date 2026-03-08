import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuietHours,
  isWithinQuietHours,
  resolveEffectiveQuietHours,
  validateQuietHoursConfig,
} from "./quiet-hours";

test("validateQuietHoursConfig accepts valid overnight ranges", () => {
  const validatedQuietHours = validateQuietHoursConfig({
    startLocal: "22:00",
    endLocal: "08:00",
    timeZone: "UTC",
  });

  assert.equal(validatedQuietHours.startMinutes, 1320);
  assert.equal(validatedQuietHours.endMinutes, 480);
});

test("resolveEffectiveQuietHours prefers property overrides", () => {
  const effectiveQuietHours = resolveEffectiveQuietHours({
    workspaceQuietHoursStartLocal: "21:00",
    workspaceQuietHoursEndLocal: "08:00",
    workspaceQuietHoursTimeZone: "UTC",
    propertyQuietHoursStartLocal: "20:00",
    propertyQuietHoursEndLocal: "09:00",
    propertyQuietHoursTimeZone: "UTC",
  });

  assert.equal(effectiveQuietHours?.source, "property");
  assert.equal(effectiveQuietHours?.config.startLocal, "20:00");
});

test("isWithinQuietHours handles overnight ranges", () => {
  assert.equal(
    isWithinQuietHours({
      quietHours: {
        startLocal: "22:00",
        endLocal: "08:00",
        timeZone: "UTC",
      },
      referenceTime: new Date("2026-03-07T23:30:00Z"),
    }),
    true,
  );
  assert.equal(
    isWithinQuietHours({
      quietHours: {
        startLocal: "22:00",
        endLocal: "08:00",
        timeZone: "UTC",
      },
      referenceTime: new Date("2026-03-07T12:30:00Z"),
    }),
    false,
  );
});

test("formatQuietHours returns a compact summary", () => {
  assert.equal(
    formatQuietHours({
      startLocal: "21:00",
      endLocal: "08:00",
      timeZone: "America/New_York",
    }),
    "21:00 to 08:00 (America/New_York)",
  );
});