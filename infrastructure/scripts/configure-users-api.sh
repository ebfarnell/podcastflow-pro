#!/bin/bash

# Configure API Gateway routes for users endpoints

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
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-users"

# Check if function exists
if ! aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo -e "${RED}Error: Lambda function $FUNCTION_NAME not found${NC}"
    exit 1
fi

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path == "/"].id' --output text)

echo -e "${YELLOW}Creating /users resource...${NC}"

# Create /users resource
USERS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part users \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "users"].id' \
    --output text)

echo -e "${GREEN}Users resource ID: $USERS_RESOURCE_ID${NC}"

# Create /users/{id} resource
echo -e "${YELLOW}Creating /users/{id} resource...${NC}"

USER_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USERS_RESOURCE_ID \
    --path-part '{id}' \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{id}" && parentId == "'$USERS_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}User ID resource ID: $USER_ID_RESOURCE_ID${NC}"

# Create /users/{id}/role resource
echo -e "${YELLOW}Creating /users/{id}/role resource...${NC}"

USER_ROLE_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USER_ID_RESOURCE_ID \
    --path-part role \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "role" && parentId == "'$USER_ID_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}User role resource ID: $USER_ROLE_RESOURCE_ID${NC}"

# Create /users/{id}/status resource
echo -e "${YELLOW}Creating /users/{id}/status resource...${NC}"

USER_STATUS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USER_ID_RESOURCE_ID \
    --path-part status \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "status" && parentId == "'$USER_ID_RESOURCE_ID'"].id' \
    --output text)

echo -e "${GREEN}User status resource ID: $USER_STATUS_RESOURCE_ID${NC}"

# Function for creating method
create_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local WITH_AUTH=${3:-true}
    
    if [ "$WITH_AUTH" = "true" ]; then
        AUTH_TYPE="NONE"
    else
        AUTH_TYPE="NONE"
    fi
    
    echo -e "${YELLOW}Creating $HTTP_METHOD method...${NC}"
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --authorization-type $AUTH_TYPE \
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

# Create methods for /users
create_method $USERS_RESOURCE_ID "GET"
create_method $USERS_RESOURCE_ID "POST"
create_cors $USERS_RESOURCE_ID

# Create methods for /users/{id}
create_method $USER_ID_RESOURCE_ID "GET"
create_method $USER_ID_RESOURCE_ID "PUT"
create_method $USER_ID_RESOURCE_ID "DELETE"
create_cors $USER_ID_RESOURCE_ID

# Create methods for /users/{id}/role
create_method $USER_ROLE_RESOURCE_ID "PUT"
create_cors $USER_ROLE_RESOURCE_ID

# Create methods for /users/{id}/status
create_method $USER_STATUS_RESOURCE_ID "PUT"
create_cors $USER_STATUS_RESOURCE_ID

# Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name production \
    --region $REGION

echo -e "${GREEN}Successfully configured users API endpoints!${NC}"