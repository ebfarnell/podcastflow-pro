#!/bin/bash

# Test script for API Keys and Webhooks functionality

BASE_URL="https://app.podcastflow.pro"
EMAIL="admin@podcastflow.pro"
PASSWORD="admin123"

echo "========================================="
echo "Testing API Keys and Webhooks"
echo "========================================="
echo ""

# Login first
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test API key creation
echo "2. Creating API key..."
API_KEY_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/api-keys" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Key",
    "permissions": ["read", "write"]
  }')

if echo "$API_KEY_RESPONSE" | grep -q "error"; then
  echo "❌ API key creation failed: $API_KEY_RESPONSE"
else
  echo "✅ API key created successfully"
  API_KEY=$(echo "$API_KEY_RESPONSE" | grep -o '"key":"[^"]*' | cut -d'"' -f4)
  API_KEY_ID=$(echo "$API_KEY_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  echo "   Key: $API_KEY"
  echo "   ID: $API_KEY_ID"
fi
echo ""

# List API keys
echo "3. Listing API keys..."
LIST_KEYS_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/api-keys")

if echo "$LIST_KEYS_RESPONSE" | grep -q "apiKeys"; then
  echo "✅ API keys listed successfully"
  KEY_COUNT=$(echo "$LIST_KEYS_RESPONSE" | grep -o '"id"' | wc -l)
  echo "   Found $KEY_COUNT API key(s)"
else
  echo "❌ Failed to list API keys: $LIST_KEYS_RESPONSE"
fi
echo ""

# Test webhook creation
echo "4. Creating webhook..."
WEBHOOK_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/webhooks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/test",
    "events": ["campaign.created", "campaign.updated"]
  }')

if echo "$WEBHOOK_RESPONSE" | grep -q "error"; then
  echo "❌ Webhook creation failed: $WEBHOOK_RESPONSE"
else
  echo "✅ Webhook created successfully"
  WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  WEBHOOK_SECRET=$(echo "$WEBHOOK_RESPONSE" | grep -o '"secret":"[^"]*' | cut -d'"' -f4)
  echo "   ID: $WEBHOOK_ID"
  echo "   Secret: $WEBHOOK_SECRET"
fi
echo ""

# List webhooks
echo "5. Listing webhooks..."
LIST_WEBHOOKS_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/webhooks")

if echo "$LIST_WEBHOOKS_RESPONSE" | grep -q "webhooks"; then
  echo "✅ Webhooks listed successfully"
  WEBHOOK_COUNT=$(echo "$LIST_WEBHOOKS_RESPONSE" | grep -o '"id"' | wc -l)
  echo "   Found $WEBHOOK_COUNT webhook(s)"
else
  echo "❌ Failed to list webhooks: $LIST_WEBHOOKS_RESPONSE"
fi
echo ""

# Test webhook
if [ ! -z "$WEBHOOK_ID" ]; then
  echo "6. Testing webhook..."
  TEST_WEBHOOK_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/webhooks/test" \
    -H "Content-Type: application/json" \
    -d "{\"webhookId\":\"$WEBHOOK_ID\"}")
  
  if echo "$TEST_WEBHOOK_RESPONSE" | grep -q "success"; then
    echo "✅ Webhook test completed"
    echo "   Response: $TEST_WEBHOOK_RESPONSE"
  else
    echo "⚠️ Webhook test may have failed (this is expected if the URL is not reachable)"
    echo "   Response: $TEST_WEBHOOK_RESPONSE"
  fi
  echo ""
fi

# Toggle webhook status
if [ ! -z "$WEBHOOK_ID" ]; then
  echo "7. Toggling webhook status..."
  TOGGLE_RESPONSE=$(curl -s -b cookies.txt -X PUT "$BASE_URL/api/webhooks" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$WEBHOOK_ID\",\"isActive\":false}")
  
  if echo "$TOGGLE_RESPONSE" | grep -q "error"; then
    echo "❌ Failed to toggle webhook: $TOGGLE_RESPONSE"
  else
    echo "✅ Webhook status toggled successfully"
  fi
  echo ""
fi

# Delete API key
if [ ! -z "$API_KEY_ID" ]; then
  echo "8. Deleting API key..."
  DELETE_KEY_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$BASE_URL/api/api-keys?id=$API_KEY_ID")
  
  if echo "$DELETE_KEY_RESPONSE" | grep -q "error"; then
    echo "❌ Failed to delete API key: $DELETE_KEY_RESPONSE"
  else
    echo "✅ API key deleted successfully"
  fi
  echo ""
fi

# Delete webhook
if [ ! -z "$WEBHOOK_ID" ]; then
  echo "9. Deleting webhook..."
  DELETE_WEBHOOK_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$BASE_URL/api/webhooks?id=$WEBHOOK_ID")
  
  if echo "$DELETE_WEBHOOK_RESPONSE" | grep -q "error"; then
    echo "❌ Failed to delete webhook: $DELETE_WEBHOOK_RESPONSE"
  else
    echo "✅ Webhook deleted successfully"
  fi
  echo ""
fi

echo "========================================="
echo "Test completed!"
echo "========================================="

# Clean up
rm -f cookies.txt