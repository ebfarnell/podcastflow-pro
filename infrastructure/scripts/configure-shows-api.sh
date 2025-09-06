#!/bin/bash

# Configure API Gateway routes for shows endpoints

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
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-shows"

# Check if function exists
if ! aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo -e "${RED}Error: Lambda function $FUNCTION_NAME not found${NC}"
    exit 1
fi

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path == "/"].id' --output text)

# Get authorizer ID
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query "items[?name=='PodcastFlowProAuthorizer'].id" --output text)

# Get or create /shows resource
SHOWS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart == "shows"].id' --output text)

if [ -z "$SHOWS_RESOURCE_ID" ]; then
    echo -e "${YELLOW}Creating /shows resource...${NC}"
    SHOWS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_RESOURCE_ID \
        --path-part shows \
        --region $REGION \
        --query 'id' \
        --output text)
fi

echo -e "${GREEN}Shows resource ID: $SHOWS_RESOURCE_ID${NC}"

# Get or create /shows/{showId} resource
SHOW_ID_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart == "{showId}" && parentId == "'$SHOWS_RESOURCE_ID'"].id' --output text)

if [ -z "$SHOW_ID_RESOURCE_ID" ]; then
    echo -e "${YELLOW}Creating /shows/{showId} resource...${NC}"
    SHOW_ID_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $SHOWS_RESOURCE_ID \
        --path-part "{showId}" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

echo -e "${GREEN}Show ID resource ID: $SHOW_ID_RESOURCE_ID${NC}"

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

# Create methods for /shows
create_method $SHOWS_RESOURCE_ID "GET"
create_method $SHOWS_RESOURCE_ID "POST"
create_cors $SHOWS_RESOURCE_ID

# Create methods for /shows/{showId}
create_method $SHOW_ID_RESOURCE_ID "GET"
create_method $SHOW_ID_RESOURCE_ID "PUT"
create_method $SHOW_ID_RESOURCE_ID "DELETE"
create_cors $SHOW_ID_RESOURCE_ID

# Add Lambda permission
echo -e "${YELLOW}Adding Lambda permission for API Gateway...${NC}"
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-shows \
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

echo -e "${GREEN}Successfully configured shows API endpoints!${NC}"