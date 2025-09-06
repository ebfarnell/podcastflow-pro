#!/bin/bash

# Test Financial Reports API with Real Data
# Tests organizational scoping and report generation functionality

echo "🧪 Testing Financial Reports Functionality"
echo "=========================================="

# Test Configuration
BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/financial-reports-test-cookies"

# Test credentials for different organizations
ADMIN_USER='{"email":"admin@podcastflow.pro","password":"admin123"}'
UNFY_USER='{"email":"michael@unfy.com","password":"EMunfy2025"}'

# Function to login and get cookies
login() {
    local user_data=$1
    local org_name=$2
    
    echo "📝 Logging in as $org_name user..."
    
    response=$(curl -s -c "$COOKIE_FILE" \
        -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "$user_data")
    
    if echo "$response" | grep -q '"success":true'; then
        echo "✅ Login successful for $org_name"
        return 0
    else
        echo "❌ Login failed for $org_name: $response"
        return 1
    fi
}

# Function to test financial report API
test_report() {
    local endpoint=$1
    local payload=$2
    local report_name=$3
    local format=$4
    
    echo "🔬 Testing $report_name ($format format)..."
    
    response=$(curl -s -b "$COOKIE_FILE" \
        -X POST "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        -w "HTTP_STATUS:%{http_code}")
    
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$http_status" = "200" ]; then
        echo "✅ $report_name generated successfully"
        
        # Check content type based on format
        case $format in
            "json")
                if echo "$body" | jq . > /dev/null 2>&1; then
                    echo "   📊 Valid JSON response received"
                    # Extract key metrics if JSON
                    if echo "$body" | jq -e '.revenue.total' > /dev/null 2>&1; then
                        revenue=$(echo "$body" | jq -r '.revenue.total // 0')
                        echo "   💰 Revenue: \$$(echo $revenue | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"
                    fi
                else
                    echo "   ⚠️  Invalid JSON response"
                fi
                ;;
            "pdf"|"excel"|"csv")
                content_length=${#body}
                if [ $content_length -gt 1000 ]; then
                    echo "   📄 Binary file generated ($content_length bytes)"
                else
                    echo "   ⚠️  File may be too small ($content_length bytes)"
                fi
                ;;
        esac
    else
        echo "❌ $report_name failed with status $http_status"
        echo "   Error: $body"
    fi
    
    return $http_status
}

# Function to test organizational scoping
test_organizational_scoping() {
    echo ""
    echo "🔐 Testing Organizational Data Isolation"
    echo "======================================="
    
    # Test with PodcastFlow Pro user
    echo "Testing with PodcastFlow Pro organization..."
    if login "$ADMIN_USER" "PodcastFlow Pro"; then
        
        response1=$(curl -s -b "$COOKIE_FILE" \
            -X POST "$BASE_URL/api/reports/financial/monthly" \
            -H "Content-Type: application/json" \
            -d '{"year":2024,"month":11,"format":"json"}')
        
        if echo "$response1" | jq . > /dev/null 2>&1; then
            revenue1=$(echo "$response1" | jq -r '.revenue.total // 0')
            expenses1=$(echo "$response1" | jq -r '.expenses.total // 0')
            echo "✅ PodcastFlow Pro data - Revenue: \$$(echo $revenue1 | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta'), Expenses: \$$(echo $expenses1 | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"
        else
            echo "❌ Failed to get PodcastFlow Pro data"
            return 1
        fi
    else
        echo "❌ Failed to login as PodcastFlow Pro user"
        return 1
    fi
    
    # Test with Unfy user
    echo "Testing with Unfy organization..."
    if login "$UNFY_USER" "Unfy"; then
        
        response2=$(curl -s -b "$COOKIE_FILE" \
            -X POST "$BASE_URL/api/reports/financial/monthly" \
            -H "Content-Type: application/json" \
            -d '{"year":2024,"month":11,"format":"json"}')
        
        if echo "$response2" | jq . > /dev/null 2>&1; then
            revenue2=$(echo "$response2" | jq -r '.revenue.total // 0')
            expenses2=$(echo "$response2" | jq -r '.expenses.total // 0')
            echo "✅ Unfy data - Revenue: \$$(echo $revenue2 | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta'), Expenses: \$$(echo $expenses2 | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')"
            
            # Verify data isolation
            if [ "$revenue1" != "$revenue2" ] || [ "$expenses1" != "$expenses2" ]; then
                echo "✅ Data isolation confirmed - organizations see different data"
            else
                echo "⚠️  Organizations seeing identical data - may indicate scoping issue"
            fi
        else
            echo "❌ Failed to get Unfy data"
            return 1
        fi
    else
        echo "❌ Failed to login as Unfy user"
        return 1
    fi
}

