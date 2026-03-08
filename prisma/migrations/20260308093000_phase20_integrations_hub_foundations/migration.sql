CREATE TYPE "IntegrationCategory" AS ENUM (
  'LEAD_SOURCE',
  'MESSAGING',
  'CALENDAR',
  'SCREENING',
  'CRM_WORKFLOW',
  'FILE_STORAGE'
);

CREATE TYPE "IntegrationProvider" AS ENUM (
  'RESEND',
  'TWILIO',
  'GOOGLE_CALENDAR',
  'OUTLOOK_CALENDAR',
  'CHECKR',
  'TRANSUNION',
  'ZUMPER',
  'GENERIC_INBOUND_WEBHOOK',
  'CSV_IMPORT',
  'CSV_EXPORT',
  'META_LEAD_ADS',
  'WHATSAPP',
  'INSTAGRAM',
  'ZILLOW',
  'APARTMENTS_COM',
  'SLACK',
  'OUTBOUND_WEBHOOK',
  'S3_COMPATIBLE'
);

CREATE TYPE "IntegrationAuthState" AS ENUM (
  'NOT_CONNECTED',
  'CONFIGURED',
  'ACTIVE',
  'ERROR'
);

CREATE TYPE "IntegrationHealthState" AS ENUM (
  'UNKNOWN',
  'HEALTHY',
  'DEGRADED',
  'ERROR'
);

CREATE TYPE "IntegrationSyncStatus" AS ENUM (
  'IDLE',
  'PENDING',
  'SUCCESS',
  'FAILED'
);

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "category" "IntegrationCategory" NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "displayName" TEXT NOT NULL,
  "authState" "IntegrationAuthState" NOT NULL DEFAULT 'NOT_CONNECTED',
  "healthState" "IntegrationHealthState" NOT NULL DEFAULT 'UNKNOWN',
  "syncStatus" "IntegrationSyncStatus" NOT NULL DEFAULT 'IDLE',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "mappingConfig" JSONB,
  "healthMessage" TEXT,
  "lastAuthorizedAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncMessage" TEXT,
  "lastHealthCheckAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationSyncEvent" (
  "id" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "status" "IntegrationSyncStatus" NOT NULL,
  "direction" TEXT,
  "summary" TEXT NOT NULL,
  "detail" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_workspaceId_provider_key" ON "IntegrationConnection"("workspaceId", "provider");
CREATE INDEX "IntegrationConnection_workspaceId_category_healthState_idx" ON "IntegrationConnection"("workspaceId", "category", "healthState");
CREATE INDEX "IntegrationConnection_workspaceId_syncStatus_lastSyncAt_idx" ON "IntegrationConnection"("workspaceId", "syncStatus", "lastSyncAt");
CREATE INDEX "IntegrationSyncEvent_integrationConnectionId_createdAt_idx" ON "IntegrationSyncEvent"("integrationConnectionId", "createdAt");

ALTER TABLE "IntegrationConnection"
ADD CONSTRAINT "IntegrationConnection_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncEvent"
ADD CONSTRAINT "IntegrationSyncEvent_integrationConnectionId_fkey"
FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
