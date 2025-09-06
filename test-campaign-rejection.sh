#!/bin/bash

echo "====================================="
echo "Campaign Rejection Test Script"
echo "====================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

# Test accounts
declare -A TEST_ACCOUNTS=(
    ["master"]="michael@unfy.com:EMunfy2025"
    ["admin"]="admin@podcastflow.pro:admin123"
    ["sales"]="seller@podcastflow.pro:seller123"
    ["producer"]="producer@podcastflow.pro:producer123"
)

# Function to login and get cookie
login() {
    local email=$1
    local password=$2
    local role=$3
    
    echo -e "${YELLOW}Logging in as $role ($email)...${NC}"
    
    # Login and save cookies
    local response=$(curl -s -c /tmp/cookies-$role.txt -X POST \
        "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        -w "\nHTTP_STATUS:%{http_code}")
    
    local status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    
    if [ "$status" == "200" ]; then
        echo -e "${GREEN}✓ Login successful for $role${NC}"
        return 0
    else
        echo -e "${RED}✗ Login failed for $role (HTTP $status)${NC}"
        echo "$response" | grep -v "HTTP_STATUS"
        return 1
    fi
}

# Function to test campaign rejection
test_rejection() {
    local role=$1
    local cookie_file="/tmp/cookies-$role.txt"
    
    echo -e "\n${YELLOW}Testing campaign rejection as $role...${NC}"
    
    # First, get a campaign ID from pending approvals
    local approvals=$(curl -s -b "$cookie_file" \
        "$BASE_URL/api/admin/approvals" \
        -H "Content-Type: application/json")
    
    # Extract first campaign ID (if any)
    local campaign_id=$(echo "$approvals" | jq -r '.campaigns[0].campaignId // empty' 2>/dev/null)
    
    if [ -z "$campaign_id" ]; then
        echo -e "${YELLOW}No pending campaigns to test rejection${NC}"
        
        # Try to get any campaign for testing
        campaign_id=$(curl -s -b "$cookie_file" "$BASE_URL/api/campaigns" | \
            jq -r '.data[0].id // empty' 2>/dev/null)
        
        if [ -z "$campaign_id" ]; then
            echo -e "${RED}No campaigns found for testing${NC}"
            return 1
        fi
    fi
    
    echo "Testing with campaign ID: $campaign_id"
    
    # Attempt to reject the campaign
    local response=$(curl -s -b "$cookie_file" -X POST \
        "$BASE_URL/api/campaigns/$campaign_id/reject" \
        -H "Content-Type: application/json" \
        -d '{"reason":"Test rejection from automated script"}' \
        -w "\nHTTP_STATUS:%{http_code}")
    
    local status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    local body=$(echo "$response" | grep -v "HTTP_STATUS")
    
    echo "Response status: $status"
    
    if [ "$status" == "200" ]; then
        echo -e "${GREEN}✓ Campaign rejection successful!${NC}"
        
        # Check for workflow actions
        local workflow_actions=$(echo "$body" | jq -r '.workflowActions[]' 2>/dev/null)
        if [ ! -z "$workflow_actions" ]; then
            echo -e "${GREEN}Workflow actions performed:${NC}"
            echo "$workflow_actions"
        fi
        
        # Check debug info if available
        local debug_info=$(echo "$body" | jq '.debug' 2>/dev/null)
        if [ "$debug_info" != "null" ] && [ ! -z "$debug_info" ]; then
            echo -e "${YELLOW}Debug information available (check logs)${NC}"
        fi
        
        return 0
    elif [ "$status" == "403" ]; then
        echo -e "${RED}✗ Permission denied (403) - Expected for role: $role${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    elif [ "$status" == "401" ]; then
        echo -e "${RED}✗ Unauthorized (401) - Session may have expired${NC}"
        return 1
    else
        echo -e "${RED}✗ Rejection failed with status $status${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Main test execution
echo "Starting campaign rejection tests..."
echo "=================================="

# Test 1: Master role (should succeed)
echo -e "\n${YELLOW}TEST 1: Master Role${NC}"
if login "michael@unfy.com" "EMunfy2025" "master"; then
    test_rejection "master"
fi

# Test 2: Admin role (should succeed)
echo -e "\n${YELLOW}TEST 2: Admin Role${NC}"
if login "admin@podcastflow.pro" "admin123" "admin"; then
    test_rejection "admin"
fi

# Test 3: Sales role (should fail with 403)
echo -e "\n${YELLOW}TEST 3: Sales Role (Should Fail)${NC}"
if login "seller@podcastflow.pro" "seller123" "sales"; then
    test_rejection "sales"
fi

# Test 4: Producer role (should fail with 403)
echo -e "\n${YELLOW}TEST 4: Producer Role (Should Fail)${NC}"
if login "producer@podcastflow.pro" "producer123" "producer"; then
    test_rejection "producer"
fi

echo -e "\n=================================="
echo "Campaign rejection tests complete!"
echo

# Check server logs for debug output
echo -e "${YELLOW}Checking recent server logs for debug output...${NC}"
pm2 logs podcastflow-pro --lines 20 --nostream | grep "REJECT_DEBUG" | tail -10

echo -e "\n${GREEN}Test script completed!${NC}"
echo "Check PM2 logs for detailed debug output: pm2 logs podcastflow-pro"