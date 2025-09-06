#!/bin/bash

# PodcastFlow Pro - Feature Validation Script
# Quick validation of rate management and contract/billing features

set -e

echo "🔍 PodcastFlow Pro - Feature Validation"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://localhost:3000"
RESULTS=""

# Function to test an endpoint
test_endpoint() {
    local role=$1
    local email=$2
    local password=$3
    local endpoint=$4
    local method=$5
    local expected_status=$6
    local description=$7
    
    # Login and get token
    local token=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
        grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$token" ]; then
        echo -e "${RED}✗ Failed to authenticate $role${NC}"
        return 1
    fi
    
    # Test the endpoint
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X "$method" "$API_URL$endpoint" \
        -H "Cookie: auth-token=$token" \
        -H "Content-Type: application/json")
    
    if [ "$response_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ $description${NC}"
        return 0
    else
        echo -e "${RED}✗ $description (expected $expected_status, got $response_code)${NC}"
        return 1
    fi
}

echo "1. Testing Rate Management Features"
echo "------------------------------------"

# Test admin can access rate cards
test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/rate-cards" "GET" 200 \
    "Admin can view rate cards"

# Test sales cannot create rate cards (should get 403)
test_endpoint "sales" "seller@podcastflow.pro" "seller123" \
    "/api/rate-cards" "POST" 403 \
    "Sales role cannot create rate cards (403 expected)"

# Test admin can access rate trends
test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/analytics/rate-trends" "GET" 200 \
    "Admin can view rate trends analytics"

echo ""
echo "2. Testing Show Rate History"
echo "-----------------------------"

# Get a show ID first
SHOW_ID=$(curl -s "$API_URL/api/shows" \
    -H "Cookie: auth-token=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@podcastflow.pro","password":"admin123"}' | \
        grep -o '"token":"[^"]*' | cut -d'"' -f4)" | \
    grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$SHOW_ID" ]; then
    # Test admin can view show rate history
    test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
        "/api/shows/$SHOW_ID/rate-history" "GET" 200 \
        "Admin can view show rate history"
    
    # Test sales can view but gets appropriate response
    test_endpoint "sales" "seller@podcastflow.pro" "seller123" \
        "/api/shows/$SHOW_ID/rate-history" "GET" 200 \
        "Sales can view show rate history"
else
    echo -e "${YELLOW}⚠ No shows available for rate history testing${NC}"
fi

echo ""
echo "3. Testing Contract & Billing APIs"
echo "-----------------------------------"

# Test contract endpoints
test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/contracts" "GET" 200 \
    "Admin can view contracts"

test_endpoint "sales" "seller@podcastflow.pro" "seller123" \
    "/api/contracts" "GET" 200 \
    "Sales can view contracts"

# Test billing automation settings (admin only)
test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/admin/billing-automation" "GET" 200 \
    "Admin can access billing automation settings"

test_endpoint "sales" "seller@podcastflow.pro" "seller123" \
    "/api/admin/billing-automation" "GET" 403 \
    "Sales cannot access billing automation (403 expected)"

echo ""
echo "4. Testing Budget Management"
echo "-----------------------------"

test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/budget/hierarchical" "GET" 200 \
    "Admin can view hierarchical budgets"

test_endpoint "sales" "seller@podcastflow.pro" "seller123" \
    "/api/budget/hierarchical" "GET" 200 \
    "Sales can view their assigned budgets"

echo ""
echo "5. Testing Master Admin Features"
echo "---------------------------------"

test_endpoint "master" "michael@unfy.com" "EMunfy2025" \
    "/api/master/organizations" "GET" 200 \
    "Master can view organizations"

test_endpoint "admin" "admin@podcastflow.pro" "admin123" \
    "/api/master/organizations" "GET" 403 \
    "Regular admin cannot access master endpoints (403 expected)"

echo ""
echo "========================================"
echo "📊 Validation Summary"
echo "========================================"
echo ""

# Check application health
HEALTH=$(curl -s "$API_URL/api/health" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "degraded" ]; then
    echo -e "${GREEN}✅ Application is running and ${HEALTH}${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
fi

# Check PM2 status
PM2_STATUS=$(pm2 list | grep "podcastflow-pro" | grep -o "online" || echo "offline")
if [ "$PM2_STATUS" = "online" ]; then
    echo -e "${GREEN}✅ PM2 process is online${NC}"
else
    echo -e "${RED}❌ PM2 process is not running${NC}"
fi

echo ""
echo "All feature validations complete!"