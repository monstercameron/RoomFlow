CREATE TYPE "WorkspacePlanType" AS ENUM ('PERSONAL', 'ORG');

CREATE TYPE "WorkspacePlanStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

CREATE TYPE "WorkspaceCapability" AS ENUM (
  'CORE_CRM',
  'PROPERTY_PIPELINE',
  'MESSAGING',
  'INTEGRATIONS',
  'ORG_MEMBERS',
  'ADVANCED_AUTOMATIONS',
  'ADVANCED_ANALYTICS',
  'AI_ASSIST',
  'SCREENING',
  'CALENDAR_SYNC'
);

ALTER TABLE "Workspace"
ADD COLUMN "planType" "WorkspacePlanType" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN "planStatus" "WorkspacePlanStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN "billingOwnerUserId" TEXT,
ADD COLUMN "enabledCapabilities" "WorkspaceCapability"[] NOT NULL DEFAULT ARRAY['CORE_CRM', 'PROPERTY_PIPELINE', 'MESSAGING', 'INTEGRATIONS']::"WorkspaceCapability"[];

UPDATE "Workspace" AS workspace
SET "billingOwnerUserId" = billing_membership."userId"
FROM (
  SELECT DISTINCT ON (membership."workspaceId")
    membership."workspaceId",
    membership."userId"
  FROM "Membership" AS membership
  ORDER BY membership."workspaceId", CASE WHEN membership."role" = 'OWNER' THEN 0 ELSE 1 END, membership."createdAt" ASC
) AS billing_membership
WHERE workspace."id" = billing_membership."workspaceId"
  AND workspace."billingOwnerUserId" IS NULL;

ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_billingOwnerUserId_fkey"
FOREIGN KEY ("billingOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Workspace_billingOwnerUserId_idx" ON "Workspace"("billingOwnerUserId");