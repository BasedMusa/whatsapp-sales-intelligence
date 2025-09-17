#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();
const { Pool } = pkg;

class SupabaseExporter {
  constructor() {
    this.sourcePool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    this.exportDir = './supabase_export';
    console.log('🔧 Supabase exporter initialized');
  }

  async createExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
      console.log(`📁 Export directory created: ${this.exportDir}`);
    } catch (error) {
      console.error('❌ Error creating export directory:', error.message);
    }
  }

  async exportCompleteSchema() {
    try {
      console.log('📋 Exporting complete database schema...');

      // Get all tables
      const tablesResult = await this.sourcePool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = tablesResult.rows.map(row => row.table_name);
      console.log(`📊 Found ${tables.length} tables:`, tables.join(', '));

      let schemaSQL = '-- Complete Database Schema Export for Supabase\n';
      schemaSQL += '-- Generated: ' + new Date().toISOString() + '\n\n';

      // Export each table schema
      for (const tableName of tables) {
        console.log(`🔍 Processing table: ${tableName}`);

        // Get table creation SQL
        const createTableSQL = await this.getCreateTableSQL(tableName);
        schemaSQL += createTableSQL + '\n\n';

        // Get indexes
        const indexesSQL = await this.getIndexesSQL(tableName);
        if (indexesSQL) {
          schemaSQL += indexesSQL + '\n\n';
        }
      }

      // Get triggers and functions
      const triggersSQL = await this.getTriggersSQL();
      if (triggersSQL) {
        schemaSQL += triggersSQL + '\n\n';
      }

      await fs.writeFile(path.join(this.exportDir, 'schema.sql'), schemaSQL);
      console.log('✅ Schema exported to schema.sql');

      return tables;

    } catch (error) {
      console.error('❌ Error exporting schema:', error.message);
      throw error;
    }
  }

  async getCreateTableSQL(tableName) {
    try {
      // Get column definitions
      const columnsResult = await this.sourcePool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const columns = columnsResult.rows.map(col => {
        let definition = `  "${col.column_name}" ${this.mapDataType(col)}`;

        if (col.is_nullable === 'NO') {
          definition += ' NOT NULL';
        }

        if (col.column_default) {
          let defaultValue = col.column_default;

          // Handle common default patterns
          if (defaultValue.includes('NOW()') || defaultValue.includes('CURRENT_TIMESTAMP')) {
            defaultValue = 'NOW()';
          } else if (defaultValue.includes('nextval')) {
            // Skip sequence defaults, they'll be handled by SERIAL
            defaultValue = null;
          } else if (defaultValue.includes("'") && !defaultValue.includes('::')) {
            // String literals
            defaultValue = defaultValue;
          }

          if (defaultValue) {
            definition += ` DEFAULT ${defaultValue}`;
          }
        }

        return definition;
      }).join(',\\n');

      // Get primary key
      const pkResult = await this.sourcePool.query(`
        SELECT column_name
        FROM information_schema.key_column_usage
        WHERE table_schema = 'public'
        AND table_name = $1
        AND constraint_name LIKE '%_pkey'
        ORDER BY ordinal_position
      `, [tableName]);

      let pkClause = '';
      if (pkResult.rows.length > 0) {
        const pkColumns = pkResult.rows.map(row => `"${row.column_name}"`).join(', ');
        pkClause = `,\\n  PRIMARY KEY (${pkColumns})`;
      }

      return `-- Table: ${tableName}
CREATE TABLE IF NOT EXISTS "${tableName}" (
${columns}${pkClause}
);`;

    } catch (error) {
      console.error(`❌ Error getting CREATE TABLE for ${tableName}:`, error.message);
      return `-- Error creating table ${tableName}: ${error.message}`;
    }
  }

  mapDataType(column) {
    const { data_type, character_maximum_length, numeric_precision, numeric_scale } = column;

    switch (data_type) {
      case 'character varying':
        return character_maximum_length ? `VARCHAR(${character_maximum_length})` : 'TEXT';
      case 'character':
        return `CHAR(${character_maximum_length})`;
      case 'text':
        return 'TEXT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'numeric':
        return numeric_precision ? `NUMERIC(${numeric_precision},${numeric_scale || 0})` : 'NUMERIC';
      case 'timestamp with time zone':
        return 'TIMESTAMP WITH TIME ZONE';
      case 'timestamp without time zone':
        return 'TIMESTAMP';
      case 'boolean':
        return 'BOOLEAN';
      case 'jsonb':
        return 'JSONB';
      case 'json':
        return 'JSON';
      case 'uuid':
        return 'UUID';
      case 'date':
        return 'DATE';
      case 'time':
        return 'TIME';
      default:
        console.warn(`⚠️ Unknown data type: ${data_type}, using TEXT`);
        return 'TEXT';
    }
  }

  async getIndexesSQL(tableName) {
    try {
      const indexesResult = await this.sourcePool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      `, [tableName]);

      if (indexesResult.rows.length === 0) return '';

      const indexes = indexesResult.rows.map(row =>
        `-- Index: ${row.indexname}\\n${row.indexdef};`
      ).join('\\n\\n');

      return `-- Indexes for ${tableName}\\n${indexes}`;

    } catch (error) {
      console.error(`❌ Error getting indexes for ${tableName}:`, error.message);
      return '';
    }
  }

  async getTriggersSQL() {
    try {
      const triggersResult = await this.sourcePool.query(`
        SELECT
          t.trigger_name,
          t.event_manipulation,
          t.event_object_table,
          p.prosrc as function_definition
        FROM information_schema.triggers t
        LEFT JOIN pg_proc p ON p.proname = replace(t.action_statement, 'EXECUTE FUNCTION ', '')
        WHERE t.trigger_schema = 'public'
      `);

      if (triggersResult.rows.length === 0) return '';

      // First, create functions
      const functions = new Set();
      let functionsSQL = '';

      for (const trigger of triggersResult.rows) {
        if (trigger.function_definition && !functions.has(trigger.trigger_name)) {
          functions.add(trigger.trigger_name);
          functionsSQL += `
-- Function for trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.UPDATED_AT = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

`;
        }
      }

      // Then create triggers
      const triggers = triggersResult.rows.map(trigger => `
-- Trigger: ${trigger.trigger_name}
DROP TRIGGER IF EXISTS ${trigger.trigger_name} ON "${trigger.event_object_table}";
CREATE TRIGGER ${trigger.trigger_name}
    BEFORE UPDATE ON "${trigger.event_object_table}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();`
      ).join('\\n');

      return `-- Functions and Triggers\\n${functionsSQL}${triggers}`;

    } catch (error) {
      console.error('❌ Error getting triggers:', error.message);
      return '';
    }
  }

  async exportTableData(tableName) {
    try {
      console.log(`📦 Exporting data for table: ${tableName}`);

      const countResult = await this.sourcePool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const totalRows = parseInt(countResult.rows[0].count);

      if (totalRows === 0) {
        console.log(`📭 Table ${tableName} is empty, skipping data export`);
        return;
      }

      console.log(`📊 Table ${tableName} has ${totalRows} rows`);

      // Export data in INSERT statements
      const dataResult = await this.sourcePool.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length === 0) return;

      const columns = Object.keys(dataResult.rows[0]);
      const columnList = columns.map(col => `"${col}"`).join(', ');

      let insertSQL = `-- Data for table: ${tableName}\\n`;
      insertSQL += `-- Records: ${totalRows}\\n\\n`;

      // Process in batches for large tables
      const batchSize = 100;
      for (let i = 0; i < dataResult.rows.length; i += batchSize) {
        const batch = dataResult.rows.slice(i, i + batchSize);

        const values = batch.map(row => {
          const valuesList = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value.toString().toUpperCase();
            if (typeof value === 'object') return `'${JSON.stringify(value)}'::jsonb`;
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return value;
          }).join(', ');
          return `(${valuesList})`;
        }).join(',\\n  ');

        insertSQL += `INSERT INTO "${tableName}" (${columnList}) VALUES\\n  ${values}\\nON CONFLICT DO NOTHING;\\n\\n`;
      }

      await fs.writeFile(path.join(this.exportDir, `${tableName}_data.sql`), insertSQL);
      console.log(`✅ Data exported for ${tableName}`);

    } catch (error) {
      console.error(`❌ Error exporting data for ${tableName}:`, error.message);
    }
  }

  async exportComplete() {
    try {
      console.log('🚀 Starting complete export for Supabase migration');
      console.log('='.repeat(60));

      await this.createExportDirectory();

      // Export schema
      const tables = await this.exportCompleteSchema();

      // Export data for each table
      console.log('\\n📦 Exporting table data...');
      for (const tableName of tables) {
        await this.exportTableData(tableName);
      }

      // Create master import script
      let masterScript = '-- Supabase Import Script\\n';
      masterScript += '-- Run this in Supabase SQL Editor\\n\\n';
      masterScript += '-- 1. First run the schema\\n';
      masterScript += '\\\\i schema.sql\\n\\n';
      masterScript += '-- 2. Then run the data imports\\n';

      for (const tableName of tables) {
        masterScript += `\\\\i ${tableName}_data.sql\\n`;
      }

      await fs.writeFile(path.join(this.exportDir, 'import_to_supabase.sql'), masterScript);

      console.log('\\n✅ Export completed successfully!');
      console.log('📁 Files created in:', this.exportDir);
      console.log('📋 Next steps:');
      console.log('   1. Go to your Supabase project');
      console.log('   2. Open SQL Editor');
      console.log('   3. Run schema.sql first');
      console.log('   4. Then run each *_data.sql file');

    } catch (error) {
      console.error('❌ Export failed:', error.message);
      throw error;
    } finally {
      await this.sourcePool.end();
    }
  }
}

// Execute export
async function main() {
  const exporter = new SupabaseExporter();
  try {
    await exporter.exportComplete();
    process.exit(0);
  } catch (error) {
    console.error('💥 Export failed:', error.message);
    process.exit(1);
  }
}

main();