DO $$
BEGIN
  BEGIN
    CREATE TYPE "MessageOrigin" AS ENUM (
      'INBOUND',
      'OUTBOUND_MANUAL',
      'OUTBOUND_AUTOMATED',
      'SYSTEM_NOTICE'
    );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "origin" "MessageOrigin" NOT NULL DEFAULT 'SYSTEM_NOTICE';
