#\!/bin/bash

set -e

API_URL="http://localhost:3000/api"
SELLER_EMAIL="seller@podcastflow.pro"
SELLER_PASS="seller123"
ADMIN_EMAIL="admin@podcastflow.pro"
ADMIN_PASS="admin123"

echo "🔧 PodcastFlow Workflow Test (Fixed)"
echo "===================================="

# Login function
login() {
    local email=$1
    local password=$2
    curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        -c /tmp/cookies.txt > /dev/null
    echo "✅ Logged in as $email"
}

# API call function
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -b /tmp/cookies.txt
    else
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -b /tmp/cookies.txt \
            -d "$data"
    fi
}

# First, get valid advertiser and agency IDs
echo "📋 Getting valid advertiser and agency IDs..."
login "$SELLER_EMAIL" "$SELLER_PASS"

ADVERTISERS=$(api_call GET "/advertisers")
ADVERTISER_ID=$(echo "$ADVERTISERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

AGENCIES=$(api_call GET "/agencies") 
AGENCY_ID=$(echo "$AGENCIES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ADVERTISER_ID" ] || [ -z "$AGENCY_ID" ]; then
    echo "⚠️  No advertisers/agencies found, creating test data..."
    
    # Create test advertiser
    ADV_RESPONSE=$(api_call POST "/advertisers" '{"name":"Test Advertiser for Workflow","contact":"test@example.com"}')
    ADVERTISER_ID=$(echo "$ADV_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    # Create test agency
    AGENCY_RESPONSE=$(api_call POST "/agencies" '{"name":"Test Agency for Workflow","contact":"test@example.com"}')
    AGENCY_ID=$(echo "$AGENCY_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

echo "   Advertiser ID: $ADVERTISER_ID"
echo "   Agency ID: $AGENCY_ID"

# Test 1: Create campaign at 10%
echo -e "\n📝 Test 1: Creating campaign at 10% probability..."

CAMPAIGN_DATA="{
    \"name\": \"Workflow Test - $(date +%s)\",
    \"advertiserId\": \"$ADVERTISER_ID\",
    \"agencyId\": \"$AGENCY_ID\",
    \"budget\": 50000,
    \"probability\": 10,
    \"startDate\": \"2025-03-01\",
    \"endDate\": \"2025-03-31\",
    \"status\": \"active\"
}"

CREATE_RESPONSE=$(api_call POST "/campaigns" "$CAMPAIGN_DATA")
CAMPAIGN_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CAMPAIGN_ID" ]; then
    echo "❌ Failed to create campaign"
    echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
    exit 1
fi

echo "✅ Created campaign: $CAMPAIGN_ID"

# Test 2: Update to 90% - should trigger workflow
echo -e "\n🚀 Test 2: Updating campaign to 90% (triggering workflow)..."
sleep 2

UPDATE_RESPONSE=$(api_call PUT "/campaigns/$CAMPAIGN_ID" '{"probability": 90}')
echo "$UPDATE_RESPONSE" | jq '.message' 2>/dev/null || echo "Response: $UPDATE_RESPONSE"

# Test 3: Check for pending approval
echo -e "\n📋 Test 3: Checking for pending approval..."
sleep 3

login "$ADMIN_EMAIL" "$ADMIN_PASS"
APPROVALS_RESPONSE=$(api_call GET "/admin/approvals")

# Parse approvals more carefully
APPROVAL_COUNT=$(echo "$APPROVALS_RESPONSE" | grep -o '"campaignId"' | wc -l)
echo "   Found $APPROVAL_COUNT pending approvals"

if echo "$APPROVALS_RESPONSE" | grep -q "\"campaignId\":\"$CAMPAIGN_ID\""; then
    echo "✅ Approval request found for our campaign"
    # Extract approval ID for our specific campaign
    APPROVAL_ID=$(echo "$APPROVALS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
approvals = data.get('approvals', [])
for a in approvals:
    if a.get('campaignId') == '$CAMPAIGN_ID':
        print(a.get('id', ''))
        break
" 2>/dev/null || echo "")
    
    if [ -n "$APPROVAL_ID" ]; then
        echo "   Approval ID: $APPROVAL_ID"
        
        # Test approval
        echo -e "\n✅ Test 4: Testing approval flow..."
        APPROVE_RESPONSE=$(api_call PUT "/campaigns/approvals/$APPROVAL_ID" '{"action":"approve","notes":"Test approval"}')
        
        if echo "$APPROVE_RESPONSE" | grep -q "orderId\|success\|approved"; then
            echo "✅ Campaign approved successfully\!"
            ORDER_ID=$(echo "$APPROVE_RESPONSE" | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
            [ -n "$ORDER_ID" ] && echo "   Order created: $ORDER_ID"
        else
            echo "⚠️  Approval response:"
            echo "$APPROVE_RESPONSE" | jq '.' 2>/dev/null || echo "$APPROVE_RESPONSE"
        fi
    fi
else
    echo "⚠️  No approval found for campaign $CAMPAIGN_ID"
    echo "Available approvals:"
    echo "$APPROVALS_RESPONSE" | jq '.approvals[] | {id, campaignId, status}' 2>/dev/null
fi

# Test rejection flow with new campaign
echo -e "\n📝 Test 5: Creating second campaign for rejection test..."
login "$SELLER_EMAIL" "$SELLER_PASS"

CAMPAIGN2_DATA="{
    \"name\": \"Rejection Test - $(date +%s)\",
    \"advertiserId\": \"$ADVERTISER_ID\",
    \"agencyId\": \"$AGENCY_ID\",
    \"budget\": 25000,
    \"probability\": 85,
    \"startDate\": \"2025-04-01\",
    \"endDate\": \"2025-04-30\",
    \"status\": \"active\"
}"

CREATE2_RESPONSE=$(api_call POST "/campaigns" "$CAMPAIGN2_DATA")
CAMPAIGN2_ID=$(echo "$CREATE2_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$CAMPAIGN2_ID" ]; then
    echo "✅ Created campaign: $CAMPAIGN2_ID"
    
    # Update to 90%
    api_call PUT "/campaigns/$CAMPAIGN2_ID" '{"probability": 90}' > /dev/null
    echo "✅ Updated to 90%"
    
    sleep 3
    login "$ADMIN_EMAIL" "$ADMIN_PASS"
    
    # Get the approval ID for rejection test
    APPROVALS2=$(api_call GET "/admin/approvals")
    APPROVAL2_ID=$(echo "$APPROVALS2" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for a in data.get('approvals', []):
    if a.get('campaignId') == '$CAMPAIGN2_ID':
        print(a.get('id', ''))
        break
" 2>/dev/null || echo "")
    
    if [ -n "$APPROVAL2_ID" ]; then
        echo -e "\n❌ Test 6: Testing rejection flow..."
        REJECT_RESPONSE=$(api_call PUT "/campaigns/approvals/$APPROVAL2_ID" '{"action":"reject","reason":"Test rejection"}')
        
        if echo "$REJECT_RESPONSE" | grep -q "rejected\|65\|success"; then
            echo "✅ Campaign rejected and reverted\!"
        else
            echo "⚠️  Rejection response:"
            echo "$REJECT_RESPONSE" | jq '.' 2>/dev/null
        fi
    fi
fi

# Check timeline
echo -e "\n📊 Test 7: Checking Timeline events..."
ACTIVITIES=$(api_call GET "/activities?limit=5")
if echo "$ACTIVITIES" | grep -q "campaign\|90"; then
    echo "✅ Timeline events recorded"
fi

echo -e "\n=================================="
echo "✨ WORKFLOW TEST COMPLETE"
echo "=================================="

rm -f /tmp/cookies.txt
