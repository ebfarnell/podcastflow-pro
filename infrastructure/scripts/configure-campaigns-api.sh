#!/bin/bash

# Configure API Gateway routes for campaigns endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

# API Gateway ID
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='PodcastFlow-Pro-API'].id" --output text --region $REGION)

if [ -z "$API_ID" ]; then
    echo -e "${RED}Error: Could not find API Gateway${NC}"
    exit 1
fi

echo -e "${GREEN}Found API Gateway: ${API_ID}${NC}"

# Function name
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-campaigns"

# Check if function exists
if ! aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo -e "${RED}Error: Lambda function $FUNCTION_NAME not found${NC}"
    exit 1
fi

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path == "/"].id' --output text)

# Get authorizer ID
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query "items[?name=='PodcastFlowProAuthorizer'].id" --output text)

echo -e "${YELLOW}Creating /campaigns resource...${NC}"

# Create /campaigns resource
CAMPAIGNS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part campaigns \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "campaigns"].id' \
    --output text)

echo -e "${GREEN}Campaigns resource ID: $CAMPAIGNS_RESOURCE_ID${NC}"

# Create /campaigns/{campaignId} resource
echo -e "${YELLOW}Creating /campaigns/{campaignId} resource...${NC}"

CAMPAIGN_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $CAMPAIGNS_RESOURCE_ID \
    --path-part "{campaignId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{campaignId}" && parentId == "'$CAMPAIGNS_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}Campaign ID resource ID: $CAMPAIGN_ID_RESOURCE_ID${NC}"

# Create /campaigns/{campaignId}/team resource
echo -e "${YELLOW}Creating /campaigns/{campaignId}/team resource...${NC}"

TEAM_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $CAMPAIGN_ID_RESOURCE_ID \
    --path-part "team" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "team" && parentId == "'$CAMPAIGN_ID_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}Team resource ID: $TEAM_RESOURCE_ID${NC}"

# Create /campaigns/{campaignId}/team/{userId} resource
echo -e "${YELLOW}Creating /campaigns/{campaignId}/team/{userId} resource...${NC}"

TEAM_USER_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $TEAM_RESOURCE_ID \
    --path-part "{userId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{userId}" && parentId == "'$TEAM_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}Team user resource ID: $TEAM_USER_RESOURCE_ID${NC}"

# Function for creating method with authorization
create_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    
    echo -e "${YELLOW}Creating $HTTP_METHOD method...${NC}"
    
    # Create method with authorizer
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --authorization-type CUSTOM \
        --authorizer-id $AUTHORIZER_ID \
        --region $REGION 2>/dev/null || true
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}/invocations" \
        --region $REGION 2>/dev/null || true
    
    # Create method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Origin=true" \
        --region $REGION 2>/dev/null || true
    
    # Create integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Origin='*'" \
        --region $REGION 2>/dev/null || true
}

# Function for creating CORS
create_cors() {
    local RESOURCE_ID=$1
    
    echo -e "${YELLOW}Creating CORS for resource...${NC}"
    
    # Create OPTIONS method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION 2>/dev/null || true
    
    # Create mock integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION 2>/dev/null || true
    
    # Create method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
        --region $REGION 2>/dev/null || true
    
    # Create integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Headers='Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',method.response.header.Access-Control-Allow-Methods='GET,POST,PUT,DELETE,OPTIONS',method.response.header.Access-Control-Allow-Origin='*'" \
        --region $REGION 2>/dev/null || true
}

# Create methods for /campaigns
create_method $CAMPAIGNS_RESOURCE_ID "GET"
create_method $CAMPAIGNS_RESOURCE_ID "POST"
create_cors $CAMPAIGNS_RESOURCE_ID

# Create methods for /campaigns/{campaignId}
create_method $CAMPAIGN_ID_RESOURCE_ID "GET"
create_method $CAMPAIGN_ID_RESOURCE_ID "PUT"
create_method $CAMPAIGN_ID_RESOURCE_ID "DELETE"
create_cors $CAMPAIGN_ID_RESOURCE_ID

# Create methods for /campaigns/{campaignId}/team
create_method $TEAM_RESOURCE_ID "POST"
create_cors $TEAM_RESOURCE_ID

# Create methods for /campaigns/{campaignId}/team/{userId}
create_method $TEAM_USER_RESOURCE_ID "DELETE"
create_cors $TEAM_USER_RESOURCE_ID

# Add Lambda permission
echo -e "${YELLOW}Adding Lambda permission for API Gateway...${NC}"
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-campaigns \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name production \
    --region $REGION

echo -e "${GREEN}Successfully configured campaigns API endpoints!${NC}"