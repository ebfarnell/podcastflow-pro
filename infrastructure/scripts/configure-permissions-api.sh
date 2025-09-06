#!/bin/bash

# Configure API endpoints for permissions Lambda

set -e

REGION="us-east-1"
REST_API_ID="6a2opgfepf"
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/'].id" --output text)

echo "Configuring permissions API endpoints..."

# Create /roles resource
echo "Creating /roles resource..."
ROLES_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "roles" \
    --region $REGION \
    --query 'id' \
    --output text) || ROLES_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='roles'].id" --output text | head -1)

# Create /roles/{role} resource
echo "Creating /roles/{role} resource..."
ROLE_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $ROLES_RESOURCE \
    --path-part "{role}" \
    --region $REGION \
    --query 'id' \
    --output text) || ROLE_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='{role}'].id" --output text | head -1)

# Create /roles/{role}/permissions resource
echo "Creating /roles/{role}/permissions resource..."
PERMISSIONS_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $ROLE_RESOURCE \
    --path-part "permissions" \
    --region $REGION \
    --query 'id' \
    --output text) || PERMISSIONS_RESOURCE=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?pathPart=='permissions'].id" --output text | head -1)

# Configure GET method for /roles/{role}/permissions
echo "Configuring GET method..."
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method GET \
    --authorization-type NONE \
    --region $REGION \
    --no-paginate || true

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:podcastflow-permissions/invocations" \
    --region $REGION \
    --no-paginate || true

# Configure PUT method for /roles/{role}/permissions
echo "Configuring PUT method..."
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method PUT \
    --authorization-type NONE \
    --region $REGION \
    --no-paginate || true

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method PUT \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:podcastflow-permissions/invocations" \
    --region $REGION \
    --no-paginate || true

# Configure OPTIONS method for CORS
echo "Configuring OPTIONS method..."
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION \
    --no-paginate || true

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION \
    --no-paginate || true

aws apigateway put-integration-response \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION \
    --no-paginate || true

aws apigateway put-method-response \
    --rest-api-id $REST_API_ID \
    --resource-id $PERMISSIONS_RESOURCE \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region $REGION \
    --no-paginate || true

# Deploy API
echo "Deploying API changes..."
aws apigateway create-deployment \
    --rest-api-id $REST_API_ID \
    --stage-name prod \
    --region $REGION

echo "Permissions API configuration complete!"
echo "Endpoints:"
echo "  GET  /roles/{role}/permissions"
echo "  PUT  /roles/{role}/permissions"