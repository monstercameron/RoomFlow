import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAvailabilityWindow,
  isDateTimeWithinAvailabilityWindow,
  parseAvailabilityWindowConfig,
  validateAvailabilityWindowConfig,
} from "./availability-windows";

test("validateAvailabilityWindowConfig accepts a weekday window", () => {
  const validatedWindow = validateAvailabilityWindowConfig({
    days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    endLocal: "17:00",
    startLocal: "09:00",
    timeZone: "America/New_York",
  });

  assert.deepEqual(validatedWindow.days, [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ]);
});

test("parseAvailabilityWindowConfig returns null for invalid payloads", () => {
  assert.equal(
    parseAvailabilityWindowConfig({
      days: [],
      endLocal: "17:00",
      startLocal: "09:00",
      timeZone: "America/New_York",
    }),
    null,
  );
});

test("isDateTimeWithinAvailabilityWindow checks the local day and time", () => {
  const availabilityWindow = {
    days: ["TUESDAY", "WEDNESDAY"] as const,
    endLocal: "17:00",
    startLocal: "09:00",
    timeZone: "America/New_York",
  } as const;

  assert.equal(
    isDateTimeWithinAvailabilityWindow({
      availabilityWindow,
      referenceTime: new Date("2030-01-15T15:30:00Z"),
    }),
    true,
  );
  assert.equal(
    isDateTimeWithinAvailabilityWindow({
      availabilityWindow,
      referenceTime: new Date("2030-01-15T01:30:00Z"),
    }),
    false,
  );
});

test("formatAvailabilityWindow renders a compact operator summary", () => {
  assert.equal(
    formatAvailabilityWindow({
      days: ["MONDAY", "WEDNESDAY", "FRIDAY"] as const,
      endLocal: "18:00",
      startLocal: "10:00",
      timeZone: "UTC",
    }),
    "Mon, Wed, Fri · 10:00 to 18:00 (UTC)",
  );
});