import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus, QualificationFit } from "@/generated/prisma/client";
import { deriveWorkflowKpis } from "./kpi-derivation";

test("deriveWorkflowKpis computes all v1 KPI aggregates", () => {
  const metrics = deriveWorkflowKpis({
    leads: [
      {
        id: "lead_1",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        leadSourceName: "Inbound email",
        fitResult: QualificationFit.PASS,
        declineReason: null,
      },
      {
        id: "lead_2",
        createdAt: new Date("2026-03-01T11:00:00.000Z"),
        leadSourceName: "Inbound SMS",
        fitResult: QualificationFit.CAUTION,
        declineReason: "RULE_MISMATCH",
      },
    ],
    statusHistory: [
      {
        leadId: "lead_1",
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.AWAITING_RESPONSE,
        createdAt: new Date("2026-03-01T10:05:00.000Z"),
      },
      {
        leadId: "lead_1",
        fromStatus: LeadStatus.AWAITING_RESPONSE,
        toStatus: LeadStatus.QUALIFIED,
        createdAt: new Date("2026-03-01T11:05:00.000Z"),
      },
    ],
    auditEvents: [
      {
        leadId: "lead_1",
        eventType: "inquiry_received",
        createdAt: new Date("2026-03-01T10:15:00.000Z"),
      },
      {
        leadId: "lead_1",
        eventType: "tour_scheduled",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
      },
      {
        leadId: "lead_2",
        eventType: "application_sent",
        createdAt: new Date("2026-03-01T12:30:00.000Z"),
      },
    ],
  });

  assert.equal(metrics.leadsBySource["Inbound email"], 1);
  assert.equal(metrics.leadsBySource["Inbound SMS"], 1);
  assert.equal(metrics.fitDistribution.PASS, 1);
  assert.equal(metrics.fitDistribution.CAUTION, 1);
  assert.equal(metrics.declineReasonDistribution.RULE_MISMATCH, 1);
  assert.equal(metrics.qualificationCompletionRate, 100);
  assert.equal(metrics.inquiryToTourConversionRate, 50);
  assert.equal(metrics.inquiryToApplicationConversionRate, 50);
  assert.equal(metrics.averageTimeToFirstResponseMinutes, 15);
});
