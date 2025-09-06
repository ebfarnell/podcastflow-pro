#!/bin/bash

# Production Deployment Script for PodcastFlow Pro

set -e

echo "🚀 Starting PodcastFlow Pro Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running as ec2-user
if [ "$USER" != "ec2-user" ]; then
    print_error "This script should be run as ec2-user"
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    print_error ".env.production file not found!"
    print_warning "Please create .env.production based on .env.production.example"
    exit 1
fi

# Load production environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "AWS_REGION"
    "S3_BUCKET_NAME"
    "EMAIL_FROM"
    "EMAIL_HOST"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_status "Environment variables validated"

# Stop the current PM2 process
print_status "Stopping current application..."
pm2 stop podcastflow-pro || true

# Pull latest changes (if using git)
if [ -d .git ]; then
    print_status "Pulling latest changes..."
    git pull origin main || print_warning "Git pull failed, continuing with local code"
fi

# Install dependencies
print_status "Installing dependencies..."
npm install --legacy-peer-deps --production=false

# Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate

# Test database connection
print_status "Testing database connection..."
if ! npx prisma db push --skip-generate 2>/dev/null; then
    print_error "Cannot connect to production database!"
    print_warning "Please check your DATABASE_URL in .env.production"
    exit 1
fi

# Run database migrations
print_status "Running database migrations..."
npx prisma migrate deploy || {
    print_warning "Migrations failed, trying db push instead..."
    npx prisma db push
}

# Build the application
print_status "Building production application..."
npm run build

# Copy static files
if [ -f ./scripts/copy-static-files.sh ]; then
    print_status "Copying static files..."
    ./scripts/copy-static-files.sh
fi

# Update PM2 configuration
print_status "Updating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'podcastflow-pro',
    script: '.next/standalone/server.js',
    cwd: '/home/ec2-user/podcastflow-pro',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: '/home/ec2-user/.pm2/logs/podcastflow-error.log',
    out_file: '/home/ec2-user/.pm2/logs/podcastflow-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
  }]
};
EOF

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Show application status
pm2 status

# Clear caches
if [ -f ./clear-caches.sh ]; then
    print_status "Clearing caches..."
    ./clear-caches.sh
fi

print_status "Deployment completed successfully!"
echo ""
echo "Application is running at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "To view logs: pm2 logs podcastflow-pro"
echo "To monitor: pm2 monit"
echo ""

# Check if seed data should be run
if [ "$1" == "--seed" ]; then
    print_warning "Running seed data..."
    npm run db:seed
    echo ""
    print_status "Seed data completed. Default users created."
fi