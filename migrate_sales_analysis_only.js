#!/usr/bin/env node

import dotenv from 'dotenv';
import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const { Pool } = pkg;

class SalesAnalysisMigrator {
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

    console.log('🎯 SalesAnalysisReport migrator initialized');
  }

  async migrateSalesAnalysisReport() {
    try {
      console.log('🚀 Starting SalesAnalysisReport migration...');

      // Get total count
      const countResult = await this.sourcePool.query('SELECT COUNT(*) as count FROM "SalesAnalysisReport"');
      const totalRows = parseInt(countResult.rows[0].count);

      console.log(`📊 Found ${totalRows.toLocaleString()} SalesAnalysisReport records to migrate`);

      if (totalRows === 0) {
        console.log('📭 No records to migrate');
        return;
      }

      const batchSize = 500; // Smaller batches for analysis data
      let offset = 0;
      let successCount = 0;
      let errorCount = 0;

      while (offset < totalRows) {
        const currentBatchSize = Math.min(batchSize, totalRows - offset);
        console.log(`📥 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalRows/batchSize)} (rows ${offset + 1}-${offset + currentBatchSize})`);

        try {
          // Get batch from source
          const batchResult = await this.sourcePool.query(
            'SELECT * FROM "SalesAnalysisReport" ORDER BY "remoteJid" LIMIT $1 OFFSET $2',
            [batchSize, offset]
          );

          if (batchResult.rows.length === 0) break;

          // Insert batch into Supabase
          const { data, error } = await this.supabase
            .from('SalesAnalysisReport')
            .upsert(batchResult.rows, {
              onConflict: 'remoteJid',
              ignoreDuplicates: false // Update existing records
            });

          if (error) {
            console.error(`❌ Batch error:`, error.message);

            // Try individual inserts
            let batchSuccess = 0;
            for (const row of batchResult.rows) {
              try {
                const { error: singleError } = await this.supabase
                  .from('SalesAnalysisReport')
                  .upsert([row], {
                    onConflict: 'remoteJid',
                    ignoreDuplicates: false
                  });

                if (!singleError) {
                  batchSuccess++;
                } else {
                  console.error(`❌ Single row error for ${row.remoteJid}:`, singleError.message);
                  errorCount++;
                }
              } catch (singleErr) {
                console.error(`❌ Exception for ${row.remoteJid}:`, singleErr.message);
                errorCount++;
              }
            }
            successCount += batchSuccess;
          } else {
            successCount += batchResult.rows.length;
            console.log(`  ✅ Batch successful: ${batchResult.rows.length} records`);
          }

        } catch (error) {
          console.error(`❌ Error in batch at offset ${offset}:`, error.message);
          errorCount += currentBatchSize;
        }

        offset += batchSize;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('\n📊 SalesAnalysisReport Migration Summary');
      console.log('='.repeat(50));
      console.log(`✅ Successfully migrated: ${successCount.toLocaleString()} records`);
      console.log(`❌ Failed to migrate: ${errorCount.toLocaleString()} records`);
      console.log(`📈 Success rate: ${((successCount / totalRows) * 100).toFixed(2)}%`);

      // Verify the migration
      console.log('\n🔍 Verifying migration...');
      const { count: verifyCount, error: verifyError } = await this.supabase
        .from('SalesAnalysisReport')
        .select('*', { count: 'exact', head: true });

      if (!verifyError) {
        console.log(`✅ Verification: ${verifyCount?.toLocaleString() || 0} records found in Supabase`);
      } else {
        console.log(`❌ Verification failed: ${verifyError.message}`);
      }

      return { success: successCount, failed: errorCount, total: totalRows };

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
  const migrator = new SalesAnalysisMigrator();
  try {
    await migrator.migrateSalesAnalysisReport();
    console.log('\n🎉 SalesAnalysisReport migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

main();