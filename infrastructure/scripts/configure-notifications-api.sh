#!/bin/bash

# Configure API Gateway for notifications endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuring notifications API endpoints...${NC}"

# Configuration
REST_API_ID="6a2opgfepf"
FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-notifications"
REGION="us-east-1"

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

if [ -z "$LAMBDA_ARN" ]; then
    echo -e "${RED}Error: Lambda function not found${NC}"
    exit 1
fi

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/'].id" --output text)

# Create /notifications resource
echo -e "${YELLOW}Creating /notifications resource...${NC}"
NOTIFICATIONS_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='notifications'].id" --output text)

if [ -z "$NOTIFICATIONS_ID" ]; then
    NOTIFICATIONS_ID=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $ROOT_ID \
        --path-part notifications \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created notifications resource: $NOTIFICATIONS_ID"
else
    echo "Notifications resource already exists: $NOTIFICATIONS_ID"
fi

# Create /notifications/{notificationId} resource
echo -e "${YELLOW}Creating /notifications/{notificationId} resource...${NC}"
NOTIFICATION_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='{notificationId}' && parentId=='$NOTIFICATIONS_ID'].id" --output text)

if [ -z "$NOTIFICATION_ID_RESOURCE" ]; then
    NOTIFICATION_ID_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $NOTIFICATIONS_ID \
        --path-part "{notificationId}" \
        --region $REGION \
        --query 'id' \
        --output text)
    echo "Created {notificationId} resource: $NOTIFICATION_ID_RESOURCE"
else
    echo "{notificationId} resource already exists: $NOTIFICATION_ID_RESOURCE"
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

# Create notification endpoints
create_method $NOTIFICATIONS_ID "GET" "/notifications"
create_method $NOTIFICATIONS_ID "POST" "/notifications"
create_method $NOTIFICATIONS_ID "OPTIONS" "/notifications"

create_method $NOTIFICATION_ID_RESOURCE "GET" "/notifications/{notificationId}"
create_method $NOTIFICATION_ID_RESOURCE "PUT" "/notifications/{notificationId}"
create_method $NOTIFICATION_ID_RESOURCE "DELETE" "/notifications/{notificationId}"
create_method $NOTIFICATION_ID_RESOURCE "OPTIONS" "/notifications/{notificationId}"

# Create special action endpoints
echo -e "${YELLOW}Creating special action endpoints...${NC}"

# /notifications/{notificationId}/read
READ_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='read' && parentId=='$NOTIFICATION_ID_RESOURCE'].id" --output text)

if [ -z "$READ_RESOURCE" ]; then
    READ_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $NOTIFICATION_ID_RESOURCE \
        --path-part "read" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

create_method $READ_RESOURCE "POST" "/notifications/{notificationId}/read"
create_method $READ_RESOURCE "OPTIONS" "/notifications/{notificationId}/read"

# /notifications/batch-read
BATCH_READ_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='batch-read' && parentId=='$NOTIFICATIONS_ID'].id" --output text)

if [ -z "$BATCH_READ_RESOURCE" ]; then
    BATCH_READ_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $NOTIFICATIONS_ID \
        --path-part "batch-read" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

create_method $BATCH_READ_RESOURCE "POST" "/notifications/batch-read"
create_method $BATCH_READ_RESOURCE "OPTIONS" "/notifications/batch-read"

# /notifications/batch-delete
BATCH_DELETE_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='batch-delete' && parentId=='$NOTIFICATIONS_ID'].id" --output text)

if [ -z "$BATCH_DELETE_RESOURCE" ]; then
    BATCH_DELETE_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $REST_API_ID \
        --parent-id $NOTIFICATIONS_ID \
        --path-part "batch-delete" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

create_method $BATCH_DELETE_RESOURCE "DELETE" "/notifications/batch-delete"
create_method $BATCH_DELETE_RESOURCE "OPTIONS" "/notifications/batch-delete"

# Add Lambda permissions
echo -e "${YELLOW}Adding Lambda permissions...${NC}"
PERMISSION_EXISTS=$(aws lambda get-policy --function-name $FUNCTION_NAME --region $REGION 2>/dev/null | jq -r '.Policy' | jq -r '.Statement[].Sid' | grep -c "apigateway-notifications-invoke" || true)

if [ "$PERMISSION_EXISTS" -eq "0" ]; then
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id apigateway-notifications-invoke \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:*:$REST_API_ID/*/*/*" \
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
echo -e "${GREEN}Notifications API endpoints configured successfully!${NC}"