import assert from "node:assert/strict";
import test from "node:test";
import {
  CalendarSyncProvider,
  CalendarSyncStatus,
  TourSchedulingMode,
} from "@/generated/prisma/client";
import {
  buildCalendarSyncState,
  buildInitialTourReminderState,
  defaultCalendarConnectionsConfig,
  defaultTourReminderSequence,
  formatTourReminderSequenceSummary,
  parseCalendarConnectionsConfig,
  resolveAssignedTourMembershipId,
  resolveTourReminderDelays,
} from "./tour-scheduling";

test("parseCalendarConnectionsConfig falls back to defaults", () => {
  const parsedConfig = parseCalendarConnectionsConfig(null);

  assert.equal(parsedConfig.GOOGLE.status, "DISCONNECTED");
  assert.equal(parsedConfig.OUTLOOK.syncEnabled, false);
});

test("buildCalendarSyncState returns a synced google event when the connection is active", () => {
  const calendarConnections = parseCalendarConnectionsConfig({
    GOOGLE: {
      connectedAccount: "ops@roomflow.local",
      status: "ACTIVE",
      syncEnabled: true,
    },
  });

  const syncState = buildCalendarSyncState({
    propertyCalendarTargetExternalId: "primary",
    propertyCalendarTargetProvider: "GOOGLE",
    tourEventId: "tour_123",
    workspaceCalendarConnections: calendarConnections,
  });

  assert.equal(syncState.calendarSyncProvider, CalendarSyncProvider.GOOGLE);
  assert.equal(syncState.calendarSyncStatus, CalendarSyncStatus.SYNCED);
  assert.equal(syncState.externalCalendarId, "google:primary:tour_123");
});

test("resolveAssignedTourMembershipId uses round robin ordering for shared coverage members", () => {
  const assignedMembershipId = resolveAssignedTourMembershipId({
    currentMembershipId: "membership_current",
    eligibleMemberships: [
      {
        createdAt: new Date("2030-01-01T00:00:00Z"),
        id: "membership_b",
        lastTourAssignedAt: new Date("2030-01-02T00:00:00Z"),
        sharedTourCoverageEnabled: true,
      },
      {
        createdAt: new Date("2030-01-01T00:00:00Z"),
        id: "membership_a",
        lastTourAssignedAt: null,
        sharedTourCoverageEnabled: true,
      },
    ],
    explicitAssignedMembershipId: null,
    workspaceSchedulingMode: TourSchedulingMode.ROUND_ROBIN,
  });

  assert.equal(assignedMembershipId, "membership_a");
});

test("tour reminder helpers build state and delays from the configured sequence", () => {
  const scheduledAt = new Date("2030-01-15T15:30:00Z");
  const reminderState = buildInitialTourReminderState({
    reminderSequence: defaultTourReminderSequence,
    scheduledAt,
  });
  const delays = resolveTourReminderDelays({
    now: new Date("2030-01-14T14:00:00Z"),
    reminderSequence: defaultTourReminderSequence,
    scheduledAt,
  });

  assert.equal(reminderState.length, 2);
  assert.equal(delays.length, 2);
  assert.equal(formatTourReminderSequenceSummary(defaultTourReminderSequence), "24 hours before · 1 hour before");
});

test("buildCalendarSyncState fails when a provider connection is not active", () => {
  const syncState = buildCalendarSyncState({
    propertyCalendarTargetExternalId: "calendar_123",
    propertyCalendarTargetProvider: "OUTLOOK",
    tourEventId: "tour_456",
    workspaceCalendarConnections: defaultCalendarConnectionsConfig,
  });

  assert.equal(syncState.calendarSyncProvider, CalendarSyncProvider.OUTLOOK);
  assert.equal(syncState.calendarSyncStatus, CalendarSyncStatus.FAILED);
});