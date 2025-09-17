-- Create conversation cache table to preserve processing progress
CREATE TABLE IF NOT EXISTS "ConversationCache" (
    "remoteJid" VARCHAR(100) NOT NULL PRIMARY KEY,
    conversation_text TEXT,
    total_messages INTEGER,
    conversation_duration_days INTEGER,
    last_customer_message_time TIMESTAMP,
    chat_name VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UPDATED_AT TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_conversation_cache_processed ON "ConversationCache"(processed_at);

-- Create the comprehensive SalesAnalysisReport table
CREATE TABLE IF NOT EXISTS "SalesAnalysisReport" (
    "remoteJid" VARCHAR(100) NOT NULL PRIMARY KEY,
    analysis_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Product Classification
    product_category VARCHAR(200),
    specific_products JSONB,
    product_models JSONB,
    quantity_mentioned INTEGER,

    -- Sales Agent Information
    primary_sales_agent VARCHAR(255),
    additional_agents JSONB,
    agent_handoff_detected BOOLEAN DEFAULT FALSE,

    -- Sales Process Status
    lead_stage VARCHAR(100), -- Inquiry, Interest, Consideration, Intent, Purchase, Closed
    next_action_required TEXT,
    sales_status VARCHAR(200),
    customer_objections JSONB,
    urgency_level VARCHAR(20), -- High, Medium, Low

    -- Customer Intelligence
    customer_name VARCHAR(255),
    customer_location VARCHAR(255),
    budget_range VARCHAR(200),
    purchase_timeline VARCHAR(200),
    decision_maker_status VARCHAR(200),

    -- Product Details
    product_specifications JSONB,
    accessories_discussed JSONB,
    warranty_service_needs TEXT,
    color_preferences JSONB,

    -- Business Intelligence
    lead_source VARCHAR(200),
    competitive_products JSONB,
    upsell_opportunities JSONB,
    customer_sentiment VARCHAR(50), -- Positive, Neutral, Negative, Frustrated
    pain_points_identified JSONB,
    pricing_discussed BOOLEAN DEFAULT FALSE,
    demo_scheduled BOOLEAN DEFAULT FALSE,
    follow_up_required BOOLEAN DEFAULT TRUE,

    -- Conversation Metadata
    total_messages INTEGER,
    conversation_duration_days INTEGER,
    last_customer_message_time TIMESTAMP,
    response_time_analysis JSONB,

    -- AI Analysis Metadata
    analysis_confidence DECIMAL(3,2),
    ai_model_used VARCHAR(50),
    processing_time_ms INTEGER,

    -- Timestamps
    CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UPDATED_AT TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance (remoteJid is already indexed as PRIMARY KEY)
CREATE INDEX IF NOT EXISTS idx_sales_analysis_category ON "SalesAnalysisReport"(product_category);
CREATE INDEX IF NOT EXISTS idx_sales_analysis_stage ON "SalesAnalysisReport"(lead_stage);
CREATE INDEX IF NOT EXISTS idx_sales_analysis_urgency ON "SalesAnalysisReport"(urgency_level);
CREATE INDEX IF NOT EXISTS idx_sales_analysis_time ON "SalesAnalysisReport"(analysis_time);

-- Update trigger for UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.UPDATED_AT = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_analysis_updated_at ON "SalesAnalysisReport";
CREATE TRIGGER update_sales_analysis_updated_at
    BEFORE UPDATE ON "SalesAnalysisReport"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_cache_updated_at ON "ConversationCache";
CREATE TRIGGER update_conversation_cache_updated_at
    BEFORE UPDATE ON "ConversationCache"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();