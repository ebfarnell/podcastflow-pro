#!/bin/bash

# Configure Organizations API Routes

REST_API_ID="9uiib4zrdb"
REGION="us-east-1"

# Get authorizer ID
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $REST_API_ID --region $REGION --query "items[0].id" --output text)

# Get root resource ID
PARENT_ID=$(aws apigateway get-resources --rest-api-id $REST_API_ID --region $REGION --query "items[?path=='/'].id" --output text)

echo "Configuring Organizations API routes..."

# Get Lambda ARN
LAMBDA_ARN="arn:aws:lambda:${REGION}:058264344435:function:organizations"

# Create /organizations resource
RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $PARENT_ID \
    --path-part "organizations" \
    --region $REGION \
    --query 'id' \
    --output text)

echo "Created /organizations resource: $RESOURCE_ID"

# Configure CORS for /organizations
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region $REGION > /dev/null

aws apigateway put-method-response \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
    --region $REGION > /dev/null

aws apigateway put-integration-response \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION > /dev/null

# GET /organizations
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# POST /organizations
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# Create /organizations/{id} resource
ORG_ID_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $RESOURCE_ID \
    --path-part "{id}" \
    --region $REGION \
    --query 'id' \
    --output text)

echo "Created /organizations/{id} resource: $ORG_ID_RESOURCE"

# Configure CORS for /organizations/{id}
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region $REGION > /dev/null

aws apigateway put-method-response \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
    --region $REGION > /dev/null

aws apigateway put-integration-response \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION > /dev/null

# GET /organizations/{id}
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method GET \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# PUT /organizations/{id}
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method PUT \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $ORG_ID_RESOURCE \
    --http-method PUT \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# Create /organizations/{id}/status resource
STATUS_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $ORG_ID_RESOURCE \
    --path-part "status" \
    --region $REGION \
    --query 'id' \
    --output text)

echo "Created /organizations/{id}/status resource: $STATUS_RESOURCE"

# PUT /organizations/{id}/status
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $STATUS_RESOURCE \
    --http-method PUT \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $STATUS_RESOURCE \
    --http-method PUT \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# Create /organizations/{id}/features resource
FEATURES_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $REST_API_ID \
    --parent-id $ORG_ID_RESOURCE \
    --path-part "features" \
    --region $REGION \
    --query 'id' \
    --output text)

echo "Created /organizations/{id}/features resource: $FEATURES_RESOURCE"

# PUT /organizations/{id}/features
aws apigateway put-method \
    --rest-api-id $REST_API_ID \
    --resource-id $FEATURES_RESOURCE \
    --http-method PUT \
    --authorization-type NONE \
    --region $REGION > /dev/null

aws apigateway put-integration \
    --rest-api-id $REST_API_ID \
    --resource-id $FEATURES_RESOURCE \
    --http-method PUT \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null

# Grant Lambda permission for all endpoints
aws lambda add-permission \
    --function-name organizations \
    --statement-id api-gateway-organizations \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:058264344435:${REST_API_ID}/*/*" \
    --region $REGION 2>/dev/null || true

# Deploy API
aws apigateway create-deployment \
    --rest-api-id $REST_API_ID \
    --stage-name prod \
    --region $REGION > /dev/null

echo "✓ Organizations API routes configured successfully"