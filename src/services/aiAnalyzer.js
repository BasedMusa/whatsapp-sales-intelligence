import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export class AIAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze sales conversation with comprehensive data extraction
   */
  async analyzeSalesConversation(conversation, remoteJid) {
    if (!conversation || conversation.trim() === '') {
      return this.getEmptyAnalysis(remoteJid);
    }

    const analysisPrompt = this.buildAnalysisPrompt(conversation);
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const processingTime = Date.now() - startTime;
      const analysis = JSON.parse(response.choices[0].message.content);

      return {
        ...analysis,
        remoteJid,
        analysisConfidence: analysis.analysis_confidence || 0.8,
        aiModelUsed: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error(`Error analyzing conversation for ${remoteJid}:`, error);

      // Return basic analysis on error
      return {
        ...this.getEmptyAnalysis(remoteJid),
        analysisConfidence: 0.1,
        aiModelUsed: 'error',
        processingTimeMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * System prompt for comprehensive sales analysis
   */
  getSystemPrompt() {
    return `You are an expert sales conversation analyzer. Analyze WhatsApp conversations between sales agents and potential customers to extract comprehensive sales intelligence.

You must return a valid JSON object with ALL the following fields (use null for unknown values, empty arrays for empty lists):

{
  "product_category": "Apple Products | Non-Apple Laptops | Tablets | Phones | Watches | TVs | Air Conditioners | Refrigerators | Other Electronics | No Product Mentioned",
  "specific_products": ["array of specific products mentioned"],
  "product_models": ["specific model numbers or names"],
  "quantity_mentioned": "number or null",
  "primary_sales_agent": "main agent name or null",
  "additional_agents": ["other agents involved"],
  "agent_handoff_detected": "boolean",
  "lead_stage": "Inquiry | Interest | Consideration | Intent | Purchase | Closed",
  "next_action_required": "what needs to be done next",
  "sales_status": "current status description",
  "customer_objections": ["list of concerns raised"],
  "urgency_level": "High | Medium | Low",
  "customer_name": "name if mentioned or null",
  "customer_location": "location if mentioned or null",
  "budget_range": "budget mentioned or null",
  "purchase_timeline": "when they need it or null",
  "decision_maker_status": "decision authority level or null",
  "product_specifications": "object with spec details or null",
  "accessories_discussed": ["accessories mentioned"],
  "warranty_service_needs": "warranty/service requirements or null",
  "color_preferences": ["colors mentioned"],
  "lead_source": "how they found you or null",
  "competitive_products": ["competitor products mentioned"],
  "upsell_opportunities": ["potential additional sales"],
  "customer_sentiment": "Positive | Neutral | Negative | Frustrated",
  "pain_points_identified": ["customer problems mentioned"],
  "pricing_discussed": "boolean",
  "demo_scheduled": "boolean",
  "follow_up_required": "boolean",
  "analysis_confidence": "decimal 0.0-1.0 confidence score"
}

Focus on extracting factual information from the conversation. Be conservative with confidence scores.`;
  }

  /**
   * Build the analysis prompt with conversation context
   */
  buildAnalysisPrompt(conversation) {
    return `Please analyze this WhatsApp sales conversation and extract all relevant sales intelligence:

CONVERSATION:
${conversation}

Extract comprehensive sales data including product categories, sales agent information, customer intelligence, sales process status, and business insights. Return the analysis as a JSON object following the exact schema provided in the system message.`;
  }

  /**
   * Get empty analysis structure for conversations with no content
   */
  getEmptyAnalysis(remoteJid) {
    return {
      remoteJid,
      product_category: 'No Product Mentioned',
      specific_products: [],
      product_models: [],
      quantity_mentioned: null,
      primary_sales_agent: null,
      additional_agents: [],
      agent_handoff_detected: false,
      lead_stage: 'Inquiry',
      next_action_required: 'Initial contact or follow-up needed',
      sales_status: 'No meaningful conversation detected',
      customer_objections: [],
      urgency_level: 'Low',
      customer_name: null,
      customer_location: null,
      budget_range: null,
      purchase_timeline: null,
      decision_maker_status: null,
      product_specifications: null,
      accessories_discussed: [],
      warranty_service_needs: null,
      color_preferences: [],
      lead_source: null,
      competitive_products: [],
      upsell_opportunities: [],
      customer_sentiment: 'Neutral',
      pain_points_identified: [],
      pricing_discussed: false,
      demo_scheduled: false,
      follow_up_required: true,
      analysisConfidence: 0.3
    };
  }

  /**
   * Process multiple conversations in parallel with optional incremental save callback
   */
  async analyzeConversationsBatch(conversationData, batchSize = 5, incrementalSaveCallback = null) {
    const results = [];
    const SAVE_INTERVAL = 50; // Save every 50 batches
    let batchNumber = 0;
    let accumulatedForSave = [];

    for (let i = 0; i < conversationData.length; i += batchSize) {
      const batch = conversationData.slice(i, i + batchSize);
      batchNumber++;
      console.log(`Analyzing batch ${batchNumber}/${Math.ceil(conversationData.length/batchSize)} (${batch.length} conversations)`);

      const batchPromises = batch.map(async (data) => {
        if (data.error || !data.hasMessages) {
          return {
            ...this.getEmptyAnalysis(data.remoteJid),
            metadata: data.metadata || {}
          };
        }

        try {
          const analysis = await this.analyzeSalesConversation(data.conversation, data.remoteJid);
          return {
            ...analysis,
            metadata: data.metadata || {},
            analysisSuccess: true
          };
        } catch (error) {
          // Log OpenAI quota errors prominently
          if (error.code === 'insufficient_quota' || error.status === 429) {
            console.error(`❌ OpenAI QUOTA EXCEEDED for ${data.remoteJid}: ${error.message}`);
          } else {
            console.error(`❌ OTHER AI ERROR for ${data.remoteJid}: ${error.message}`);
            console.error(`   Error Type: ${error.name || 'Unknown'}`);
            console.error(`   Error Code: ${error.code || 'none'}`);
            if (error.stack) {
              console.error(`   Stack: ${error.stack.split('\n')[0]}`);
            }
          }

          return {
            ...this.getEmptyAnalysis(data.remoteJid),
            error: error.message,
            errorCode: error.code || 'unknown',
            metadata: data.metadata || {},
            analysisSuccess: false
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      accumulatedForSave.push(...batchResults);

      // Report batch errors
      const batchErrors = batchResults.filter(result => !result.analysisSuccess);
      const quotaErrors = batchErrors.filter(result => result.errorCode === 'insufficient_quota');

      if (quotaErrors.length > 0) {
        console.error(`🚨 BATCH ${batchNumber}: ${quotaErrors.length}/${batchResults.length} failed due to OpenAI QUOTA EXCEEDED`);
      } else if (batchErrors.length > 0) {
        console.error(`⚠️ BATCH ${batchNumber}: ${batchErrors.length}/${batchResults.length} failed due to other errors`);
      } else {
        console.log(`✅ BATCH ${batchNumber}: ${batchResults.length}/${batchResults.length} analyzed successfully`);
      }

      // Incremental save every SAVE_INTERVAL batches
      if (incrementalSaveCallback && batchNumber % SAVE_INTERVAL === 0) {
        const successfulInBatch = accumulatedForSave.filter(result => result.analysisSuccess);

        if (successfulInBatch.length > 0) {
          console.log(`\n📦 INCREMENTAL SAVE at batch ${batchNumber}: ${successfulInBatch.length} successful analyses`);

          try {
            await incrementalSaveCallback(successfulInBatch);
            console.log(`✅ Incremental save completed successfully\n`);
          } catch (error) {
            console.error(`❌ Incremental save failed:`, error.message);
          }
        }

        accumulatedForSave = []; // Clear accumulator after save
      }

      // Rate limiting delay between batches
      if (i + batchSize < conversationData.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final save for any remaining records
    if (incrementalSaveCallback && accumulatedForSave.length > 0) {
      const successfulRemaining = accumulatedForSave.filter(result => result.analysisSuccess);

      if (successfulRemaining.length > 0) {
        console.log(`\n📦 FINAL INCREMENTAL SAVE: ${successfulRemaining.length} successful analyses`);

        try {
          await incrementalSaveCallback(successfulRemaining);
          console.log(`✅ Final incremental save completed successfully\n`);
        } catch (error) {
          console.error(`❌ Final incremental save failed:`, error.message);
        }
      }
    }

    // Final summary
    const totalSuccess = results.filter(result => result.analysisSuccess).length;
    const totalQuotaErrors = results.filter(result => result.errorCode === 'insufficient_quota').length;
    const totalOtherErrors = results.filter(result => !result.analysisSuccess && result.errorCode !== 'insufficient_quota').length;

    console.log(`\n📊 AI ANALYSIS SUMMARY:`);
    console.log(`   ✅ Successful: ${totalSuccess}/${results.length}`);
    if (totalQuotaErrors > 0) {
      console.log(`   🚨 OpenAI Quota Exceeded: ${totalQuotaErrors}/${results.length}`);
    }
    if (totalOtherErrors > 0) {
      console.log(`   ⚠️ Other Errors: ${totalOtherErrors}/${results.length}`);
    }

    return results;
  }
}