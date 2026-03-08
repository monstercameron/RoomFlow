CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

ALTER TABLE "Workspace"
ADD COLUMN "leadResponseSlaMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "leadReviewSlaMinutes" INTEGER NOT NULL DEFAULT 240;

ALTER TABLE "Lead"
ADD COLUMN "assignedMembershipId" TEXT;

CREATE TABLE "MembershipPropertyScope" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MembershipPropertyScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "propertyId" TEXT,
  "assignedMembershipId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipPropertyScope_membershipId_propertyId_key" ON "MembershipPropertyScope"("membershipId", "propertyId");
CREATE INDEX "MembershipPropertyScope_propertyId_membershipId_idx" ON "MembershipPropertyScope"("propertyId", "membershipId");
CREATE INDEX "Lead_assignedMembershipId_status_idx" ON "Lead"("assignedMembershipId", "status");
CREATE INDEX "Task_workspaceId_status_createdAt_idx" ON "Task"("workspaceId", "status", "createdAt");
CREATE INDEX "Task_assignedMembershipId_status_dueAt_idx" ON "Task"("assignedMembershipId", "status", "dueAt");
CREATE INDEX "Task_leadId_createdAt_idx" ON "Task"("leadId", "createdAt");
CREATE INDEX "Task_propertyId_createdAt_idx" ON "Task"("propertyId", "createdAt");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_assignedMembershipId_fkey"
FOREIGN KEY ("assignedMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipPropertyScope"
ADD CONSTRAINT "MembershipPropertyScope_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipPropertyScope"
ADD CONSTRAINT "MembershipPropertyScope_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assignedMembershipId_fkey"
FOREIGN KEY ("assignedMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
