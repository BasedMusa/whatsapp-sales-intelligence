#!/bin/bash

# Deploy to Render.com (No Credit Card Required)
echo "🚀 Deploying to Render.com (FREE - No Credit Card)..."
echo ""
echo "📋 Steps to deploy:"
echo ""
echo "1. Go to: https://dashboard.render.com/register"
echo "   - Sign up with GitHub (no credit card needed)"
echo ""
echo "2. Click 'New +' → 'Web Service'"
echo ""
echo "3. Connect your GitHub repo or use 'Public Git repository'"
echo "   - If using public repo, enter: https://github.com/your-username/your-repo"
echo ""
echo "4. Configure:"
echo "   - Name: whatsapp-evolution"
echo "   - Runtime: Docker"
echo "   - Branch: main"
echo "   - Dockerfile Path: ./Dockerfile.evolution"
echo ""
echo "5. Set Environment Variables (copy these):"
echo ""
cat << 'EOF'
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_HISTORIC=true
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
CACHE_LOCAL_ENABLED=true
CACHE_REDIS_ENABLED=false
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_ENABLED=true
DATABASE_CONNECTION_URI=postgresql://postgres:wI7.%23WjF4k%3AEQ2Z@db.cjclurjjnljsulihbgoi.supabase.co:5432/postgres?schema=public&sslmode=require
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_DATA_CONTACTS=true
AUTHENTICATION_API_KEY=whatsapp-exporter-key-2024
TZ=America/Sao_Paulo
EOF

echo ""
echo "6. Click 'Create Web Service'"
echo ""
echo "⏰ Note: Free tier apps sleep after 15 min of inactivity"
echo "   They wake up automatically when you access them"
echo ""
echo "🔗 Your Evolution API will be at:"
echo "   https://whatsapp-evolution.onrender.com"
echo ""
echo "📱 After deployment, visit the URL to scan QR code!"