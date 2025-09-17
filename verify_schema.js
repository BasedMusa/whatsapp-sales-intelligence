#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function verifySchema() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔍 Verifying Supabase schema...');

    // Test each critical table
    const criticalTables = [
      'Instance', 'Chat', 'Contact', 'Message',
      'SalesAnalysisReport', 'ConversationCache'
    ];

    let allTablesExist = true;

    for (const tableName of criticalTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.error(`❌ Table ${tableName} not found or accessible:`, error.message);
          allTablesExist = false;
        } else {
          console.log(`✅ Table ${tableName} exists and accessible`);
        }
      } catch (err) {
        console.error(`❌ Error checking ${tableName}: ${err.message}`);
        allTablesExist = false;
      }
    }

    if (allTablesExist) {
      console.log('\n🎉 All critical tables verified!');
      console.log('✅ Ready to run data migration: node migrate_data_to_supabase.js');
      return true;
    } else {
      console.log('\n❌ Some tables are missing. Please import the schema first.');
      console.log('📋 Manual steps:');
      console.log('1. Go to: https://cjclurjjnljsulihbgoi.supabase.co');
      console.log('2. Open SQL Editor');
      console.log('3. Copy content from: supabase_export/supabase_schema.sql');
      console.log('4. Paste and run in SQL Editor');
      return false;
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

verifySchema();