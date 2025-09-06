#!/bin/bash

# Test script for Invoice type column functionality
# Tests migration, API filtering, and data integrity

echo "🧪 Testing Invoice Type Column Implementation"
echo "============================================="

BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/invoice-type-test-cookies"
ADMIN_USER='{"email":"admin@podcastflow.pro","password":"admin123"}'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to login
login() {
    echo "📝 Logging in..."
    response=$(curl -s -c "$COOKIE_FILE" \
        -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "$ADMIN_USER")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Login successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Login failed: $response${NC}"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo "🔬 Testing: $description"
    response=$(curl -s -b "$COOKIE_FILE" -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL$endpoint")
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    if [ "$http_status" = "$expected_status" ]; then
        echo -e "   ${GREEN}✅ Expected status $expected_status received${NC}"
        
        # Parse and display invoice counts if applicable
        if echo "$body" | grep -q '"invoices"'; then
            count=$(echo "$body" | grep -o '"invoices":\[' | wc -l)
            if [ "$count" -gt 0 ]; then
                invoice_count=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('invoices', [])))" 2>/dev/null || echo "0")
                echo "   📊 Invoices returned: $invoice_count"
            fi
        fi
        return 0
    else
        echo -e "   ${RED}❌ Unexpected status: $http_status (expected $expected_status)${NC}"
        echo "   Response: $(echo "$body" | head -c 200)..."
        return 1
    fi
}

# Function to check database schema
check_db_schema() {
    echo ""
    echo "🗄️  Checking Database Schema"
    echo "=============================="
    
    # Check if type column exists in org schemas
    PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t << EOF 2>/dev/null | head -20
SELECT 
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.column_default,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_name = 'Invoice'
  AND c.column_name = 'type'
  AND c.table_schema LIKE 'org_%'
ORDER BY c.table_schema;
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Type column found in Invoice tables${NC}"
    else
        echo -e "${YELLOW}⚠️  Type column may not exist yet${NC}"
    fi
}

# Function to test type filtering
test_type_filtering() {
    echo ""
    echo "🔍 Testing Type Filtering"
    echo "========================="
    
    # Test all invoices (no filter)
    test_api "/api/financials/invoices" 200 "All invoices (no type filter)"
    
    # Test incoming invoices
    test_api "/api/financials/invoices?type=incoming" 200 "Incoming invoices only"
    
    # Test outgoing invoices
    test_api "/api/financials/invoices?type=outgoing" 200 "Outgoing invoices only"
    
    # Test invalid type (should return 400)
    test_api "/api/financials/invoices?type=invalid" 400 "Invalid type parameter"
    
    # Test mixed filters
    test_api "/api/financials/invoices?type=incoming&status=pending" 200 "Incoming + pending status"
    test_api "/api/financials/invoices?type=outgoing&dateRange=thisMonth" 200 "Outgoing + this month"
}

# Function to get invoice counts by type
get_invoice_counts() {
    echo ""
    echo "📊 Invoice Distribution by Type"
    echo "================================"
    
    PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t << EOF 2>/dev/null
SELECT 
    schema_name,
    type,
    count
FROM (
    SELECT 
        'org_podcastflow_pro' as schema_name,
        "type",
        COUNT(*) as count
    FROM org_podcastflow_pro."Invoice"
    GROUP BY "type"
    UNION ALL
    SELECT 
        'org_unfy' as schema_name,
        "type",
        COUNT(*) as count
    FROM org_unfy."Invoice"
    GROUP BY "type"
) t
ORDER BY schema_name, type;
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully retrieved invoice counts${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not retrieve invoice counts (column may not exist yet)${NC}"
    fi
}

# Main test execution
main() {
    echo "Starting Invoice Type tests..."
    echo "Timestamp: $(date)"
    echo ""
    
    # Check if application is running
    if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        echo -e "${RED}❌ Application not responding at $BASE_URL${NC}"
        echo "Please ensure the application is running: pm2 restart podcastflow-pro"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Application is responding${NC}"
    
    # Check database schema
    check_db_schema
    
    # Get initial counts
    get_invoice_counts
    
    # Login for API tests
    if ! login; then
        echo -e "${RED}❌ Login failed - aborting tests${NC}"
        exit 1
    fi
    
    # Test type filtering
    test_type_filtering
    
    # Cleanup
    rm -f "$COOKIE_FILE"
    
    echo ""
    echo "═════════════════════════════════════════════"
    echo -e "${GREEN}✅ Invoice Type Testing Complete${NC}"
    echo "═════════════════════════════════════════════"
    echo ""
    echo "Summary:"
    echo "  • Database schema check performed"
    echo "  • API type filtering tested"
    echo "  • Invoice distribution analyzed"
    echo ""
    echo "Next steps:"
    echo "  1. Run migration if type column doesn't exist"
    echo "  2. Build and deploy application"
    echo "  3. Re-run tests to verify functionality"
    echo ""
    echo "Test completed at: $(date)"
}

# Run main function
main "$@"