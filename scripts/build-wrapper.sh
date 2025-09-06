#!/bin/bash

# Build wrapper script with configurable timeout and proper signal handling
# This script centralizes all build timeout logic to avoid nested timeout issues

# Configuration
BUILD_TIMEOUT_SEC="${BUILD_TIMEOUT_SEC:-600}"  # Default 10 minutes
BUILD_LOG_FILE=".next/build-log-$(date +%Y%m%d-%H%M%S).txt"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BUILD_LOG_FILE"
}

# Signal handler for cleanup
cleanup() {
    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
        echo -e "${RED}⏱️  Build timed out after ${BUILD_TIMEOUT_SEC} seconds${NC}"
        log "ERROR: Build timed out after ${BUILD_TIMEOUT_SEC} seconds"
        
        # Print last 50 lines of build log if available
        if [ -f "$BUILD_LOG_FILE" ]; then
            echo -e "${YELLOW}Last 50 lines of build output:${NC}"
            tail -50 "$BUILD_LOG_FILE"
        fi
    elif [ $exit_code -ne 0 ]; then
        echo -e "${RED}❌ Build failed with exit code: $exit_code${NC}"
        log "ERROR: Build failed with exit code: $exit_code"
    fi
    exit $exit_code
}

# Set up signal handling
trap cleanup EXIT INT TERM

# Print build configuration
echo -e "${GREEN}🏗️  Next.js Build Wrapper${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Build configuration:"
log "  Timeout: ${BUILD_TIMEOUT_SEC} seconds"
log "  Node options: ${NODE_OPTIONS}"
log "  Node version: $(node --version)"
log "  NPM version: $(npm --version)"
log "  Next.js version: $(npx next --version 2>/dev/null || echo 'unknown')"
log "  Working directory: $(pwd)"
log "  Timeout command: $(which timeout)"
log "  Timeout version: $(timeout --version | head -1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Export Node options
export NODE_OPTIONS

# Disable Next.js telemetry for faster builds
export NEXT_TELEMETRY_DISABLED=1

# Create build directory if needed
mkdir -p .next

# Start time tracking
START_TIME=$(date +%s)
log "Build started at $(date)"

# Run the build with timeout
# Using exec to replace shell process and ensure proper signal handling
# --preserve-status ensures we get Next.js exit code, not timeout's
echo -e "${YELLOW}⏳ Starting Next.js build (timeout: ${BUILD_TIMEOUT_SEC}s)...${NC}"

# Run build and capture output
timeout --preserve-status --signal=TERM --kill-after=10 "${BUILD_TIMEOUT_SEC}" \
    npx next build 2>&1 | tee -a "$BUILD_LOG_FILE"

BUILD_EXIT_CODE=${PIPESTATUS[0]}

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Log completion
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed successfully in ${DURATION} seconds${NC}"
    log "Build completed successfully in ${DURATION} seconds"
    
    # Clean up old build logs (keep last 5)
    find .next -name "build-log-*.txt" -type f | sort -r | tail -n +6 | xargs rm -f 2>/dev/null || true
else
    # Error handling is done in cleanup trap
    exit $BUILD_EXIT_CODE
fi

exit 0