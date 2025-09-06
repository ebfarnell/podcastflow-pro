#!/bin/bash

echo "======================================"
echo "Agency Report Production Test"
echo "======================================"

# Test with admin account
echo -e "\n1. Testing with Admin account..."
LOGIN_RESPONSE=$(curl -s -X POST https://app.podcastflow.pro/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  -c /tmp/cookies-admin.txt)

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo "✓ Admin login successful"
  
  # Test the test endpoint
  echo "Testing agency report test endpoint..."
  TEST_RESPONSE=$(curl -s -X GET https://app.podcastflow.pro/api/reports/agency/test \
    -b /tmp/cookies-admin.txt \
    -H "Content-Type: application/json")
  
  if echo "$TEST_RESPONSE" | jq -e '.summary.allPassed' > /dev/null 2>&1; then
    ALL_PASSED=$(echo "$TEST_RESPONSE" | jq -r '.summary.allPassed')
    SUCCESS_COUNT=$(echo "$TEST_RESPONSE" | jq -r '.summary.success')
    ERROR_COUNT=$(echo "$TEST_RESPONSE" | jq -r '.summary.errors')
    
    echo "Test Results:"
    echo "  - Success: $SUCCESS_COUNT"
    echo "  - Errors: $ERROR_COUNT"
    echo "  - All Passed: $ALL_PASSED"
    
    if [ "$ALL_PASSED" = "true" ]; then
      echo "✓ All agency report functions working correctly!"
    else
      echo "⚠ Some functions failed. Details:"
      echo "$TEST_RESPONSE" | jq '.results[] | select(.status == "error")'
    fi
  else
    echo "✗ Test endpoint failed"
    echo "$TEST_RESPONSE" | jq
  fi
else
  echo "✗ Admin login failed"
fi

# Test with sales account
echo -e "\n2. Testing with Sales account..."
LOGIN_RESPONSE=$(curl -s -X POST https://app.podcastflow.pro/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@podcastflow.pro","password":"seller123"}' \
  -c /tmp/cookies-sales.txt)

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo "✓ Sales login successful"
  
  # Get an agency ID first
  echo "Getting agency list..."
  AGENCIES=$(curl -s -X GET https://app.podcastflow.pro/api/agencies \
    -b /tmp/cookies-sales.txt \
    -H "Content-Type: application/json")
  
  AGENCY_ID=$(echo "$AGENCIES" | jq -r '.[0].id' 2>/dev/null)
  
  if [ ! -z "$AGENCY_ID" ] && [ "$AGENCY_ID" != "null" ]; then
    echo "Testing report generation for agency: $AGENCY_ID"
    
    # Test actual report generation
    REPORT_RESPONSE=$(curl -s -X POST https://app.podcastflow.pro/api/reports/agency \
      -b /tmp/cookies-sales.txt \
      -H "Content-Type: application/json" \
      -d "{\"agencyId\":\"$AGENCY_ID\",\"format\":\"zip\"}" \
      -o /tmp/test-report.zip \
      -w "%{http_code}")
    
    if [ "$REPORT_RESPONSE" = "200" ]; then
      echo "✓ Report generated successfully!"
      echo "  File size: $(ls -lh /tmp/test-report.zip | awk '{print $5}')"
      
      # Check if it's a valid ZIP
      if unzip -t /tmp/test-report.zip > /dev/null 2>&1; then
        echo "✓ Valid ZIP file generated"
        unzip -l /tmp/test-report.zip | head -10
      else
        echo "✗ Invalid ZIP file"
      fi
      
      rm -f /tmp/test-report.zip
    else
      echo "✗ Report generation failed with status: $REPORT_RESPONSE"
    fi
  else
    echo "⚠ No agencies found for sales user"
  fi
else
  echo "✗ Sales login failed"
fi

# Cleanup
rm -f /tmp/cookies-admin.txt /tmp/cookies-sales.txt

echo -e "\n======================================"
echo "Test completed"
echo "======================================="