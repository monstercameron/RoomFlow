import { PgBoss, type JobWithMetadata, type SendOptions } from "pg-boss";
import {
  LeadStatus,
  MessageOrigin,
  NotificationType,
  PropertyLifecycleStatus,
  TourEventStatus,
  WebhookDeliveryStatus,
} from "@/generated/prisma/client";
import { processNormalizedInboundLead, type NormalizedLeadPayload } from "@/lib/lead-normalization";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import { publishNotificationBusEvent } from "@/lib/notification-bus";
import { prisma } from "@/lib/prisma";
import { sendTourReminderNotification } from "@/lib/tour-communications";
import { markTourReminderSent, parseTourReminderState } from "@/lib/tour-scheduling";
import { workflowEventTypes } from "@/lib/workflow-events";

declare global {
  var roomflowBoss: Promise<PgBoss> | undefined;
}

export const jobNames = {
  delayedFollowUp: "delayed-follow-up",
  reminderSend: "reminder-send",
  webhookProcessing: "webhook-processing",
  outboundMessageSend: "outbound-message-send",
  outboundWebhookDelivery: "outbound-webhook-delivery",
} as const;

type OutboundMessageJob = {
  messageId: string;
};

type ReminderJob = {
  leadId: string;
  templateType?: string | null;
  reminderLabel?: string | null;
  reminderStepId?: string | null;
  scheduledFor?: string | null;
  tourEventId?: string | null;
};

type DelayedFollowUpJob = {
  leadId: string;
  dueAt: string;
};

type OutboundWebhookDeliveryJob = {
  outboundWebhookDeliveryId: string;
};

export function getBossConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return connectionString;
}

type JobProcessingDependencies = {
  isProviderConfigurationError: typeof isProviderConfigurationError;
  markMessageDeliveryFailure: typeof markMessageDeliveryFailure;
  markMessageProviderUnresolved: typeof markMessageProviderUnresolved;
  processNormalizedInboundLead: typeof processNormalizedInboundLead;
  sendQueuedMessage: typeof sendQueuedMessage;
};

const defaultJobProcessingDependencies: JobProcessingDependencies = {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  processNormalizedInboundLead,
  sendQueuedMessage,
};

type RegisteredBoss = Pick<PgBoss, "work" | "stop">;

export type RegisterWorkerHandlersDependencies = {
  getBoss: () => Promise<RegisteredBoss>;
};

const defaultRegisterWorkerHandlersDependencies: RegisterWorkerHandlersDependencies = {
  getBoss,
};

async function createBoss() {
  const boss = new PgBoss({
    connectionString: getBossConnectionString(),
    schema: "pgboss",
  });

  boss.on("error", (error) => {
    console.error("[pg-boss]", error);
  });

  await boss.start();

  await Promise.all(
    Object.values(jobNames).map((name) =>
      boss.createQueue(name, {
        retryLimit: 3,
        retryDelay: 10,
        retryBackoff: true,
      }),
    ),
  );

  return boss;
}

export async function getBoss() {
  if (!globalThis.roomflowBoss) {
    globalThis.roomflowBoss = createBoss();
  }

  return globalThis.roomflowBoss;
}

async function enqueueJob<T extends object>(
  name: string,
  data: T,
  options?: SendOptions,
) {
  const boss = await getBoss();
  return boss.send(name, data, options);
}

export async function enqueueWebhookProcessing(payload: NormalizedLeadPayload) {
  return enqueueJob(jobNames.webhookProcessing, payload);
}

export async function enqueueOutboundMessageSend(
  payload: OutboundMessageJob,
  options?: SendOptions,
) {
  return enqueueJob(jobNames.outboundMessageSend, payload, options);
}

export async function scheduleDelayedFollowUp(
  payload: DelayedFollowUpJob,
  seconds: number,
) {
  return enqueueJob(jobNames.delayedFollowUp, payload, {
    startAfter: seconds,
  });
}

export async function scheduleReminderSend(payload: ReminderJob, seconds: number) {
  return enqueueJob(jobNames.reminderSend, payload, {
    startAfter: seconds,
  });
}

export async function enqueueOutboundWebhookDelivery(
  payload: OutboundWebhookDeliveryJob,
  options?: SendOptions,
) {
  return enqueueJob(jobNames.outboundWebhookDelivery, payload, options);
}

export async function processWebhookJob(
  jobs: JobWithMetadata<NormalizedLeadPayload>[],
  dependencies: JobProcessingDependencies = defaultJobProcessingDependencies,
) {
  for (const job of jobs) {
    await dependencies.processNormalizedInboundLead(job.data);
  }
}

