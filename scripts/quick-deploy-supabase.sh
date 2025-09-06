#!/bin/bash

# Quick Deployment with Supabase (Free PostgreSQL)

echo "🚀 Quick PodcastFlow Pro Deployment Guide"
echo "========================================"
echo ""
echo "This script will help you quickly deploy PodcastFlow Pro using Supabase's free PostgreSQL database."
echo ""
echo "Steps:"
echo "1. Go to https://supabase.com and create a free account"
echo "2. Create a new project (takes ~2 minutes)"
echo "3. Go to Settings → Database"
echo "4. Copy the connection string (URI)"
echo ""
echo "Press Enter when you have your Supabase database URL..."
read

echo "Please paste your Supabase database URL:"
read -r DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Database URL is required!"
    exit 1
fi

# Generate a secure secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

echo "Creating .env.production file..."
cat > .env.production << EOF
# Database
DATABASE_URL="$DATABASE_URL"

# Authentication
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"

# AWS Configuration (using existing EC2 IAM role)
AWS_REGION="us-east-1"
S3_BUCKET_NAME="podcastflow-pro-uploads"

# Email (using local mail for now)
EMAIL_FROM="noreply@podcastflow.local"
EMAIL_HOST="localhost"
EMAIL_PORT="25"
EMAIL_USER=""
EMAIL_PASSWORD=""

# Application
NEXT_PUBLIC_APP_URL="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
EOF

echo "✅ Environment file created"
echo ""
echo "Starting deployment..."
echo ""

# Run the deployment
./scripts/deploy-production.sh --seed

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Access your application at:"
echo "http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo ""
echo "Default credentials:"
echo "  Email: master@podcastflow.com"
echo "  Password: masterpassword123"
echo ""
echo "⚠️  Important: Change these credentials after first login!"