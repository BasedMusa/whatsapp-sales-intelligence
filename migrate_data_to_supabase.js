#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const { Pool } = pkg;

class DataMigrator {
  constructor() {
    // Source PostgreSQL connection
    this.sourcePool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    // Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🚀 Data migrator initialized');
  }

  async testConnections() {
    try {
      console.log('🔌 Testing source PostgreSQL connection...');
      const sourceResult = await this.sourcePool.query('SELECT NOW(), current_database()');
      console.log(`✅ Source connected: ${sourceResult.rows[0].current_database}`);

      console.log('🔌 Testing Supabase connection...');
      const { data, error } = await this.supabase.from('Instance').select('count').limit(1);
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
      console.log('✅ Supabase connected successfully');

      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  async getTablesWithData() {
    try {
      const result = await this.sourcePool.query(`
        SELECT
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tablesWithCounts = [];
      for (const table of result.rows) {
        const countResult = await this.sourcePool.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        const rowCount = parseInt(countResult.rows[0].count);

        if (rowCount > 0) {
          tablesWithCounts.push({
            name: table.table_name,
            rows: rowCount,
            columns: table.column_count
          });
        }
      }

      return tablesWithCounts;
    } catch (error) {
      console.error('❌ Error getting tables:', error.message);
      throw error;
    }
  }

  async migrateTable(tableName, rowCount) {
    try {
      console.log(`\n📦 Migrating ${tableName} (${rowCount} rows)...`);

      const batchSize = 1000;
      let offset = 0;
      let successCount = 0;
      let errorCount = 0;

      while (offset < rowCount) {
        const currentBatchSize = Math.min(batchSize, rowCount - offset);
        console.log(`  📥 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(rowCount/batchSize)} (rows ${offset + 1}-${offset + currentBatchSize})`);

        try {
          // Get batch from source
          const batchResult = await this.sourcePool.query(
            `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
            [batchSize, offset]
          );

          if (batchResult.rows.length === 0) break;

          // Insert batch into Supabase
          const { data, error } = await this.supabase
            .from(tableName)
            .upsert(batchResult.rows, {
              onConflict: 'id', // Use primary key for conflict resolution
              ignoreDuplicates: true
            });

          if (error) {
            console.error(`❌ Supabase error for ${tableName}:`, error.message);

            // Try inserting one by one for this batch
            let batchSuccess = 0;
            for (const row of batchResult.rows) {
              try {
                const { error: singleError } = await this.supabase
                  .from(tableName)
                  .upsert([row], { ignoreDuplicates: true });

                if (!singleError) {
                  batchSuccess++;
                } else {
                  console.error(`❌ Single row error: ${singleError.message}`);
                }
              } catch (singleErr) {
                console.error(`❌ Exception inserting single row:`, singleErr.message);
              }
            }
            successCount += batchSuccess;
            errorCount += (batchResult.rows.length - batchSuccess);
          } else {
            successCount += batchResult.rows.length;
          }

        } catch (error) {
          console.error(`❌ Error in batch at offset ${offset}:`, error.message);
          errorCount += currentBatchSize;
        }

        offset += batchSize;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ ${tableName} migration complete: ${successCount} success, ${errorCount} failed`);
      return { success: successCount, failed: errorCount };

    } catch (error) {
      console.error(`❌ Error migrating table ${tableName}:`, error.message);
      throw error;
    }
  }

  async migrateAllData() {
    try {
      console.log('🚀 Starting data migration to Supabase');
      console.log('='.repeat(60));

      // Test connections
      const connectionsOk = await this.testConnections();
      if (!connectionsOk) {
        throw new Error('Database connections failed');
      }

      // Get tables with data
      const tables = await this.getTablesWithData();
      console.log(`\n📊 Found ${tables.length} tables with data:`);

      let totalRows = 0;
      for (const table of tables) {
        console.log(`  📋 ${table.name}: ${table.rows.toLocaleString()} rows`);
        totalRows += table.rows;
      }
      console.log(`📈 Total records to migrate: ${totalRows.toLocaleString()}`);

      // Migration strategy: Prioritize core tables first
      const coreTableOrder = [
        'Instance', 'Chat', 'Contact', 'Message', 'IsOnWhatsapp',
        'ConversationCache', 'SalesAnalysisReport', 'AppleAnalysisReport'
      ];

      const orderedTables = [];

      // Add core tables first
      for (const coreTable of coreTableOrder) {
        const found = tables.find(t => t.name === coreTable);
        if (found) {
          orderedTables.push(found);
        }
      }

      // Add remaining tables
      for (const table of tables) {
        if (!coreTableOrder.includes(table.name)) {
          orderedTables.push(table);
        }
      }

      console.log(`\n🔄 Migration order: ${orderedTables.map(t => t.name).join(', ')}`);

      // Migrate each table
      const results = {};
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const table of orderedTables) {
        try {
          const result = await this.migrateTable(table.name, table.rows);
          results[table.name] = result;
          totalSuccess += result.success;
          totalFailed += result.failed;
        } catch (error) {
          console.error(`❌ Failed to migrate ${table.name}:`, error.message);
          results[table.name] = { success: 0, failed: table.rows, error: error.message };
          totalFailed += table.rows;
        }
      }

      // Final summary
      console.log('\n📊 Migration Summary');
      console.log('='.repeat(60));

      for (const [tableName, result] of Object.entries(results)) {
        const status = result.success > 0 ? '✅' : '❌';
        console.log(`${status} ${tableName}: ${result.success.toLocaleString()} success, ${result.failed} failed`);
      }

      console.log('-'.repeat(60));
      console.log(`📈 Total successful: ${totalSuccess.toLocaleString()} records`);
      console.log(`📉 Total failed: ${totalFailed.toLocaleString()} records`);
      console.log(`📊 Success rate: ${((totalSuccess / (totalSuccess + totalFailed)) * 100).toFixed(2)}%`);

      if (totalSuccess > 0) {
        console.log('\n🎉 Migration completed! Your data is now in Supabase.');
        console.log('🔗 Check your Supabase dashboard to verify the data.');
      }

      return results;

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      await this.sourcePool.end();
    }
  }
}

// Execute migration
async function main() {
  console.log('⚠️  WARNING: Make sure you have run the schema.sql in Supabase first!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const migrator = new DataMigrator();
  try {
    await migrator.migrateAllData();
    console.log('\n🎉 Data migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

main();