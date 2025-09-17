#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const { Pool } = pkg;

class DatabaseMigrator {
  constructor() {
    // Source PostgreSQL connection
    this.sourcePool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    // Supabase connection via direct PostgreSQL
    const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];

    // For Supabase, we need to get the database password from project settings
    // Using the service role key as password won't work for direct PostgreSQL connection
    // We'll use the Supabase client for data operations instead
    this.projectRef = projectRef;

    // Also create Supabase client for API operations
    this.supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔧 Database migrator initialized');
  }

  async testConnections() {
    try {
      console.log('🔌 Testing source PostgreSQL connection...');
      const sourceResult = await this.sourcePool.query('SELECT NOW(), current_database()');
      console.log(`✅ Source connected: ${sourceResult.rows[0].current_database} at ${sourceResult.rows[0].now}`);

      console.log('🔌 Testing Supabase connection...');
      const targetResult = await this.targetPool.query('SELECT NOW(), current_database()');
      console.log(`✅ Supabase connected: ${targetResult.rows[0].current_database} at ${targetResult.rows[0].now}`);

      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  async getSourceTables() {
    try {
      console.log('📋 Fetching source database schema...');

      const tablesQuery = `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const result = await this.sourcePool.query(tablesQuery);
      const tables = result.rows.map(row => row.table_name);

      console.log(`📊 Found ${tables.length} tables:`, tables.join(', '));
      return tables;
    } catch (error) {
      console.error('❌ Error fetching tables:', error.message);
      throw error;
    }
  }

  async getTableSchema(tableName) {
    try {
      console.log(`🔍 Analyzing schema for table: ${tableName}`);

      const schemaQuery = `
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
      `;

      const result = await this.sourcePool.query(schemaQuery, [tableName]);
      return result.rows;
    } catch (error) {
      console.error(`❌ Error getting schema for ${tableName}:`, error.message);
      throw error;
    }
  }

  async createTableInSupabase(tableName, columns) {
    try {
      console.log(`🏗️ Creating table ${tableName} in Supabase...`);

      // Build CREATE TABLE statement
      const columnDefs = columns.map(col => {
        let definition = `"${col.column_name}" ${this.mapDataType(col)}`;

        if (col.is_nullable === 'NO') {
          definition += ' NOT NULL';
        }

        if (col.column_default) {
          // Handle special defaults
          let defaultValue = col.column_default;
          if (defaultValue.includes('NOW()') || defaultValue.includes('CURRENT_TIMESTAMP')) {
            defaultValue = 'NOW()';
          }
          definition += ` DEFAULT ${defaultValue}`;
        }

        return definition;
      }).join(',\n  ');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          ${columnDefs}
        )
      `;

      console.log(`📝 SQL for ${tableName}:`, createTableSQL.substring(0, 200) + '...');

      await this.targetPool.query(createTableSQL);
      console.log(`✅ Table ${tableName} created successfully`);

    } catch (error) {
      console.error(`❌ Error creating table ${tableName}:`, error.message);
      throw error;
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

  async migrateTableData(tableName) {
    try {
      console.log(`📦 Migrating data for table: ${tableName}`);

      // Get total count
      const countResult = await this.sourcePool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const totalRows = parseInt(countResult.rows[0].count);

      if (totalRows === 0) {
        console.log(`📭 Table ${tableName} is empty, skipping data migration`);
        return { success: 0, failed: 0 };
      }

      console.log(`📊 Table ${tableName} has ${totalRows} rows to migrate`);

      const batchSize = 1000;
      let offset = 0;
      let successCount = 0;
      let failedCount = 0;

      while (offset < totalRows) {
        console.log(`  📥 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalRows/batchSize)} (rows ${offset + 1}-${Math.min(offset + batchSize, totalRows)})`);

        try {
          // Fetch batch from source
          const batchResult = await this.sourcePool.query(
            `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
            [batchSize, offset]
          );

          if (batchResult.rows.length === 0) break;

          // Insert batch into Supabase
          const insertResult = await this.insertBatch(tableName, batchResult.rows);
          successCount += insertResult.success;
          failedCount += insertResult.failed;

        } catch (error) {
          console.error(`❌ Error in batch at offset ${offset}:`, error.message);
          failedCount += batchSize;
        }

        offset += batchSize;
      }

      console.log(`✅ Migration complete for ${tableName}: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };

    } catch (error) {
      console.error(`❌ Error migrating table ${tableName}:`, error.message);
      throw error;
    }
  }

  async insertBatch(tableName, rows) {
    if (rows.length === 0) return { success: 0, failed: 0 };

    try {
      // Get column names from first row
      const columns = Object.keys(rows[0]);
      const columnList = columns.map(col => `"${col}"`).join(', ');

      // Build values placeholder
      const valuePlaceholders = rows.map((_, rowIndex) => {
        const rowPlaceholders = columns.map((_, colIndex) =>
          `$${rowIndex * columns.length + colIndex + 1}`
        ).join(', ');
        return `(${rowPlaceholders})`;
      }).join(', ');

      // Flatten all values
      const values = rows.flatMap(row => columns.map(col => row[col]));

      const insertSQL = `
        INSERT INTO "${tableName}" (${columnList})
        VALUES ${valuePlaceholders}
        ON CONFLICT DO NOTHING
      `;

      await this.targetPool.query(insertSQL, values);
      return { success: rows.length, failed: 0 };

    } catch (error) {
      console.error(`❌ Batch insert failed for ${tableName}:`, error.message);

      // Try inserting one by one to identify problematic rows
      let success = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          await this.insertSingleRow(tableName, row);
          success++;
        } catch (singleError) {
          console.error(`❌ Failed to insert row:`, singleError.message);
          failed++;
        }
      }

      return { success, failed };
    }
  }

  async insertSingleRow(tableName, row) {
    const columns = Object.keys(row);
    const columnList = columns.map(col => `"${col}"`).join(', ');
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const values = columns.map(col => row[col]);

    const insertSQL = `
      INSERT INTO "${tableName}" (${columnList})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    await this.targetPool.query(insertSQL, values);
  }

  async migrateDatabase() {
    try {
      console.log('🚀 Starting complete database migration to Supabase');
      console.log('=' .repeat(60));

      // Test connections
      const connectionsOk = await this.testConnections();
      if (!connectionsOk) {
        throw new Error('Database connections failed');
      }

      // Get all tables
      const tables = await this.getSourceTables();
      const migrationResults = {};

      console.log('\n📋 Phase 1: Schema Migration');
      console.log('-'.repeat(40));

      // Create all tables first
      for (const tableName of tables) {
        try {
          const columns = await this.getTableSchema(tableName);
          await this.createTableInSupabase(tableName, columns);
          migrationResults[tableName] = { schemaCreated: true };
        } catch (error) {
          console.error(`❌ Schema creation failed for ${tableName}:`, error.message);
          migrationResults[tableName] = { schemaCreated: false, error: error.message };
        }
      }

      console.log('\n📦 Phase 2: Data Migration');
      console.log('-'.repeat(40));

      // Migrate data for successfully created tables
      for (const tableName of tables) {
        if (migrationResults[tableName].schemaCreated) {
          try {
            const result = await this.migrateTableData(tableName);
            migrationResults[tableName] = {
              ...migrationResults[tableName],
              ...result
            };
          } catch (error) {
            console.error(`❌ Data migration failed for ${tableName}:`, error.message);
            migrationResults[tableName].error = error.message;
          }
        }
      }

      // Print final summary
      console.log('\n📊 Migration Summary');
      console.log('='.repeat(60));

      let totalSuccess = 0;
      let totalFailed = 0;

      for (const [tableName, result] of Object.entries(migrationResults)) {
        const status = result.schemaCreated ? '✅' : '❌';
        const records = result.success ? `${result.success} records` : 'no data';
        console.log(`${status} ${tableName}: ${records}`);

        if (result.success) totalSuccess += result.success;
        if (result.failed) totalFailed += result.failed;
      }

      console.log('-'.repeat(60));
      console.log(`📈 Total migrated: ${totalSuccess} records`);
      console.log(`📉 Total failed: ${totalFailed} records`);
      console.log('✅ Database migration completed!');

      return migrationResults;

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      await this.sourcePool.end();
      await this.targetPool.end();
    }
  }
}

// Execute migration
async function main() {
  const migrator = new DatabaseMigrator();
  try {
    await migrator.migrateDatabase();
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

main();