# Function to test unauthorized access
test_unauthorized_access() {
    echo ""
    echo "🚫 Testing Unauthorized Access"
    echo "============================="
    
    # Remove cookies
    rm -f "$COOKIE_FILE"
    
    response=$(curl -s \
        -X POST "$BASE_URL/api/reports/financial/monthly" \
        -H "Content-Type: application/json" \
        -d '{"year":2024,"month":11,"format":"json"}' \
        -w "HTTP_STATUS:%{http_code}")
    
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$http_status" = "401" ]; then
        echo "✅ Unauthorized access properly rejected (401)"
    else
        echo "❌ Unauthorized access not properly rejected (got $http_status)"
    fi
}

# Main test execution
main() {
    echo "Starting financial reports testing..."
    echo "Current time: $(date)"
    echo ""
    
    # Check if application is running
    if ! curl -s "$BASE_URL/api/health" > /dev/null; then
        echo "❌ Application not responding at $BASE_URL"
        echo "Please ensure the application is running: pm2 restart podcastflow-pro"
        exit 1
    fi
    
    echo "✅ Application is responding"
    echo ""
    
    # Login as admin user for main tests
    if ! login "$ADMIN_USER" "PodcastFlow Pro"; then
        echo "❌ Failed to login - aborting tests"
        exit 1
    fi
    
    echo ""
    echo "📊 Testing Report Generation"
    echo "============================"
    
    # Test Monthly Report in different formats
    test_report "/api/reports/financial/monthly" \
        '{"year":2024,"month":11,"format":"json"}' \
        "Monthly Report" "json"
    
    test_report "/api/reports/financial/monthly" \
        '{"year":2024,"month":11,"format":"pdf"}' \
        "Monthly PDF Report" "pdf"
    
    test_report "/api/reports/financial/monthly" \
        '{"year":2024,"month":11,"format":"excel"}' \
        "Monthly Excel Report" "excel"
    
    test_report "/api/reports/financial/monthly" \
        '{"year":2024,"month":11,"format":"csv"}' \
        "Monthly CSV Report" "csv"
    
    # Test Quarterly Report
    test_report "/api/reports/financial/quarterly" \
        '{"year":2024,"quarter":4,"format":"json"}' \
        "Quarterly Report" "json"
    
    # Test Tax Report
    test_report "/api/reports/financial/tax" \
        '{"year":2024,"format":"json"}' \
        "Tax Report" "json"
    
    # Test P&L Report
    test_report "/api/reports/financial/pl" \
        '{"year":2024,"startMonth":1,"endMonth":12,"format":"json","includeComparison":true}' \
        "P&L Report with Comparison" "json"
    
    # Test Error Handling
    echo ""
    echo "⚠️  Testing Error Handling"
    echo "=========================="
    
    test_report "/api/reports/financial/monthly" \
        '{"year":2024,"month":11,"format":"invalid"}' \
        "Invalid Format Test" "invalid"
    
    # Test organizational scoping
    test_organizational_scoping
    
    # Test unauthorized access
    test_unauthorized_access
    
    echo ""
    echo "📈 Performance Test"
    echo "=================="
    
    echo "Testing P&L report with full year comparison..."
    start_time=$(date +%s)
    
    test_report "/api/reports/financial/pl" \
        '{"year":2024,"startMonth":1,"endMonth":12,"format":"json","includeComparison":true}' \
        "Full Year P&L with Comparison" "json"
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "⏱️  Full year P&L report completed in ${duration} seconds"
    
    if [ $duration -lt 10 ]; then
        echo "✅ Performance test passed (< 10 seconds)"
    else
        echo "⚠️  Performance test warning (> 10 seconds)"
    fi
    
    # Cleanup
    rm -f "$COOKIE_FILE"
    
    echo ""
    echo "🎉 Financial Reports Testing Complete"
    echo "====================================="
    echo "Test completed at: $(date)"
}

# Run main function
main "$@"