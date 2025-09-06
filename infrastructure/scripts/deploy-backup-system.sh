#!/bin/bash

# Deploy backup system for PodcastFlow Pro

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying backup system...${NC}"

# Configuration
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-backup"
REGION="us-east-1"
BUCKET_NAME="podcastflowpro-backups-${RANDOM}"
TABLE_NAME="PodcastFlowPro"
REST_API_ID="6a2opgfepf"

# 1. Create S3 bucket for backups
echo -e "${YELLOW}Creating S3 bucket for backups...${NC}"
aws s3 mb s3://$BUCKET_NAME --region $REGION || echo "Bucket may already exist"

# Configure bucket
aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled \
    --region $REGION

aws s3api put-bucket-lifecycle-configuration \
    --bucket $BUCKET_NAME \
    --lifecycle-configuration '{
        "Rules": [
            {
                "ID": "DeleteOldBackups",
                "Status": "Enabled",
                "NoncurrentVersionExpiration": {
                    "NoncurrentDays": 90
                },
                "AbortIncompleteMultipartUpload": {
                    "DaysAfterInitiation": 7
                }
            }
        ]
    }' \
    --region $REGION

# 2. Deploy backup Lambda function
echo -e "${YELLOW}Deploying backup Lambda function...${NC}"
cd /home/ec2-user/podcastflow-pro/infrastructure/lambdas/backup

# Create deployment package
rm -f deployment-package.zip
cp -r ../shared .
zip -r deployment-package.zip index.js shared/

# Create or update Lambda function
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment-package.zip \
        --region $REGION
    
    sleep 5
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="{TABLE_NAME=$TABLE_NAME,BACKUP_BUCKET=$BUCKET_NAME}" \
        --timeout 900 \
        --memory-size 1024 \
        --region $REGION
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role arn:aws:iam::590183844530:role/LabRole \
        --handler index.handler \
        --zip-file fileb://deployment-package.zip \
        --timeout 900 \
        --memory-size 1024 \
        --environment Variables="{TABLE_NAME=$TABLE_NAME,BACKUP_BUCKET=$BUCKET_NAME}" \
        --region $REGION
fi

# Clean up
rm -rf deployment-package.zip shared/

# 3. Add S3 permissions to Lambda role
echo -e "${YELLOW}Adding S3 permissions...${NC}"
# Note: In production, you would update the Lambda role with S3 permissions
# Since we're using LabRole which has full access, we skip this step

# 4. Configure API Gateway endpoints
echo -e "${YELLOW}Configuring API Gateway endpoints...${NC}"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/'].id" --output text)

# Create /backups resource
BACKUPS_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='backups'].id" --output text)

if [ -z "$BACKUPS_ID" ]; then
    BACKUPS_ID=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $ROOT_ID \
        --path-part backups \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created backups resource: $BACKUPS_ID"
else
    echo "Backups resource already exists: $BACKUPS_ID"
fi

# Create /backups/{backupId} resource
BACKUP_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='{backupId}' && parentId=='$BACKUPS_ID'].id" --output text)

if [ -z "$BACKUP_ID_RESOURCE" ]; then
    BACKUP_ID_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $BACKUPS_ID \
        --path-part "{backupId}" \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created {backupId} resource: $BACKUP_ID_RESOURCE"
else
    echo "{backupId} resource already exists: $BACKUP_ID_RESOURCE"
fi

# Create /backups/{backupId}/download resource
DOWNLOAD_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='download' && parentId=='$BACKUP_ID_RESOURCE'].id" --output text)

if [ -z "$DOWNLOAD_RESOURCE" ]; then
    DOWNLOAD_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $BACKUP_ID_RESOURCE \
        --path-part download \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created download resource: $DOWNLOAD_RESOURCE"
else
    echo "Download resource already exists: $DOWNLOAD_RESOURCE"
fi

# Create /backups/restore resource
RESTORE_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='restore' && parentId=='$BACKUPS_ID'].id" --output text)

if [ -z "$RESTORE_RESOURCE" ]; then
    RESTORE_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $BACKUPS_ID \
        --path-part restore \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created restore resource: $RESTORE_RESOURCE"
