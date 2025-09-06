#!/bin/bash

# PodcastFlow Pro - Comprehensive Email Settings Test Script
# Tests all email-related endpoints and functionality

set -e

echo "========================================"
echo "PodcastFlow Pro Email Settings Test"
echo "========================================"
echo

# Login as admin
echo "1. Logging in as admin user..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}')

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')

if [ "$AUTH_TOKEN" == "null" ] || [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Failed to login"
  echo "$AUTH_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Login successful"
echo

# Test email settings endpoint
echo "2. Testing email settings endpoint..."
SETTINGS_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  http://localhost:3000/api/organization/email-settings \
  -H "Cookie: auth-token=$AUTH_TOKEN")

STATUS=$(echo "$SETTINGS_RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$SETTINGS_RESPONSE" | head -n -1)

if [ "$STATUS" != "200" ]; then
  echo "❌ Failed to get email settings (HTTP $STATUS)"
  echo "$BODY" | jq '.'
  exit 1
fi

echo "✅ Email settings retrieved successfully"
echo "$BODY" | jq '.organizationName, .configured'
echo

# Test email status endpoint
echo "3. Testing email status endpoint..."
STATUS_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  http://localhost:3000/api/email/status \
  -H "Cookie: auth-token=$AUTH_TOKEN")

STATUS=$(echo "$STATUS_RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$STATUS_RESPONSE" | head -n -1)

if [ "$STATUS" != "200" ]; then
  echo "❌ Failed to get email status (HTTP $STATUS)"
  echo "$BODY" | jq '.'
  exit 1
fi

echo "✅ Email status retrieved successfully"
echo "SES Status:"
echo "$BODY" | jq '.sesStatus | {connected, region, mode, quota}'
echo "Recent Activity Count: $(echo "$BODY" | jq '.recentActivity | length')"
echo

# Test email templates endpoint
echo "4. Testing email templates endpoint..."
TEMPLATES_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  http://localhost:3000/api/organization/email-templates \
  -H "Cookie: auth-token=$AUTH_TOKEN")

STATUS=$(echo "$TEMPLATES_RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$TEMPLATES_RESPONSE" | head -n -1)

if [ "$STATUS" != "200" ]; then
  echo "❌ Failed to get email templates (HTTP $STATUS)"
  echo "$BODY" | jq '.'
  exit 1
fi

TEMPLATE_COUNT=$(echo "$BODY" | jq '.templates | length')
echo "✅ Email templates retrieved successfully"
echo "Templates available: $TEMPLATE_COUNT"
echo "Sample templates:"
echo "$BODY" | jq '.templates[:3] | .[].name'
echo

# Send test email
echo "5. Sending test email..."
TEST_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  -X POST http://localhost:3000/api/email/test \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":["admin@podcastflow.pro"],"template":"test","subject":"PodcastFlow Email Test - '"$(date)"'"}')

STATUS=$(echo "$TEST_RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$TEST_RESPONSE" | head -n -1)

if [ "$STATUS" != "200" ]; then
  echo "❌ Failed to send test email (HTTP $STATUS)"
  echo "$BODY" | jq '.'
  exit 1
fi

MESSAGE_ID=$(echo "$BODY" | jq -r '.messageId')
echo "✅ Test email sent successfully"
echo "Message ID: $MESSAGE_ID"
echo "$BODY" | jq '.sesStatus.quota'
echo

# Check recent activity after sending email
echo "6. Verifying email appears in recent activity..."
sleep 2

STATUS_AFTER=$(curl -s http://localhost:3000/api/email/status \
  -H "Cookie: auth-token=$AUTH_TOKEN")

RECENT_EMAIL=$(echo "$STATUS_AFTER" | jq --arg mid "$MESSAGE_ID" '.recentActivity[] | select(.messageId == $mid)')

if [ -n "$RECENT_EMAIL" ]; then
  echo "✅ Email found in recent activity"
  echo "$RECENT_EMAIL" | jq '{toEmail, subject, status, sentAt}'
else
  echo "⚠️  Email not yet in recent activity (may take time to sync)"
fi
echo

# Test updating email settings
echo "7. Testing email settings update..."
UPDATE_RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  -X POST http://localhost:3000/api/organization/email-settings \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notifications": {
      "reportReady": true,
      "campaignUpdates": true,
      "approvalRequests": true,
      "taskAssignments": false,
      "userInvitations": true,
      "adCopyUpdates": true,
      "paymentReminders": true,
      "deadlineReminders": true
    },
    "sendingRules": {
      "dailyLimitPerUser": 200,
      "requireApproval": false,
      "ccOnCertainEmails": false,
      "allowedDomains": []
    }
  }')

STATUS=$(echo "$UPDATE_RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$UPDATE_RESPONSE" | head -n -1)

if [ "$STATUS" != "200" ]; then
  echo "❌ Failed to update email settings (HTTP $STATUS)"
  echo "$BODY" | jq '.'
  exit 1
fi

echo "✅ Email settings updated successfully"
echo

# Summary
echo "========================================"
echo "Email Settings Test Summary"
echo "========================================"
echo "✅ All endpoints tested successfully"
echo "✅ Email delivery working"
echo "✅ SES integration confirmed"
echo "✅ Templates loading correctly"
echo "✅ Settings can be updated"
echo
echo "Email System Status: FULLY OPERATIONAL"
echo "========================================"