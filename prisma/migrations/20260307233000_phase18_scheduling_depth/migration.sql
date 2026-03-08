CREATE TYPE "CalendarSyncProvider" AS ENUM ('GOOGLE', 'OUTLOOK');

CREATE TYPE "CalendarSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

CREATE TYPE "TourSchedulingMode" AS ENUM ('DIRECT', 'TEAM_MANUAL', 'ROUND_ROBIN');

ALTER TYPE "TourEventStatus" ADD VALUE 'NO_SHOW';

ALTER TABLE "Workspace"
ADD COLUMN "calendarConnections" JSONB,
ADD COLUMN "tourSchedulingMode" "TourSchedulingMode" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "tourReminderSequence" JSONB;

ALTER TABLE "Membership"
ADD COLUMN "sharedTourCoverageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastTourAssignedAt" TIMESTAMP(3);

ALTER TABLE "TourEvent"
ADD COLUMN "assignedMembershipId" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "operatorCancelReason" TEXT,
ADD COLUMN "operatorRescheduleReason" TEXT,
ADD COLUMN "operatorNoShowReason" TEXT,
ADD COLUMN "calendarSyncProvider" "CalendarSyncProvider",
ADD COLUMN "calendarSyncStatus" "CalendarSyncStatus",
ADD COLUMN "calendarSyncedAt" TIMESTAMP(3),
ADD COLUMN "calendarSyncError" TEXT,
ADD COLUMN "prospectNotificationSentAt" TIMESTAMP(3),
ADD COLUMN "reminderSequenceState" JSONB;

CREATE INDEX "TourEvent_assignedMembershipId_createdAt_idx" ON "TourEvent"("assignedMembershipId", "createdAt");

ALTER TABLE "TourEvent"
ADD CONSTRAINT "TourEvent_assignedMembershipId_fkey"
FOREIGN KEY ("assignedMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;