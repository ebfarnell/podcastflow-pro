#!/bin/bash

echo "Clearing all Next.js build caches..."

# Clear Next.js caches
rm -rf .next/cache
rm -rf .next/trace

# Clear any potential CDN/browser caches by updating build ID
echo "$(date +%s)" > .next/BUILD_ID

# Clear PM2 logs to save space
pm2 flush

# Restart PM2 with updated environment
pm2 restart podcastflow-pro --update-env

echo "Build cache cleared and application restarted"
echo "Build ID: $(cat .next/BUILD_ID)"
echo ""
echo "IMPORTANT: Users may need to:"
echo "1. Hard refresh their browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "2. Clear browser cache"
echo "3. Open in incognito/private browsing mode"