#!/usr/bin/env node

import dotenv from 'dotenv';
import { ChatService } from './services/chatService.js';
import { AIAnalyzer } from './services/aiAnalyzer.js';
import { DatabaseService } from './services/databaseService.js';
import { Logger } from './utils/logger.js';

dotenv.config();

class WhatsAppSalesIntelligence {
  constructor() {
    this.logger = new Logger(process.env.LOG_LEVEL || 'info');
    this.chatService = new ChatService();
    this.aiAnalyzer = new AIAnalyzer();
    this.databaseService = new DatabaseService();

    // Configuration
    this.config = {
      concurrentChats: parseInt(process.env.CONCURRENT_CHATS) || 8,
      batchSize: parseInt(process.env.BATCH_SIZE) || 50,
      maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH) || 200,
      aiConcurrency: 5 // Lower concurrency for AI calls to avoid rate limits
    };
  }

  async initialize() {
    try {
      await this.logger.info('🚀 Initializing WhatsApp Sales Intelligence System');

      // Initialize database schema
      await this.databaseService.initializeSchema();
      await this.logger.info('✅ Database schema initialized');

      // Validate OpenAI connection
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      await this.logger.info('✅ System initialization completed');
    } catch (error) {
      await this.logger.error('❌ Initialization failed', { error: error.message });
      throw error;
    }
  }

  async runAnalysis() {
    const startTime = Date.now();

    try {
      await this.logger.info('📊 Starting comprehensive sales analysis');

      // Step 1: Get unanalyzed chats
      await this.logger.info('🔍 Fetching unanalyzed chats from database');
      const unanalyzedChats = await this.chatService.getUnanalyzedChats();

      if (unanalyzedChats.length === 0) {
        await this.logger.info('✅ No new chats to analyze');
        return;
      }

      await this.logger.info(`📝 Found ${unanalyzedChats.length} chats to analyze`);

      // Step 2: Process chats in parallel batches
      await this.logger.info('🔄 Processing conversations in parallel');
      const conversationData = await this.chatService.processChatsBatch(
        unanalyzedChats,
        this.config.concurrentChats
      );

      // Filter out error cases for analysis
      const validConversations = conversationData.filter(data => !data.error);
      await this.logger.info(`✅ Successfully processed ${validConversations.length}/${conversationData.length} conversations`);

      if (validConversations.length === 0) {
        await this.logger.warn('⚠️ No valid conversations to analyze');
        return;
      }

      // Step 3: AI Analysis in batches with incremental saves
      await this.logger.info('🤖 Running AI analysis on conversations with incremental saves every 50 batches');

      let totalSaved = 0;
      let saveAttempts = 0;

      // Create incremental save callback
      const incrementalSaveCallback = async (successfulBatch) => {
        saveAttempts++;
        console.log(`\n💾 INCREMENTAL SAVE #${saveAttempts}: Storing ${successfulBatch.length} successful analyses to database`);

        try {
          const result = await this.databaseService.bulkInsertAnalysisResults(successfulBatch);

          if (result && result.success) {
            totalSaved += result.success;
            console.log(`✅ Successfully saved ${result.success} records (Total saved so far: ${totalSaved})`);
          }

          if (result && result.failed > 0) {
            console.warn(`⚠️ Failed to save ${result.failed} records`);
          }

          return result;
        } catch (error) {
          console.error(`❌ Incremental save error:`, error.message);
          throw error;
        }
      };

      // Run analysis with incremental save callback
      const analysisResults = await this.aiAnalyzer.analyzeConversationsBatch(
        validConversations,
        this.config.aiConcurrency,
        incrementalSaveCallback
      );

      await this.logger.info(`🎯 Completed AI analysis for ${analysisResults.length} conversations`);

      // Final statistics
      const totalAnalyzed = analysisResults.length;
      const successfulAnalyses = analysisResults.filter(result => result.analysisSuccess);
      const quotaFailures = analysisResults.filter(result => result.errorCode === 'insufficient_quota');

      console.log(`\n📊 FINAL ANALYSIS SUMMARY:`);
      console.log(`   Total Analyzed: ${totalAnalyzed}`);
      console.log(`   Successfully Analyzed: ${successfulAnalyses.length}`);
      console.log(`   Saved to Database: ${totalSaved}`);

      if (quotaFailures.length > 0) {
        console.error(`   🚨 Quota Failures: ${quotaFailures.length} (will retry on next run)`);
      }

      if (totalSaved === 0 && successfulAnalyses.length === 0) {
        await this.logger.warn('⚠️ No successful analyses to save - likely due to OpenAI quota issues');
        console.warn('⚠️ NO DATA SAVED: All AI analyses failed, likely due to quota limits');
        console.warn('   🔄 Run again once OpenAI credits/quota are restored');

        return {
          success: false,
          reason: 'No successful AI analyses due to quota issues',
          quotaFailures: quotaFailures.length,
          totalAttempted: totalAnalyzed
        };
      }

      // Step 5: Generate performance report
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;

      const performanceMetrics = {
        totalChatsProcessed: unanalyzedChats.length,
        validConversations: validConversations.length,
        totalAnalysisAttempts: totalAnalyzed,
        successfulAnalyses: successfulAnalyses.length,
        quotaFailures: quotaFailures.length,
        analysisResultsStored: totalSaved,
        incrementalSaves: saveAttempts,
        processingTimeSeconds: processingTime,
        averageTimePerChat: processingTime / unanalyzedChats.length,
        chatsPerSecond: unanalyzedChats.length / processingTime,
        successRate: totalAnalyzed > 0 ? ((successfulAnalyses.length / totalAnalyzed) * 100).toFixed(2) + '%' : '0%'
      };

      await this.logger.logPerformanceMetrics(performanceMetrics);

      // Step 6: Get and log analysis statistics
      const stats = await this.databaseService.getAnalysisStats();
      await this.logger.logAnalysisStats(stats);

      await this.logger.info(`🎉 Analysis completed successfully in ${processingTime.toFixed(2)} seconds`);

      return {
        success: true,
        metrics: performanceMetrics,
        stats
      };

    } catch (error) {
      await this.logger.error('❌ Analysis failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async generateReport() {
    try {
      await this.logger.info('📈 Generating analysis report');

      const [stats, categoryBreakdown, priorityLeads] = await Promise.all([
        this.databaseService.getAnalysisStats(),
        this.databaseService.getProductCategoryBreakdown(),
        this.databaseService.getHighPriorityLeads()
      ]);

      const report = {
        timestamp: new Date().toISOString(),
        overview: stats,
        productCategories: categoryBreakdown,
        priorityLeads: priorityLeads.slice(0, 10), // Top 10 priority leads
        summary: {
          totalAnalyzed: parseInt(stats.total_analyzed),
          appleInquiries: parseInt(stats.apple_inquiries),
          purchases: parseInt(stats.purchases),
          highUrgencyLeads: parseInt(stats.high_urgency),
          averageConfidence: parseFloat(stats.avg_confidence).toFixed(2)
        }
      };

      console.log('\n📊 SALES INTELLIGENCE REPORT');
      console.log('═'.repeat(50));
      console.log(`Total Conversations Analyzed: ${report.summary.totalAnalyzed}`);
      console.log(`Apple Product Inquiries: ${report.summary.appleInquiries}`);
      console.log(`Completed Purchases: ${report.summary.purchases}`);
      console.log(`High Urgency Leads: ${report.summary.highUrgencyLeads}`);
      console.log(`Average AI Confidence: ${report.summary.averageConfidence}`);

      console.log('\n🏷️ Top Product Categories:');
      categoryBreakdown.slice(0, 5).forEach(category => {
        console.log(`  ${category.product_category}: ${category.count} (${category.percentage}%)`);
      });

      console.log('\n🎯 High Priority Leads (Top 5):');
      priorityLeads.slice(0, 5).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.chat_name || lead.remoteJid}`);
        console.log(`     Category: ${lead.product_category} | Stage: ${lead.lead_stage} | Urgency: ${lead.urgency_level}`);
        if (lead.next_action_required) {
          console.log(`     Next Action: ${lead.next_action_required}`);
        }
      });

      await this.logger.info('✅ Report generated successfully');
      return report;

    } catch (error) {
      await this.logger.error('❌ Report generation failed', { error: error.message });
      throw error;
    }
  }
}

// Main execution function
async function main() {
  const intelligence = new WhatsAppSalesIntelligence();

  try {
    // Initialize system
    await intelligence.initialize();

    // Run analysis
    const result = await intelligence.runAnalysis();

    // Generate report
    await intelligence.generateReport();

    console.log('\n🎉 WhatsApp Sales Intelligence Analysis Completed Successfully!');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WhatsAppSalesIntelligence };