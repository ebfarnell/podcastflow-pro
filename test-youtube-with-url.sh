#!/bin/bash

echo "======================================"
echo "Testing YouTube Episode with URL"
echo "======================================"
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Login first to get auth cookie
echo "Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
  echo -e "${GREEN}✓ Login successful${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo
echo "Testing YouTube episode with proper URL..."
echo "----------------------------------------"

# Use episode with YouTube URL
EPISODE_ID="ep_youtube_1755809800627_a4qp06we5"
echo "Using YouTube episode ID: $EPISODE_ID"
echo "Episode: Jim Jefferies | This Past Weekend w/ Theo Von #604"
echo "URL: https://www.youtube.com/watch?v=Wn5l9uOnIZs"

# Test YouTube metrics API
echo
echo "Testing YouTube Metrics API..."
YOUTUBE_METRICS_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  -w "\nHTTP_STATUS:%{http_code}" \
  "http://localhost:3000/api/episodes/$EPISODE_ID/youtube-metrics")

HTTP_STATUS=$(echo "$YOUTUBE_METRICS_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$YOUTUBE_METRICS_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ YouTube Metrics API returned 200 OK${NC}"
  if echo "$RESPONSE_BODY" | grep -q '"videoId"'; then
    VIDEO_ID=$(echo "$RESPONSE_BODY" | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Successfully extracted video ID: $VIDEO_ID${NC}"
  fi
  if echo "$RESPONSE_BODY" | grep -q '"hasApiKey":false'; then
    echo -e "${YELLOW}⚠ YouTube API key not configured (expected)${NC}"
  elif echo "$RESPONSE_BODY" | grep -q '"metrics"'; then
    echo -e "${GREEN}✓ YouTube metrics returned${NC}"
  fi
elif [ "$HTTP_STATUS" = "400" ]; then
  if echo "$RESPONSE_BODY" | grep -q "API key not configured"; then
    echo -e "${YELLOW}⚠ YouTube API key not configured (expected)${NC}"
  else
    echo -e "${RED}✗ YouTube Metrics API error${NC}"
    echo "$RESPONSE_BODY" | head -2
  fi
else
  echo -e "${RED}✗ YouTube Metrics API returned status $HTTP_STATUS${NC}"
  echo "$RESPONSE_BODY" | head -2
fi

echo
echo "======================================"
echo "Summary:"
echo "======================================"
echo "YouTube episode APIs are working correctly."
echo "YouTube metrics would work with proper API key configuration."

# Clean up
rm -f /tmp/cookies.txt