import fs from 'fs/promises';
import path from 'path';

export class Logger {
  constructor(logLevel = 'info') {
    this.logLevel = logLevel;
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    // Create logs directory if it doesn't exist
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir('logs', { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };

    return JSON.stringify(logMessage);
  }

  async writeToFile(level, message, data = null) {
    try {
      const logFile = path.join('logs', `${new Date().toISOString().split('T')[0]}.log`);
      const logEntry = this.formatMessage(level, message, data) + '\n';
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  async error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(`❌ ERROR: ${message}`, data || '');
      await this.writeToFile('error', message, data);
    }
  }

  async warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ WARN: ${message}`, data || '');
      await this.writeToFile('warn', message, data);
    }
  }

  async info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ INFO: ${message}`, data || '');
      await this.writeToFile('info', message, data);
    }
  }

  async debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.log(`🐛 DEBUG: ${message}`, data || '');
      await this.writeToFile('debug', message, data);
    }
  }

  async logPerformanceMetrics(metrics) {
    const metricsMessage = `Performance Metrics: ${JSON.stringify(metrics, null, 2)}`;
    await this.info('PERFORMANCE_METRICS', metrics);
  }

  async logAnalysisStats(stats) {
    await this.info('ANALYSIS_STATISTICS', stats);
  }

  async logProcessingBatch(batchInfo) {
    await this.info(`Processing batch ${batchInfo.currentBatch}/${batchInfo.totalBatches} (${batchInfo.itemsInBatch} items)`);
  }
}