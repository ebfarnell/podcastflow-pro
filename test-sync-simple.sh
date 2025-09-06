#!/bin/bash

SHOW_ID="show_1755587882316_e5ccuvioa"
AUTH_TOKEN="9df2dbacb25bea5cd9952b9fb50ced6eb661f7e3181a1e5f3e36fefe7ba7da6a"
API_URL="http://localhost:3000"

echo "Testing YouTube sync status..."
curl -s "$API_URL/api/shows/$SHOW_ID/metrics/sync" \
  -H "Cookie: auth-token=$AUTH_TOKEN" | jq '.'

echo ""
echo "Triggering YouTube sync..."
curl -s -X POST "$API_URL/api/shows/$SHOW_ID/metrics/sync" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}' | jq '.'