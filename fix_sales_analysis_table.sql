-- Fix SalesAnalysisReport table to match source schema exactly

-- Add missing lowercase timestamp columns
ALTER TABLE "SalesAnalysisReport" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE "SalesAnalysisReport" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing response_time_analysis column
ALTER TABLE "SalesAnalysisReport" ADD COLUMN IF NOT EXISTS "response_time_analysis" JSONB;

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');