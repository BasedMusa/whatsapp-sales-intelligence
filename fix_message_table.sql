-- Fix Message table to include missing columns
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatwootContactInboxSourceId" VARCHAR(100);

-- Refresh the schema cache
SELECT pg_notify('pgrst', 'reload schema');