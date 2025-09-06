#!/bin/bash

# Test campaign rejection functionality for different user roles
# This script tests the rejection workflow for admin, sales, and producer roles

API_URL="http://localhost:3000/api"
CAMPAIGN_ID="d734af9b-f7ef-4149-bf47-044c1fc449a1"  # Active test campaign

echo "====================================="
echo "Campaign Rejection Role Testing"
echo "====================================="
echo "Testing campaign ID: $CAMPAIGN_ID"
echo ""

# Function to test rejection for a specific role
test_rejection() {
    local email=$1
    local password=$2
    local role=$3
    local expected_status=$4
    
    echo "Testing with $role role ($email)..."
    
    # Login
    LOGIN_RESPONSE=$(curl -s -c /tmp/cookies-$role.txt \
        -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    # Check if login was successful
    if echo "$LOGIN_RESPONSE" | grep -q "error"; then
        echo "  ❌ Login failed for $role"
        echo "  Response: $LOGIN_RESPONSE"
        return
    fi
    
    echo "  ✓ Login successful"
    
    # Get campaign current status
    CAMPAIGN_STATUS=$(curl -s -b /tmp/cookies-$role.txt \
        "$API_URL/campaigns/$CAMPAIGN_ID" | \
        grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    echo "  Current campaign status: $CAMPAIGN_STATUS"
    
    # Attempt rejection
    REJECT_RESPONSE=$(curl -s -b /tmp/cookies-$role.txt \
        -X POST "$API_URL/campaigns/$CAMPAIGN_ID/reject" \
        -H "Content-Type: application/json" \
        -d '{"reason":"Test rejection from '"$role"' role","fallbackRevenue":1000}' \
        -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$REJECT_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
    RESPONSE_BODY=$(echo "$REJECT_RESPONSE" | sed '/HTTP_STATUS:/d')
    
    echo "  HTTP Status: $HTTP_STATUS"
    
    if [ "$HTTP_STATUS" = "$expected_status" ]; then
        echo "  ✅ Expected status code received ($expected_status)"
        
        if [ "$expected_status" = "200" ]; then
            # Check if campaign was actually rejected
            NEW_STATUS=$(curl -s -b /tmp/cookies-$role.txt \
                "$API_URL/campaigns/$CAMPAIGN_ID" | \
                grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            
            if [ "$NEW_STATUS" = "rejected" ]; then
                echo "  ✅ Campaign successfully rejected"
                
                # Reset campaign status for next test
                echo "  Resetting campaign status to active..."
                curl -s -b /tmp/cookies-$role.txt \
                    -X PATCH "$API_URL/campaigns/$CAMPAIGN_ID" \
                    -H "Content-Type: application/json" \
                    -d '{"status":"active"}' > /dev/null
            else
                echo "  ⚠️ Campaign status unchanged: $NEW_STATUS"
            fi
        fi
    else
        echo "  ❌ Unexpected status code (expected $expected_status, got $HTTP_STATUS)"
        echo "  Response: $RESPONSE_BODY"
    fi
    
    # Cleanup
    rm -f /tmp/cookies-$role.txt
    echo ""
}

# Test with different roles
echo "1. Testing ADMIN role (should succeed)"
echo "----------------------------------------"
test_rejection "admin@podcastflow.pro" "admin123" "admin" "200"

echo "2. Testing SALES role (should fail - 403)"
echo "----------------------------------------"
test_rejection "seller@podcastflow.pro" "seller123" "sales" "403"

echo "3. Testing PRODUCER role (should fail - 403)"
echo "---------------------------------------------"
test_rejection "producer@podcastflow.pro" "producer123" "producer" "403"

echo "4. Testing TALENT role (should fail - 403)"
echo "-------------------------------------------"
test_rejection "talent@podcastflow.pro" "talent123" "talent" "403"

echo "5. Testing CLIENT role (should fail - 403)"
echo "-------------------------------------------"
test_rejection "client@podcastflow.pro" "client123" "client" "403"

echo "====================================="
echo "Role Testing Complete"
echo "====================================="
echo ""
echo "Summary:"
echo "- Only Admin and Master roles can reject campaigns"
echo "- Sales, Producer, Talent, and Client roles should receive 403 Forbidden"
echo ""
echo "Note: If any tests failed unexpectedly, check:"
echo "1. Campaign exists and is in correct status"
echo "2. User accounts are properly configured"
echo "3. API endpoint is responding correctly"