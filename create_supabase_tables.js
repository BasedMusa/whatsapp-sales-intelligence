#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function createTables() {
  try {
    console.log('🚀 Creating tables in Supabase using SQL commands...');

    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Since we can't execute arbitrary DDL via the client, let's check what we can do
    console.log('🔍 Testing Supabase connection and checking existing tables...');

    // Try to query system tables to see what's available
    const { data: tables, error } = await supabase
      .rpc('get_schema_tables')
      .select('*');

    if (error) {
      console.log('⚠️ Cannot access schema information via RPC');

      // Let's try a different approach - create a simple function in Supabase first
      console.log('📋 Manual schema import required:');
      console.log('='.repeat(60));
      console.log('Since Supabase REST API doesn\'t support arbitrary DDL execution,');
      console.log('you need to manually import the schema:');
      console.log('');
      console.log('1. Go to: https://cjclurjjnljsulihbgoi.supabase.co');
      console.log('2. Click "SQL Editor" in the sidebar');
      console.log('3. Copy the content from: supabase_export/supabase_schema.sql');
      console.log('4. Paste it into the SQL Editor and click "Run"');
      console.log('');
      console.log('Then come back and I\'ll run the data migration!');
      console.log('='.repeat(60));

      // Let's create a simple verification script
      await createVerificationScript();

    } else {
      console.log('✅ Connected to Supabase successfully');
      console.log('📊 Existing tables:', tables);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);

    console.log('\n📋 MANUAL IMPORT REQUIRED:');
    console.log('='.repeat(50));
    console.log('1. Open Supabase Dashboard: https://cjclurjjnljsulihbgoi.supabase.co');
    console.log('2. Go to SQL Editor (left sidebar)');
    console.log('3. Copy all content from: supabase_export/supabase_schema.sql');
    console.log('4. Paste into SQL Editor and click "Run"');
    console.log('5. Once done, run: node verify_schema.js');
    console.log('6. Then run: node migrate_data_to_supabase.js');
    console.log('='.repeat(50));
  }
}

async function createVerificationScript() {
  const verificationScript = `#!/usr/bin/env node

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
          console.error(\`❌ Table \${tableName} not found or accessible\`);
          allTablesExist = false;
        } else {
          console.log(\`✅ Table \${tableName} exists and accessible\`);
        }
      } catch (err) {
        console.error(\`❌ Error checking \${tableName}: \${err.message}\`);
        allTablesExist = false;
      }
    }

    if (allTablesExist) {
      console.log('\\n🎉 All critical tables verified!');
      console.log('✅ Ready to run data migration: node migrate_data_to_supabase.js');
    } else {
      console.log('\\n❌ Some tables are missing. Please import the schema first.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifySchema();
`;

  await require('fs').promises.writeFile('./verify_schema.js', verificationScript);
  console.log('📝 Created verification script: verify_schema.js');
}

createTables();