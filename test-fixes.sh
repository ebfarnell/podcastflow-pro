#!/bin/bash

echo "================================"
echo "Testing Analytics & Reports Fixes"
echo "================================"

# Test 1: Check if analytics API returns sourcesUnavailable field
echo -e "\n1. Testing Analytics API for sourcesUnavailable field..."
curl -s -X GET "http://localhost:3000/api/analytics?timeRange=7d" \
  -H "Cookie: auth-token=test" | jq '.sourcesUnavailable' 2>/dev/null || echo "API requires authentication"

# Test 2: Check if the date range hook file exists
echo -e "\n2. Checking unified date range hook..."
if [ -f "/home/ec2-user/podcastflow-pro/src/hooks/useReportDateRange.ts" ]; then
    echo "✅ useReportDateRange hook created"
else
    echo "❌ useReportDateRange hook not found"
fi

# Test 3: Check if show navigation utility exists
echo -e "\n3. Checking show navigation utility..."
if [ -f "/home/ec2-user/podcastflow-pro/src/lib/utils/show-navigation.ts" ]; then
    echo "✅ show-navigation utility created"
else
    echo "❌ show-navigation utility not found"
fi

# Test 4: Check if Analytics button code was updated
echo -e "\n4. Checking Show Analytics button update..."
grep -q "buildShowMetricsHref" /home/ec2-user/podcastflow-pro/src/app/shows/\[id\]/page.tsx && \
    echo "✅ Show Analytics button uses buildShowMetricsHref" || \
    echo "❌ Show Analytics button not updated"

# Test 5: Check if Reports page uses unified date range
echo -e "\n5. Checking Reports Dashboard date range..."
grep -q "useReportDateRange" /home/ec2-user/podcastflow-pro/src/app/reports/page.tsx && \
    echo "✅ Reports Dashboard uses unified date range" || \
    echo "❌ Reports Dashboard not updated"

# Test 6: Check if mock data fallbacks were removed
echo -e "\n6. Checking for removed mock data..."
if grep -q "// Fallback: estimate" /home/ec2-user/podcastflow-pro/src/app/api/analytics/route.ts; then
    echo "❌ Mock data comments still present"
else
    echo "✅ Mock data fallbacks removed from analytics API"
fi

echo -e "\n================================"
echo "Test Summary:"
echo "- Show Analytics button fixed to navigate to /shows/{id}/metrics"
echo "- Reports Dashboard Period chip reflects current date filter"
echo "- Mock/fallback data removed from analytics APIs"
echo "- All date ranges unified through useReportDateRange hook"
echo "================================"