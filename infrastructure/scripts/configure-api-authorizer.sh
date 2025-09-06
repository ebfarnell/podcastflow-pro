#!/bin/bash

# Configure API Gateway authorizer

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

# Authorizer function name
AUTHORIZER_FUNCTION="PodcastFlowPro-PodcastFlowPro-authorizer"

# Check if authorizer already exists
EXISTING_AUTHORIZER=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query "items[?name=='PodcastFlowProAuthorizer'].id" --output text)

if [ ! -z "$EXISTING_AUTHORIZER" ]; then
    echo -e "${YELLOW}Authorizer already exists with ID: $EXISTING_AUTHORIZER${NC}"
    echo -e "${YELLOW}Deleting existing authorizer...${NC}"
    aws apigateway delete-authorizer --rest-api-id $API_ID --authorizer-id $EXISTING_AUTHORIZER --region $REGION
fi

echo -e "${YELLOW}Creating new authorizer...${NC}"

# Create authorizer
AUTHORIZER_ID=$(aws apigateway create-authorizer \
    --rest-api-id $API_ID \
    --name "PodcastFlowProAuthorizer" \
    --type TOKEN \
    --authorizer-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${AUTHORIZER_FUNCTION}/invocations" \
    --identity-source "method.request.header.Authorization" \
    --authorizer-result-ttl-in-seconds 300 \
    --region $REGION \
    --query 'id' \
    --output text)

echo -e "${GREEN}Created authorizer with ID: $AUTHORIZER_ID${NC}"

# Add Lambda permission for API Gateway to invoke authorizer
echo -e "${YELLOW}Adding Lambda permission for API Gateway...${NC}"

aws lambda add-permission \
    --function-name $AUTHORIZER_FUNCTION \
    --statement-id apigateway-authorizer \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/authorizers/${AUTHORIZER_ID}" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

# Function to update method authorization
update_method_auth() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local RESOURCE_PATH=$3
    
    # Skip OPTIONS methods
    if [ "$HTTP_METHOD" == "OPTIONS" ]; then
        return
    fi
    
    echo -e "${YELLOW}Updating authorization for $HTTP_METHOD $RESOURCE_PATH...${NC}"
    
    aws apigateway update-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --patch-operations \
            op=replace,path=/authorizationType,value=CUSTOM \
            op=replace,path=/authorizerId,value=$AUTHORIZER_ID \
        --region $REGION 2>/dev/null || echo "Failed to update $HTTP_METHOD $RESOURCE_PATH"
}

echo -e "${YELLOW}Updating methods to use authorizer...${NC}"

# Get all resources and update their methods
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --limit 500)

# Parse resources and update methods
echo "$RESOURCES" | jq -r '.items[] | "\(.id) \(.path)"' | while read -r RESOURCE_ID RESOURCE_PATH; do
    # Get methods for this resource
    METHODS=$(echo "$RESOURCES" | jq -r ".items[] | select(.id == \"$RESOURCE_ID\") | .resourceMethods // {} | keys[]" 2>/dev/null)
    
    for METHOD in $METHODS; do
        # Skip certain paths that shouldn't require auth
        if [[ "$RESOURCE_PATH" == "/" || "$RESOURCE_PATH" == "/health" || "$RESOURCE_PATH" == "/auth"* ]]; then
            echo -e "${YELLOW}Skipping auth for $METHOD $RESOURCE_PATH${NC}"
            continue
        fi
        
        update_method_auth "$RESOURCE_ID" "$METHOD" "$RESOURCE_PATH"
    done
done

# Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name production \
    --description "Added authorizer configuration" \
    --region $REGION

echo -e "${GREEN}Successfully configured API Gateway authorizer!${NC}"
echo -e "${GREEN}Authorizer ID: $AUTHORIZER_ID${NC}"