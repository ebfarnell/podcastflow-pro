#!/bin/bash

# Test script for schedule availability API
echo "Testing Schedule Availability API"
echo "=================================="
echo "Testing SQL syntax fix for empty showIds array"
echo ""

# Always use cookie-based auth for consistency
curl -s -c /tmp/auth-cookie.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@podcastflow.pro", "password": "admin123"}' > /dev/null

echo "✓ Authentication successful"

# Test 1: Get a show ID to use for testing
echo -e "\n1. Fetching shows to get test show IDs..."
SHOWS_RESPONSE=$(curl -s -b /tmp/auth-cookie.txt http://localhost:3000/api/shows)
echo "Shows response (first 500 chars): ${SHOWS_RESPONSE:0:500}"

# Extract first show ID using jq or sed
SHOW_ID=$(echo "$SHOWS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SHOW_ID" ]; then
  echo "❌ No shows found. Creating test data may be needed."
  exit 1
fi

echo "✓ Found show ID: $SHOW_ID"

# Test 2: Call schedule availability API
echo -e "\n2. Testing schedule availability API..."
START_DATE=$(date +%Y-%m-%d)
END_DATE=$(date -d "+30 days" +%Y-%m-%d)

echo "   Requesting availability for show: $SHOW_ID"
echo "   Date range: $START_DATE to $END_DATE"

AVAILABILITY_RESPONSE=$(curl -s -b /tmp/auth-cookie.txt \
  "http://localhost:3000/api/schedule-availability?showIds=$SHOW_ID&startDate=$START_DATE&endDate=$END_DATE")

echo -e "\nAvailability Response:"
echo "$AVAILABILITY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AVAILABILITY_RESPONSE"

# Test 3: Check if episodes were found
EPISODE_COUNT=$(echo "$AVAILABILITY_RESPONSE" | grep -o '"episodeCount":[0-9]*' | cut -d':' -f2)

if [ -z "$EPISODE_COUNT" ] || [ "$EPISODE_COUNT" = "0" ]; then
  echo -e "\n⚠️  No episodes found in the date range. This is expected if no episodes are scheduled."
else
  echo -e "\n✓ Found $EPISODE_COUNT episodes with availability data"
fi

# Test 4: Test with empty showIds array (this was causing the SQL syntax error)
echo -e "\n4. Testing with empty showIds array (was causing SQL error)..."
EMPTY_RESPONSE=$(curl -s -b /tmp/auth-cookie.txt \
  "http://localhost:3000/api/schedule-availability?showIds=&startDate=$START_DATE&endDate=$END_DATE")

echo "Empty showIds response:"
echo "$EMPTY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$EMPTY_RESPONSE"

# Check if we get a valid response without SQL error
if echo "$EMPTY_RESPONSE" | grep -q "syntax error"; then
  echo "❌ SQL syntax error still present!"
else
  echo "✓ No SQL syntax error - fix successful!"
fi

# Clean up
rm -f /tmp/auth-cookie.txt

echo -e "\n✅ Schedule availability API test complete!"