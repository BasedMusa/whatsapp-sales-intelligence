#!/bin/bash

# Deploy WhatsApp Analysis System to Fly.io
echo "🚀 Deploying WhatsApp Analysis System to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl not found. Please install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Login to Fly.io (if not already logged in)
echo "🔐 Checking Fly.io authentication..."
flyctl auth whoami || {
    echo "Please login to Fly.io:"
    flyctl auth login
}

# Deploy Redis first (dependency)
echo "📦 Deploying Redis..."
flyctl launch --config redis-fly.toml --name whatsapp-redis --region iad --no-deploy
flyctl volumes create redis_data --app whatsapp-redis --region iad --size 1
flyctl deploy --app whatsapp-redis

# Get Redis internal address
REDIS_URL="redis://whatsapp-redis.flycast:6379"
echo "✅ Redis deployed. Internal URL: $REDIS_URL"

# Deploy Evolution API
echo "📱 Deploying Evolution API..."
flyctl launch --config fly.toml --name whatsapp-evolution-api --region iad --no-deploy

# Set secrets for Evolution API
flyctl secrets set \
  DATABASE_CONNECTION_URI="postgresql://postgres:wI7.%23WjF4k%3AEQ2Z@db.cjclurjjnljsulihbgoi.supabase.co:5432/postgres?schema=public&sslmode=require" \
  CACHE_REDIS_URI="$REDIS_URL/6" \
  --app whatsapp-evolution-api

flyctl deploy --app whatsapp-evolution-api
echo "✅ Evolution API deployed"

# Deploy Analysis System
echo "🧠 Deploying Analysis System..."
flyctl launch --config analysis-fly.toml --name whatsapp-analysis-system --region iad --no-deploy

# Set secrets for Analysis System
flyctl secrets set \
  DB_HOST="db.cjclurjjnljsulihbgoi.supabase.co" \
  DB_PORT="5432" \
  DB_NAME="postgres" \
  DB_USER="postgres" \
  DB_PASSWORD="wI7.#WjF4k:EQ2Z" \
  SUPABASE_PROJECT_URL="https://cjclurjjnljsulihbgoi.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqY2x1cmpqbmxqc3VsaWhiZ29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MzkwOCwiZXhwIjoyMDczNjE5OTA4fQ.JGnN5smQ78zmheLNL2ccsJn4zAXxDM84MifhBgN3gnk" \
  OPENAI_API_KEY="YOUR_OPENAI_API_KEY_HERE" \
  --app whatsapp-analysis-system

flyctl deploy --app whatsapp-analysis-system
echo "✅ Analysis System deployed"

# Show deployment URLs
echo ""
echo "🎉 Deployment Complete!"
echo "================================"
echo "📱 Evolution API: https://whatsapp-evolution-api.fly.dev"
echo "🧠 Analysis System: https://whatsapp-analysis-system.fly.dev"
echo "📊 Supabase Dashboard: https://supabase.com/dashboard/project/cjclurjjnljsulihbgoi"
echo ""
echo "🔑 Next Steps:"
echo "1. Visit the Evolution API URL to scan QR code"
echo "2. Your system will start analyzing WhatsApp messages automatically"
echo "3. Check Supabase for real-time analysis results"
echo ""
echo "💡 To check logs:"
echo "flyctl logs --app whatsapp-evolution-api"
echo "flyctl logs --app whatsapp-analysis-system"