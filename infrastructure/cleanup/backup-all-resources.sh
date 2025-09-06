#!/bin/bash

# Comprehensive Backup Script for PodcastFlow Pro Resources
# Date: 2025-07-25
# Purpose: Backup all AWS resources before cleanup

set -e

# Configuration
REGION="us-east-1"
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/backups/$BACKUP_DATE"
S3_BACKUP_BUCKET="podcastflow-backups-590183844530"
S3_BACKUP_PREFIX="infrastructure-cleanup/$BACKUP_DATE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PodcastFlow Pro Infrastructure Backup ===${NC}"
echo -e "${BLUE}Backup Date: $BACKUP_DATE${NC}"
echo -e "${BLUE}Local Backup Location: $BACKUP_ROOT${NC}"
echo -e "${BLUE}S3 Backup Location: s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX${NC}"
echo ""

# Create backup directories
mkdir -p "$BACKUP_ROOT"/{lambda,api-gateway,dynamodb,cloudwatch,iam,metadata}

# Log function
log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Backup Lambda Functions
log "Starting Lambda function backups..."
mkdir -p "$BACKUP_ROOT/lambda/code"
mkdir -p "$BACKUP_ROOT/lambda/configs"

# Get list of Lambda functions to backup
LAMBDA_FUNCTIONS=(
    "PodcastFlowPro-APIWebhooks"
    "PodcastFlowPro-Ad-Approvals"
    "PodcastFlowPro-Ad-Copy"
    "PodcastFlowPro-Advertisers"
    "PodcastFlowPro-Agencies"
    "PodcastFlowPro-Availability"
    "PodcastFlowPro-Backup"
    "PodcastFlowPro-Billing"
    "PodcastFlowPro-Contracts"
    "PodcastFlowPro-Episodes"
    "PodcastFlowPro-Financials"
    "PodcastFlowPro-Insertion-Orders"
    "PodcastFlowPro-Reports"
    "PodcastFlowPro-Security"
    "PodcastFlowPro-Shows"
    "PodcastFlowPro-Team"
    "PodcastFlowPro-master-analytics"
    "PodcastFlowPro-master-billing"
    "PodcastFlowPro-master-organizations"
    "PodcastFlowPro-master-settings"
    "PodcastFlowPro-master-users"
    "podcastflow-api-analytics"
    "podcastflow-api-campaigns"
    "podcastflow-api-organization"
    "podcastflow-api-user"
    "podcastflow-permissions"
    "podcastflow-users"
    "podcastflow-websocket-handler"
)

# Add all PodcastFlowPro-PodcastFlowPro-* functions
LAMBDA_FUNCTIONS+=($(aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'PodcastFlowPro-PodcastFlowPro-')].FunctionName" \
    --output text | tr '\t' ' '))

# Backup each Lambda function
for func in "${LAMBDA_FUNCTIONS[@]}"; do
    if [ ! -z "$func" ]; then
        log "Backing up Lambda: $func"
        
        # Get function code
        CODE_URL=$(aws lambda get-function --function-name "$func" \
            --region $REGION --query 'Code.Location' --output text 2>/dev/null || echo "")
        
        if [ ! -z "$CODE_URL" ] && [ "$CODE_URL" != "None" ]; then
            wget -q "$CODE_URL" -O "$BACKUP_ROOT/lambda/code/${func}.zip" 2>/dev/null || \
                error "Failed to download code for $func"
        fi
        
        # Get function configuration
        aws lambda get-function-configuration --function-name "$func" \
            --region $REGION > "$BACKUP_ROOT/lambda/configs/${func}-config.json" 2>/dev/null || \
            error "Failed to get config for $func"
        
        # Get function policy
        aws lambda get-policy --function-name "$func" \
            --region $REGION > "$BACKUP_ROOT/lambda/configs/${func}-policy.json" 2>/dev/null || \
            echo "{}" > "$BACKUP_ROOT/lambda/configs/${func}-policy.json"
    fi
done

# 2. Backup API Gateway Configuration
log "Backing up API Gateway configuration..."
API_ID="9uiib4zrdb"

# Export API Gateway
aws apigateway get-export --rest-api-id $API_ID \
    --stage-name prod --export-type oas30 \
    --region $REGION \
    "$BACKUP_ROOT/api-gateway/api-export-prod.json" 2>/dev/null || \
    error "Failed to export API Gateway"

# Get all resources
aws apigateway get-resources --rest-api-id $API_ID \
    --region $REGION --limit 500 \
    > "$BACKUP_ROOT/api-gateway/resources.json"

# Get deployments
aws apigateway get-deployments --rest-api-id $API_ID \
    --region $REGION \
    > "$BACKUP_ROOT/api-gateway/deployments.json"

# Get stages
aws apigateway get-stages --rest-api-id $API_ID \
    --region $REGION \
    > "$BACKUP_ROOT/api-gateway/stages.json"

# 3. Backup DynamoDB Tables
log "Backing up DynamoDB tables..."
DYNAMODB_TABLES=("PodcastFlowPro" "podcastflow-pro" "WebSocketConnections" "WebSocketSubscriptions")