else
    echo "Restore resource already exists: $RESTORE_RESOURCE"
fi

# Create /backups/schedule resource
SCHEDULE_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='schedule' && parentId=='$BACKUPS_ID'].id" --output text)

if [ -z "$SCHEDULE_RESOURCE" ]; then
    SCHEDULE_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $BACKUPS_ID \
        --path-part schedule \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created schedule resource: $SCHEDULE_RESOURCE"
else
    echo "Schedule resource already exists: $SCHEDULE_RESOURCE"
fi

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

# Function to create method and integration
create_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local DESCRIPTION=$3
    
    echo -e "${YELLOW}Creating $HTTP_METHOD method for $DESCRIPTION...${NC}"
    
    # Check if method exists
    if aws apigateway get-method --rest-api-id $REST_API_ID --resource-id $RESOURCE_ID --http-method $HTTP_METHOD --region $REGION 2>/dev/null; then
        echo "$HTTP_METHOD method already exists for $DESCRIPTION"
    else
        # Create method
        aws apigateway put-method \
            --rest-api-id $REST_API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $HTTP_METHOD \
            --authorization-type NONE \
            --region $REGION
        
        # Create integration
        aws apigateway put-integration \
            --rest-api-id $REST_API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $HTTP_METHOD \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
            --region $REGION
    fi
}

# Create endpoints
create_method $BACKUPS_ID "GET" "/backups"
create_method $BACKUPS_ID "POST" "/backups"
create_method $BACKUPS_ID "OPTIONS" "/backups"

create_method $BACKUP_ID_RESOURCE "GET" "/backups/{backupId}"
create_method $BACKUP_ID_RESOURCE "DELETE" "/backups/{backupId}"
create_method $BACKUP_ID_RESOURCE "OPTIONS" "/backups/{backupId}"

create_method $DOWNLOAD_RESOURCE "GET" "/backups/{backupId}/download"
create_method $DOWNLOAD_RESOURCE "OPTIONS" "/backups/{backupId}/download"

create_method $RESTORE_RESOURCE "POST" "/backups/restore"
create_method $RESTORE_RESOURCE "OPTIONS" "/backups/restore"

create_method $SCHEDULE_RESOURCE "GET" "/backups/schedule"
create_method $SCHEDULE_RESOURCE "PUT" "/backups/schedule"
create_method $SCHEDULE_RESOURCE "OPTIONS" "/backups/schedule"

# 5. Add Lambda permissions
echo -e "${YELLOW}Adding Lambda permissions...${NC}"
PERMISSION_EXISTS=$(aws lambda get-policy --function-name $FUNCTION_NAME --region $REGION 2>/dev/null | jq -r '.Policy' | jq -r '.Statement[].Sid' | grep -c "apigateway-backups-invoke" || true)

if [ "$PERMISSION_EXISTS" -eq "0" ]; then
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id apigateway-backups-invoke \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:590183844530:$REST_API_ID/*/*/*" \
        --region $REGION
    echo "Lambda permission added"
else
    echo "Lambda permission already exists"
fi

# Add EventBridge permission for scheduled backups
EVENTBRIDGE_PERMISSION_EXISTS=$(aws lambda get-policy --function-name $FUNCTION_NAME --region $REGION 2>/dev/null | jq -r '.Policy' | jq -r '.Statement[].Sid' | grep -c "eventbridge-backups-invoke" || true)

if [ "$EVENTBRIDGE_PERMISSION_EXISTS" -eq "0" ]; then
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id eventbridge-backups-invoke \
        --action lambda:InvokeFunction \
        --principal events.amazonaws.com \
        --region $REGION
    echo "EventBridge permission added"
else
    echo "EventBridge permission already exists"
fi

# 6. Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $REST_API_ID \
    --stage-name prod \
    --region $REGION \
    --query 'id' \
    --output text)

echo -e "${GREEN}Backup system deployed successfully!${NC}"
echo -e "${GREEN}Backup bucket: s3://$BUCKET_NAME${NC}"
echo -e "${GREEN}API deployment ID: $DEPLOYMENT_ID${NC}"
echo -e "${YELLOW}Note: Remember to update the permissions in the admin panel to grant backup access to appropriate roles${NC}"