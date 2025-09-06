#!/bin/bash

echo "=== Clearing PodcastFlow Caches ==="

# 1. Clear Next.js cache
echo "1. Clearing Next.js cache..."
rm -rf .next/cache/*

# 2. Restart PM2 app
echo "2. Restarting PM2 app..."
pm2 restart podcastflow-pro

# 3. Wait for app to start
echo "3. Waiting for app to start..."
sleep 5

# 4. Clear nginx cache (if exists)
echo "4. Clearing nginx cache..."
sudo rm -rf /var/cache/nginx/*

# 5. Reload nginx
echo "5. Reloading nginx..."
sudo nginx -s reload

# 6. Update build ID to force client refresh
echo "6. Updating build ID..."
BUILD_ID=$(date +%s)
echo $BUILD_ID > .next/BUILD_ID

echo ""
echo "=== Cache clearing complete ==="
echo ""
echo "To force browser refresh, users should:"
echo "1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
echo "2. Clear browser cache"
echo "3. Open DevTools > Application > Storage > Clear site data"
echo ""
echo "Current build ID: $BUILD_ID"