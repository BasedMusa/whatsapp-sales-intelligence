import { query, getClient } from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';

export class DatabaseService {

  /**
   * Initialize database schema
   */
  async initializeSchema() {
    try {
      const schemaPath = path.join(process.cwd(), 'src', 'config', 'schemas.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');

      await query(schema);
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing database schema:', error);
      throw error;
    }
  }

  /**
   * Bulk insert analysis results for maximum performance
   */
  async bulkInsertAnalysisResults(analysisResults) {
    if (!analysisResults || analysisResults.length === 0) {
      console.log('⚠️ No analysis results to insert');
      return { success: 0, failed: 0, errors: [] };
    }

    console.log(`🔄 Starting bulk insert of ${analysisResults.length} analysis results`);
    const client = await getClient();
    const errors = [];

    try {
      await client.query('BEGIN');
      console.log('✅ Database transaction started');

      const insertQuery = `
        INSERT INTO "SalesAnalysisReport" (
          "remoteJid", analysis_time, product_category, specific_products, product_models, quantity_mentioned,
          primary_sales_agent, additional_agents, agent_handoff_detected, lead_stage, next_action_required,
          sales_status, customer_objections, urgency_level, customer_name, customer_location, budget_range,
          purchase_timeline, decision_maker_status, product_specifications, accessories_discussed,
          warranty_service_needs, color_preferences, lead_source, competitive_products, upsell_opportunities,
          customer_sentiment, pain_points_identified, pricing_discussed, demo_scheduled, follow_up_required,
          total_messages, conversation_duration_days, last_customer_message_time, analysis_confidence,
          ai_model_used, processing_time_ms
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
        ) ON CONFLICT ("remoteJid") DO UPDATE SET
          analysis_time = EXCLUDED.analysis_time,
          product_category = EXCLUDED.product_category,
          specific_products = EXCLUDED.specific_products,
          product_models = EXCLUDED.product_models,
          quantity_mentioned = EXCLUDED.quantity_mentioned,
          primary_sales_agent = EXCLUDED.primary_sales_agent,
          additional_agents = EXCLUDED.additional_agents,
          agent_handoff_detected = EXCLUDED.agent_handoff_detected,
          lead_stage = EXCLUDED.lead_stage,
          next_action_required = EXCLUDED.next_action_required,
          sales_status = EXCLUDED.sales_status,
          customer_objections = EXCLUDED.customer_objections,
          urgency_level = EXCLUDED.urgency_level,
          customer_name = EXCLUDED.customer_name,
          customer_location = EXCLUDED.customer_location,
          budget_range = EXCLUDED.budget_range,
          purchase_timeline = EXCLUDED.purchase_timeline,
          decision_maker_status = EXCLUDED.decision_maker_status,
          product_specifications = EXCLUDED.product_specifications,
          accessories_discussed = EXCLUDED.accessories_discussed,
          warranty_service_needs = EXCLUDED.warranty_service_needs,
          color_preferences = EXCLUDED.color_preferences,
          lead_source = EXCLUDED.lead_source,
          competitive_products = EXCLUDED.competitive_products,
          upsell_opportunities = EXCLUDED.upsell_opportunities,
          customer_sentiment = EXCLUDED.customer_sentiment,
          pain_points_identified = EXCLUDED.pain_points_identified,
          pricing_discussed = EXCLUDED.pricing_discussed,
          demo_scheduled = EXCLUDED.demo_scheduled,
          follow_up_required = EXCLUDED.follow_up_required,
          total_messages = EXCLUDED.total_messages,
          conversation_duration_days = EXCLUDED.conversation_duration_days,
          last_customer_message_time = EXCLUDED.last_customer_message_time,
          analysis_confidence = EXCLUDED.analysis_confidence,
          ai_model_used = EXCLUDED.ai_model_used,
          processing_time_ms = EXCLUDED.processing_time_ms,
          UPDATED_AT = NOW()
      `;

      let successCount = 0;
      let errorCount = 0;

      // Process in smaller batches for better error tracking
      for (let i = 0; i < analysisResults.length; i++) {
        const result = analysisResults[i];

        try {
          const values = this.prepareInsertValues(result);

          // Debug first record
          if (i === 0) {
            console.log('🔍 DEBUG: First record values:', {
              remoteJid: values[0],
              product_category: values[2],
              lead_stage: values[9],
              analysisConfidence: values[34]
            });
          }

          await client.query(insertQuery, values);
          successCount++;

          // Log progress every 100 records
          if (successCount % 100 === 0) {
            console.log(`  ✅ Inserted ${successCount}/${analysisResults.length} records`);
          }
        } catch (error) {
          console.error(`❌ Error inserting analysis for ${result.remoteJid}:`, error.message);
          console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          errors.push({
            remoteJid: result.remoteJid,
            error: error.message,
            code: error.code
          });
          errorCount++;

          // If too many errors, abort
          if (errorCount > 50) {
            console.error('❌ Too many errors, aborting bulk insert');
            throw new Error('Too many insertion errors');
          }
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Bulk insert COMMITTED: ${successCount} successful, ${errorCount} failed`);

      return { success: successCount, failed: errorCount, errors };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Bulk insert ROLLED BACK due to error:', error.message);
      return { success: 0, failed: analysisResults.length, errors: [{ error: error.message }] };
    } finally {
      client.release();
    }
  }

  /**
   * Prepare values for database insertion
   */
  prepareInsertValues(result) {
    // Helper function to convert arrays to JSONB
    const toJsonb = (value) => {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    };

    // Helper function to ensure integer values
    const toInteger = (value) => {
      if (value === null || value === undefined) return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Helper function to ensure boolean values
    const toBoolean = (value) => {
      return value === true || value === 'true';
    };

    // Helper function to truncate strings to max length
    const truncateString = (value, maxLength) => {
      if (!value || typeof value !== 'string') return value;
      return value.length > maxLength ? value.substring(0, maxLength - 3) + '...' : value;
    };

    return [
      result.remoteJid,                                                    // $1
      new Date().toISOString(),                                           // $2 - analysis_time
      truncateString(result.product_category || 'No Product Mentioned', 200), // $3
      toJsonb(result.specific_products || []),                           // $4 - JSONB
      toJsonb(result.product_models || []),                              // $5 - JSONB
      toInteger(result.quantity_mentioned),                              // $6 - INTEGER (validated)
      truncateString(result.primary_sales_agent, 255) || null,           // $7
      toJsonb(result.additional_agents || []),                           // $8 - JSONB
      toBoolean(result.agent_handoff_detected),                          // $9 - BOOLEAN (validated)
      truncateString(result.lead_stage || 'Inquiry', 100),               // $10
      result.next_action_required || null,                                // $11 - TEXT (no limit)
      truncateString(result.sales_status, 200) || null,                  // $12
      toJsonb(result.customer_objections || []),                         // $13 - JSONB
      truncateString(result.urgency_level || 'Low', 20),                 // $14
      truncateString(result.customer_name, 255) || null,                 // $15
      truncateString(result.customer_location, 255) || null,             // $16
      truncateString(result.budget_range, 200) || null,                  // $17
      truncateString(result.purchase_timeline, 200) || null,             // $18
      truncateString(result.decision_maker_status, 200) || null,         // $19
      toJsonb(result.product_specifications || null),                     // $20 - JSONB
      toJsonb(result.accessories_discussed || []),                        // $21 - JSONB
      result.warranty_service_needs || null,                              // $22
      toJsonb(result.color_preferences || []),                            // $23 - JSONB
      truncateString(result.lead_source, 200) || null,                   // $24
      toJsonb(result.competitive_products || []),                         // $25 - JSONB
      toJsonb(result.upsell_opportunities || []),                         // $26 - JSONB
      truncateString(result.customer_sentiment || 'Neutral', 50),        // $27
      toJsonb(result.pain_points_identified || []),                       // $28 - JSONB
      toBoolean(result.pricing_discussed),                                // $29 - BOOLEAN (validated)
      toBoolean(result.demo_scheduled),                                   // $30 - BOOLEAN (validated)
      toBoolean(result.follow_up_required !== false),                     // $31 - BOOLEAN (validated)
      toInteger(result.metadata?.totalMessages) || 0,                    // $32 - INTEGER (validated)
      toInteger(result.metadata?.conversationDurationDays) || 0,         // $33 - INTEGER (validated)
      result.metadata?.lastCustomerMessageTime || null,                   // $34
      parseFloat(result.analysisConfidence || result.analysis_confidence || 0.5), // $35
      result.aiModelUsed || result.ai_model_used || 'gpt-3.5-turbo',    // $36
      toInteger(result.processingTimeMs || result.processing_time_ms) || 0 // $37 - INTEGER (validated)
    ];
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats() {
    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_analyzed,
          COUNT(*) FILTER (WHERE product_category = 'Apple Products') as apple_inquiries,
          COUNT(*) FILTER (WHERE lead_stage = 'Purchase') as purchases,
          COUNT(*) FILTER (WHERE urgency_level = 'High') as high_urgency,
          AVG(analysis_confidence) as avg_confidence,
          COUNT(DISTINCT primary_sales_agent) as unique_agents,
          MIN(analysis_time) as first_analysis,
          MAX(analysis_time) as last_analysis
        FROM "SalesAnalysisReport"
      `;

      const result = await query(statsQuery);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching analysis stats:', error);
      throw error;
    }
  }

  /**
   * Get product category breakdown
   */
  async getProductCategoryBreakdown() {
    try {
      const categoryQuery = `
        SELECT
          product_category,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM "SalesAnalysisReport"
        WHERE product_category IS NOT NULL
        GROUP BY product_category
        ORDER BY count DESC
      `;

      const result = await query(categoryQuery);
      return result.rows;
    } catch (error) {
      console.error('Error fetching category breakdown:', error);
      throw error;
    }
  }

  /**
   * Get high-priority leads for follow-up
   */
  async getHighPriorityLeads() {
    try {
      const priorityQuery = `
        SELECT
          c."remoteJid",
          c."name" as chat_name,
          s.product_category,
          s.lead_stage,
          s.urgency_level,
          s.next_action_required,
          s.customer_sentiment,
          s.analysis_time
        FROM "SalesAnalysisReport" s
        JOIN "Chat" c ON s."remoteJid" = c."remoteJid"
        WHERE s.urgency_level = 'High'
           OR s.lead_stage IN ('Intent', 'Consideration')
           OR s.follow_up_required = true
        ORDER BY
          CASE s.urgency_level
            WHEN 'High' THEN 1
            WHEN 'Medium' THEN 2
            ELSE 3
          END,
          s.analysis_time DESC
        LIMIT 50
      `;

      const result = await query(priorityQuery);
      return result.rows;
    } catch (error) {
      console.error('Error fetching priority leads:', error);
      throw error;
    }
  }

  /**
   * Clean up old analysis data (optional maintenance function)
   */
  async cleanupOldAnalysis(daysToKeep = 90) {
    try {
      const cleanupQuery = `
        DELETE FROM "SalesAnalysisReport"
        WHERE analysis_time < NOW() - INTERVAL '${daysToKeep} days'
      `;

      const result = await query(cleanupQuery);
      console.log(`Cleaned up ${result.rowCount} old analysis records`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old analysis data:', error);
      throw error;
    }
  }
}