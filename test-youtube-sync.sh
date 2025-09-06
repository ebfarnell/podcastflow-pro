#!/bin/bash

echo "Testing YouTube Sync Functionality"
echo "==================================="
echo

# Test login and get auth token
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST \
  https://app.podcastflow.pro/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/cookies-youtube-sync.txt)

if echo "$LOGIN_RESPONSE" | grep -q "user"; then
  echo "✓ Login successful"
else
  echo "✗ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

# Test manual sync via integrations endpoint
echo
echo "2. Testing manual YouTube sync via Integrations API..."
SYNC_RESPONSE=$(curl -s -X POST \
  https://app.podcastflow.pro/api/integrations/youtube/sync \
  -H "Content-Type: application/json" \
  -b /tmp/cookies-youtube-sync.txt)

echo "Response: $SYNC_RESPONSE"

if echo "$SYNC_RESPONSE" | grep -q "success"; then
  echo "✓ Manual sync triggered successfully"
else
  echo "✗ Manual sync failed"
fi

# Test cron endpoint (with secret)
echo
echo "3. Testing cron endpoint..."
CRON_RESPONSE=$(curl -s -X GET \
  https://app.podcastflow.pro/api/cron/youtube-sync \
  -H "x-cron-secret: podcastflow-cron-secret-2025" \
  -H "Content-Type: application/json")

echo "Response: $CRON_RESPONSE"

if echo "$CRON_RESPONSE" | grep -q "organizationsSynced"; then
  echo "✓ Cron endpoint works"
else
  echo "✗ Cron endpoint failed"
fi

# Check cron service status
echo
echo "4. Checking cron service status..."
pm2 list | grep podcastflow-cron

echo
echo "==================================="
echo "YouTube Sync Test Complete"

# Clean up
rm -f /tmp/cookies-youtube-sync.txt
