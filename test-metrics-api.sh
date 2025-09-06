#!/bin/bash

# Test the metrics API with authentication

echo "=== Testing Metrics API for Theo Von Show ==="
echo

# Login first to get auth token
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}')

echo "Login response: $LOGIN_RESPONSE"
echo

# Test metrics API
echo "2. Fetching metrics for show_1755587882316_e5ccuvioa..."
METRICS_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  http://localhost:3000/api/shows/show_1755587882316_e5ccuvioa/metrics)

echo "Metrics response:"
echo "$METRICS_RESPONSE" | jq '.' 2>/dev/null || echo "$METRICS_RESPONSE"
echo

# Test metrics history API
echo "3. Fetching metrics history..."
HISTORY_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  "http://localhost:3000/api/shows/show_1755587882316_e5ccuvioa/metrics/history?days=30")

echo "History response (first 10 entries):"
echo "$HISTORY_RESPONSE" | jq '.history[:10]' 2>/dev/null || echo "$HISTORY_RESPONSE"
echo

# Check if we have YouTube data
echo "4. Checking for YouTube data in response..."
echo "$METRICS_RESPONSE" | jq '{
  totalYoutubeViews: .totalYoutubeViews,
  totalYoutubeLikes: .totalYoutubeLikes,
  avgYoutubeViews: .avgYoutubeViews,
  avgYoutubeLikes: .avgYoutubeLikes,
  episodesWithYoutubeData: .episodesWithYoutubeData
}' 2>/dev/null

# Clean up
rm -f /tmp/cookies.txt

echo
echo "=== Test Complete ==="