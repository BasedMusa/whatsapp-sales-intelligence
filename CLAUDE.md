# WhatsApp Sales Intelligence System

This repository contains a complete WhatsApp analysis system that captures and analyzes WhatsApp conversations using AI for sales intelligence.

## Project Overview

A production-ready system that connects to WhatsApp via Evolution API, captures all conversations, and uses OpenAI GPT to extract sales insights including:
- Customer information and lead stages
- Product interests and specifications
- Sales agent performance tracking
- Conversation sentiment and urgency levels
- Follow-up recommendations

## Tech Stack

- **Evolution API**: WhatsApp Web integration
- **Node.js**: Backend processing with parallel conversation analysis
- **OpenAI GPT-3.5-turbo**: AI-powered conversation analysis
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Docker**: Containerized deployment
- **Render.com/Fly.io**: Cloud hosting options

## Architecture

```
[WhatsApp] → [Evolution API] → [Supabase Database] → [Analysis System] → [Dashboard]
```

## Key Features

- 24/7 WhatsApp message capture and analysis
- Incremental processing with conversation caching
- Parallel processing (8 conversations simultaneously)
- Progress preservation across restarts
- Real-time data storage in Supabase
- Sales intelligence extraction with 35+ data points per conversation

## Development

- Run tests: No test framework configured yet
- Linting: No linting configured yet
- Main entry: `src/index.js` for analysis system
- Database: All schemas migrated to Supabase
- Deployment: Ready for Render.com, Fly.io, or Railway

## Deployment

Use `./deploy-to-render.sh` for free Render.com deployment or `./deploy-to-fly.sh` for Fly.io deployment.