#\!/bin/bash

REST_API_ID="9uiib4zrdb"
REGION="us-east-1"
LAMBDA_ARN="arn:aws:lambda:${REGION}:058264344435:function:organizations"

# Get resource IDs
ORG_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/organizations'].id" --output text)
ORG_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/organizations/{id}'].id" --output text)
STATUS_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/organizations/{id}/status'].id" --output text)
FEATURES_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/organizations/{id}/features'].id" --output text)

echo "Resources found:"
echo "- /organizations: $ORG_RESOURCE"
echo "- /organizations/{id}: $ORG_ID_RESOURCE"
echo "- /organizations/{id}/status: $STATUS_RESOURCE"
echo "- /organizations/{id}/features: $FEATURES_RESOURCE"

# Configure methods
configure_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local RESOURCE_PATH=$3
    
    echo "Configuring $HTTP_METHOD $RESOURCE_PATH..."
    
    # Add method
    aws apigateway put-method \
        --rest-api-id $REST_API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --authorization-type NONE \
        --region $REGION > /dev/null 2>&1
    
    # Add integration
    aws apigateway put-integration \
        --rest-api-id $REST_API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
        --region $REGION > /dev/null 2>&1
}

# Configure all methods
configure_method $ORG_RESOURCE "GET" "/organizations"
configure_method $ORG_RESOURCE "POST" "/organizations"
configure_method $ORG_ID_RESOURCE "GET" "/organizations/{id}"
configure_method $ORG_ID_RESOURCE "PUT" "/organizations/{id}"
configure_method $STATUS_RESOURCE "PUT" "/organizations/{id}/status"
configure_method $FEATURES_RESOURCE "PUT" "/organizations/{id}/features"

# Grant Lambda permission
aws lambda add-permission \
    --function-name organizations \
    --statement-id api-gateway-organizations-all \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:058264344435:${REST_API_ID}/*/*" \
    --region $REGION 2>/dev/null || true

# Deploy API
aws apigateway create-deployment \
    --rest-api-id $REST_API_ID \
    --stage-name prod \
    --region $REGION > /dev/null

echo "✓ Organizations API methods configured successfully"
