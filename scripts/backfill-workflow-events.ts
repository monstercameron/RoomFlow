import "dotenv/config";
import { AuditActorType, QualificationFit } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { workflowEventTypes } from "../src/lib/workflow-events";

async function main() {
  const leadRecords = await prisma.lead.findMany({
    include: {
      leadSource: {
        select: {
          name: true,
          type: true,
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },
      auditEvents: {
        select: {
          eventType: true,
          createdAt: true,
        },
      },
    },
  });

  let leadCreatedEventBackfillCount = 0;
  let fitComputedEventBackfillCount = 0;
  let statusChangedEventBackfillCount = 0;

  for (const leadRecord of leadRecords) {
    const existingAuditEventTypes = new Set(
      leadRecord.auditEvents.map((auditEvent) => auditEvent.eventType),
    );

    if (!existingAuditEventTypes.has(workflowEventTypes.leadCreated)) {
      await prisma.auditEvent.create({
        data: {
          workspaceId: leadRecord.workspaceId,
          leadId: leadRecord.id,
          propertyId: leadRecord.propertyId,
          actorType: AuditActorType.SYSTEM,
          eventType: workflowEventTypes.leadCreated,
          createdAt: leadRecord.createdAt,
          payload: {
            sourceName: leadRecord.leadSource?.name ?? "Unknown",
            sourceType: leadRecord.leadSource?.type ?? "MANUAL",
            backfilled: true,
          },
        },
      });
      leadCreatedEventBackfillCount += 1;
    }

    if (
      leadRecord.fitResult !== QualificationFit.UNKNOWN &&
      !existingAuditEventTypes.has(workflowEventTypes.fitComputed)
    ) {
      await prisma.auditEvent.create({
        data: {
          workspaceId: leadRecord.workspaceId,
          leadId: leadRecord.id,
          propertyId: leadRecord.propertyId,
          actorType: AuditActorType.SYSTEM,
          eventType: workflowEventTypes.fitComputed,
          createdAt: leadRecord.updatedAt,
          payload: {
            summary: "Backfilled fit computation event for seeded flow.",
            nextFitResult: leadRecord.fitResult,
            backfilled: true,
          },
        },
      });
      fitComputedEventBackfillCount += 1;
    }

    const existingStatusChangeEventTimestamps = new Set(
      leadRecord.auditEvents
        .filter(
          (auditEvent) => auditEvent.eventType === workflowEventTypes.statusChanged,
        )
        .map((auditEvent) => auditEvent.createdAt.toISOString()),
    );

    for (const statusHistoryRecord of leadRecord.statusHistory) {
      const statusHistoryTimestampIsoString =
        statusHistoryRecord.createdAt.toISOString();

      if (existingStatusChangeEventTimestamps.has(statusHistoryTimestampIsoString)) {
        continue;
      }

      await prisma.auditEvent.create({
        data: {
          workspaceId: leadRecord.workspaceId,
          leadId: leadRecord.id,
          propertyId: leadRecord.propertyId,
          actorType: AuditActorType.SYSTEM,
          eventType: workflowEventTypes.statusChanged,
          createdAt: statusHistoryRecord.createdAt,
          payload: {
            actorUserId: "system-backfill",
            fromStatus: statusHistoryRecord.fromStatus,
            toStatus: statusHistoryRecord.toStatus,
            reason: statusHistoryRecord.reason,
            backfilled: true,
          },
        },
      });
      statusChangedEventBackfillCount += 1;
    }
  }

  console.log(
    `Backfill complete: lead_created=${leadCreatedEventBackfillCount}, fit_computed=${fitComputedEventBackfillCount}, status_changed=${statusChangedEventBackfillCount}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
