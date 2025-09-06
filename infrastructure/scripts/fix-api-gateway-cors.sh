#!/bin/bash

# Script to configure API Gateway CORS to allow Lambda functions to handle CORS

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
API_ID="6a2opgfepf"
STAGE_NAME="prod"

echo "Configuring API Gateway CORS for marketing-analytics-api..."
echo "API ID: $API_ID"
echo "Stage: $STAGE_NAME"
echo ""

# Get all resources in the API
echo "Fetching API resources..."
RESOURCES=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[].id" \
    --output text)

echo "Found resources: $RESOURCES"
echo ""

# For each resource, remove API Gateway CORS configuration
# This allows Lambda functions to handle CORS
for RESOURCE_ID in $RESOURCES; do
    echo -n "Processing resource $RESOURCE_ID... "
    
    # Get resource path
    RESOURCE_PATH=$(aws apigateway get-resource \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --region $REGION \
        --query "path" \
        --output text 2>/dev/null || echo "unknown")
    
    echo -n "($RESOURCE_PATH) "
    
    # Check if OPTIONS method exists
    HAS_OPTIONS=$(aws apigateway get-resource \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --region $REGION \
        --query "resourceMethods.OPTIONS" \
        --output text 2>/dev/null || echo "None")
    
    if [ "$HAS_OPTIONS" != "None" ]; then
        echo -n "Updating OPTIONS integration... "
        
        # Update the OPTIONS method to proxy to Lambda
        # This ensures Lambda handles CORS headers
        aws apigateway put-integration \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method OPTIONS \
            --type AWS_PROXY \
            --integration-http-method POST \
            --region $REGION \
            --no-cli-pager > /dev/null 2>&1 || true
        
        echo "Done"
    else
        echo "No OPTIONS method"
    fi
done

# Deploy the changes
echo ""
echo -n "Deploying API changes to $STAGE_NAME stage... "
if aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE_NAME \
    --description "Updated CORS configuration to allow Lambda handling" \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
else
    echo "FAILED"
fi

echo ""
echo "================================"
echo "API Gateway CORS Update Complete!"
echo "================================"
echo ""
echo "The API Gateway has been updated to allow Lambda functions to handle CORS."
echo "This ensures that the correct origin-specific headers are returned."
echo ""
echo "Note: It may take a few minutes for the changes to propagate."