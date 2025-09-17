#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

async function getMessageSchema() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'Message'
      ORDER BY column_name
    `);

    console.log('Complete Message table schema:');
    console.log('');

    let alterStatements = [];
    result.rows.forEach(row => {
      const { column_name, data_type, character_maximum_length } = row;
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
      }

      console.log(`  ${column_name}: ${dataType}`);

      // Generate ALTER statements for likely missing columns
      if (column_name.includes('chatwoot') || column_name.includes('integration')) {
        alterStatements.push(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "${column_name}" ${dataType};`);
      }
    });

    console.log('\\n\\nSQL to add missing columns:');
    console.log('='.repeat(50));
    alterStatements.forEach(stmt => console.log(stmt));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

getMessageSchema();