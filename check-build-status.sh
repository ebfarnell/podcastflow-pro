#!/bin/bash

echo "🔍 PodcastFlow Pro Build Status Check"
echo "====================================="
echo

# Check if build process is running
if pgrep -f "next build" > /dev/null; then
    echo "⏳ Build Status: RUNNING"
    
    # Get process info
    BUILD_PID=$(pgrep -f "next build" | tail -1)
    echo "   PID: $BUILD_PID"
    
    # Get CPU and memory usage
    ps aux | grep $BUILD_PID | grep -v grep | awk '{printf "   CPU: %s%%  Memory: %s%%\n", $3, $4}'
    
    # Get runtime
    ps -o etime= -p $BUILD_PID | awk '{printf "   Runtime: %s\n", $1}'
    
    # Check .next directory size
    if [ -d .next ]; then
        SIZE=$(du -sh .next 2>/dev/null | cut -f1)
        echo "   .next size: $SIZE"
    fi
else
    echo "❌ Build Status: NOT RUNNING"
fi

echo

# Check for BUILD_ID
if [ -f .next/BUILD_ID ]; then
    echo "✅ BUILD COMPLETE!"
    echo "   BUILD_ID: $(cat .next/BUILD_ID)"
    echo "   Ready to restart PM2"
else
    echo "⚠️  BUILD_ID not found yet"
fi

echo

# Check recent files in .next
if [ -d .next ]; then
    echo "📁 Recent .next files:"
    ls -lt .next/ 2>/dev/null | head -5 | tail -4
fi

echo

# Check PM2 status
echo "🚀 PM2 Status:"
pm2 list | grep podcastflow-pro

echo
echo "To restart after build completes:"
echo "  pm2 restart podcastflow-pro"