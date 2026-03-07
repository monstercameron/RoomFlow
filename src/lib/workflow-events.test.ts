import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeNearSimultaneousTimelineEvents,
  isWorkflowEventType,
  sortTimelineEventsDeterministically,
  workflowEventTypes,
} from "./workflow-events";

test("isWorkflowEventType validates known canonical events", () => {
  assert.equal(isWorkflowEventType(workflowEventTypes.fitComputed), true);
  assert.equal(isWorkflowEventType("unknown_event"), false);
});

test("sortTimelineEventsDeterministically enforces stable ordering", () => {
  const sortedEvents = sortTimelineEventsDeterministically([
    {
      id: "event_c",
      leadId: "lead_1",
      eventType: workflowEventTypes.statusChanged,
      createdAt: new Date("2026-03-07T15:00:00.000Z"),
    },
    {
      id: "event_a",
      leadId: "lead_1",
      eventType: workflowEventTypes.fitComputed,
      createdAt: new Date("2026-03-07T15:00:00.000Z"),
    },
    {
      id: "event_b",
      leadId: "lead_2",
      eventType: workflowEventTypes.fitComputed,
      createdAt: new Date("2026-03-07T14:59:00.000Z"),
    },
  ]);

  assert.deepEqual(
    sortedEvents.map((timelineEvent) => timelineEvent.id),
    ["event_b", "event_a", "event_c"],
  );
});

test("dedupeNearSimultaneousTimelineEvents drops repeated events within dedupe window", () => {
  const dedupedEvents = dedupeNearSimultaneousTimelineEvents(
    [
      {
        id: "event_1",
        leadId: "lead_1",
        eventType: workflowEventTypes.fitComputed,
        createdAt: new Date("2026-03-07T15:00:00.000Z"),
      },
      {
        id: "event_2",
        leadId: "lead_1",
        eventType: workflowEventTypes.fitComputed,
        createdAt: new Date("2026-03-07T15:00:01.000Z"),
      },
      {
        id: "event_3",
        leadId: "lead_1",
        eventType: workflowEventTypes.fitComputed,
        createdAt: new Date("2026-03-07T15:00:04.000Z"),
      },
    ],
    2_000,
  );

  assert.deepEqual(
    dedupedEvents.map((timelineEvent) => timelineEvent.id),
    ["event_1", "event_3"],
  );
});
