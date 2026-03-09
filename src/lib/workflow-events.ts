export const workflowEventTypes = {
  leadCreated: "lead_created",
  inquiryReceived: "inquiry_received",
  inquiryAttached: "inquiry_attached",
  duplicateFlagged: "duplicate_flagged",
  qualificationStarted: "qualification_started",
  qualificationQuestionSent: "qualification_question_sent",
  qualificationAnswerReceived: "qualification_answer_received",
  qualificationAnswerInvalid: "qualification_answer_invalid",
  fitComputed: "fit_computed",
  warningTriggered: "warning_triggered",
  mismatchTriggered: "mismatch_triggered",
  statusChanged: "lead_status_changed",
  overrideApplied: "lead_override_applied",
  tourScheduled: "tour_scheduled",
  tourRescheduled: "tour_rescheduled",
  tourCanceled: "tour_canceled",
  screeningRequested: "screening_requested",
  screeningConsentCompleted: "screening_consent_completed",
  screeningCompleted: "screening_completed",
  screeningReviewed: "screening_reviewed",
  screeningAdverseActionRecorded: "screening_adverse_action_recorded",
  applicationSent: "application_sent",
  declineRecorded: "decline_recorded",
  archived: "lead_archived",
  restored: "lead_restored",
  templateRenderFailed: "template_render_failed",
  outboundMessageQueued: "outbound_message_queued",
  outboundMessageBlocked: "outbound_message_blocked",
  outboundMessageSent: "outbound_message_sent",
  reminderSent: "reminder_sent",
  deliveryFailed: "delivery_failed",
  staleMarked: "lead_stale_marked",
  staleArchiveSuggested: "lead_stale_archive_suggested",
  webhookQueued: "outbound_webhook_queued",
  webhookDelivered: "outbound_webhook_delivered",
  webhookDeadLettered: "outbound_webhook_dead_lettered",
} as const;

export type WorkflowEventType =
  (typeof workflowEventTypes)[keyof typeof workflowEventTypes];

export function isWorkflowEventType(value: string): value is WorkflowEventType {
  return Object.values(workflowEventTypes).includes(value as WorkflowEventType);
}

export function sortTimelineEventsDeterministically<
  T extends {
    createdAt: Date;
    id: string;
    eventType: string;
    leadId?: string | null;
  },
>(events: T[]) {
  return [...events].sort((leftEvent, rightEvent) => {
    const createdAtDiff =
      leftEvent.createdAt.getTime() - rightEvent.createdAt.getTime();

    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    const leadIdLeft = leftEvent.leadId ?? "";
    const leadIdRight = rightEvent.leadId ?? "";
    const leadIdDiff = leadIdLeft.localeCompare(leadIdRight);

    if (leadIdDiff !== 0) {
      return leadIdDiff;
    }

    const eventTypeDiff = leftEvent.eventType.localeCompare(rightEvent.eventType);

    if (eventTypeDiff !== 0) {
      return eventTypeDiff;
    }

    return leftEvent.id.localeCompare(rightEvent.id);
  });
}

export function dedupeNearSimultaneousTimelineEvents<
  T extends {
    id: string;
    leadId?: string | null;
    eventType: string;
    createdAt: Date;
  },
>(events: T[], dedupeWindowMs = 2_000) {
  const orderedEvents = sortTimelineEventsDeterministically(events);
  const dedupedEvents: T[] = [];
  const mostRecentEventTimestampByKey = new Map<string, number>();

  for (const orderedEvent of orderedEvents) {
    const dedupeKey = `${orderedEvent.leadId ?? "workspace"}|${orderedEvent.eventType}`;
    const mostRecentTimestamp = mostRecentEventTimestampByKey.get(dedupeKey);
    const orderedEventTimestamp = orderedEvent.createdAt.getTime();

    if (
      mostRecentTimestamp !== undefined &&
      orderedEventTimestamp - mostRecentTimestamp <= dedupeWindowMs
    ) {
      continue;
    }

    dedupedEvents.push(orderedEvent);
    mostRecentEventTimestampByKey.set(dedupeKey, orderedEventTimestamp);
  }

  return dedupedEvents;
}
