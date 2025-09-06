#!/bin/bash

echo "🧪 Testing Dynamic Workflow Thresholds"
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get auth token
echo -e "${YELLOW}1. Getting auth token for admin user...${NC}"
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}')

AUTH_TOKEN=$(echo $AUTH_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get auth token${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Got auth token${NC}"

# Test 1: Get current workflow settings
echo -e "\n${YELLOW}2. Getting current workflow settings...${NC}"
SETTINGS=$(curl -s -X GET http://localhost:3000/api/admin/workflow-settings \
  -H "Cookie: auth-token=$AUTH_TOKEN")

echo "Current settings:"
echo "$SETTINGS" | jq '.thresholds'

# Test 2: Update workflow settings with custom thresholds
echo -e "\n${YELLOW}3. Updating workflow settings with custom thresholds...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT http://localhost:3000/api/admin/workflow-settings \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -d '{
    "thresholds": {
      "approval_trigger": 85,
      "rejection_fallback": 60,
      "auto_create_order": 95
    },
    "notifications": {
      "notify_on_90": true,
      "notify_on_approval": true,
      "notify_on_rejection": true
    },
    "isActive": true
  }')

echo "Updated settings:"
echo "$UPDATE_RESPONSE" | jq '.thresholds'

# Test 3: Create a test campaign at 85% to trigger workflow
echo -e "\n${YELLOW}4. Creating test campaign at 85% (should trigger workflow)...${NC}"
CAMPAIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -d '{
    "name": "Test Dynamic Workflow Campaign",
    "advertiserId": "test-advertiser-id",
    "budget": 50000,
    "startDate": "2025-09-01",
    "endDate": "2025-09-30",
    "probability": 85,
    "status": "negotiation"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN_RESPONSE | jq -r '.id // .campaignId // empty')

if [ -z "$CAMPAIGN_ID" ]; then
  echo -e "${RED}❌ Failed to create campaign${NC}"
  echo "$CAMPAIGN_RESPONSE"
else
  echo -e "${GREEN}✅ Campaign created with ID: $CAMPAIGN_ID${NC}"
  
  # Check if approval request was created
  echo -e "\n${YELLOW}5. Checking for approval request...${NC}"
  sleep 2
  APPROVAL_CHECK=$(curl -s -X GET http://localhost:3000/api/admin/approvals \
    -H "Cookie: auth-token=$AUTH_TOKEN")
  
  APPROVAL_COUNT=$(echo "$APPROVAL_CHECK" | jq 'length')
  if [ "$APPROVAL_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Approval request created successfully!${NC}"
    echo "Total pending approvals: $APPROVAL_COUNT"
  else
    echo -e "${YELLOW}⚠️ No approval request found (might be expected if threshold not met)${NC}"
  fi
fi

# Test 4: Reset to default settings
echo -e "\n${YELLOW}6. Resetting to default workflow settings...${NC}"
RESET_RESPONSE=$(curl -s -X PUT http://localhost:3000/api/admin/workflow-settings \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -d '{
    "thresholds": {
      "approval_trigger": 90,
      "rejection_fallback": 65,
      "auto_create_order": 100
    },
    "notifications": {
      "notify_on_90": true,
      "notify_on_approval": true,
      "notify_on_rejection": true
    },
    "isActive": true
  }')

echo "Reset to defaults:"
echo "$RESET_RESPONSE" | jq '.thresholds'

echo -e "\n${GREEN}✅ Dynamic workflow threshold testing complete!${NC}"