export async function processOutboundMessageJobs(
  jobs: JobWithMetadata<OutboundMessageJob>[],
  dependencies: JobProcessingDependencies = defaultJobProcessingDependencies,
) {
  for (const job of jobs) {
    try {
      await dependencies.sendQueuedMessage(job.data.messageId, job.retryCount);
    } catch (error) {
      const deliveryErrorMessage =
        error instanceof Error ? error.message : "Unknown delivery error";

      if (dependencies.isProviderConfigurationError(deliveryErrorMessage)) {
        await dependencies.markMessageProviderUnresolved({
          messageId: job.data.messageId,
          error: deliveryErrorMessage,
        });
        continue;
      }

      await dependencies.markMessageDeliveryFailure({
        messageId: job.data.messageId,
        retryCount: job.retryCount,
        error: deliveryErrorMessage,
      });

      throw error;
    }
  }
}

async function processReminderJobs(jobs: JobWithMetadata<ReminderJob>[]) {
  for (const job of jobs) {
    console.log("[pg-boss] reminder-send", job.data);

    if (job.data.tourEventId && job.data.reminderStepId && job.data.scheduledFor) {
      const scheduledReminderAt = new Date(job.data.scheduledFor);

      if (!Number.isNaN(scheduledReminderAt.getTime()) && scheduledReminderAt > new Date()) {
        continue;
      }

      const tour = await prisma.tourEvent.findFirst({
        where: {
          id: job.data.tourEventId,
          leadId: job.data.leadId,
          status: TourEventStatus.SCHEDULED,
        },
        include: {
          lead: {
            select: {
              id: true,
            },
          },
          property: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!tour?.property?.name) {
        continue;
      }

      const reminderState = parseTourReminderState(tour.reminderSequenceState);
      const matchingReminderState = reminderState.find(
        (entry) => entry.id === job.data.reminderStepId,
      );

      if (matchingReminderState?.sentAt) {
        continue;
      }

      const reminderSent = await sendTourReminderNotification({
        leadId: tour.lead.id,
        propertyName: tour.property.name,
        reminderLabel: job.data.reminderLabel ?? "Before the tour",
        scheduledAt: tour.scheduledAt ?? tour.createdAt,
      });

      if (!reminderSent) {
        continue;
      }

      const sentAt = new Date();

      await prisma.tourEvent.update({
        where: {
          id: tour.id,
        },
        data: {
          prospectNotificationSentAt: sentAt,
          reminderSequenceState: markTourReminderSent({
            reminderState,
            reminderStepId: job.data.reminderStepId,
            sentAt,
          }),
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId: tour.workspaceId,
          leadId: tour.leadId,
          propertyId: tour.propertyId,
          eventType: workflowEventTypes.reminderSent,
          payload: {
            reminderLabel: job.data.reminderLabel ?? null,
            reminderStepId: job.data.reminderStepId,
            scheduledFor: job.data.scheduledFor,
            tourEventId: tour.id,
          },
        },
      });

      continue;
    }

    const staleNoResponseDays = Number(process.env.STALE_NO_RESPONSE_DAYS ?? "7");
    const staleArchiveDays = Number(process.env.STALE_AUTO_ARCHIVE_DAYS ?? "30");
    const staleCutoffDate = new Date();
    staleCutoffDate.setDate(staleCutoffDate.getDate() - staleNoResponseDays);
    const archiveCutoffDate = new Date();
    archiveCutoffDate.setDate(archiveCutoffDate.getDate() - staleArchiveDays);

    const staleCandidates = await prisma.lead.findMany({
      where: {
        status: {
          in: [
            LeadStatus.NEW,
            LeadStatus.AWAITING_RESPONSE,
            LeadStatus.INCOMPLETE,
            LeadStatus.UNDER_REVIEW,
            LeadStatus.CAUTION,
            LeadStatus.QUALIFIED,
            LeadStatus.TOUR_SCHEDULED,
            LeadStatus.APPLICATION_SENT,
          ],
        },
        OR: [
          {
            lastActivityAt: {
              lt: staleCutoffDate,
            },
          },
          {
            updatedAt: {
              lt: staleCutoffDate,
            },
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        workspaceId: true,
        status: true,
        lastActivityAt: true,
        updatedAt: true,
        staleAutoArchiveBlocked: true,
        applicationInviteSentAt: true,
      },
      take: 100,
    });

    for (const staleCandidate of staleCandidates) {
      if (!staleCandidate.lastActivityAt || staleCandidate.lastActivityAt < staleCutoffDate) {
        await prisma.lead.update({
          where: {
            id: staleCandidate.id,
          },
          data: {
            isStale: true,
            staleAt: new Date(),
            staleReason: "no_response_or_operator_action",
          },
        });

        await publishNotificationBusEvent({
          workspaceId: staleCandidate.workspaceId,
          leadId: staleCandidate.id,
          type: NotificationType.STALE_LEAD,
          title: "Lead marked stale",
          body: `${staleCandidate.fullName} has gone stale and needs review.`,
          payload: {
            leadId: staleCandidate.id,
          },
        });

        await prisma.auditEvent.create({
          data: {
            workspaceId: staleCandidate.workspaceId,
            leadId: staleCandidate.id,
            eventType: workflowEventTypes.staleMarked,
            payload: {
              staleReason: "no_response_or_operator_action",
            },
          },
        });

        await scheduleDelayedFollowUp(
          {
            leadId: staleCandidate.id,
            dueAt: new Date().toISOString(),
          },
          60,
        );
      }

      if (
        staleCandidate.applicationInviteSentAt &&
        staleCandidate.applicationInviteSentAt < staleCutoffDate
      ) {
        await publishNotificationBusEvent({
          workspaceId: staleCandidate.workspaceId,
          leadId: staleCandidate.id,
          type: NotificationType.APPLICATION_INVITE_STALE,
          title: "Application invite is stale",
          body: `${staleCandidate.fullName} has an application invite that needs follow-up.`,
        });
      }

      const referenceDate = staleCandidate.lastActivityAt ?? staleCandidate.updatedAt;

      if (
        referenceDate < archiveCutoffDate &&
        !staleCandidate.staleAutoArchiveBlocked &&
        staleCandidate.status !== LeadStatus.ARCHIVED &&
        staleCandidate.status !== LeadStatus.CLOSED
      ) {
        await prisma.$transaction(async (transactionClient) => {
          await transactionClient.lead.update({
            where: {
              id: staleCandidate.id,
            },
            data: {
              status: LeadStatus.ARCHIVED,
              isStale: true,
              staleAt: new Date(),
              staleReason: "stale_auto_archive",
            },
          });

          await transactionClient.leadStatusHistory.create({
            data: {
              leadId: staleCandidate.id,
              fromStatus: staleCandidate.status,
              toStatus: LeadStatus.ARCHIVED,
              reason: "Auto-archived by stale policy threshold.",
            },
          });

          await transactionClient.auditEvent.create({
            data: {
              workspaceId: staleCandidate.workspaceId,
              leadId: staleCandidate.id,
              eventType: workflowEventTypes.staleArchiveSuggested,
              payload: {
                fromStatus: staleCandidate.status,
                toStatus: LeadStatus.ARCHIVED,
              },
            },
          });
        });
      }
    }

    const allWorkspaces = await prisma.workspace.findMany({
      select: {
        id: true,
      },
      take: 100,
    });
    const startOfCurrentMonth = new Date();
    startOfCurrentMonth.setUTCDate(1);
    startOfCurrentMonth.setUTCHours(0, 0, 0, 0);

    for (const workspace of allWorkspaces) {
      const [activeProperties, monthlyLeads, automationSends, seats] =
        await Promise.all([
          prisma.property.count({
            where: {
              workspaceId: workspace.id,
              lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
            },
          }),
          prisma.lead.count({
            where: {
              workspaceId: workspace.id,
              createdAt: {
                gte: startOfCurrentMonth,
              },
            },
          }),
          prisma.message.count({
            where: {
              origin: MessageOrigin.OUTBOUND_AUTOMATED,
              conversation: {
                lead: {
                  workspaceId: workspace.id,
                },
              },
            },
          }),
          prisma.membership.count({
            where: {
              workspaceId: workspace.id,
            },
          }),
        ]);

      const snapshotDate = new Date();
      snapshotDate.setUTCHours(0, 0, 0, 0);

      await prisma.workspaceUsageSnapshot.upsert({
        where: {
          workspaceId_snapshotDate: {
            workspaceId: workspace.id,
            snapshotDate,
          },
        },
        update: {
          activeProperties,
          monthlyLeads,
          automationSends,
          seats,
        },
        create: {
          workspaceId: workspace.id,
          snapshotDate,
          activeProperties,
          monthlyLeads,
          automationSends,
          seats,
        },
      });
    }

    const pendingWebhookDeliveries = await prisma.outboundWebhookDelivery.findMany({
      where: {
        status: {
          in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED],
        },
        OR: [
          {
            nextAttemptAt: null,
          },
          {
            nextAttemptAt: {
              lte: new Date(),
            },
          },
        ],
      },
      select: {
        id: true,
      },
      take: 100,
    });

    for (const pendingWebhookDelivery of pendingWebhookDeliveries) {
      await enqueueOutboundWebhookDelivery({
        outboundWebhookDeliveryId: pendingWebhookDelivery.id,
      });
    }
  }
}

async function processOutboundWebhookDeliveryJobs(
  jobs: JobWithMetadata<OutboundWebhookDeliveryJob>[],
) {
  for (const job of jobs) {
    const deliveryRecord = await prisma.outboundWebhookDelivery.findUnique({
      where: {
        id: job.data.outboundWebhookDeliveryId,
      },
    });

    if (!deliveryRecord) {
      continue;
    }

    if (
      deliveryRecord.nextAttemptAt &&
      deliveryRecord.nextAttemptAt.getTime() > Date.now()
    ) {
      continue;
    }

    const payloadAsJsonString = JSON.stringify(deliveryRecord.payload);

    try {
      const response = await fetch(deliveryRecord.destinationUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-roomflow-event-type": deliveryRecord.eventType,
          ...(deliveryRecord.signature
            ? {
                "x-roomflow-signature": deliveryRecord.signature,
              }
            : {}),
        },
        body: payloadAsJsonString,
      });

      if (!response.ok) {
        throw new Error(`Webhook destination returned ${response.status}`);
      }

      await prisma.outboundWebhookDelivery.update({
        where: {
          id: deliveryRecord.id,
        },
        data: {
          status: WebhookDeliveryStatus.DELIVERED,
          attemptCount: deliveryRecord.attemptCount + 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          lastError: null,
        },
      });
      continue;
    } catch (error) {
      const nextAttemptCount = deliveryRecord.attemptCount + 1;
      const maxAttemptCount = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? "5");

      if (nextAttemptCount >= maxAttemptCount) {
        await prisma.outboundWebhookDelivery.update({
          where: {
            id: deliveryRecord.id,
          },
          data: {
            status: WebhookDeliveryStatus.DEAD_LETTER,
            attemptCount: nextAttemptCount,
            deadLetteredAt: new Date(),
            lastAttemptAt: new Date(),
            nextAttemptAt: null,
            lastError: error instanceof Error ? error.message : "Webhook delivery failed",
          },
        });
        continue;
      }

      const retryDelayMinutes = Math.min(60, 2 ** nextAttemptCount);
      const nextAttemptAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      await prisma.outboundWebhookDelivery.update({
        where: {
          id: deliveryRecord.id,
        },
        data: {
          status: WebhookDeliveryStatus.FAILED,
          attemptCount: nextAttemptCount,
          lastAttemptAt: new Date(),
          nextAttemptAt,
          lastError: error instanceof Error ? error.message : "Webhook delivery failed",
        },
      });

      await enqueueOutboundWebhookDelivery(
        {
          outboundWebhookDeliveryId: deliveryRecord.id,
        },
        {
          startAfter: retryDelayMinutes * 60,
        },
      );
    }
  }
}

