#!/bin/bash

# Configure API Gateway routes for remaining endpoints

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

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path == "/"].id' --output text)

# Function for creating method
create_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local FUNCTION_NAME=$3
    
    echo -e "${YELLOW}Creating $HTTP_METHOD method...${NC}"
    
    # Create method
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

# Get authorizer ID
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query "items[?name=='PodcastFlowProAuthorizer'].id" --output text)

if [ -z "$AUTHORIZER_ID" ]; then
    echo -e "${RED}Error: Authorizer not found. Please run configure-api-authorizer.sh first${NC}"
    exit 1
fi

# 1. Configure role assignment endpoints
echo -e "${YELLOW}Configuring role assignment endpoints...${NC}"

# Get or create /users resource
USERS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart == "users"].id' --output text)

# Create /users/{userId}/role resource
USER_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USERS_RESOURCE_ID \
    --path-part "{userId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{userId}" && parentId == "'$USERS_RESOURCE_ID'"].id' \
    --output text)

ROLE_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USER_ID_RESOURCE_ID \
    --path-part "role" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "role" && parentId == "'$USER_ID_RESOURCE_ID'"].id' \
    --output text)

create_method $ROLE_RESOURCE_ID "POST" "PodcastFlowPro-PodcastFlowPro-role-assignment"
create_method $ROLE_RESOURCE_ID "GET" "PodcastFlowPro-PodcastFlowPro-role-assignment"
create_method $ROLE_RESOURCE_ID "PUT" "PodcastFlowPro-PodcastFlowPro-role-assignment"
create_cors $ROLE_RESOURCE_ID

# Add Lambda permission
aws lambda add-permission \
    --function-name PodcastFlowPro-PodcastFlowPro-role-assignment \
    --statement-id apigateway-role \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# 2. Configure permissions check endpoints
echo -e "${YELLOW}Configuring permissions check endpoints...${NC}"

# Create /users/{userId}/permissions resource
PERMISSIONS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $USER_ID_RESOURCE_ID \
    --path-part "permissions" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "permissions" && parentId == "'$USER_ID_RESOURCE_ID'"].id' \
    --output text)

create_method $PERMISSIONS_RESOURCE_ID "GET" "PodcastFlowPro-PodcastFlowPro-permissions-check"
create_cors $PERMISSIONS_RESOURCE_ID

# Also create /permissions for current user
PERMISSIONS_ROOT_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "permissions" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "permissions" && parentId == "'$ROOT_RESOURCE_ID'"].id' \
    --output text)

create_method $PERMISSIONS_ROOT_ID "GET" "PodcastFlowPro-PodcastFlowPro-permissions-check"
create_cors $PERMISSIONS_ROOT_ID

# Add Lambda permission
aws lambda add-permission \
    --function-name PodcastFlowPro-PodcastFlowPro-permissions-check \
    --statement-id apigateway-permissions \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# 3. Configure show assignment endpoints
echo -e "${YELLOW}Configuring show assignment endpoints...${NC}"

# Get or create /shows resource
SHOWS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?pathPart == "shows"].id' --output text)

if [ -z "$SHOWS_RESOURCE_ID" ]; then
    SHOWS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_RESOURCE_ID \
        --path-part "shows" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

# Create /shows/{showId}/assignments resource
SHOW_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $SHOWS_RESOURCE_ID \
    --path-part "{showId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{showId}" && parentId == "'$SHOWS_RESOURCE_ID'"].id' \
    --output text)

ASSIGNMENTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $SHOW_ID_RESOURCE_ID \
    --path-part "assignments" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "assignments" && parentId == "'$SHOW_ID_RESOURCE_ID'"].id' \
    --output text)

create_method $ASSIGNMENTS_RESOURCE_ID "POST" "PodcastFlowPro-PodcastFlowPro-show-assignment"
create_method $ASSIGNMENTS_RESOURCE_ID "GET" "PodcastFlowPro-PodcastFlowPro-show-assignment"
create_cors $ASSIGNMENTS_RESOURCE_ID

# Create /shows/{showId}/assignments/{userId} for DELETE
ASSIGNMENT_USER_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ASSIGNMENTS_RESOURCE_ID \
    --path-part "{userId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "{userId}" && parentId == "'$ASSIGNMENTS_RESOURCE_ID'"].id' \
    --output text)

create_method $ASSIGNMENT_USER_ID_RESOURCE_ID "DELETE" "PodcastFlowPro-PodcastFlowPro-show-assignment"
create_cors $ASSIGNMENT_USER_ID_RESOURCE_ID

# Also create /assignments for user assignments
ASSIGNMENTS_ROOT_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "assignments" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?pathPart == "assignments" && parentId == "'$ROOT_RESOURCE_ID'"].id' \
    --output text)

create_method $ASSIGNMENTS_ROOT_ID "GET" "PodcastFlowPro-PodcastFlowPro-show-assignment"
create_cors $ASSIGNMENTS_ROOT_ID

# Add Lambda permission
aws lambda add-permission \
    --function-name PodcastFlowPro-PodcastFlowPro-show-assignment \
    --statement-id apigateway-assignments \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name production \
    --description "Added role, permissions, and assignment endpoints" \
    --region $REGION

echo -e "${GREEN}Successfully configured remaining API endpoints!${NC}"