#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

class SupabaseSchemaCreator {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_PROJECT_URL;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.apiUrl = `${this.supabaseUrl}/rest/v1/rpc/exec`;
  }

  async executeSQL(sql) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  async createCoreTables() {
    console.log('🏗️ Creating core Evolution API tables...');

    const coreTableSQL = `
-- Core Evolution API Tables

CREATE TABLE IF NOT EXISTS "Instance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "connectionStatus" TEXT DEFAULT 'open',
  "ownerJid" VARCHAR(100),
  "profilePicUrl" VARCHAR(500),
  "integration" VARCHAR(100),
  "number" VARCHAR(100),
  "token" VARCHAR(255),
  "clientName" VARCHAR(100),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP,
  "profileName" VARCHAR(100),
  "businessId" VARCHAR(100),
  "disconnectionAt" TIMESTAMP,
  "disconnectionObject" JSONB,
  "disconnectionReasonCode" INTEGER
);

CREATE TABLE IF NOT EXISTS "Chat" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "remoteJid" VARCHAR(100) NOT NULL,
  "labels" JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP,
  "instanceId" TEXT NOT NULL,
  "name" VARCHAR(100),
  "unreadMessages" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "Chat_instanceId_idx" ON "Chat" ("instanceId");
CREATE INDEX IF NOT EXISTS "Chat_remoteJid_idx" ON "Chat" ("remoteJid");

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "remoteJid" VARCHAR(100) NOT NULL,
  "pushName" VARCHAR(100),
  "profilePicUrl" VARCHAR(500),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP,
  "instanceId" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Contact_remoteJid_instanceId_key" ON "Contact" ("remoteJid", "instanceId");
CREATE INDEX IF NOT EXISTS "Contact_remoteJid_idx" ON "Contact" ("remoteJid");
CREATE INDEX IF NOT EXISTS "Contact_instanceId_idx" ON "Contact" ("instanceId");
`;

    try {
      await this.executeSQL(coreTableSQL);
      console.log('✅ Core tables created successfully');
    } catch (error) {
      console.error('❌ Error creating core tables:', error.message);
    }
  }

  async createMessageTables() {
    console.log('📧 Creating message-related tables...');

    const messageTableSQL = `
-- Message Tables

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" JSONB NOT NULL,
  "pushName" VARCHAR(100),
  "message" JSONB,
  "messageType" TEXT NOT NULL,
  "messageTimestamp" TEXT,
  "owner" VARCHAR(100) NOT NULL,
  "source" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "quotedMsgId" VARCHAR(100),
  "status" TEXT,
  "chatId" TEXT,
  "remoteJid" VARCHAR(100),
  "participant" VARCHAR(100),
  "dataMessage" JSONB
);

CREATE TABLE IF NOT EXISTS "MessageUpdate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "remoteJid" VARCHAR(100) NOT NULL,
  "fromMe" BOOLEAN NOT NULL,
  "participant" VARCHAR(100),
  "updatedMessageId" VARCHAR(100) NOT NULL,
  "status" TEXT NOT NULL,
  "messageTimestamp" TEXT,
  "instanceId" TEXT NOT NULL,
  "chatId" TEXT
);

CREATE TABLE IF NOT EXISTS "Media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fileName" VARCHAR(500),
  "type" VARCHAR(100),
  "mimetype" VARCHAR(100),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "messageId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL
);
`;

    try {
      await this.executeSQL(messageTableSQL);
      console.log('✅ Message tables created successfully');
    } catch (error) {
      console.error('❌ Error creating message tables:', error.message);
    }
  }

  async createAnalysisTables() {
    console.log('📊 Creating analysis tables...');

    const analysisTableSQL = `
-- Analysis Tables

CREATE TABLE IF NOT EXISTS "SalesAnalysisReport" (
  "remoteJid" VARCHAR(100) NOT NULL PRIMARY KEY,
  "analysis_time" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "product_category" VARCHAR(200),
  "specific_products" JSONB,
  "product_models" JSONB,
  "quantity_mentioned" INTEGER,
  "primary_sales_agent" VARCHAR(255),
  "additional_agents" JSONB,
  "agent_handoff_detected" BOOLEAN DEFAULT FALSE,
  "lead_stage" VARCHAR(100),
  "next_action_required" TEXT,
  "sales_status" VARCHAR(200),
  "customer_objections" JSONB,
  "urgency_level" VARCHAR(20),
  "customer_name" VARCHAR(255),
  "customer_location" VARCHAR(255),
  "budget_range" VARCHAR(200),
  "purchase_timeline" VARCHAR(200),
  "decision_maker_status" VARCHAR(200),
  "product_specifications" JSONB,
  "accessories_discussed" JSONB,
  "warranty_service_needs" TEXT,
  "color_preferences" JSONB,
  "lead_source" VARCHAR(200),
  "competitive_products" JSONB,
  "upsell_opportunities" JSONB,
  "customer_sentiment" VARCHAR(50),
  "pain_points_identified" JSONB,
  "pricing_discussed" BOOLEAN DEFAULT FALSE,
  "demo_scheduled" BOOLEAN DEFAULT FALSE,
  "follow_up_required" BOOLEAN DEFAULT TRUE,
  "total_messages" INTEGER,
  "conversation_duration_days" INTEGER,
  "last_customer_message_time" TIMESTAMP,
  "response_time_analysis" JSONB,
  "analysis_confidence" DECIMAL(3,2),
  "ai_model_used" VARCHAR(50),
  "processing_time_ms" INTEGER,
  "CREATED_AT" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "UPDATED_AT" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_sales_analysis_category" ON "SalesAnalysisReport"("product_category");
CREATE INDEX IF NOT EXISTS "idx_sales_analysis_stage" ON "SalesAnalysisReport"("lead_stage");
CREATE INDEX IF NOT EXISTS "idx_sales_analysis_urgency" ON "SalesAnalysisReport"("urgency_level");
CREATE INDEX IF NOT EXISTS "idx_sales_analysis_time" ON "SalesAnalysisReport"("analysis_time");

CREATE TABLE IF NOT EXISTS "ConversationCache" (
  "remoteJid" VARCHAR(100) NOT NULL PRIMARY KEY,
  "conversation_text" TEXT,
  "total_messages" INTEGER,
  "conversation_duration_days" INTEGER,
  "last_customer_message_time" TIMESTAMP,
  "chat_name" VARCHAR(255),
  "processed_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "UPDATED_AT" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_conversation_cache_processed" ON "ConversationCache"("processed_at");

CREATE TABLE IF NOT EXISTS "AppleAnalysisReport" (
  "remoteJid" TEXT NOT NULL PRIMARY KEY,
  "chat_product_category" TEXT NOT NULL,
  "analysis_time" TIMESTAMP NOT NULL
);
`;

    try {
      await this.executeSQL(analysisTableSQL);
      console.log('✅ Analysis tables created successfully');
    } catch (error) {
      console.error('❌ Error creating analysis tables:', error.message);
    }
  }

  async createOtherTables() {
    console.log('🔧 Creating other Evolution tables...');

    const otherTablesSQL = `
-- Other Evolution API Tables

CREATE TABLE IF NOT EXISTS "IsOnWhatsapp" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "remoteJid" VARCHAR(100) NOT NULL UNIQUE,
  "jidOptions" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL,
  "lid" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "Label" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "color" VARCHAR(10) NOT NULL,
  "predefinedId" VARCHAR(100),
  "instanceId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" VARCHAR(255) NOT NULL,
  "creds" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL,
  "instanceId" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "Setting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rejectCall" BOOLEAN DEFAULT false,
  "msgCall" VARCHAR(100),
  "groupsIgnore" BOOLEAN DEFAULT true,
  "alwaysOnline" BOOLEAN DEFAULT false,
  "readMessages" BOOLEAN DEFAULT false,
  "syncFullHistory" BOOLEAN DEFAULT false,
  "readStatus" BOOLEAN DEFAULT false,
  "instanceId" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMP WITH TIME ZONE,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMP WITH TIME ZONE,
  "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`;

    try {
      await this.executeSQL(otherTablesSQL);
      console.log('✅ Other tables created successfully');
    } catch (error) {
      console.error('❌ Error creating other tables:', error.message);
    }
  }

  async createTriggers() {
    console.log('⚡ Creating triggers and functions...');

    const triggersSQL = `
-- Triggers and Functions

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UPDATED_AT" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_sales_analysis_updated_at
    BEFORE UPDATE ON "SalesAnalysisReport"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_conversation_cache_updated_at
    BEFORE UPDATE ON "ConversationCache"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

    try {
      await this.executeSQL(triggersSQL);
      console.log('✅ Triggers created successfully');
    } catch (error) {
      console.error('❌ Error creating triggers:', error.message);
    }
  }

  async createAllTables() {
    try {
      console.log('🚀 Starting Supabase schema creation...');
      console.log('='.repeat(60));

      await this.createCoreTables();
      await this.createMessageTables();
      await this.createAnalysisTables();
      await this.createOtherTables();
      await this.createTriggers();

      console.log('\n✅ All tables created successfully!');
      console.log('🔗 Check your Supabase dashboard to verify tables');

    } catch (error) {
      console.error('❌ Schema creation failed:', error.message);
      throw error;
    }
  }
}

// Execute schema creation
async function main() {
  const creator = new SupabaseSchemaCreator();
  try {
    await creator.createAllTables();
    console.log('\n🎉 Schema creation completed! Ready for data migration.');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Schema creation failed:', error.message);
    process.exit(1);
  }
}

main();