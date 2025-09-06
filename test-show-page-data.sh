#!/bin/bash

# Test Script for Show Page Data Validation
# This script tests all tabs on the Show page to ensure they're using real data

echo "========================================"
echo "Show Page Data Validation Test"
echo "Testing show: show_1755587882316_e5ccuvioa (This Past Weekend)"
echo "========================================"

# Login as PodcastFlow Pro admin
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -i)

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | grep -i "set-cookie: auth-token=" | sed 's/.*auth-token=\([^;]*\).*/\1/')

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Test 1: Episodes API - Check for YouTube/Megaphone data
echo "1. Testing Episodes Tab Data..."
echo "--------------------------------"
EPISODES=$(curl -s -H "Cookie: auth-token=$AUTH_TOKEN" \
  "http://localhost:3000/api/episodes?showId=show_1755587882316_e5ccuvioa&limit=2")

EPISODE_COUNT=$(echo "$EPISODES" | jq '.total')
echo "   Episodes found: $EPISODE_COUNT"

if [ "$EPISODE_COUNT" -gt 0 ]; then
  FIRST_EPISODE=$(echo "$EPISODES" | jq '.episodes[0]')
  echo "   First episode:"
  echo "     Title: $(echo "$FIRST_EPISODE" | jq -r '.title')"
  echo "     YouTube Views: $(echo "$FIRST_EPISODE" | jq -r '.youtubeViewCount')"
  echo "     YouTube Likes: $(echo "$FIRST_EPISODE" | jq -r '.youtubeLikeCount')"
  echo "     YouTube URL: $(echo "$FIRST_EPISODE" | jq -r '.youtubeUrl')"
  echo "     Megaphone Downloads: $(echo "$FIRST_EPISODE" | jq -r '.megaphoneDownloads')"
  
  # Check if YouTube data is present
  YOUTUBE_VIEWS=$(echo "$FIRST_EPISODE" | jq -r '.youtubeViewCount')
  if [ "$YOUTUBE_VIEWS" != "null" ] && [ "$YOUTUBE_VIEWS" != "0" ]; then
    echo "   ✅ YouTube data is present"
  else
    echo "   ⚠️  YouTube data is missing or zero"
  fi
fi
echo ""

# Test 2: Campaigns API
echo "2. Testing Campaigns Tab Data..."
echo "--------------------------------"
CAMPAIGNS=$(curl -s -H "Cookie: auth-token=$AUTH_TOKEN" \
  "http://localhost:3000/api/campaigns?showId=show_1755587882316_e5ccuvioa")

CAMPAIGN_COUNT=$(echo "$CAMPAIGNS" | jq '.campaigns | length' 2>/dev/null || echo "0")
echo "   Campaigns found: $CAMPAIGN_COUNT"
echo ""

# Test 3: YouTube Analytics API
echo "3. Testing YouTube Analytics Tab..."
echo "-----------------------------------"
YOUTUBE_ANALYTICS=$(curl -s -H "Cookie: auth-token=$AUTH_TOKEN" \
  "http://localhost:3000/api/shows/show_1755587882316_e5ccuvioa/youtube-analytics")

TOTAL_VIEWS=$(echo "$YOUTUBE_ANALYTICS" | jq '.totalMetrics.totalViews' 2>/dev/null)
if [ "$TOTAL_VIEWS" != "null" ] && [ "$TOTAL_VIEWS" != "0" ]; then
  echo "   ✅ YouTube Analytics working"
  echo "     Total Views: $TOTAL_VIEWS"
  echo "     Total Likes: $(echo "$YOUTUBE_ANALYTICS" | jq '.totalMetrics.totalLikes')"
else
  echo "   ⚠️  YouTube Analytics not returning data"
fi
echo ""

# Test 4: Megaphone Analytics API
echo "4. Testing Megaphone Analytics Tab..."
echo "-------------------------------------"
MEGAPHONE_ANALYTICS=$(curl -s -H "Cookie: auth-token=$AUTH_TOKEN" \
  "http://localhost:3000/api/shows/show_1755587882316_e5ccuvioa/megaphone-analytics")

TOTAL_DOWNLOADS=$(echo "$MEGAPHONE_ANALYTICS" | jq '.totalMetrics.totalDownloads' 2>/dev/null)
if [ "$TOTAL_DOWNLOADS" != "null" ] && [ "$TOTAL_DOWNLOADS" != "0" ]; then
  echo "   ✅ Megaphone Analytics working"
  echo "     Total Downloads: $TOTAL_DOWNLOADS"
else
  echo "   ⚠️  Megaphone Analytics not returning data (may not have data yet)"
fi
echo ""

# Test 5: Show Details API
echo "5. Testing Show Details API..."
echo "------------------------------"
SHOW_DETAILS=$(curl -s -H "Cookie: auth-token=$AUTH_TOKEN" \
  "http://localhost:3000/api/shows/show_1755587882316_e5ccuvioa")

SHOW_NAME=$(echo "$SHOW_DETAILS" | jq -r '.name' 2>/dev/null)
if [ "$SHOW_NAME" != "null" ] && [ -n "$SHOW_NAME" ]; then
  echo "   ✅ Show details working"
  echo "     Show Name: $SHOW_NAME"
  echo "     Total Episodes: $(echo "$SHOW_DETAILS" | jq '.totalEpisodes')"
else
  echo "   ❌ Show details not working"
fi
echo ""

# Test 6: Database Direct Check for YouTube Data
echo "6. Direct Database Validation..."
echo "--------------------------------"
DB_CHECK=$(PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t -c "
  SELECT COUNT(*) 
  FROM \"org_podcastflow_pro\".\"Episode\" 
  WHERE \"showId\" = 'show_1755587882316_e5ccuvioa' 
    AND \"youtubeViewCount\" > 0
")
YOUTUBE_EPISODES=$(echo $DB_CHECK | tr -d ' ')
echo "   Episodes with YouTube data in DB: $YOUTUBE_EPISODES"

if [ "$YOUTUBE_EPISODES" -gt "0" ]; then
  echo "   ✅ Database has YouTube data"
else
  echo "   ❌ No YouTube data in database"
fi
echo ""

echo "========================================"
echo "Test Summary"
echo "========================================"
echo "✅ Completed = Feature working with real data"
echo "⚠️  Warning = Feature may need data or configuration"
echo "❌ Failed = Feature not working properly"
echo ""
echo "Note: Ensure you're viewing the show while logged in as"
echo "a PodcastFlow Pro user (not Unfy) to see the data."