#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

async function checkSalesAnalysisSchema() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    console.log('🔍 Checking SalesAnalysisReport schema differences...');

    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'SalesAnalysisReport'
      ORDER BY column_name
    `);

    console.log('\nSource SalesAnalysisReport columns:');
    result.rows.forEach(row => {
      const { column_name, data_type, character_maximum_length, is_nullable } = row;
      let dataType = data_type;

      if (data_type === 'character varying' && character_maximum_length) {
        dataType = `VARCHAR(${character_maximum_length})`;
      } else if (data_type === 'character varying') {
        dataType = 'TEXT';
      } else if (data_type === 'jsonb') {
        dataType = 'JSONB';
      } else if (data_type === 'text') {
        dataType = 'TEXT';
      } else if (data_type === 'boolean') {
        dataType = 'BOOLEAN';
      } else if (data_type === 'numeric') {
        dataType = 'DECIMAL(3,2)';
      } else if (data_type === 'integer') {
        dataType = 'INTEGER';
      } else if (data_type === 'timestamp with time zone') {
        dataType = 'TIMESTAMP WITH TIME ZONE';
      } else if (data_type === 'timestamp without time zone') {
        dataType = 'TIMESTAMP';
      }

      const nullable = is_nullable === 'YES' ? '' : ' NOT NULL';
      console.log(`  "${column_name}": ${dataType}${nullable}`);
    });

    // Get a sample record to see the actual data structure
    console.log('\n🔍 Sample record structure:');
    const sampleResult = await pool.query(`
      SELECT * FROM "SalesAnalysisReport" LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      const sample = sampleResult.rows[0];
      console.log('Sample data keys:', Object.keys(sample));

      // Check for problematic fields
      for (const [key, value] of Object.entries(sample)) {
        if (typeof value === 'string' && value.length > 200) {
          console.log(`⚠️  Long field "${key}": ${value.length} chars - "${value.substring(0, 50)}..."`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSalesAnalysisSchema();