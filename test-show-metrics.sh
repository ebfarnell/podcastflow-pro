#!/bin/bash

echo "======================================"
echo "Show Metrics API Test"
echo "======================================"

# Test with admin account
echo -e "\n1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/cookies-metrics.txt)

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo "✓ Admin login successful"
  
  # Get the first show
  echo -e "\n2. Getting list of shows..."
  SHOWS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/shows \
    -b /tmp/cookies-metrics.txt \
    -H "Content-Type: application/json")
  
  # Extract the first show ID
  SHOW_ID=$(echo "$SHOWS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)
  
  if [ ! -z "$SHOW_ID" ] && [ "$SHOW_ID" != "null" ]; then
    echo "Found show: $SHOW_ID"
    
    # Test 1: Get show details (should work)
    echo -e "\n3. Testing GET /api/shows/{showId} ..."
    SHOW_DETAILS=$(curl -s -X GET "http://localhost:3000/api/shows/$SHOW_ID" \
      -b /tmp/cookies-metrics.txt \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$SHOW_DETAILS" | grep "HTTP_STATUS:" | cut -d: -f2)
    if [ "$HTTP_STATUS" = "200" ]; then
      echo "✓ Show details endpoint working (200 OK)"
    else
      echo "✗ Show details endpoint failed (HTTP $HTTP_STATUS)"
    fi
    
    # Test 2: Get show metrics
    echo -e "\n4. Testing GET /api/shows/{showId}/metrics ..."
    METRICS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/shows/$SHOW_ID/metrics" \
      -b /tmp/cookies-metrics.txt \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$METRICS_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    if [ "$HTTP_STATUS" = "200" ]; then
      echo "✓ Metrics endpoint working (200 OK)"
      echo "$METRICS_RESPONSE" | head -n -1 | python3 -m json.tool 2>/dev/null | head -20
    else
      echo "✗ Metrics endpoint failed (HTTP $HTTP_STATUS)"
      echo "$METRICS_RESPONSE" | head -n -1
    fi
    
    # Test 3: Get metrics history
    echo -e "\n5. Testing GET /api/shows/{showId}/metrics/history?days=30 ..."
    HISTORY_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/shows/$SHOW_ID/metrics/history?days=30" \
      -b /tmp/cookies-metrics.txt \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$HISTORY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    if [ "$HTTP_STATUS" = "200" ]; then
      echo "✓ History endpoint working (200 OK)"
      # Show just the structure, not all data
      echo "$HISTORY_RESPONSE" | head -n -1 | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'  - Show ID: {data.get(\"showId\")}')
print(f'  - Days: {data.get(\"days\")}')
print(f'  - History entries: {len(data.get(\"history\", []))}')
if data.get('history'):
    print(f'  - First date: {data[\"history\"][0].get(\"date\")}')
    print(f'  - Last date: {data[\"history\"][-1].get(\"date\")}')
" 2>/dev/null
    else
      echo "✗ History endpoint failed (HTTP $HTTP_STATUS)"
      echo "$HISTORY_RESPONSE" | head -n -1
    fi
    
    # Test 4: Test with invalid show ID
    echo -e "\n6. Testing with invalid show ID..."
    INVALID_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/shows/invalid-id/metrics" \
      -b /tmp/cookies-metrics.txt \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    if [ "$HTTP_STATUS" = "400" ]; then
      echo "✓ Invalid ID correctly returns 400 Bad Request"
    else
      echo "✗ Invalid ID returned unexpected status (HTTP $HTTP_STATUS)"
    fi
    
    # Test 5: Test with invalid days parameter
    echo -e "\n7. Testing with invalid days parameter..."
    INVALID_DAYS=$(curl -s -X GET "http://localhost:3000/api/shows/$SHOW_ID/metrics/history?days=999" \
      -b /tmp/cookies-metrics.txt \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$INVALID_DAYS" | grep "HTTP_STATUS:" | cut -d: -f2)
    if [ "$HTTP_STATUS" = "400" ]; then
      echo "✓ Invalid days (999) correctly returns 400 Bad Request"
    else
      echo "✗ Invalid days returned unexpected status (HTTP $HTTP_STATUS)"
    fi
    
  else
    echo "✗ No shows found in the system"
  fi
else
  echo "✗ Admin login failed"
fi

# Cleanup
rm -f /tmp/cookies-metrics.txt

echo -e "\n======================================"
echo "Test completed"
echo "======================================"