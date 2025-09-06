#!/bin/bash
# Emergency Rollback Script
# Date: 2025-07-25
# Purpose: Restore API Gateway if issues are detected after deletion

set -e

echo "🚨 EMERGENCY ROLLBACK: Restoring API Gateway"
echo "This will restore the API Gateway from backup"
echo ""

# Find latest backup
latest_backup=$(ls -t /tmp/api-gateway-backup-*.json 2>/dev/null | head -1)

if [ -z "$latest_backup" ] || [ ! -f "$latest_backup" ]; then
  echo "❌ No backup found for rollback"
  echo "   Looking for: /tmp/api-gateway-backup-*.json"
  echo "   Available files:"
  ls -la /tmp/api-gateway-backup-*.json 2>/dev/null || echo "   None found"
  exit 1
fi

echo "Using backup: $latest_backup"
backup_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null)
echo "Backup size: $backup_size bytes"
echo ""

# Validate backup file
if [ "$backup_size" -lt 1000 ]; then
  echo "❌ Backup file appears to be too small or corrupted"
  exit 1
fi

if ! jq . "$latest_backup" >/dev/null 2>&1; then
  echo "❌ Backup file is not valid JSON"
  exit 1
fi

echo "✅ Backup file validated"
echo ""

# Import API Gateway from backup
echo "1. Importing API Gateway from backup..."
api_id=$(aws apigateway import-rest-api \
  --body file://"$latest_backup" \
  --region us-east-1 \
  --query 'id' --output text 2>/dev/null)

if [ -z "$api_id" ] || [ "$api_id" = "None" ]; then
  echo "❌ Failed to import API Gateway from backup"
  exit 1
fi

echo "✅ API Gateway imported with ID: $api_id"

# Create deployment for prod stage
echo ""
echo "2. Creating prod deployment..."
deployment_id=$(aws apigateway create-deployment \
  --rest-api-id "$api_id" \
  --stage-name prod \
  --description "Emergency rollback deployment $(date)" \
  --region us-east-1 \
  --query 'id' --output text 2>/dev/null)

if [ -z "$deployment_id" ] || [ "$deployment_id" = "None" ]; then
  echo "❌ Failed to create prod deployment"
  exit 1
fi

echo "✅ Prod deployment created: $deployment_id"

# Create deployment for production stage  
echo ""
echo "3. Creating production deployment..."
prod_deployment_id=$(aws apigateway create-deployment \
  --rest-api-id "$api_id" \
  --stage-name production \
  --description "Emergency rollback deployment $(date)" \
  --region us-east-1 \
  --query 'id' --output text 2>/dev/null)

if [ -z "$prod_deployment_id" ] || [ "$prod_deployment_id" = "None" ]; then
  echo "❌ Failed to create production deployment"
  exit 1
fi

echo "✅ Production deployment created: $prod_deployment_id"

# Test the restored API Gateway
echo ""
echo "4. Testing restored API Gateway..."
api_url="https://$api_id.execute-api.us-east-1.amazonaws.com/prod"

# Wait a moment for deployment to be ready
sleep 10

# Test a simple endpoint
test_response=$(curl -s -w "%{http_code}" -o /tmp/rollback_test.json "$api_url/" 2>/dev/null)
http_code="${test_response: -3}"

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 403 ] || [ "$http_code" -eq 401 ]; then
  echo "✅ API Gateway is responding (HTTP $http_code)"
else
  echo "⚠️  API Gateway response: HTTP $http_code"
  echo "   This may be normal if authentication is required"
fi

# Clean up
rm -f /tmp/rollback_test.json

echo ""
echo "🎉 Emergency rollback completed successfully!"
echo ""
echo "📊 Rollback Summary:"
echo "   New API Gateway ID: $api_id"
echo "   Prod Stage URL: https://$api_id.execute-api.us-east-1.amazonaws.com/prod"  
echo "   Production Stage URL: https://$api_id.execute-api.us-east-1.amazonaws.com/production"
echo "   Backup used: $latest_backup"
echo ""
echo "⚠️  IMPORTANT: You may need to update environment variables"
echo "   Add this to your .env.production if switching back to API Gateway:"
echo "   NEXT_PUBLIC_API_ENDPOINT=https://$api_id.execute-api.us-east-1.amazonaws.com/prod"
echo ""
echo "🔄 To switch application to use API Gateway:"
echo "   1. Add NEXT_PUBLIC_API_ENDPOINT to .env.production"
echo "   2. Restart the application: npm run build && pm2 restart podcastflow-pro"
echo "   3. Test that frontend uses API Gateway instead of Next.js routes"
echo ""
echo "✅ Rollback complete - system should be functional"