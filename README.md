# WhatsApp Sales Intelligence Analyzer

A high-performance Node.js application that analyzes WhatsApp conversations from Evolution API to extract comprehensive sales intelligence using AI.

## Features

### 🚀 Performance Optimized
- **Parallel Processing**: Processes multiple chats simultaneously (5-10x faster than sequential)
- **Batch Operations**: Bulk database operations for maximum efficiency
- **Smart Rate Limiting**: Optimized API calls to prevent throttling
- **Expected Performance**: ~10-15 minutes total (vs 3+ hours sequential)

### 🤖 Comprehensive AI Analysis
- **Product Classification**: Apple Products, Non-Apple Laptops, Tablets, Phones, Watches, TVs, ACs, Refrigerators
- **Sales Agent Tracking**: Primary agents, handoffs, team involvement
- **Sales Process Intelligence**: Lead stages, next actions, customer objections
- **Customer Intelligence**: Names, locations, budgets, timelines, sentiment
- **Business Insights**: Upsell opportunities, competitor mentions, pain points

### 📊 Advanced Analytics
- **Real-time Statistics**: Analysis metrics, category breakdowns, priority leads
- **Performance Monitoring**: Processing times, success rates, confidence scores
- **Priority Lead Identification**: High-urgency prospects requiring immediate follow-up

## Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Docker Deployment (Recommended)
```bash
# Build and run with docker-compose
docker-compose up -d

# Or build and run manually
docker build -t whatsapp-sales-intelligence .
docker run --network evolution_network --env-file .env whatsapp-sales-intelligence
```

### 3. Local Development
```bash
# Install dependencies
npm install

# Run analysis
npm start

# Development mode with auto-reload
npm run dev
```

## Database Schema

The application creates a comprehensive `SalesAnalysisReport` table with 35+ fields:

### Core Data
- Product categorization and specifications
- Sales agent information and handoffs
- Lead stages and sales status
- Customer intelligence and contact details

### Business Intelligence
- Competitive analysis and upsell opportunities
- Customer sentiment and pain points
- Urgency levels and follow-up requirements
- Conversation metadata and AI confidence scores

## Configuration

### Environment Variables
```bash
# Database (matches Evolution API setup)
DB_USER=postgres
DB_HOST=postgres
DB_NAME=evolution_db
DB_PASSWORD=password
DB_PORT=5432

# AI Analysis
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-3.5-turbo  # or gpt-4

# Performance Tuning
CONCURRENT_CHATS=8           # Parallel chat processing
BATCH_SIZE=50               # Database batch size
MAX_CONVERSATION_LENGTH=200  # Message limit per chat
LOG_LEVEL=info              # error|warn|info|debug
```

## Key Performance Optimizations

### 1. Parallel Processing
- Processes 8 chats simultaneously by default
- Configurable concurrency levels
- Intelligent batching to prevent database overload

### 2. Smart Data Processing
- Only processes chats not in `SalesAnalysisReport` table
- Excludes group chats (focuses on individual sales conversations)
- Filters to last 3 months of activity

### 3. AI Efficiency
- Optimized prompts for structured JSON output
- Batch AI analysis with rate limiting
- Fallback handling for API errors

### 4. Database Optimization
- Bulk insert operations
- Proper indexing on key fields
- Connection pooling for concurrent access

## Usage Examples

### Run Full Analysis
```bash
npm start
```

### Docker with Custom Settings
```bash
docker run --network evolution_network \
  -e CONCURRENT_CHATS=10 \
  -e OPENAI_API_KEY=your_key \
  whatsapp-sales-intelligence
```

## Output

### Console Report
```
📊 SALES INTELLIGENCE REPORT
═══════════════════════════════════════════════════════════
Total Conversations Analyzed: 247
Apple Product Inquiries: 89
Completed Purchases: 23
High Urgency Leads: 15
Average AI Confidence: 0.84

🏷️ Top Product Categories:
  Apple Products: 89 (36.0%)
  Non-Apple Laptops: 45 (18.2%)
  Phones: 38 (15.4%)
  ...

🎯 High Priority Leads (Top 5):
  1. John Smith
     Category: Apple Products | Stage: Intent | Urgency: High
     Next Action: Send MacBook Pro pricing and schedule demo
```

### Detailed Logs
- Daily log files in `logs/` directory
- Performance metrics and processing statistics
- Error tracking and analysis confidence scores

## Production Deployment

### With Evolution API
1. Ensure your Evolution API is running with PostgreSQL
2. Add this service to the same Docker network
3. Set environment variables for database connection
4. Schedule regular runs via cron or process manager

### Monitoring
- Check `logs/` directory for processing logs
- Monitor database `SalesAnalysisReport` table for results
- Use provided statistics queries for business insights

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure `evolution_network` exists and PostgreSQL is accessible
2. **OpenAI API**: Verify API key and check rate limits
3. **Memory**: Increase Docker memory limits for large datasets

### Performance Tuning
- Reduce `CONCURRENT_CHATS` if database struggles
- Adjust `MAX_CONVERSATION_LENGTH` for very long chats
- Use `gpt-3.5-turbo` instead of `gpt-4` for faster processing

## Architecture

```
WhatsApp Sales Intelligence
├── Chat Processing (Parallel)
├── AI Analysis (Batched)
├── Database Storage (Bulk)
└── Analytics & Reporting
```

The system is designed for maximum efficiency while maintaining comprehensive analysis quality.