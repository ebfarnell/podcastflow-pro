#!/bin/bash

# Deploy Settings Lambda Functions
# This script deploys all the new Lambda functions for settings features

set -e

echo "Deploying Settings Lambda Functions..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/PodcastFlowProLambdaRole"

# DynamoDB table name
TABLE_NAME="PodcastFlowPro"

# API Gateway ID (get from existing API)
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='PodcastFlow-Pro-API'].id" --output text --region $REGION)

if [ -z "$API_ID" ]; then
    echo -e "${RED}Error: Could not find API Gateway. Please ensure PodcastFlowProAPI exists.${NC}"
    exit 1
fi

echo -e "${GREEN}Found API Gateway: ${API_ID}${NC}"

# Function to create or update Lambda function
deploy_lambda() {
    local FUNCTION_NAME=$1
    local HANDLER=$2
    local RUNTIME=$3
    local ZIP_FILE=$4
    local ENV_VARS=$5
    
    echo -e "${YELLOW}Deploying Lambda function: ${FUNCTION_NAME}${NC}"
    
    # Check if function exists
    if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
        # Update existing function
        echo "Updating existing function..."
        aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --zip-file fileb://$ZIP_FILE \
            --region $REGION
        
        # Update environment variables if provided
        if [ ! -z "$ENV_VARS" ]; then
            aws lambda update-function-configuration \
                --function-name $FUNCTION_NAME \
                --environment "$ENV_VARS" \
                --region $REGION
        fi
    else
        # Create new function
        echo "Creating new function..."
        aws lambda create-function \
            --function-name $FUNCTION_NAME \
            --runtime $RUNTIME \
            --role $LAMBDA_ROLE_ARN \
            --handler $HANDLER \
            --zip-file fileb://$ZIP_FILE \
            --timeout 30 \
            --memory-size 256 \
            --environment "$ENV_VARS" \
            --region $REGION
    fi
    
    # Add API Gateway invoke permission
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id apigateway-invoke \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
        --region $REGION 2>/dev/null || true
}

# Navigate to lambdas directory
cd ../lambdas

# 1. Deploy Team Lambda
echo -e "\n${GREEN}1. Deploying Team Management Lambda${NC}"
cd team
zip -r ../team.zip .
cd ..
deploy_lambda "PodcastFlowPro-Team" "index.handler" "nodejs18.x" "team.zip" "Variables={TABLE_NAME=$TABLE_NAME}"

# 2. Deploy Security Lambda
echo -e "\n${GREEN}2. Deploying Security Settings Lambda${NC}"
cd security
npm install --production
zip -r ../security.zip .
cd ..
deploy_lambda "PodcastFlowPro-Security" "index.handler" "nodejs18.x" "security.zip" "Variables={TABLE_NAME=$TABLE_NAME,USER_POOL_ID=${USER_POOL_ID:-none},ENCRYPTION_KEY=${ENCRYPTION_KEY:-default-key}}"

# 3. Deploy Billing Lambda
echo -e "\n${GREEN}3. Deploying Billing Management Lambda${NC}"
cd billing
npm install --production
zip -r ../billing.zip .
cd ..
deploy_lambda "PodcastFlowPro-Billing" "index.handler" "nodejs18.x" "billing.zip" "Variables={TABLE_NAME=$TABLE_NAME,STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-sk_test_placeholder}}"

# 4. Deploy API/Webhooks Lambda
echo -e "\n${GREEN}4. Deploying API/Webhooks Lambda${NC}"
cd api-webhooks
npm install --production
zip -r ../api-webhooks.zip .
cd ..
deploy_lambda "PodcastFlowPro-APIWebhooks" "index.handler" "nodejs18.x" "api-webhooks.zip" "Variables={TABLE_NAME=$TABLE_NAME,API_GATEWAY_ID=$API_ID}"

# 5. Deploy Backup Lambda
echo -e "\n${GREEN}5. Deploying Backup/Export Lambda${NC}"
cd backup
npm install --production
zip -r ../backup.zip .
cd ..

# Create S3 bucket for backups if it doesn't exist
BACKUP_BUCKET="podcastflow-backups-${ACCOUNT_ID}"
if ! aws s3 ls "s3://${BACKUP_BUCKET}" 2>/dev/null; then
    echo "Creating backup S3 bucket..."
    aws s3 mb "s3://${BACKUP_BUCKET}" --region $REGION
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket $BACKUP_BUCKET \
        --versioning-configuration Status=Enabled \
        --region $REGION
    # Add lifecycle policy for old backups
    cat > lifecycle.json <<EOF
{
    "Rules": [{
        "ID": "DeleteOldBackups",
        "Status": "Enabled",
        "Prefix": "",
        "Transitions": [{
            "Days": 30,
            "StorageClass": "GLACIER"
        }],
        "Expiration": {
            "Days": 365
        }
    }]
}
EOF
    aws s3api put-bucket-lifecycle-configuration \
        --bucket $BACKUP_BUCKET \
        --lifecycle-configuration file://lifecycle.json \
        --region $REGION
    rm lifecycle.json
fi

deploy_lambda "PodcastFlowPro-Backup" "index.handler" "nodejs18.x" "backup.zip" "Variables={TABLE_NAME=$TABLE_NAME,BACKUP_BUCKET=$BACKUP_BUCKET}"

# Clean up zip files
echo -e "\n${YELLOW}Cleaning up...${NC}"
rm -f *.zip

echo -e "\n${GREEN}Lambda functions deployed successfully!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Run ./configure-api-routes.sh to set up API Gateway routes"
echo "2. Update environment variables with production values (Stripe keys, etc.)"
echo "3. Test the endpoints"