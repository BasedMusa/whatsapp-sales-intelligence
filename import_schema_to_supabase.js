#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

dotenv.config();

async function importSchema() {
  try {
    console.log('🚀 Importing schema to Supabase...');

    // Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Read the schema file
    const schemaContent = await fs.readFile('./supabase_export/supabase_schema.sql', 'utf8');

    console.log('📋 Schema file loaded, executing SQL...');

    // Execute the schema SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: schemaContent
    });

    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution
      console.log('📝 Trying direct SQL execution...');

      // Split schema into individual statements
      const statements = schemaContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`📊 Found ${statements.length} SQL statements to execute`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length < 10) continue; // Skip very short statements

        try {
          console.log(`  📝 Executing statement ${i + 1}/${statements.length}...`);

          const { error: stmtError } = await supabase
            .from('pg_stat_activity') // Use any system table to execute raw SQL
            .select('*')
            .limit(0);

          // Since we can't execute arbitrary SQL via the client, we'll need to use the REST API
          const response = await fetch(`${process.env.SUPABASE_PROJECT_URL}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ sql: statement })
          });

          if (response.ok) {
            successCount++;
          } else {
            console.error(`❌ Statement failed: ${statement.substring(0, 50)}...`);
            errorCount++;
          }

        } catch (stmtError) {
          console.error(`❌ Error executing statement: ${stmtError.message}`);
          errorCount++;
        }
      }

      console.log(`✅ Schema import completed: ${successCount} success, ${errorCount} failed`);

    } else {
      console.log('✅ Schema imported successfully via exec_sql');
    }

    // Verify tables were created
    console.log('🔍 Verifying tables were created...');

    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (!tablesError && tables) {
      console.log(`📊 Found ${tables.length} tables in Supabase:`);
      tables.forEach(table => console.log(`  📋 ${table.table_name}`));
    }

    console.log('🎉 Schema import process completed!');

  } catch (error) {
    console.error('❌ Schema import failed:', error.message);
    console.log('\n📋 Manual Import Instructions:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy content from supabase_export/supabase_schema.sql');
    console.log('3. Paste and run in SQL Editor');
    console.log('4. Then run: node migrate_data_to_supabase.js');
  }
}

importSchema();