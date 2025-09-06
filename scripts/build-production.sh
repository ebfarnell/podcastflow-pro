#!/bin/bash

# Production build script that runs the build in background and monitors it
# This works around any interactive shell timeout limitations

BUILD_TIMEOUT_SEC="${BUILD_TIMEOUT_SEC:-600}"
BUILD_PID_FILE="/tmp/podcastflow-build-$$.pid"
BUILD_STATUS_FILE="/tmp/podcastflow-build-$$.status"

# Ensure .next directory exists
mkdir -p .next

BUILD_LOG_FILE=".next/build-production-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Starting production build (timeout: ${BUILD_TIMEOUT_SEC}s)"
echo "📝 Build log: $BUILD_LOG_FILE"

# Clean up previous status files
rm -f "$BUILD_PID_FILE" "$BUILD_STATUS_FILE"

# Start the build in background
(
    # Run the actual build command
    npm run build > "$BUILD_LOG_FILE" 2>&1
    echo $? > "$BUILD_STATUS_FILE"
) &

BUILD_PID=$!
echo $BUILD_PID > "$BUILD_PID_FILE"

echo "✅ Build started with PID: $BUILD_PID"
echo "⏳ Waiting for build to complete (max ${BUILD_TIMEOUT_SEC}s)..."

# Monitor the build
ELAPSED=0
while [ $ELAPSED -lt $BUILD_TIMEOUT_SEC ]; do
    if [ -f "$BUILD_STATUS_FILE" ]; then
        STATUS=$(cat "$BUILD_STATUS_FILE")
        rm -f "$BUILD_PID_FILE" "$BUILD_STATUS_FILE"
        
        if [ "$STATUS" -eq "0" ]; then
            echo "✅ Build completed successfully!"
            echo "📋 Last 20 lines of build output:"
            tail -20 "$BUILD_LOG_FILE"
            exit 0
        else
            echo "❌ Build failed with exit code: $STATUS"
            echo "📋 Last 50 lines of build output:"
            tail -50 "$BUILD_LOG_FILE"
            exit $STATUS
        fi
    fi
    
    if ! kill -0 $BUILD_PID 2>/dev/null; then
        # Process died without writing status
        echo "⚠️ Build process terminated unexpectedly"
        exit 1
    fi
    
    # Show progress every 30 seconds
    if [ $((ELAPSED % 30)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        echo "  Still building... (${ELAPSED}s elapsed)"
    fi
    
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

# Timeout reached
echo "⏱️ Build timeout reached (${BUILD_TIMEOUT_SEC}s)"
kill -TERM $BUILD_PID 2>/dev/null
sleep 2
kill -KILL $BUILD_PID 2>/dev/null
rm -f "$BUILD_PID_FILE" "$BUILD_STATUS_FILE"

echo "📋 Last 50 lines of build output:"
tail -50 "$BUILD_LOG_FILE"
exit 124