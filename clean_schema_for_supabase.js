#!/usr/bin/env node

import fs from 'fs/promises';

async function cleanSchema() {
  try {
    console.log('🧹 Cleaning schema.sql for Supabase import...');

    const schemaContent = await fs.readFile('./supabase_export/schema.sql', 'utf8');

    // Clean up the escaped newlines and fix formatting
    let cleanedSchema = schemaContent
      .replace(/\\n/g, '\n')  // Fix escaped newlines
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive blank lines
      .replace(/-- Index: /g, '\n-- Index: ')  // Better index formatting
      .replace(/DEFAULT 'open'::"InstanceConnectionStatus"/g, "DEFAULT 'open'")  // Fix enum defaults
      .replace(/::"[^"]*"/g, '')  // Remove type casts
      .replace(/TEXT NOT NULL DEFAULT 'open'/g, "TEXT DEFAULT 'open'");  // Fix invalid syntax

    // Add proper header
    const header = `-- Evolution API + Analysis System Schema
-- Migrated to Supabase: ${new Date().toISOString()}
-- Run this in Supabase SQL Editor

`;

    cleanedSchema = header + cleanedSchema;

    await fs.writeFile('./supabase_export/supabase_schema.sql', cleanedSchema);

    console.log('✅ Cleaned schema saved as supabase_schema.sql');
    console.log('📋 Next steps:');
    console.log('   1. Open Supabase SQL Editor');
    console.log('   2. Copy and paste supabase_schema.sql content');
    console.log('   3. Run the SQL to create all tables');
    console.log('   4. Come back here to run data migration');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanSchema();