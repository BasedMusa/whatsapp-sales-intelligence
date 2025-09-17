-- Update column lengths to handle longer AI-generated content
ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN product_category TYPE VARCHAR(200);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN lead_stage TYPE VARCHAR(100);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN sales_status TYPE VARCHAR(200);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN budget_range TYPE VARCHAR(200);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN purchase_timeline TYPE VARCHAR(200);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN decision_maker_status TYPE VARCHAR(200);

ALTER TABLE "SalesAnalysisReport"
ALTER COLUMN lead_source TYPE VARCHAR(200);