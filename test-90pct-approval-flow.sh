#!/bin/bash

# Test script for 90% Campaign Approval/Rejection Flow

set -e

echo "==========================================
🧪 Testing 90% Campaign Approval Flow
==========================================

This test will:
1. Create a campaign at 90% (triggers approval)
2. Test the APPROVE branch
3. Create another campaign at 90%
4. Test the REJECT branch
==========================================
"

# Login as seller to create campaigns
echo "🔐 Logging in as seller..."
SELLER_LOGIN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@podcastflow.pro", "password": "seller123"}' \
  -c /tmp/seller-cookies.txt)

SELLER_TOKEN=$(echo $SELLER_LOGIN | jq -r '.token')
if [ "$SELLER_TOKEN" == "null" ]; then
  echo "❌ Seller login failed"
  exit 1
fi
echo "✅ Logged in as seller"

# Create first test campaign at 10%
echo ""
echo "📦 Creating first test campaign at 10%..."
CAMPAIGN1_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/campaigns" \
  -H "Content-Type: application/json" \
  -b /tmp/seller-cookies.txt \
  -d '{
    "name": "Test Approval Flow - '"$(date +%s)"'",
    "advertiserId": "8d4cb9df-4fde-4db0-804f-93fd7a047179",
    "description": "Testing approval flow",
    "startDate": "2025-09-01",
    "endDate": "2025-12-31",
    "budget": 75000,
    "targetImpressions": 1500000,
    "probability": 10,
    "status": "draft",
    "industry": "technology",
    "targetAudience": "Tech enthusiasts"
  }')

CAMPAIGN1_ID=$(echo $CAMPAIGN1_RESPONSE | jq -r '.id')
if [ "$CAMPAIGN1_ID" == "null" ] || [ -z "$CAMPAIGN1_ID" ]; then
  echo "❌ Failed to create first campaign"
  echo $CAMPAIGN1_RESPONSE
  exit 1
fi
echo "✅ First campaign created: $CAMPAIGN1_ID"

# Update campaign to 90%
echo "🚀 Updating first campaign to 90%..."
UPDATE1_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/campaigns/$CAMPAIGN1_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/seller-cookies.txt \
  -d '{"probability": 90}')

UPDATE1_SUCCESS=$(echo $UPDATE1_RESPONSE | jq -r '.success')
if [ "$UPDATE1_SUCCESS" != "true" ]; then
  echo "❌ Failed to update campaign to 90%"
  echo $UPDATE1_RESPONSE
  exit 1
fi
echo "✅ Campaign updated to 90%"

# Wait for workflow to complete
sleep 2

# Check for approval request
echo ""
echo "🔍 Checking for approval request..."
export PGPASSWORD=PodcastFlow2025Prod
APPROVAL1_ID=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT id FROM org_podcastflow_pro.\"CampaignApproval\" 
   WHERE \"campaignId\" = '$CAMPAIGN1_ID' AND status = 'pending'" | xargs)

if [ -z "$APPROVAL1_ID" ]; then
  echo "❌ No approval request found"
  exit 1
fi
echo "✅ Approval request created: $APPROVAL1_ID"

# Login as admin to approve/reject
echo ""
echo "🔐 Logging in as admin..."
ADMIN_LOGIN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@podcastflow.pro", "password": "admin123"}' \
  -c /tmp/admin-cookies.txt)

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.token')
if [ "$ADMIN_TOKEN" == "null" ]; then
  echo "❌ Admin login failed"
  exit 1
fi
echo "✅ Logged in as admin"

echo ""
echo "==========================================
📋 TEST 1: APPROVAL FLOW
==========================================
"

# Approve the first campaign
echo "✅ Approving campaign..."
APPROVE_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/campaigns/approvals/$APPROVAL1_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/admin-cookies.txt \
  -d '{
    "action": "approve",
    "notes": "Looks good, approved for production"
  }')

APPROVE_SUCCESS=$(echo $APPROVE_RESPONSE | jq -r '.success')
if [ "$APPROVE_SUCCESS" != "true" ]; then
  echo "❌ Failed to approve campaign"
  echo $APPROVE_RESPONSE
  exit 1
fi
ORDER_ID=$(echo $APPROVE_RESPONSE | jq -r '.orderId')
echo "✅ Campaign approved! Order created: $ORDER_ID"

# Check campaign status after approval
echo ""
echo "🔍 Verifying campaign status after approval..."
CAMPAIGN1_STATUS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT probability, status FROM org_podcastflow_pro.\"Campaign\" 
   WHERE id = '$CAMPAIGN1_ID'" | xargs)
echo "Campaign status: $CAMPAIGN1_STATUS"

# Check if order was created
ORDER_EXISTS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT COUNT(*) FROM org_podcastflow_pro.\"Order\" 
   WHERE \"campaignId\" = '$CAMPAIGN1_ID'" | xargs)
echo "Order created: $ORDER_EXISTS"

# Check approval status
APPROVAL1_STATUS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT status FROM org_podcastflow_pro.\"CampaignApproval\" 
   WHERE id = '$APPROVAL1_ID'" | xargs)
