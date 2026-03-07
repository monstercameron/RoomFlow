import { LeadStatus, QualificationFit } from "@/generated/prisma/client";

type KpiLeadRecord = {
  id: string;
  createdAt: Date;
  leadSourceName: string | null;
  fitResult: QualificationFit;
  declineReason: string | null;
};

type KpiStatusHistoryRecord = {
  leadId: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  createdAt: Date;
};

type KpiAuditEventRecord = {
  leadId: string | null;
  eventType: string;
  createdAt: Date;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveWorkflowKpis(params: {
  leads: KpiLeadRecord[];
  statusHistory: KpiStatusHistoryRecord[];
  auditEvents: KpiAuditEventRecord[];
}) {
  const leadsBySource = new Map<string, number>();
  const fitDistribution = new Map<QualificationFit, number>();
  const declineReasonDistribution = new Map<string, number>();
  const firstResponseTimesMinutes: number[] = [];
  const inquiryToTourConversionLeadIds = new Set<string>();
  const inquiryToApplicationConversionLeadIds = new Set<string>();
  const cumulativeStatusDurationMinutesByStatus = new Map<LeadStatus, number>();
  const statusTransitionCountByStatus = new Map<LeadStatus, number>();

  for (const lead of params.leads) {
    const sourceLabel = lead.leadSourceName ?? "Unattributed";
    leadsBySource.set(sourceLabel, (leadsBySource.get(sourceLabel) ?? 0) + 1);
    fitDistribution.set(lead.fitResult, (fitDistribution.get(lead.fitResult) ?? 0) + 1);

    if (lead.declineReason) {
      declineReasonDistribution.set(
        lead.declineReason,
        (declineReasonDistribution.get(lead.declineReason) ?? 0) + 1,
      );
    }
  }

  const leadCreatedTimestampByLeadId = new Map<string, Date>();

  for (const lead of params.leads) {
    leadCreatedTimestampByLeadId.set(lead.id, lead.createdAt);
  }

  const firstInboundReplyTimestampByLeadId = new Map<string, Date>();

  for (const auditEvent of params.auditEvents) {
    if (!auditEvent.leadId) {
      continue;
    }

    const eventType = auditEvent.eventType.toLowerCase();

    if (
      eventType.includes("inquiry_received") &&
      !firstInboundReplyTimestampByLeadId.has(auditEvent.leadId)
    ) {
      firstInboundReplyTimestampByLeadId.set(auditEvent.leadId, auditEvent.createdAt);
    }

    if (eventType.includes("tour_scheduled")) {
      inquiryToTourConversionLeadIds.add(auditEvent.leadId);
    }

    if (eventType.includes("application_sent")) {
      inquiryToApplicationConversionLeadIds.add(auditEvent.leadId);
    }
  }

  for (const [leadId, firstResponseTimestamp] of firstInboundReplyTimestampByLeadId) {
    const createdTimestamp = leadCreatedTimestampByLeadId.get(leadId);

    if (!createdTimestamp) {
      continue;
    }

    const minutes = (firstResponseTimestamp.getTime() - createdTimestamp.getTime()) / 60000;

    if (minutes >= 0) {
      firstResponseTimesMinutes.push(minutes);
    }
  }

  const orderedStatusHistory = [...params.statusHistory].sort(
    (leftStatusHistoryRecord, rightStatusHistoryRecord) =>
      leftStatusHistoryRecord.createdAt.getTime() - rightStatusHistoryRecord.createdAt.getTime(),
  );

  for (let statusHistoryIndex = 0; statusHistoryIndex < orderedStatusHistory.length; statusHistoryIndex += 1) {
    const currentStatusHistoryRecord = orderedStatusHistory[statusHistoryIndex];
    const nextStatusHistoryRecord = orderedStatusHistory[statusHistoryIndex + 1];

    statusTransitionCountByStatus.set(
      currentStatusHistoryRecord.toStatus,
      (statusTransitionCountByStatus.get(currentStatusHistoryRecord.toStatus) ?? 0) + 1,
    );

    if (!nextStatusHistoryRecord) {
      continue;
    }

    const durationMinutes =
      (nextStatusHistoryRecord.createdAt.getTime() -
        currentStatusHistoryRecord.createdAt.getTime()) /
      60000;

    if (durationMinutes < 0) {
      continue;
    }

    cumulativeStatusDurationMinutesByStatus.set(
      currentStatusHistoryRecord.toStatus,
      (cumulativeStatusDurationMinutesByStatus.get(currentStatusHistoryRecord.toStatus) ?? 0) +
        durationMinutes,
    );
  }

  const averageMinutesByStatus = new Map<LeadStatus, number>();

  for (const [status, cumulativeDurationMinutes] of cumulativeStatusDurationMinutesByStatus) {
    const transitionCount = statusTransitionCountByStatus.get(status) ?? 1;
    averageMinutesByStatus.set(status, cumulativeDurationMinutes / transitionCount);
  }

  const qualificationCompletionRate =
    params.leads.length === 0
      ? 0
      : (params.leads.filter((lead) => lead.fitResult !== QualificationFit.UNKNOWN).length /
          params.leads.length) *
        100;

  return {
    leadsBySource: Object.fromEntries(leadsBySource),
    averageTimeToFirstResponseMinutes: average(firstResponseTimesMinutes),
    qualificationCompletionRate,
    fitDistribution: Object.fromEntries(fitDistribution),
    inquiryToTourConversionRate:
      params.leads.length === 0
        ? 0
        : (inquiryToTourConversionLeadIds.size / params.leads.length) * 100,
    inquiryToApplicationConversionRate:
      params.leads.length === 0
        ? 0
        : (inquiryToApplicationConversionLeadIds.size / params.leads.length) * 100,
    averageStatusDurationMinutes: Object.fromEntries(averageMinutesByStatus),
    declineReasonDistribution: Object.fromEntries(declineReasonDistribution),
  };
}
