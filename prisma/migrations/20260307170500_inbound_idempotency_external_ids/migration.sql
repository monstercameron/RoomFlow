ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "externalThreadId" TEXT;

ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "externalMessageId" TEXT,
ADD COLUMN IF NOT EXISTS "externalThreadId" TEXT;

CREATE INDEX IF NOT EXISTS "Conversation_externalThreadId_idx"
ON "Conversation"("externalThreadId");

CREATE INDEX IF NOT EXISTS "Message_externalThreadId_idx"
ON "Message"("externalThreadId");

CREATE INDEX IF NOT EXISTS "Message_channel_externalMessageId_idx"
ON "Message"("channel", "externalMessageId");
