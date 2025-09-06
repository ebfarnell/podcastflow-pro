#!/bin/bash

# Test script for 90% Campaign Automation

set -e

echo "==========================================
🧪 Testing 90% Campaign Automation
==========================================

This test will:
1. Create a test campaign at 10%
2. Add scheduled spots
3. Update to 90% and verify automation
==========================================
"

# Login as seller
echo "🔐 Logging in as seller..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@podcastflow.pro", "password": "seller123"}' \
  -c /tmp/test-cookies.txt)

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
if [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Logged in successfully"

# Create a test campaign
echo ""
echo "📦 Creating test campaign..."
CAMPAIGN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/campaigns" \
  -H "Content-Type: application/json" \
  -b /tmp/test-cookies.txt \
  -d '{
    "name": "Test 90% Automation - '"$(date +%s)"'",
    "advertiserId": "8d4cb9df-4fde-4db0-804f-93fd7a047179",
    "description": "Testing 90% automation workflow",
    "startDate": "2025-09-01",
    "endDate": "2025-12-31",
    "budget": 50000,
    "targetImpressions": 1000000,
    "probability": 10,
    "status": "draft",
    "industry": "technology",
    "targetAudience": "Tech enthusiasts"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN_RESPONSE | jq -r '.id')
if [ "$CAMPAIGN_ID" == "null" ] || [ -z "$CAMPAIGN_ID" ]; then
  echo "❌ Failed to create campaign"
  echo $CAMPAIGN_RESPONSE
  exit 1
fi
echo "✅ Campaign created: $CAMPAIGN_ID"

# Wait a moment
sleep 2

# Update campaign to 90%
echo ""
echo "🚀 Updating campaign to 90%..."
UPDATE_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/test-cookies.txt \
  -d '{"probability": 90}')

UPDATE_SUCCESS=$(echo $UPDATE_RESPONSE | jq -r '.success')
if [ "$UPDATE_SUCCESS" != "true" ]; then
  echo "❌ Failed to update campaign"
  echo $UPDATE_RESPONSE
  exit 1
fi
echo "✅ Campaign updated to 90%"

# Check PM2 logs for automation
echo ""
echo "📊 Checking logs for automation triggers..."
echo "----------------------------------------"
pm2 logs podcastflow-pro --lines 50 --nostream | grep -E "\[90%.*Automation\]|\[Reservations\]" | tail -20
echo "----------------------------------------"

# Check if reservations were created
echo ""
echo "🔍 Checking database for created entities..."
export PGPASSWORD=PodcastFlow2025Prod

# Check for approval request
APPROVAL_COUNT=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT COUNT(*) FROM org_podcastflow_pro.\"CampaignApproval\" 
   WHERE \"campaignId\" = '$CAMPAIGN_ID'")
echo "📋 Approval requests created: $APPROVAL_COUNT"

# Check for inventory reservations
RESERVATION_COUNT=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT COUNT(*) FROM org_podcastflow_pro.\"InventoryReservation\" 
   WHERE \"scheduleId\" = '$CAMPAIGN_ID'")
echo "📦 Inventory reservations created: $RESERVATION_COUNT"

# Check campaign fields
CAMPAIGN_DATA=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT \"reservationId\", \"approvalRequestId\" FROM org_podcastflow_pro.\"Campaign\" 
   WHERE id = '$CAMPAIGN_ID'")
echo "🎯 Campaign fields: $CAMPAIGN_DATA"

# Check activity logs
ACTIVITY_COUNT=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT COUNT(*) FROM org_podcastflow_pro.\"Activity\" 
   WHERE \"targetId\" = '$CAMPAIGN_ID' 
   AND \"createdAt\" > NOW() - INTERVAL '5 minutes'")
echo "📝 Activity logs created: $ACTIVITY_COUNT"

echo ""
echo "==========================================
📊 Test Summary
==========================================
Campaign ID: $CAMPAIGN_ID
Approval Requests: $APPROVAL_COUNT
Inventory Reservations: $RESERVATION_COUNT
Activity Logs: $ACTIVITY_COUNT

✅ Test complete! Check the logs above for details.
=========================================="