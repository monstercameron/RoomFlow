CREATE TYPE "ScreeningProvider" AS ENUM ('CHECKR', 'TRANSUNION', 'ZUMPER');

CREATE TYPE "ScreeningConnectionAuthState" AS ENUM ('DISCONNECTED', 'CONFIGURED', 'ACTIVE', 'ERROR');

CREATE TYPE "ScreeningChargeMode" AS ENUM ('APPLICANT_PAY', 'LANDLORD_PAY', 'PASS_THROUGH');

CREATE TYPE "ScreeningRequestStatus" AS ENUM (
  'REQUESTED',
  'INVITE_SENT',
  'CONSENT_COMPLETED',
  'IN_PROGRESS',
  'COMPLETED',
  'REVIEWED',
  'ADVERSE_ACTION_RECORDED'
);

CREATE TABLE "ScreeningProviderConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" "ScreeningProvider" NOT NULL,
  "authState" "ScreeningConnectionAuthState" NOT NULL DEFAULT 'DISCONNECTED',
  "connectedAccount" TEXT,
  "defaultPackageKey" TEXT,
  "defaultPackageLabel" TEXT,
  "packageConfig" JSONB,
  "chargeMode" "ScreeningChargeMode" NOT NULL DEFAULT 'PASS_THROUGH',
  "allowedLaunchRoles" "MembershipRole"[] NOT NULL DEFAULT ARRAY['OWNER'::"MembershipRole", 'ADMIN'::"MembershipRole", 'MANAGER'::"MembershipRole"],
  "disclosureStrategy" TEXT,
  "lastAuthorizedAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScreeningProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningRequest" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "propertyId" TEXT,
  "screeningProviderConnectionId" TEXT NOT NULL,
  "status" "ScreeningRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "packageKey" TEXT NOT NULL,
  "packageLabel" TEXT NOT NULL,
  "chargeMode" "ScreeningChargeMode" NOT NULL DEFAULT 'PASS_THROUGH',
  "providerApplicantId" TEXT,
  "providerInvitationId" TEXT,
  "providerReportId" TEXT,
  "providerReportUrl" TEXT,
  "providerReference" TEXT,
  "providerUpdatedAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "inviteSentAt" TIMESTAMP(3),
  "consentCompletedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "adverseActionRecordedAt" TIMESTAMP(3),
  "chargeAmountCents" INTEGER,
  "chargeCurrency" TEXT,
  "chargeReference" TEXT,
  "reviewNotes" TEXT,
  "adverseActionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScreeningRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningStatusEvent" (
  "id" TEXT NOT NULL,
  "screeningRequestId" TEXT NOT NULL,
  "status" "ScreeningRequestStatus" NOT NULL,
  "detail" TEXT,
  "providerTimestamp" TIMESTAMP(3),
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScreeningStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningConsentRecord" (
  "id" TEXT NOT NULL,
  "screeningRequestId" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT,
  "disclosureVersion" TEXT,
  "providerReference" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScreeningConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningAttachmentReference" (
  "id" TEXT NOT NULL,
  "screeningRequestId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "externalId" TEXT,
  "url" TEXT,
  "contentType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScreeningAttachmentReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScreeningProviderConnection_workspaceId_provider_key" ON "ScreeningProviderConnection"("workspaceId", "provider");
CREATE INDEX "ScreeningProviderConnection_workspaceId_authState_idx" ON "ScreeningProviderConnection"("workspaceId", "authState");
CREATE INDEX "ScreeningRequest_workspaceId_status_createdAt_idx" ON "ScreeningRequest"("workspaceId", "status", "createdAt");
CREATE INDEX "ScreeningRequest_leadId_createdAt_idx" ON "ScreeningRequest"("leadId", "createdAt");
CREATE INDEX "ScreeningRequest_screeningProviderConnectionId_createdAt_idx" ON "ScreeningRequest"("screeningProviderConnectionId", "createdAt");
CREATE INDEX "ScreeningStatusEvent_screeningRequestId_createdAt_idx" ON "ScreeningStatusEvent"("screeningRequestId", "createdAt");
CREATE INDEX "ScreeningConsentRecord_screeningRequestId_createdAt_idx" ON "ScreeningConsentRecord"("screeningRequestId", "createdAt");
CREATE INDEX "ScreeningAttachmentReference_screeningRequestId_createdAt_idx" ON "ScreeningAttachmentReference"("screeningRequestId", "createdAt");

ALTER TABLE "ScreeningProviderConnection"
ADD CONSTRAINT "ScreeningProviderConnection_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningRequest"
ADD CONSTRAINT "ScreeningRequest_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningRequest"
ADD CONSTRAINT "ScreeningRequest_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningRequest"
ADD CONSTRAINT "ScreeningRequest_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScreeningRequest"
ADD CONSTRAINT "ScreeningRequest_screeningProviderConnectionId_fkey"
FOREIGN KEY ("screeningProviderConnectionId") REFERENCES "ScreeningProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningStatusEvent"
ADD CONSTRAINT "ScreeningStatusEvent_screeningRequestId_fkey"
FOREIGN KEY ("screeningRequestId") REFERENCES "ScreeningRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningConsentRecord"
ADD CONSTRAINT "ScreeningConsentRecord_screeningRequestId_fkey"
FOREIGN KEY ("screeningRequestId") REFERENCES "ScreeningRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningAttachmentReference"
ADD CONSTRAINT "ScreeningAttachmentReference_screeningRequestId_fkey"
FOREIGN KEY ("screeningRequestId") REFERENCES "ScreeningRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;