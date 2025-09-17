#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function checkMigrationStatus() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔍 Checking migration status...');

    const tables = [
      'Instance', 'Chat', 'Contact', 'Message', 'IsOnWhatsapp',
      'ConversationCache', 'SalesAnalysisReport', 'AppleAnalysisReport'
    ];

    for (const tableName of tables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ ${tableName}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: ${count?.toLocaleString() || 0} records`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }

    console.log('\n📊 Migration Progress Summary');
    console.log('Expected totals:');
    console.log('  Instance: 1 records');
    console.log('  Chat: 17,709 records');
    console.log('  Contact: 1,315 records');
    console.log('  Message: 167,467 records');
    console.log('  SalesAnalysisReport: 16,164 records');
    console.log('  ConversationCache: 16,164 records');

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  }
}

checkMigrationStatus();