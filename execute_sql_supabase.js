#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

async function executeSQL() {
  try {
    console.log('🚀 Executing SQL in Supabase...');

    const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Read the schema file
    let sqlContent = await fs.readFile('./supabase_export/supabase_schema.sql', 'utf8');

    // Clean and prepare SQL
    sqlContent = sqlContent
      .replace(/-- [^\n]*\n/g, '') // Remove comments
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    console.log('📝 Prepared SQL content for execution');

    // Execute SQL using Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: sqlContent
      })
    });

    if (response.ok) {
      console.log('✅ SQL executed successfully!');

      // Verify by checking if tables exist
      console.log('🔍 Verifying table creation...');

      const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/Chat?select=id&limit=1`, {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        }
      });

      if (verifyResponse.ok) {
        console.log('✅ Tables verified - schema import successful!');
        console.log('🎉 Ready to proceed with data migration');
      } else {
        console.log('⚠️ Tables may not have been created properly');
      }

    } else {
      const errorText = await response.text();
      console.error('❌ SQL execution failed:', response.status, errorText);

      // Try alternative approach - direct table creation
      console.log('🔄 Trying alternative table creation...');
      await createTablesDirectly(supabaseUrl, serviceKey);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Manual steps required:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy content from supabase_export/supabase_schema.sql');
    console.log('3. Paste and execute in SQL Editor');
    console.log('4. Then run: node migrate_data_to_supabase.js');
  }
}

async function createTablesDirectly(supabaseUrl, serviceKey) {
  console.log('🏗️ Creating essential tables directly...');

  const essentialTables = [
    // Instance table
    `CREATE TABLE IF NOT EXISTS "Instance" (
      "id" TEXT PRIMARY KEY,
      "name" VARCHAR(255) UNIQUE NOT NULL,
      "connectionStatus" TEXT DEFAULT 'open',
      "ownerJid" VARCHAR(100),
      "number" VARCHAR(100),
      "token" VARCHAR(255),
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP
    );`,

    // Chat table
    `CREATE TABLE IF NOT EXISTS "Chat" (
      "id" TEXT PRIMARY KEY,
      "remoteJid" VARCHAR(100) NOT NULL,
      "instanceId" TEXT NOT NULL,
      "name" VARCHAR(100),
      "unreadMessages" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP,
      "labels" JSONB
    );`,

    // Contact table
    `CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT PRIMARY KEY,
      "remoteJid" VARCHAR(100) NOT NULL,
      "pushName" VARCHAR(100),
      "instanceId" TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP
    );`,

    // Message table
    `CREATE TABLE IF NOT EXISTS "Message" (
      "id" TEXT PRIMARY KEY,
      "key" JSONB NOT NULL,
      "pushName" VARCHAR(100),
      "message" JSONB,
      "messageType" TEXT NOT NULL,
      "messageTimestamp" TEXT,
      "owner" VARCHAR(100) NOT NULL,
      "source" TEXT NOT NULL,
      "instanceId" TEXT NOT NULL
    );`,

    // SalesAnalysisReport table
    `CREATE TABLE IF NOT EXISTS "SalesAnalysisReport" (
      "remoteJid" VARCHAR(100) PRIMARY KEY,
      "analysis_time" TIMESTAMP DEFAULT NOW(),
      "product_category" VARCHAR(200),
      "specific_products" JSONB,
      "lead_stage" VARCHAR(100),
      "sales_status" VARCHAR(200),
      "customer_name" VARCHAR(255),
      "analysis_confidence" DECIMAL(3,2),
      "ai_model_used" VARCHAR(50),
      "CREATED_AT" TIMESTAMP DEFAULT NOW(),
      "UPDATED_AT" TIMESTAMP DEFAULT NOW()
    );`,

    // ConversationCache table
    `CREATE TABLE IF NOT EXISTS "ConversationCache" (
      "remoteJid" VARCHAR(100) PRIMARY KEY,
      "conversation_text" TEXT,
      "total_messages" INTEGER,
      "chat_name" VARCHAR(255),
      "processed_at" TIMESTAMP DEFAULT NOW(),
      "UPDATED_AT" TIMESTAMP DEFAULT NOW()
    );`
  ];

  for (let i = 0; i < essentialTables.length; i++) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({ sql: essentialTables[i] })
      });

      if (response.ok) {
        console.log(`✅ Table ${i + 1}/${essentialTables.length} created`);
      } else {
        console.error(`❌ Table ${i + 1} failed:`, await response.text());
      }
    } catch (error) {
      console.error(`❌ Error creating table ${i + 1}:`, error.message);
    }
  }

  console.log('🎯 Essential tables creation completed');
}

executeSQL();