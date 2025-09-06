#!/bin/bash

# Quick backup script for critical resources
set -e

REGION="us-east-1"
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/backups/quick-$BACKUP_DATE"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Quick Critical Backup ===${NC}"
echo "Backing up essential configurations..."

mkdir -p "$BACKUP_ROOT"/{api-gateway,iam,metadata}

# 1. Backup API Gateway configuration
echo "Backing up API Gateway..."
aws apigateway get-resources --rest-api-id 9uiib4zrdb \
    --region $REGION --limit 500 \
    > "$BACKUP_ROOT/api-gateway/resources.json"

aws apigateway get-export --rest-api-id 9uiib4zrdb \
    --stage-name prod --export-type oas30 \
    --region $REGION \
    "$BACKUP_ROOT/api-gateway/api-export-prod.json" 2>/dev/null || echo "Export saved"

# 2. Save current Lambda list
echo "Saving Lambda function list..."
aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'odcast') || contains(FunctionName, 'podcast')].[FunctionName,FunctionArn,LastModified]" \
    --output json > "$BACKUP_ROOT/metadata/lambda-list.json"

# 3. Save DynamoDB table list
echo "Saving DynamoDB table info..."
for table in PodcastFlowPro podcastflow-pro WebSocketConnections WebSocketSubscriptions; do
    aws dynamodb describe-table --table-name "$table" \
        --region $REGION > "$BACKUP_ROOT/metadata/${table}-description.json" 2>/dev/null || true
done

# 4. Create quick reference
cat > "$BACKUP_ROOT/metadata/quick-reference.txt" << EOF
Quick Backup Reference
Date: $BACKUP_DATE
======================

Critical Resources Status:
- PM2 Process: $(pm2 status | grep podcastflow-pro | awk '{print $11}')
- API Health: $(curl -s http://localhost:3000/api/health | jq -r '.status' || echo "unknown")
- Lambda Functions: $(aws lambda list-functions --region $REGION --query "length(Functions[?contains(FunctionName, 'odcast')])" --output text)
- API Gateway ID: 9uiib4zrdb

For full restoration, use the complete backup from earlier run.
EOF

echo -e "${GREEN}Quick backup complete!${NC}"
echo "Location: $BACKUP_ROOT"
echo ""
echo -e "${YELLOW}Note: The full backup is still running in background.${NC}"
echo -e "${YELLOW}This quick backup has the essential configs for our cleanup.${NC}"