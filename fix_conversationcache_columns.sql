-- Fix ConversationCache table missing columns

-- Add missing updated_at column (in source it's lowercase)
ALTER TABLE "ConversationCache" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');