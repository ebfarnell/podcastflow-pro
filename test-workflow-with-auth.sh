#!/bin/bash

echo "=== Testing Workflow Automation with Proper Authentication ==="
echo ""

# Login as admin to get auth token
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/cookies.txt)

echo "Login response: $LOGIN_RESPONSE"
echo ""

# Test GET workflow settings
echo "2. Testing GET /api/organization/workflow-automation..."
GET_RESPONSE=$(curl -s -X GET http://localhost:3000/api/organization/workflow-automation \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json")

echo "GET response:"
echo "$GET_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_RESPONSE"
echo ""

# Test PUT workflow settings (update a single setting)
echo "3. Testing PUT /api/organization/workflow-automation..."
PUT_RESPONSE=$(curl -s -X PUT http://localhost:3000/api/organization/workflow-automation \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "autoStages": {
      "at10": true,
      "at35": true,
      "at65": true,
      "at90": true,
      "at100": false
    },
    "inventory": {
      "reserveAt90": true,
      "reservationTtlHours": 48
    },
    "rateCard": {
      "deltaApprovalThresholdPct": 10
    },
    "exclusivity": {
      "policy": "WARN",
      "categories": ["automotive", "finance"]
    },
    "talentApprovals": {
      "hostRead": true,
      "endorsed": false
    },
    "contracts": {
      "autoGenerate": true,
      "emailTemplateId": "contract_standard"
    },
    "billing": {
      "invoiceDayOfMonth": 15,
      "timezone": "America/New_York",
      "prebillWhenNoTerms": true
    }
  }')

echo "PUT response:"
echo "$PUT_RESPONSE" | jq '.' 2>/dev/null || echo "$PUT_RESPONSE"
echo ""

# Get updated settings
echo "4. Verifying updated settings..."
VERIFY_RESPONSE=$(curl -s -X GET http://localhost:3000/api/organization/workflow-automation \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json")

echo "Updated settings:"
echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

# Test simulation endpoint (dry run)
echo "5. Testing POST /api/organization/workflow-automation/simulate..."
# First, get a campaign ID
CAMPAIGNS=$(curl -s -X GET http://localhost:3000/api/campaigns?limit=1 \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json")

CAMPAIGN_ID=$(echo "$CAMPAIGNS" | jq -r '.[0].id' 2>/dev/null)

if [ "$CAMPAIGN_ID" != "null" ] && [ -n "$CAMPAIGN_ID" ]; then
  echo "Using campaign ID: $CAMPAIGN_ID"
  
  SIMULATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/organization/workflow-automation/simulate \
    -b /tmp/cookies.txt \
    -H "Content-Type: application/json" \
    -d "{
      \"campaignId\": \"$CAMPAIGN_ID\",
      \"targetStage\": \"90\",
      \"dryRun\": true
    }")
    
  echo "Simulation response:"
  echo "$SIMULATE_RESPONSE" | jq '.' 2>/dev/null || echo "$SIMULATE_RESPONSE"
else
  echo "No campaigns found to test simulation"
fi

echo ""
echo "=== Test Complete ==="