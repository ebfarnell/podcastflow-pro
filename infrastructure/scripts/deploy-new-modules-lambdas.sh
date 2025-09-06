#!/bin/bash

# Deploy New Modules Lambda Functions
# This script deploys all the Lambda functions for the new modules

set -e

echo "Deploying New Modules Lambda Functions..."

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
    echo -e "${RED}Error: Could not find API Gateway. Please ensure PodcastFlow-Pro-API exists.${NC}"
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

# Deploy all new module Lambda functions
MODULES=(
    "insertion-orders:Insertion Orders"
    "agencies:Agencies"
    "advertisers:Advertisers"
    "shows:Shows"
    "episodes:Episodes"
    "availability:Availability"
    "ad-approvals:Ad Approvals"
    "ad-copy:Ad Copy"
    "contracts:Contracts"
    "reports:Reports"
    "financials:Financials"
)

for module_info in "${MODULES[@]}"; do
    IFS=':' read -r module_dir module_name <<< "$module_info"
    
    echo -e "\n${GREEN}Deploying ${module_name} Lambda${NC}"
    
    # Navigate to module directory
    cd "$module_dir"
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        npm install --production
    fi
    
    # Create zip file
    zip -r "../${module_dir}.zip" .
    
    # Go back to lambdas directory
    cd ..
    
    # Deploy the Lambda function
    FUNCTION_NAME="PodcastFlowPro-${module_name// /-}"
    deploy_lambda "$FUNCTION_NAME" "index.handler" "nodejs18.x" "${module_dir}.zip" "Variables={TABLE_NAME=$TABLE_NAME}"
done

# Clean up zip files
echo -e "\n${YELLOW}Cleaning up...${NC}"
rm -f *.zip

echo -e "\n${GREEN}Lambda functions deployed successfully!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Run configure-api-routes script to set up API Gateway routes"
echo "2. Test the endpoints"
echo "3. Update frontend API service to connect to new endpoints"