for table in "${DYNAMODB_TABLES[@]}"; do
    log "Backing up DynamoDB table: $table"
    
    # Create on-demand backup
    BACKUP_ARN=$(aws dynamodb create-backup \
        --table-name "$table" \
        --backup-name "${table}-cleanup-backup-${BACKUP_DATE}" \
        --region $REGION \
        --query 'BackupDetails.BackupArn' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$BACKUP_ARN" ] && [ "$BACKUP_ARN" != "None" ]; then
        echo "$BACKUP_ARN" >> "$BACKUP_ROOT/dynamodb/backup-arns.txt"
        
        # Also export to S3
        aws dynamodb export-table-to-point-in-time \
            --table-arn "arn:aws:dynamodb:${REGION}:590183844530:table/${table}" \
            --s3-bucket "$S3_BACKUP_BUCKET" \
            --s3-prefix "$S3_BACKUP_PREFIX/dynamodb-exports/${table}" \
            --export-format DYNAMODB_JSON \
            --region $REGION 2>/dev/null || \
            error "Failed to export $table to S3"
    fi
    
    # Save table description
    aws dynamodb describe-table --table-name "$table" \
        --region $REGION > "$BACKUP_ROOT/dynamodb/${table}-description.json" 2>/dev/null || \
        error "Failed to describe table $table"
done

# 4. Backup CloudWatch Log Groups
log "Backing up CloudWatch Log Groups metadata..."
aws logs describe-log-groups --region $REGION \
    --log-group-name-prefix "/aws/lambda/PodcastFlowPro" \
    > "$BACKUP_ROOT/cloudwatch/log-groups-podcastflow.json"

aws logs describe-log-groups --region $REGION \
    --log-group-name-prefix "/aws/lambda/podcastflow" \
    > "$BACKUP_ROOT/cloudwatch/log-groups-podcastflow-lower.json"

# 5. Backup IAM Roles and Policies
log "Backing up IAM roles and policies..."
IAM_ROLES=("PodcastFlowProLambdaRole" "podcastflow-api-LambdaExecutionRole-GhmKBJfcPhbh" "podcastflow-websocket-stack-WebSocketLambdaRole-zYURAo2nfFjX")

for role in "${IAM_ROLES[@]}"; do
    log "Backing up IAM role: $role"
    
    # Get role
    aws iam get-role --role-name "$role" \
        > "$BACKUP_ROOT/iam/${role}-role.json" 2>/dev/null || \
        error "Failed to get role $role"
    
    # Get attached policies
    aws iam list-attached-role-policies --role-name "$role" \
        > "$BACKUP_ROOT/iam/${role}-attached-policies.json" 2>/dev/null || \
        error "Failed to list policies for $role"
    
    # Get inline policies
    aws iam list-role-policies --role-name "$role" \
        > "$BACKUP_ROOT/iam/${role}-inline-policies.json" 2>/dev/null || \
        error "Failed to list inline policies for $role"
done

# 6. Create metadata file
log "Creating backup metadata..."
cat > "$BACKUP_ROOT/metadata/backup-info.json" << EOF
{
    "backupDate": "$BACKUP_DATE",
    "region": "$REGION",
    "s3Bucket": "$S3_BACKUP_BUCKET",
    "s3Prefix": "$S3_BACKUP_PREFIX",
    "awsAccountId": "590183844530",
    "backupType": "pre-cleanup-comprehensive",
    "includedResources": {
        "lambdaFunctions": ${#LAMBDA_FUNCTIONS[@]},
        "apiGateway": "$API_ID",
        "dynamoDBTables": ${#DYNAMODB_TABLES[@]},
        "iamRoles": ${#IAM_ROLES[@]}
    }
}
EOF

# 7. Create resource inventory
log "Creating resource inventory..."
cat > "$BACKUP_ROOT/metadata/resource-inventory.txt" << EOF
PodcastFlow Pro Infrastructure Inventory
Backup Date: $BACKUP_DATE
========================================

LAMBDA FUNCTIONS:
$(printf '%s\n' "${LAMBDA_FUNCTIONS[@]}")

API GATEWAY:
- API ID: $API_ID
- Stages: prod, production

DYNAMODB TABLES:
$(printf '%s\n' "${DYNAMODB_TABLES[@]}")

IAM ROLES:
$(printf '%s\n' "${IAM_ROLES[@]}")

S3 BUCKETS (NOT BACKED UP - ALREADY PERSISTENT):
- podcastflow
- podcastflow-backups-590183844530
- podcastflow-deployments-1751349654
- podcastflow-lambda-deployments
- podcastflow-pro-uploads-590183844530
EOF

# 8. Compress and upload to S3
log "Compressing backup..."
cd "$(dirname "$BACKUP_ROOT")"
tar -czf "${BACKUP_DATE}.tar.gz" "$BACKUP_DATE"

log "Uploading to S3..."
aws s3 cp "${BACKUP_DATE}.tar.gz" \
    "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/complete-backup.tar.gz" \
    --region $REGION

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_ROOT" | cut -f1)

echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo -e "${GREEN}Local backup location: $BACKUP_ROOT${NC}"
echo -e "${GREEN}Local backup size: $BACKUP_SIZE${NC}"
echo -e "${GREEN}S3 backup location: s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/${NC}"
echo -e "${GREEN}Compressed backup: ${BACKUP_DATE}.tar.gz${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: Verify backup integrity before proceeding with cleanup${NC}"
echo -e "${YELLOW}DynamoDB backup ARNs saved in: $BACKUP_ROOT/dynamodb/backup-arns.txt${NC}"