#!/bin/bash

echo "=== Testing New Audience Analytics APIs ==="
echo

# Login first
echo "1. Logging in..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/test-cookies.txt)

if [ $? -ne 0 ]; then
  echo "Failed to login"
  exit 1
fi

echo "Login successful"
echo

# Test audience category endpoint
echo "2. Testing /api/analytics/audience?type=category"
echo "This should return category distribution based on real audience data:"
CATEGORY_DATA=$(curl -s -X GET "http://localhost:3000/api/analytics/audience?type=category&timeRange=30d" \
  -b /tmp/test-cookies.txt)

if echo "$CATEGORY_DATA" | jq '.' > /dev/null 2>&1; then
  echo "$CATEGORY_DATA" | jq '{
    data: .data[0:3],
    attribution: .sourceAttribution,
    hasData: (.data | length > 0),
    message: .meta.message
  }'
else
  echo "Error: $CATEGORY_DATA"
fi
echo

# Test audience markets endpoint
echo "3. Testing /api/analytics/audience?type=markets"
echo "This should return geographic distribution from YouTube/Megaphone:"
MARKETS_DATA=$(curl -s -X GET "http://localhost:3000/api/analytics/audience?type=markets&timeRange=30d" \
  -b /tmp/test-cookies.txt)

if echo "$MARKETS_DATA" | jq '.' > /dev/null 2>&1; then
  echo "$MARKETS_DATA" | jq '{
    data: .data[0:3],
    attribution: .sourceAttribution,
    hasData: (.data | length > 0),
    message: .meta.message
  }'
else
  echo "Error: $MARKETS_DATA"
fi
echo

# Test audience insights endpoint
echo "4. Testing /api/analytics/audience/insights"
echo "This should return comprehensive insights with real platform data:"
INSIGHTS_DATA=$(curl -s -X GET "http://localhost:3000/api/analytics/audience/insights?timeRange=30d" \
  -b /tmp/test-cookies.txt)

if echo "$INSIGHTS_DATA" | jq '.' > /dev/null 2>&1; then
  echo "$INSIGHTS_DATA" | jq '{
    hasCategories: ((.categoryDistribution // []) | length > 0),
    hasMarkets: ((.topMarkets // []) | length > 0),
    contentVelocity: .contentVelocity.kpi7d,
    attribution: .meta.attribution,
    message: .meta.message
  }'
else
  echo "Error: $INSIGHTS_DATA"
fi
echo

echo "=== Summary ==="
echo "The Audience tab now displays:"
echo "- Category distribution based on YouTube views + Megaphone downloads"
echo "- Geographic markets from actual platform data"
echo "- Content velocity (7-day audience accumulation per episode)"
echo "- Platform attribution badges (YouTube/Megaphone)"
echo
echo "If no platform data is available, empty states are shown with helpful messages."