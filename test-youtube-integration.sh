#!/bin/bash

echo "=== YouTube Analytics Integration Test ==="
echo "Testing the complete YouTube data sync flow"
echo

# Set the base URL and get auth token
API_BASE="http://localhost:3000/api"
SHOW_ID="show_1755587882316_e5ccuvioa"  # Theo Von's This Past Weekend

# Step 1: Generate auth token
echo "1. Generating auth token..."
AUTH_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}')

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Failed to get auth token"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo "✓ Auth token obtained"
echo

# Step 2: Check YouTube API configuration status
echo "2. Checking YouTube API configuration..."
CONFIG_CHECK=$(curl -s -X GET "$API_BASE/youtube/config/status" \
  -H "Cookie: auth-token=$AUTH_TOKEN")

HAS_API_KEY=$(echo "$CONFIG_CHECK" | jq -r '.has_api_key // false')
echo "YouTube API configured: $HAS_API_KEY"

if [ "$HAS_API_KEY" != "true" ]; then
    echo "⚠️  YouTube API key not configured in database"
    echo "   Please configure it through Settings > Integrations"
    echo
fi

# Step 3: Get sync status for the show
echo "3. Getting current sync status for Theo Von's show..."
SYNC_STATUS=$(curl -s -X GET "$API_BASE/shows/$SHOW_ID/metrics/sync" \
  -H "Cookie: auth-token=$AUTH_TOKEN")

echo "$SYNC_STATUS" | jq '.'
echo

# Step 4: Attempt to sync YouTube data (will only work with real API key)
echo "4. Attempting YouTube Analytics sync..."
echo "   Note: This will only succeed if a real YouTube API key is configured"
echo

SYNC_RESPONSE=$(curl -s -X POST "$API_BASE/shows/$SHOW_ID/metrics/sync" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 7}' \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$SYNC_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$SYNC_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Response Status: $HTTP_STATUS"
echo "$RESPONSE_BODY" | jq '.'

if [ "$HTTP_STATUS" = "200" ]; then
    echo
    echo "✅ YouTube sync successful!"
    echo "Summary:"
    echo "$RESPONSE_BODY" | jq '.metrics'
elif [ "$HTTP_STATUS" = "400" ]; then
    ERROR_MSG=$(echo "$RESPONSE_BODY" | jq -r '.error // "Unknown error"')
    if [[ "$ERROR_MSG" == *"YouTube API not configured"* ]]; then
        echo
        echo "ℹ️  YouTube API key needs to be configured"
        echo "   Go to Settings > Integrations to add your YouTube API key"
    else
        echo
        echo "⚠️  Sync failed: $ERROR_MSG"
    fi
elif [ "$HTTP_STATUS" = "429" ]; then
    echo
    echo "⚠️  YouTube API quota exceeded"
    echo "$RESPONSE_BODY" | jq '.details'
else
    echo
    echo "❌ Unexpected error (HTTP $HTTP_STATUS)"
fi

echo
echo "=== Test Complete ==="
echo
echo "Next Steps:"
echo "1. If YouTube API key is not configured:"
echo "   - Go to https://app.podcastflow.pro/settings/integrations"
echo "   - Add your YouTube API key"
echo "   - The key will be encrypted and stored in the database"
echo
echo "2. Once configured, this sync will:"
echo "   - Pull real YouTube Analytics data (views, VTR, engagement)"
echo "   - Store it in the YouTubeAnalytics table"
echo "   - Update episode view counts"
echo "   - Make data available on the Show Metrics page"
echo
echo "3. The system uses the stored API key from database, not environment variables"