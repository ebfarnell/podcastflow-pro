#!/bin/bash

SHOW_ID="show_1755587882316_e5ccuvioa"
AUTH_TOKEN="9df2dbacb25bea5cd9952b9fb50ced6eb661f7e3181a1e5f3e36fefe7ba7da6a"

echo "Getting metrics summary..."
curl -s "http://localhost:3000/api/shows/$SHOW_ID/metrics/summary" \
  -H "Cookie: auth-token=$AUTH_TOKEN" | jq '.'

echo ""
echo "Getting daily trend..."
curl -s "http://localhost:3000/api/shows/$SHOW_ID/metrics/daily-trend" \
  -H "Cookie: auth-token=$AUTH_TOKEN" | jq '.data[:3]'