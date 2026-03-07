import { PgBoss, type JobWithMetadata, type SendOptions } from "pg-boss";
import { processNormalizedInboundLead, type NormalizedLeadPayload } from "@/lib/lead-normalization";
import {
  markMessageDeliveryFailure,
  sendQueuedMessage,
} from "@/lib/message-delivery";

declare global {
  var roomflowBoss: Promise<PgBoss> | undefined;
}

export const jobNames = {
  delayedFollowUp: "delayed-follow-up",
  reminderSend: "reminder-send",
  webhookProcessing: "webhook-processing",
  outboundMessageSend: "outbound-message-send",
} as const;

type OutboundMessageJob = {
  messageId: string;
};

type ReminderJob = {
  leadId: string;
  templateType?: string | null;
};

type DelayedFollowUpJob = {
  leadId: string;
  dueAt: string;
};

function getBossConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return connectionString;
}

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

async function processWebhookJob(jobs: JobWithMetadata<NormalizedLeadPayload>[]) {
  for (const job of jobs) {
    await processNormalizedInboundLead(job.data);
  }
}

async function processOutboundMessageJobs(
  jobs: JobWithMetadata<OutboundMessageJob>[],
) {
  for (const job of jobs) {
    try {
      await sendQueuedMessage(job.data.messageId, job.retryCount);
    } catch (error) {
      await markMessageDeliveryFailure({
        messageId: job.data.messageId,
        retryCount: job.retryCount,
        error: error instanceof Error ? error.message : "Unknown delivery error",
      });

      throw error;
    }
  }
}

async function processReminderJobs(jobs: JobWithMetadata<ReminderJob>[]) {
  for (const job of jobs) {
    console.log("[pg-boss] reminder-send", job.data);
  }
}

async function processDelayedFollowUpJobs(
  jobs: JobWithMetadata<DelayedFollowUpJob>[],
) {
  for (const job of jobs) {
    console.log("[pg-boss] delayed-follow-up", job.data);
  }
}

export async function registerWorkerHandlers() {
  const boss = await getBoss();

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

  return boss;
}
