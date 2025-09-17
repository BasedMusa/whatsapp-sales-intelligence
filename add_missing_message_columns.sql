-- Add all missing columns to Message table in Supabase

-- Chatwoot integration columns
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootContactInboxSourceId" VARCHAR(100);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootConversationId" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootInboxId" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootIsRead" BOOLEAN;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootMessageId" INTEGER;

-- Other missing columns
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "contextInfo" JSONB;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "webhookUrl" VARCHAR(500);

-- Update existing columns to correct data types if needed
ALTER TABLE "Message" ALTER COLUMN "messageTimestamp" TYPE BIGINT USING "messageTimestamp"::BIGINT;
ALTER TABLE "Message" ALTER COLUMN "messageType" TYPE VARCHAR(100);
ALTER TABLE "Message" ALTER COLUMN "participant" TYPE VARCHAR(100);
ALTER TABLE "Message" ALTER COLUMN "pushName" TYPE VARCHAR(100);
ALTER TABLE "Message" ALTER COLUMN "status" TYPE VARCHAR(30);

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');