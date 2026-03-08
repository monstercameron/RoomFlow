CREATE TYPE "PropertyListingSyncStatus" AS ENUM ('HEALTHY', 'PENDING', 'FAILED', 'OUT_OF_DATE');

ALTER TABLE "Property"
ADD COLUMN "listingSyncStatus" "PropertyListingSyncStatus",
ADD COLUMN "listingSyncMessage" TEXT,
ADD COLUMN "listingSyncUpdatedAt" TIMESTAMP(3);