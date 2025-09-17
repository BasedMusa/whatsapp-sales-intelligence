-- Fix Message table constraints for successful migration

-- Remove NOT NULL constraint from owner column (some messages don't have owner)
ALTER TABLE "Message" ALTER COLUMN "owner" DROP NOT NULL;

-- Remove NOT NULL constraint from source column as well
ALTER TABLE "Message" ALTER COLUMN "source" DROP NOT NULL;

-- Add default values for required fields to handle null cases
ALTER TABLE "Message" ALTER COLUMN "owner" SET DEFAULT 'unknown';
ALTER TABLE "Message" ALTER COLUMN "source" SET DEFAULT 'unknown';

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');