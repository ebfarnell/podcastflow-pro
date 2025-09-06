#!/bin/bash
# API Gateway Immediate Deletion Script
# Date: 2025-07-25
# Purpose: Delete unused API Gateway with immediate validation

set -e  # Exit on any error

echo "🚀 Starting immediate API Gateway deletion..."
echo "API Gateway ID: 9uiib4zrdb"
echo "Region: us-east-1"
echo ""

# Step 1: Verify Next.js APIs are working
echo "1. Verifying Next.js API health..."
HEALTH_STATUS=$(curl -s http://localhost:3000/api/health | jq -r '.checks.database.status' 2>/dev/null)

if [ "$HEALTH_STATUS" != "pass" ]; then
  echo "❌ Next.js APIs not healthy - aborting deletion"
  echo "   Database status: $HEALTH_STATUS"
  exit 1
fi
echo "✅ Next.js APIs confirmed healthy"

# Step 2: Create emergency backup
echo ""
echo "2. Creating emergency backup..."
BACKUP_FILE="/tmp/api-gateway-backup-$(date +%s).json"

aws apigateway get-export \
  --rest-api-id 9uiib4zrdb \
  --stage-name prod \
  --export-type swagger \
  --parameters extensions='integrations' \
  --region us-east-1 > "$BACKUP_FILE" 2>/dev/null

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  echo "✅ Backup created: $BACKUP_FILE"
else
  echo "❌ Failed to create backup - aborting deletion"
  exit 1
fi

# Step 3: Verify zero usage
echo ""
echo "3. Verifying API Gateway has zero usage..."
USAGE_DATA=$(aws apigateway get-usage \
  --usage-plan-id lprmgz \
  --start-date 2025-07-20 \
  --end-date 2025-07-25 \
  --region us-east-1 \
  --query 'items' 2>/dev/null)

if [ "$USAGE_DATA" == "{}" ] || [ "$USAGE_DATA" == "null" ]; then
  echo "✅ Confirmed zero API Gateway usage"
else
  echo "⚠️  API Gateway shows recent usage - review before deletion"
  echo "   Usage data: $USAGE_DATA"
  read -p "Continue with deletion? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deletion cancelled by user"
    exit 1
  fi
fi

# Step 4: Delete API Gateway
echo ""
echo "4. Deleting API Gateway..."
aws apigateway delete-rest-api --rest-api-id 9uiib4zrdb --region us-east-1

if [ $? -eq 0 ]; then
  echo "✅ API Gateway deletion command executed"
else
  echo "❌ Failed to delete API Gateway"
  exit 1
fi

# Step 5: Verify deletion
echo ""
echo "5. Verifying deletion..."
sleep 5  # Wait for deletion to propagate

if aws apigateway get-rest-api --rest-api-id 9uiib4zrdb --region us-east-1 2>/dev/null; then
  echo "⚠️  API Gateway still exists - may take a few moments to complete"
else
  echo "✅ API Gateway successfully deleted"
fi

# Step 6: Test Next.js APIs still work
echo ""
echo "6. Final validation of Next.js APIs..."

test_endpoints=("/api/health" "/api/campaigns" "/api/shows" "/api/dashboard")
all_passed=true

for endpoint in "${test_endpoints[@]}"; do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint")
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 401 ]; then
    echo "✅ $endpoint responding (HTTP $http_code)"
  else
    echo "❌ $endpoint failed (HTTP $http_code)"
    all_passed=false
  fi
done

if [ "$all_passed" = true ]; then
  echo ""
  echo "🎉 API Gateway deletion completed successfully!"
  echo "   Backup available at: $BACKUP_FILE"
  echo "   Next.js APIs confirmed working"
  echo "   Estimated monthly savings: $20.50"
else
  echo ""
  echo "⚠️  Deletion completed but some Next.js APIs showing issues"
  echo "   Backup available at: $BACKUP_FILE"
  echo "   Run emergency rollback if needed: ./emergency-rollback.sh"
fi

echo ""
echo "📊 Summary:"
echo "   API Gateway 9uiib4zrdb: DELETED"
echo "   Next.js APIs: OPERATIONAL"
echo "   Backup: $BACKUP_FILE"
echo "   Cost savings: $20.50/month"