async function processDelayedFollowUpJobs(
  jobs: JobWithMetadata<DelayedFollowUpJob>[],
) {
  for (const job of jobs) {
    console.log("[pg-boss] delayed-follow-up", job.data);

    const lead = await prisma.lead.findUnique({
      where: {
        id: job.data.leadId,
      },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        staleAutoArchiveBlocked: true,
      },
    });

    if (!lead) {
      continue;
    }

    await prisma.auditEvent.create({
      data: {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        eventType: workflowEventTypes.staleArchiveSuggested,
        payload: {
          dueAt: job.data.dueAt,
        },
      },
    });

    if (!lead.staleAutoArchiveBlocked && lead.status !== LeadStatus.ARCHIVED) {
      await prisma.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: LeadStatus.ARCHIVED,
          staleReason: "archive_suggestion_accepted_by_policy",
        },
      });
    }
  }
}

export async function registerWorkerHandlers(
  dependencies: RegisterWorkerHandlersDependencies = defaultRegisterWorkerHandlersDependencies,
) {
  const boss = await dependencies.getBoss();

  await boss.work(
    jobNames.webhookProcessing,
    { batchSize: 1, includeMetadata: true },
    processWebhookJob,
  );
  await boss.work(
    jobNames.outboundMessageSend,
    { batchSize: 1, includeMetadata: true },
    processOutboundMessageJobs,
  );
  await boss.work(
    jobNames.reminderSend,
    { batchSize: 1, includeMetadata: true },
    processReminderJobs,
  );
  await boss.work(
    jobNames.delayedFollowUp,
    { batchSize: 1, includeMetadata: true },
    processDelayedFollowUpJobs,
  );
  await boss.work(
    jobNames.outboundWebhookDelivery,
    { batchSize: 1, includeMetadata: true },
    processOutboundWebhookDeliveryJobs,
  );

  return boss;
}
