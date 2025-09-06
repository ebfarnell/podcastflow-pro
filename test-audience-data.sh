#!/bin/bash

echo "=== Testing Audience Tab Data Sources ==="
echo

# Login and get auth token
echo "1. Logging in to get auth token..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/cookies.txt)

if [ $? -ne 0 ]; then
  echo "Failed to login"
  exit 1
fi

echo "Login successful"
echo

# Test audience data endpoint (category type)
echo "2. Testing /api/analytics/audience?type=category"
echo "This provides the PIE CHART data:"
AUDIENCE_DATA=$(curl -s -X GET "http://localhost:3000/api/analytics/audience?type=category" \
  -b /tmp/cookies.txt)
echo "$AUDIENCE_DATA" | jq '.' || echo "$AUDIENCE_DATA"
echo

# Test audience insights endpoint
echo "3. Testing /api/analytics/audience/insights?timeRange=30d"
echo "This provides the INSIGHTS PANEL data:"
INSIGHTS_DATA=$(curl -s -X GET "http://localhost:3000/api/analytics/audience/insights?timeRange=30d" \
  -b /tmp/cookies.txt)

echo "Key metrics returned:"
echo "- avgListeningDuration: $(echo "$INSIGHTS_DATA" | jq -r '.avgListeningDuration')"
echo "- completionRate: $(echo "$INSIGHTS_DATA" | jq -r '.completionRate')"
echo "- returnListenerRate: $(echo "$INSIGHTS_DATA" | jq -r '.returnListenerRate')"
echo "- bingeBehavior: $(echo "$INSIGHTS_DATA" | jq -r '.bingeBehavior')"
echo "- churnRisk: $(echo "$INSIGHTS_DATA" | jq -r '.churnRisk')"
echo

echo "Top Categories (from actual shows):"
echo "$INSIGHTS_DATA" | jq '.topCategories' 2>/dev/null || echo "[]"
echo

echo "Top Markets (from actual advertisers):"
echo "$INSIGHTS_DATA" | jq '.topMarkets' 2>/dev/null || echo "[]"
echo

echo "Listening Devices (should be empty - no real data):"
echo "$INSIGHTS_DATA" | jq '.listeningDevices' 2>/dev/null || echo "[]"
echo

echo "Platform Distribution (should be empty - no real data):"
echo "$INSIGHTS_DATA" | jq '.platformDistribution' 2>/dev/null || echo "[]"
echo

echo "=== SUMMARY ==="
echo "The Audience tab displays:"
echo "1. PIE CHART: Real show category distribution from your database"
echo "2. INSIGHTS PANEL:"
echo "   - Real data: topCategories (from shows), topMarkets (from advertisers)"
echo "   - Calculated metrics: bingeBehavior, contentVelocity (from episode/show counts)"
echo "   - Empty/zero data: listening duration, devices, platforms (no real analytics integration)"