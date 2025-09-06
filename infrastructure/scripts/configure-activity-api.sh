#!/bin/bash

# Configure API Gateway for activity logging endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuring activity API endpoints...${NC}"

# Configuration
REST_API_ID="6a2opgfepf"
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-activity-log"
REGION="us-east-1"

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

if [ -z "$LAMBDA_ARN" ]; then
    echo -e "${RED}Error: Lambda function not found${NC}"
    exit 1
fi

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/'].id" --output text)

# Create /activities resource
echo -e "${YELLOW}Creating /activities resource...${NC}"
ACTIVITIES_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='activities'].id" --output text)

if [ -z "$ACTIVITIES_ID" ]; then
    ACTIVITIES_ID=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $ROOT_ID \
        --path-part activities \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created activities resource: $ACTIVITIES_ID"
else
    echo "Activities resource already exists: $ACTIVITIES_ID"
fi

# Create /activities/{activityId} resource
echo -e "${YELLOW}Creating /activities/{activityId} resource...${NC}"
ACTIVITY_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='{activityId}' && parentId=='$ACTIVITIES_ID'].id" --output text)

if [ -z "$ACTIVITY_ID_RESOURCE" ]; then
    ACTIVITY_ID_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $ACTIVITIES_ID \
        --path-part "{activityId}" \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created {activityId} resource: $ACTIVITY_ID_RESOURCE"
else
    echo "{activityId} resource already exists: $ACTIVITY_ID_RESOURCE"
fi

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

# Create activity endpoints
create_method $ACTIVITIES_ID "GET" "/activities"
create_method $ACTIVITIES_ID "POST" "/activities"
create_method $ACTIVITIES_ID "OPTIONS" "/activities"

create_method $ACTIVITY_ID_RESOURCE "GET" "/activities/{activityId}"
create_method $ACTIVITY_ID_RESOURCE "OPTIONS" "/activities/{activityId}"

# Add Lambda permissions
echo -e "${YELLOW}Adding Lambda permissions...${NC}"
PERMISSION_EXISTS=$(aws lambda get-policy --function-name $FUNCTION_NAME --region $REGION 2>/dev/null | jq -r '.Policy' | jq -r '.Statement[].Sid' | grep -c "apigateway-activities-invoke" || true)

if [ "$PERMISSION_EXISTS" -eq "0" ]; then
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id apigateway-activities-invoke \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:590183844530:$REST_API_ID/*/*/*" \
        --region $REGION
    echo "Lambda permission added"
else
    echo "Lambda permission already exists"
fi

# Deploy API
echo -e "${YELLOW}Deploying API...${NC}"
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $REST_API_ID \
    --stage-name prod \
    --region $REGION \
    --query 'id' \
    --output text)

echo -e "${GREEN}API deployment completed! Deployment ID: $DEPLOYMENT_ID${NC}"
echo -e "${GREEN}Activity API endpoints configured successfully!${NC}"