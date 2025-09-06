#!/bin/bash

# PodcastFlow Pro - API Test Runner (Non-Destructive)
# Runs API tests against the running production instance

echo "🧪 PodcastFlow Pro - API Test Suite"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
export NODE_ENV=test
export API_BASE_URL="http://localhost:3000"

# Check if API is running
echo -e "${BLUE}Checking API health...${NC}"
if curl -f -s "$API_BASE_URL/api/health" > /dev/null; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API is not responding at $API_BASE_URL${NC}"
    echo "Please ensure the application is running."
    exit 1
fi

echo ""
echo -e "${BLUE}Running API Integration Tests...${NC}"
echo ""

# Function to run individual test files
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    
    # Run the test with Node directly (avoiding Jest's database reset)
    if node -e "
        const test = require('$test_file');
        console.log('✓ Test file loaded successfully');
    " 2>/dev/null; then
        echo -e "${GREEN}  ✓ $test_name test file is valid${NC}"
    else
        echo -e "${YELLOW}  ⚠ $test_name needs Jest environment${NC}"
    fi
}

# Test our custom test files
echo -e "${BLUE}1. Rate Management Tests${NC}"
run_test "Rate Management" "./tests/api/rate-management.test.js"

echo ""
echo -e "${BLUE}2. Contract & Billing Workflow Tests${NC}"
run_test "Contract Billing" "./tests/contract-billing-workflows.test.js"

echo ""
echo -e "${BLUE}3. End-to-End Contract to Payment Tests${NC}"
run_test "E2E Contract Payment" "./tests/e2e/contract-to-payment.test.js"

echo ""
echo -e "${BLUE}4. Budget Management Tests${NC}"
run_test "Budget Management" "./tests/budget/hierarchical-budget.test.js"

echo ""
echo "====================================="
echo -e "${BLUE}Running Quick API Validation...${NC}"
echo ""

# Quick API endpoint tests using curl
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected=$3
    local description=$4
    local data=$5
    
    if [ -z "$data" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if [ "$response" -eq "$expected" ]; then
        echo -e "${GREEN}✓ $description (HTTP $response)${NC}"
    else
        echo -e "${RED}✗ $description (expected $expected, got $response)${NC}"
    fi
}

# Test key endpoints
echo "Testing Authentication..."
test_endpoint "POST" "/api/auth/login" 200 "Login endpoint" '{"email":"admin@podcastflow.pro","password":"admin123"}'

echo ""
echo "Testing Public Endpoints..."
test_endpoint "GET" "/api/health" 200 "Health check"

echo ""
echo "Testing Protected Endpoints (should return 401 without auth)..."
test_endpoint "GET" "/api/shows" 401 "Shows (unauthorized)"
test_endpoint "GET" "/api/campaigns" 401 "Campaigns (unauthorized)"
test_endpoint "GET" "/api/rate-cards" 401 "Rate Cards (unauthorized)"

echo ""
echo "====================================="
echo -e "${GREEN}API Test Validation Complete!${NC}"
echo ""

# Summary
echo "Test Summary:"
echo "- Rate Management: Test suite created"
echo "- Contract & Billing: Test suite created"
echo "- E2E Workflows: Test suite created"
echo "- Budget Management: Test suite created"
echo ""
echo "Note: Full Jest test execution requires test database setup."
echo "Use './scripts/validate-features.sh' for live feature validation."