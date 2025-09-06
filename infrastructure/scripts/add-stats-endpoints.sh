#!/bin/bash

# Script to add missing stats endpoints to API Gateway

API_ID="9uiib4zrdb"
REGION="us-east-1"

echo "Adding stats endpoints to API Gateway..."

# Get the parent resource IDs
SHOWS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/shows'].id" --output text)
echo "Shows resource ID: $SHOWS_RESOURCE_ID"

# Create /shows/stats resource
echo "Creating /shows/stats resource..."
SHOWS_STATS_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $SHOWS_RESOURCE_ID \
  --path-part "stats" \
  2>/dev/null || echo "Resource might already exist")

if [ "$SHOWS_STATS_RESOURCE" = "Resource might already exist" ]; then
  SHOWS_STATS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/shows/stats'].id" --output text)
else
  SHOWS_STATS_ID=$(echo $SHOWS_STATS_RESOURCE | jq -r '.id')
fi

echo "Shows stats resource ID: $SHOWS_STATS_ID"

# Add GET method to /shows/stats
echo "Adding GET method to /shows/stats..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method GET \
  --authorization-type NONE \
  --no-api-key-required \
  2>/dev/null || echo "Method might already exist"

# Add Lambda integration to /shows/stats GET
echo "Adding Lambda integration to /shows/stats GET..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:PodcastFlowPro-Shows/invocations"

# Add OPTIONS method for CORS
echo "Adding OPTIONS method to /shows/stats..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --no-api-key-required \
  2>/dev/null || echo "Method might already exist"

# Add mock integration for OPTIONS
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Add CORS headers to OPTIONS response
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": false,
    "method.response.header.Access-Control-Allow-Methods": false,
    "method.response.header.Access-Control-Allow-Origin": false
  }'

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $SHOWS_STATS_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''",
    "method.response.header.Access-Control-Allow-Methods": "'\''GET,OPTIONS'\''",
    "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"
  }'

# Now let's check if episodes endpoint exists
EPISODES_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/episodes'].id" --output text)

if [ -z "$EPISODES_RESOURCE_ID" ]; then
  echo "Episodes endpoint doesn't exist. Creating it..."
  
  # Get root resource
  ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/'].id" --output text)
  
  # Create /episodes resource
  EPISODES_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "episodes")
  EPISODES_RESOURCE_ID=$(echo $EPISODES_RESOURCE | jq -r '.id')
  
  # Add methods to /episodes (GET, POST, OPTIONS)
  for METHOD in GET POST OPTIONS; do
    aws apigateway put-method \
      --rest-api-id $API_ID \
      --resource-id $EPISODES_RESOURCE_ID \
      --http-method $METHOD \
      --authorization-type NONE \
      --no-api-key-required
  done
  
  # Add Lambda integration for GET and POST
  for METHOD in GET POST; do
    aws apigateway put-integration \
      --rest-api-id $API_ID \
      --resource-id $EPISODES_RESOURCE_ID \
      --http-method $METHOD \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:PodcastFlowPro-Episodes/invocations"
  done
  
  # Add mock integration for OPTIONS
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $EPISODES_RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'
fi

echo "Episodes resource ID: $EPISODES_RESOURCE_ID"

# Create /episodes/stats resource
echo "Creating /episodes/stats resource..."
EPISODES_STATS_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $EPISODES_RESOURCE_ID \
  --path-part "stats" \
  2>/dev/null || echo "Resource might already exist")

if [ "$EPISODES_STATS_RESOURCE" = "Resource might already exist" ]; then
  EPISODES_STATS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/episodes/stats'].id" --output text)
else
  EPISODES_STATS_ID=$(echo $EPISODES_STATS_RESOURCE | jq -r '.id')
fi

echo "Episodes stats resource ID: $EPISODES_STATS_ID"

# Add GET method to /episodes/stats
echo "Adding GET method to /episodes/stats..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method GET \
  --authorization-type NONE \
  --no-api-key-required \
  2>/dev/null || echo "Method might already exist"

# Add Lambda integration to /episodes/stats GET
echo "Adding Lambda integration to /episodes/stats GET..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:PodcastFlowPro-Episodes/invocations"

# Add OPTIONS method for CORS
echo "Adding OPTIONS method to /episodes/stats..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --no-api-key-required \
  2>/dev/null || echo "Method might already exist"

# Add mock integration for OPTIONS
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Add CORS headers to OPTIONS response
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": false,
    "method.response.header.Access-Control-Allow-Methods": false,
    "method.response.header.Access-Control-Allow-Origin": false
  }'

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $EPISODES_STATS_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''",
    "method.response.header.Access-Control-Allow-Methods": "'\''GET,OPTIONS'\''",
    "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"
  }'

# Add Lambda permissions
echo "Adding Lambda invoke permissions..."
aws lambda add-permission \
  --function-name PodcastFlowPro-Shows \
  --statement-id "AllowAPIGatewayStats-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
  2>/dev/null || echo "Permission might already exist"

# Check if episodes Lambda exists
EPISODES_LAMBDA=$(aws lambda list-functions --query "Functions[?FunctionName=='PodcastFlowPro-Episodes'].FunctionName" --output text)
if [ -z "$EPISODES_LAMBDA" ]; then
  echo "Warning: PodcastFlowPro-Episodes Lambda function not found. Episodes endpoints won't work until it's created."
else
  aws lambda add-permission \
    --function-name PodcastFlowPro-Episodes \
    --statement-id "AllowAPIGatewayStats-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
    2>/dev/null || echo "Permission might already exist"
fi

# Deploy the changes
echo "Deploying API changes..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Added stats endpoints for shows and episodes"

echo "Stats endpoints have been added successfully!"
echo "- https://$API_ID.execute-api.$REGION.amazonaws.com/prod/shows/stats"
echo "- https://$API_ID.execute-api.$REGION.amazonaws.com/prod/episodes/stats"