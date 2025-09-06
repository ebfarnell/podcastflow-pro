#!/bin/bash

# Fix API Gateway Integration for Ad Approvals
# This script updates the ad-approvals endpoint to use the correct Lambda function

set -e

echo "Fixing API Gateway Integration for Ad Approvals..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

# API Gateway and resource IDs
API_ID="9uiib4zrdb"
AD_APPROVALS_RESOURCE_ID="w7413i"
LAMBDA_NAME="PodcastFlowPro-PodcastFlowPro-ad-approvals"

echo -e "${GREEN}API Gateway ID: ${API_ID}${NC}"
echo -e "${GREEN}Resource ID: ${AD_APPROVALS_RESOURCE_ID}${NC}"
echo -e "${GREEN}Lambda Function: ${LAMBDA_NAME}${NC}"

# Function to create method with integration
create_method() {
    local METHOD=$1
    
    echo -e "\n${YELLOW}Creating ${METHOD} method for ad-approvals...${NC}"
    
    # Delete existing method if it exists
    aws apigateway delete-method \
        --rest-api-id $API_ID \
        --resource-id $AD_APPROVALS_RESOURCE_ID \
        --http-method $METHOD \
        --region $REGION 2>/dev/null || true
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $AD_APPROVALS_RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type AWS_IAM \
        --region $REGION
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $AD_APPROVALS_RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
        --region $REGION
    
    # Add method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $AD_APPROVALS_RESOURCE_ID \
        --http-method $METHOD \
        --status-code 200 \
        --response-models '{"application/json":"Empty"}' \
        --region $REGION
    
    echo -e "${GREEN}${METHOD} method created successfully${NC}"
}

# Create methods for ad-approvals resource
create_method "GET"
create_method "POST"

# Check if {id} sub-resource exists
echo -e "\n${YELLOW}Checking for {id} sub-resource...${NC}"
ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?parentId=='${AD_APPROVALS_RESOURCE_ID}' && pathPart=='{id}'].id" --output text --region $REGION)

if [ -z "$ID_RESOURCE" ]; then
    echo "Creating {id} sub-resource..."
    ID_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $AD_APPROVALS_RESOURCE_ID \
        --path-part "{id}" \
        --query 'id' \
        --output text \
        --region $REGION)
fi

echo -e "${GREEN}ID Resource: ${ID_RESOURCE}${NC}"

# Create methods for {id} sub-resource
for METHOD in GET PUT DELETE; do
    echo -e "\n${YELLOW}Creating ${METHOD} method for ad-approvals/{id}...${NC}"
    
    # Delete existing method if it exists
    aws apigateway delete-method \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE \
        --http-method $METHOD \
        --region $REGION 2>/dev/null || true
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE \
        --http-method $METHOD \
        --authorization-type AWS_IAM \
        --region $REGION
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
        --region $REGION
    
    # Add method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE \
        --http-method $METHOD \
        --status-code 200 \
        --response-models '{"application/json":"Empty"}' \
        --region $REGION
    
    echo -e "${GREEN}${METHOD} method created successfully${NC}"
done

# Add CORS support for both resources
echo -e "\n${YELLOW}Adding CORS support...${NC}"

for RESOURCE_ID in $AD_APPROVALS_RESOURCE_ID $ID_RESOURCE; do
    # Delete existing OPTIONS method if it exists
    aws apigateway delete-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --region $REGION 2>/dev/null || true
    
    # Create OPTIONS method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
    
    # Create mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # Add OPTIONS method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --response-models '{"application/json":"Empty"}' \
        --region $REGION
    
    # Add integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
done

# Deploy the API
echo -e "\n${GREEN}Deploying API Gateway...${NC}"
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Fixed ad-approvals Lambda integration" \
    --query 'id' \
    --output text \
    --region $REGION)

echo -e "${GREEN}API Gateway deployed successfully! Deployment ID: ${DEPLOYMENT_ID}${NC}"

# Get the API endpoint
API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"

echo -e "\n${GREEN}Ad Approvals Integration Fixed!${NC}"
echo -e "${YELLOW}API Endpoints:${NC}"
echo "  - ${API_ENDPOINT}/ad-approvals (GET, POST)"
echo "  - ${API_ENDPOINT}/ad-approvals/{id} (GET, PUT, DELETE)"
echo ""
echo -e "${GREEN}All methods now correctly point to: ${LAMBDA_NAME}${NC}"