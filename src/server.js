#!/usr/bin/env node

import express from 'express';
import dotenv from 'dotenv';
import { ChatService } from './services/chatService.js';
import { AIAnalyzer } from './services/aiAnalyzer.js';
import { DatabaseService } from './services/databaseService.js';
import { Logger } from './utils/logger.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

class WhatsAppSalesIntelligence {
  constructor() {
    this.logger = new Logger(process.env.LOG_LEVEL || 'info');
    this.chatService = new ChatService();
    this.aiAnalyzer = new AIAnalyzer();
    this.databaseService = new DatabaseService();
    this.initialized = false;
    this.config = {
      concurrentChats: parseInt(process.env.CONCURRENT_CHATS) || 8,
      batchSize: parseInt(process.env.BATCH_SIZE) || 50,
      maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH) || 200,
      aiConcurrency: 5
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.logger.info('🚀 Initializing WhatsApp Sales Intelligence System');

      // Try to initialize database schema (non-blocking)
      try {
        await this.databaseService.initializeSchema();
        await this.logger.info('✅ Database schema initialized');
      } catch (error) {
        await this.logger.warn('⚠️ Database initialization failed, continuing without DB', { error: error.message });
      }

      // Validate OpenAI connection
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      this.initialized = true;
      await this.logger.info('✅ System initialization completed');
    } catch (error) {
      await this.logger.error('❌ Initialization failed', { error: error.message });
      throw error;
    }
  }
}

const intelligence = new WhatsAppSalesIntelligence();

// Health check endpoint
app.get('/', async (req, res) => {
  try {
    const status = {
      status: 'ok',
      service: 'WhatsApp Sales Intelligence',
      timestamp: new Date().toISOString(),
      initialized: intelligence.initialized,
      environment: {
        openai_configured: !!process.env.OPENAI_API_KEY,
        database_configured: !!process.env.DB_HOST || !!process.env.DATABASE_URL,
        concurrent_chats: intelligence.config.concurrentChats,
        batch_size: intelligence.config.batchSize
      }
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'WhatsApp Sales Intelligence API',
      status: intelligence.initialized ? 'ready' : 'initializing',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    if (intelligence.initialized) {
      // Try to get database stats
      try {
        const stats = await intelligence.databaseService.getAnalysisStats();
        status.database_stats = stats;
      } catch (error) {
        status.database_error = error.message;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start analysis endpoint (placeholder for now)
app.post('/analyze', async (req, res) => {
  try {
    if (!intelligence.initialized) {
      return res.status(503).json({
        status: 'error',
        message: 'System not initialized yet'
      });
    }

    // Placeholder response for now
    res.json({
      status: 'analysis_placeholder',
      message: 'WhatsApp conversation analysis endpoint ready',
      note: 'Full analysis implementation requires database connectivity',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Initialize the system when server starts
intelligence.initialize().catch(console.error);

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 WhatsApp Sales Intelligence server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/`);
  console.log(`📈 Status endpoint: http://localhost:${port}/status`);
  console.log(`🔍 Analysis endpoint: POST http://localhost:${port}/analyze`);
});