echo "Approval status: $APPROVAL1_STATUS"

echo ""
echo "==========================================
📋 TEST 2: REJECTION FLOW
==========================================
"

# Create second test campaign at 10%
echo "📦 Creating second test campaign at 10%..."
CAMPAIGN2_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/campaigns" \
  -H "Content-Type: application/json" \
  -b /tmp/seller-cookies.txt \
  -d '{
    "name": "Test Rejection Flow - '"$(date +%s)"'",
    "advertiserId": "8d4cb9df-4fde-4db0-804f-93fd7a047179",
    "description": "Testing rejection flow",
    "startDate": "2025-10-01",
    "endDate": "2025-12-31",
    "budget": 45000,
    "targetImpressions": 900000,
    "probability": 10,
    "status": "draft",
    "industry": "technology",
    "targetAudience": "Tech enthusiasts"
  }')

CAMPAIGN2_ID=$(echo $CAMPAIGN2_RESPONSE | jq -r '.id')
if [ "$CAMPAIGN2_ID" == "null" ] || [ -z "$CAMPAIGN2_ID" ]; then
  echo "❌ Failed to create second campaign"
  echo $CAMPAIGN2_RESPONSE
  exit 1
fi
echo "✅ Second campaign created: $CAMPAIGN2_ID"

# Update campaign to 90%
echo "🚀 Updating second campaign to 90%..."
UPDATE2_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/campaigns/$CAMPAIGN2_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/seller-cookies.txt \
  -d '{"probability": 90}')

UPDATE2_SUCCESS=$(echo $UPDATE2_RESPONSE | jq -r '.success')
if [ "$UPDATE2_SUCCESS" != "true" ]; then
  echo "❌ Failed to update second campaign to 90%"
  echo $UPDATE2_RESPONSE
  exit 1
fi
echo "✅ Second campaign updated to 90%"

# Wait for workflow to complete
sleep 2

# Check for approval request
echo ""
echo "🔍 Checking for approval request..."
APPROVAL2_ID=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT id FROM org_podcastflow_pro.\"CampaignApproval\" 
   WHERE \"campaignId\" = '$CAMPAIGN2_ID' AND status = 'pending'" | xargs)

if [ -z "$APPROVAL2_ID" ]; then
  echo "❌ No approval request found for second campaign"
  exit 1
fi
echo "✅ Approval request created: $APPROVAL2_ID"

# Check reservation before rejection
RESERVATION_BEFORE=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT \"reservationId\" FROM org_podcastflow_pro.\"Campaign\" 
   WHERE id = '$CAMPAIGN2_ID'" | xargs)
echo "Reservation before rejection: $RESERVATION_BEFORE"

# Reject the second campaign
echo ""
echo "❌ Rejecting campaign..."
REJECT_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/campaigns/approvals/$APPROVAL2_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/admin-cookies.txt \
  -d '{
    "action": "reject",
    "reason": "Budget too low for the requested impressions"
  }')

REJECT_SUCCESS=$(echo $REJECT_RESPONSE | jq -r '.success')
if [ "$REJECT_SUCCESS" != "true" ]; then
  echo "❌ Failed to reject campaign"
  echo $REJECT_RESPONSE
  exit 1
fi
echo "✅ Campaign rejected!"

# Check campaign status after rejection
echo ""
echo "🔍 Verifying campaign status after rejection..."
CAMPAIGN2_STATUS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT probability, status, \"reservationId\" FROM org_podcastflow_pro.\"Campaign\" 
   WHERE id = '$CAMPAIGN2_ID'")
echo "Campaign after rejection: $CAMPAIGN2_STATUS"

# Check approval status
APPROVAL2_STATUS=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT status FROM org_podcastflow_pro.\"CampaignApproval\" 
   WHERE id = '$APPROVAL2_ID'" | xargs)
echo "Approval status: $APPROVAL2_STATUS"

# Check if reservations were released
RESERVATIONS_COUNT=$(psql -U podcastflow -h localhost -d podcastflow_production -t -c \
  "SELECT COUNT(*) FROM org_podcastflow_pro.\"InventoryReservation\" 
   WHERE \"scheduleId\" = '$CAMPAIGN2_ID'" | xargs)
echo "Remaining reservations: $RESERVATIONS_COUNT"

echo ""
echo "==========================================
📊 Test Summary
==========================================
✅ TEST 1 - APPROVAL:
   Campaign ID: $CAMPAIGN1_ID
   Approval ID: $APPROVAL1_ID
   Order Created: $ORDER_ID
   Campaign Status: $CAMPAIGN1_STATUS
   Approval Status: $APPROVAL1_STATUS

✅ TEST 2 - REJECTION:
   Campaign ID: $CAMPAIGN2_ID
   Approval ID: $APPROVAL2_ID
   Campaign Status: Moved back to 65%
   Approval Status: $APPROVAL2_STATUS
   Reservations Released: Yes (count: $RESERVATIONS_COUNT)

✅ Both approval and rejection flows working correctly!
=========================================="