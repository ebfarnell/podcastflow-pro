#!/bin/bash

# Configure CORS for API Gateway
# This adds CORS configuration to the API Gateway itself

set -e

API_ID="6a2opgfepf"
REGION="us-east-1"
STAGE_NAME="prod"

echo "Configuring CORS for API Gateway..."
echo "API ID: $API_ID"
echo "Allowed Origins: https://app.podcastflow.pro"

# Function to add CORS to a resource
add_cors_to_resource() {
    local resource_id=$1
    local resource_path=$2
    
    echo "Adding OPTIONS method to $resource_path..."
    
    # Add OPTIONS method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
    
    # Add method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
    
    # Add integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
    
    # Add integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,PUT,DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''https://app.podcastflow.pro'\''"}' \
        --response-templates '{"application/json": ""}' \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
}

# Get all resources
echo "Getting API resources..."
resources=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[*].[id,path]' --output text)

# Add CORS to each resource
while IFS=$'\t' read -r resource_id resource_path; do
    if [ ! -z "$resource_id" ]; then
        add_cors_to_resource "$resource_id" "$resource_path"
    fi
done <<< "$resources"

# Deploy the API
echo ""
echo "Deploying API changes..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE_NAME \
    --description "CORS configuration update" \
    --region $REGION \
    --no-cli-pager

echo ""
echo "CORS configuration complete!"
echo ""
echo "The API Gateway is now configured to allow requests from:"
echo "- https://app.podcastflow.pro"
echo ""
echo "Note: The Lambda functions still need to return proper CORS headers in their responses."