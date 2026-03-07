DO $$
BEGIN
  BEGIN
    CREATE TYPE "DeclineReason" AS ENUM (
      'RULE_MISMATCH',
      'MISSING_INFO',
      'OPERATOR_DECISION',
      'NO_AVAILABILITY',
      'UNRESPONSIVE',
      'DUPLICATE',
      'WITHDREW'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "RuleCategory" AS ENUM (
      'SMOKING',
      'PETS',
      'GUESTS',
      'BATHROOM_SHARING',
      'PARKING',
      'MINIMUM_STAY',
      'WORK_SCHEDULE',
      'ACKNOWLEDGMENT',
      'GENERAL'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "RuleMode" AS ENUM (
      'BLOCKING',
      'WARNING_ONLY',
      'INFORMATIONAL'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "TourEventStatus" AS ENUM (
      'SCHEDULED',
      'COMPLETED',
      'CANCELED',
      'RESCHEDULED'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "NotificationType" AS ENUM (
      'NEW_LEAD',
      'CAUTION_REVIEW',
      'MISMATCH_REVIEW',
      'STALE_LEAD',
      'TOUR_SCHEDULED',
      'APPLICATION_INVITE_STALE'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "WebhookDeliveryStatus" AS ENUM (
      'PENDING',
      'DELIVERED',
      'FAILED',
      'DEAD_LETTER'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE "AuditActorType" AS ENUM (
      'SYSTEM',
      'USER'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "channelPriority" JSONB,
ADD COLUMN IF NOT EXISTS "dailyAutomatedSendCap" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "webhookSigningSecret" TEXT;

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "channelPriority" JSONB,
ADD COLUMN IF NOT EXISTS "schedulingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "declineReason" "DeclineReason",
ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isSoftDeclined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "optOutAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "optOutReason" TEXT,
ADD COLUMN IF NOT EXISTS "isStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "staleAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "staleReason" TEXT,
ADD COLUMN IF NOT EXISTS "staleAutoArchiveBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "applicationInviteSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "applicationInviteChannel" "MessageChannel",
ADD COLUMN IF NOT EXISTS "automatedSendCountDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "automatedSendCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "stateSignature" TEXT,
ADD COLUMN IF NOT EXISTS "renderedSnapshot" JSONB;

ALTER TABLE "PropertyRule"
ADD COLUMN IF NOT EXISTS "ruleCategory" "RuleCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN IF NOT EXISTS "mode" "RuleMode" NOT NULL DEFAULT 'BLOCKING',
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AuditEvent"
ADD COLUMN IF NOT EXISTS "actorType" "AuditActorType" NOT NULL DEFAULT 'SYSTEM';

CREATE TABLE IF NOT EXISTS "TourEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "propertyId" TEXT,
  "status" "TourEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "externalCalendarId" TEXT,
  "previousTourEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TourEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OutboundWebhookDelivery" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "eventType" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "signature" TEXT,
  "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "deadLetteredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceUsageSnapshot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "activeProperties" INTEGER NOT NULL,
  "monthlyLeads" INTEGER NOT NULL,
  "automationSends" INTEGER NOT NULL,
  "seats" INTEGER NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceUsageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceUsageSnapshot_workspaceId_snapshotDate_key"
ON "WorkspaceUsageSnapshot"("workspaceId", "snapshotDate");

CREATE INDEX IF NOT EXISTS "Message_stateSignature_idx"
ON "Message"("stateSignature");

CREATE INDEX IF NOT EXISTS "TourEvent_workspaceId_status_createdAt_idx"
ON "TourEvent"("workspaceId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "TourEvent_leadId_createdAt_idx"
ON "TourEvent"("leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "TourEvent_propertyId_createdAt_idx"
ON "TourEvent"("propertyId", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationEvent_workspaceId_createdAt_idx"
ON "NotificationEvent"("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationEvent_workspaceId_type_createdAt_idx"
ON "NotificationEvent"("workspaceId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationEvent_leadId_createdAt_idx"
ON "NotificationEvent"("leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "OutboundWebhookDelivery_workspaceId_status_nextAttemptAt_idx"
ON "OutboundWebhookDelivery"("workspaceId", "status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "OutboundWebhookDelivery_leadId_createdAt_idx"
ON "OutboundWebhookDelivery"("leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkspaceUsageSnapshot_workspaceId_createdAt_idx"
ON "WorkspaceUsageSnapshot"("workspaceId", "createdAt");

DO $$
BEGIN
  BEGIN
    ALTER TABLE "TourEvent"
      ADD CONSTRAINT "TourEvent_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "TourEvent"
      ADD CONSTRAINT "TourEvent_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "TourEvent"
      ADD CONSTRAINT "TourEvent_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "NotificationEvent"
      ADD CONSTRAINT "NotificationEvent_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "NotificationEvent"
      ADD CONSTRAINT "NotificationEvent_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "OutboundWebhookDelivery"
      ADD CONSTRAINT "OutboundWebhookDelivery_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "OutboundWebhookDelivery"
      ADD CONSTRAINT "OutboundWebhookDelivery_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE "WorkspaceUsageSnapshot"
      ADD CONSTRAINT "WorkspaceUsageSnapshot_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
