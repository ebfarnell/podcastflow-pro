#!/bin/bash

echo "Setting up API Gateway Cognito Authorizer..."

API_ID="9uiib4zrdb"
USER_POOL_ID="us-east-1_n2gbeGsU4"
REGION="us-east-1"

# Create the authorizer
AUTHORIZER_ID=$(aws apigateway create-authorizer \
  --rest-api-id $API_ID \
  --name "CognitoAuthorizer" \
  --type COGNITO_USER_POOLS \
  --provider-arns "arn:aws:cognito-idp:$REGION:590183844530:userpool/$USER_POOL_ID" \
  --identity-source "method.request.header.Authorization" \
  --region $REGION \
  --query 'id' \
  --output text)

echo "Created authorizer: $AUTHORIZER_ID"

# Update each method to use the authorizer
# For now, we'll just output the commands needed
echo ""
echo "To protect endpoints, run these commands:"
echo ""

# Campaigns endpoints
echo "# Protect GET /campaigns"
echo "aws apigateway update-method --rest-api-id $API_ID --resource-id [RESOURCE_ID] --http-method GET --patch-operations op=replace,path=/authorizationType,value=COGNITO_USER_POOLS op=replace,path=/authorizerId,value=$AUTHORIZER_ID --region $REGION"

echo ""
echo "After updating methods, deploy the API:"
echo "aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION"