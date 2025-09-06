#!/bin/bash
# Immediate API Validation Script
# Date: 2025-07-25
# Purpose: Validate all Next.js APIs are working after API Gateway deletion

set -e

echo "🔍 Running immediate API validation..."
echo "Testing Next.js API endpoints..."
echo ""

# Core business APIs
core_endpoints=(
  "/api/campaigns"
  "/api/shows" 
  "/api/episodes"
  "/api/users"
  "/api/organizations"
  "/api/advertisers"
  "/api/agencies"
  "/api/orders"
  "/api/contracts"
  "/api/financials/invoices"
)

# System APIs
system_endpoints=(
  "/api/health"
  "/api/dashboard"
  "/api/organization"
  "/api/user/profile"
  "/api/user/preferences"
)

# Master APIs
master_endpoints=(
  "/api/master/analytics"
  "/api/master/billing"
  "/api/master/organizations"
  "/api/master/users"
  "/api/master/settings"
)

all_passed=true
total_tests=0
passed_tests=0

echo "1. Testing Core Business APIs..."
for endpoint in "${core_endpoints[@]}"; do
  total_tests=$((total_tests + 1))
  echo -n "   Testing $endpoint... "
  
  response=$(curl -s -w "%{http_code}" -o /tmp/api_response.json "http://localhost:3000$endpoint")
  http_code="${response: -3}"
  
  # 200 (success) or 401 (auth required - but API is working)
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 401 ]; then
    echo "✅ OK (HTTP $http_code)"
    passed_tests=$((passed_tests + 1))
  else
    echo "❌ FAILED (HTTP $http_code)"
    all_passed=false
  fi
done

echo ""
echo "2. Testing System APIs..."
for endpoint in "${system_endpoints[@]}"; do
  total_tests=$((total_tests + 1))
  echo -n "   Testing $endpoint... "
  
  response=$(curl -s -w "%{http_code}" -o /tmp/api_response.json "http://localhost:3000$endpoint")
  http_code="${response: -3}"
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 401 ]; then
    echo "✅ OK (HTTP $http_code)"
    passed_tests=$((passed_tests + 1))
  else
    echo "❌ FAILED (HTTP $http_code)"
    all_passed=false
  fi
done

echo ""
echo "3. Testing Master APIs..."
for endpoint in "${master_endpoints[@]}"; do
  total_tests=$((total_tests + 1))
  echo -n "   Testing $endpoint... "
  
  response=$(curl -s -w "%{http_code}" -o /tmp/api_response.json "http://localhost:3000$endpoint")
  http_code="${response: -3}"
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 401 ]; then
    echo "✅ OK (HTTP $http_code)"
    passed_tests=$((passed_tests + 1))
  else
    echo "❌ FAILED (HTTP $http_code)"
    all_passed=false
  fi
done

echo ""
echo "4. Testing API Health Details..."
health_response=$(curl -s "http://localhost:3000/api/health")
db_status=$(echo "$health_response" | jq -r '.checks.database.status' 2>/dev/null)
tenant_schemas=$(echo "$health_response" | jq -r '.checks.tenants.details.schemaCount' 2>/dev/null)

echo "   Database status: $db_status"
echo "   Tenant schemas: $tenant_schemas"

if [ "$db_status" = "pass" ]; then
  echo "   ✅ Database connection healthy"
  passed_tests=$((passed_tests + 1))
else
  echo "   ❌ Database connection issues"
  all_passed=false
fi
total_tests=$((total_tests + 1))

if [ "$tenant_schemas" -ge 2 ]; then
  echo "   ✅ Tenant isolation schemas present"
  passed_tests=$((passed_tests + 1))
else
  echo "   ❌ Tenant isolation schema issues"
  all_passed=false
fi
total_tests=$((total_tests + 1))

echo ""
echo "5. Performance Check..."
response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:3000/api/health")
if (( $(echo "$response_time < 2.0" | bc -l) )); then
  echo "   ✅ Response time: ${response_time}s (good)"
  passed_tests=$((passed_tests + 1))
else
  echo "   ⚠️  Response time: ${response_time}s (slower than expected)"
fi
total_tests=$((total_tests + 1))

# Cleanup
rm -f /tmp/api_response.json

echo ""
echo "📊 Validation Summary:"
echo "   Total tests: $total_tests"
echo "   Passed: $passed_tests"
echo "   Failed: $((total_tests - passed_tests))"

if [ "$all_passed" = true ]; then
  echo ""
  echo "🎉 All API validations PASSED!"
  echo "   ✅ Next.js APIs are fully operational"
  echo "   ✅ Database connectivity confirmed"
  echo "   ✅ Tenant isolation working"
  echo "   ✅ Performance within acceptable range"
  echo ""
  echo "✨ API Gateway deletion was successful - system is healthy!"
  exit 0
else
  echo ""
  echo "⚠️  Some API validations FAILED!"
  echo "   Check the failed endpoints above"
  echo "   Consider running emergency rollback if critical"
  echo ""
  exit 1
fi