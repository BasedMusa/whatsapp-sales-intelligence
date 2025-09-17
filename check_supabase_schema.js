#!/usr/bin/env node

import { supabase } from './src/config/supabase.js';

async function checkSupabaseSchema() {
  try {
    console.log('🔍 Checking SalesAnalysisReport schema in Supabase...');

    // Get a sample record to see available columns
    const { data, error } = await supabase
      .from('SalesAnalysisReport')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n📋 Available columns in SalesAnalysisReport:');
      const columns = Object.keys(data[0]);
      columns.forEach((col, i) => {
        console.log(`  ${i+1}. ${col}`);
      });

      console.log('\n📄 Sample record:');
      const sample = data[0];
      console.log(`  Customer: ${sample.customer_name || 'N/A'}`);
      console.log(`  Remote JID: ${sample.remoteJid}`);
      console.log(`  Analysis Date: ${sample.analysis_date || 'N/A'}`);
      console.log(`  Products Count: ${sample.products_count || 'N/A'}`);
    } else {
      console.log('❌ No data found in SalesAnalysisReport');
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

checkSupabaseSchema();