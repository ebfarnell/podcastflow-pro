#!/bin/bash

echo "🚀 Optimizing Next.js build process..."

# Create build cache directory if it doesn't exist
CACHE_DIR="/home/ec2-user/podcastflow-pro/.next/cache"
mkdir -p "$CACHE_DIR"

# Set environment variables for build optimization
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable build caching
export NEXT_BUILD_CACHE=1

# Run the dynamic routes fix first
echo "📝 Fixing dynamic route exports..."
/home/ec2-user/podcastflow-pro/scripts/fix-dynamic-routes.sh

# Clean up old build artifacts but keep cache
echo "🧹 Cleaning old build artifacts..."
find /home/ec2-user/podcastflow-pro/.next -name "*.js.map" -delete 2>/dev/null || true
find /home/ec2-user/podcastflow-pro/.next -name "*.d.ts" -delete 2>/dev/null || true

# Remove trace files to save space
rm -f /home/ec2-user/podcastflow-pro/.next/trace

echo "✅ Build optimizations complete!"
echo ""
echo "To build with optimizations, run:"
echo "  npm run build"