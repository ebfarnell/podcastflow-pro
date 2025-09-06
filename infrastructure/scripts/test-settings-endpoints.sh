#!/bin/bash

# Test Settings API Endpoints
# This script tests all the new settings endpoints

set -e

echo "Testing Settings API Endpoints..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get API endpoint
API_ENDPOINT=${API_ENDPOINT:-"https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod"}

# Function to test endpoint
test_endpoint() {
    local METHOD=$1
    local PATH=$2
    local DESCRIPTION=$3
    local DATA=$4
    
    echo -e "\n${YELLOW}Testing: ${DESCRIPTION}${NC}"
    echo "Method: ${METHOD}"
    echo "Path: ${API_ENDPOINT}${PATH}"
    
    if [ -z "$DATA" ]; then
        RESPONSE=$(curl -s -X ${METHOD} \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test-token" \
            -w "\nHTTP_STATUS:%{http_code}" \
            "${API_ENDPOINT}${PATH}")
    else
        RESPONSE=$(curl -s -X ${METHOD} \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test-token" \
            -d "${DATA}" \
            -w "\nHTTP_STATUS:%{http_code}" \
            "${API_ENDPOINT}${PATH}")
    fi
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
    
    if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
        echo -e "${GREEN}✓ Success (${HTTP_STATUS})${NC}"
        echo "Response: ${BODY}" | jq . 2>/dev/null || echo "Response: ${BODY}"
    else
        echo -e "${RED}✗ Failed (${HTTP_STATUS})${NC}"
        echo "Response: ${BODY}" | jq . 2>/dev/null || echo "Response: ${BODY}"
    fi
}

# Team endpoints have been removed - they are redundant with User Management

# Test Security endpoints
echo -e "\n${GREEN}=== Testing Security Settings Endpoints ===${NC}"
test_endpoint "GET" "/security" "Get security settings"
test_endpoint "GET" "/security/2fa" "Get 2FA status"
test_endpoint "GET" "/security/sessions" "Get active sessions"

# Test Billing endpoints
echo -e "\n${GREEN}=== Testing Billing Management Endpoints ===${NC}"
test_endpoint "GET" "/billing" "Get billing overview"
test_endpoint "GET" "/billing/usage" "Get usage data"
test_endpoint "GET" "/billing/invoices" "Get invoices"

# Test API/Webhooks endpoints
echo -e "\n${GREEN}=== Testing API/Webhooks Endpoints ===${NC}"
test_endpoint "GET" "/api-webhooks" "Get API settings"

# Test Backup endpoints
echo -e "\n${GREEN}=== Testing Backup/Export Endpoints ===${NC}"
test_endpoint "GET" "/backups" "Get backup settings"
test_endpoint "POST" "/backups/export" "Export data" '{"format":"json","data":{"campaigns":true}}'

echo -e "\n${GREEN}Testing complete!${NC}"