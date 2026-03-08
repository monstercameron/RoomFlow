CREATE TYPE "PropertyLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

ALTER TABLE "Property"
ADD COLUMN "lifecycleStatus" "PropertyLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';