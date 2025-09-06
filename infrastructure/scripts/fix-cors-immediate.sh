#!/bin/bash

# Immediate CORS fix for production Lambda functions
# This updates the existing Lambda functions with proper CORS environment variables

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ALLOWED_ORIGINS="https://app.podcastflow.pro,https://podcastflow.pro"

echo "Applying immediate CORS fix for production Lambda functions..."
echo "Allowed origins: $ALLOWED_ORIGINS"
echo ""

# Get all Lambda functions that start with "podcastflow"
LAMBDA_FUNCTIONS=$(aws lambda list-functions --region $REGION --query 'Functions[?starts_with(FunctionName, `podcastflow`)].FunctionName' --output text)

if [ -z "$LAMBDA_FUNCTIONS" ]; then
  echo "No Lambda functions found starting with 'podcastflow'"
  exit 1
fi

echo "Found Lambda functions:"
echo "$LAMBDA_FUNCTIONS" | tr '\t' '\n'
echo ""

# Counter for tracking updates
updated=0
failed=0

# Update each Lambda function's environment variables
for FUNCTION_NAME in $LAMBDA_FUNCTIONS; do
  echo -n "Updating $FUNCTION_NAME... "
  
  # Get current environment variables
  current_env=$(aws lambda get-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --query 'Environment.Variables' \
    --output json 2>/dev/null || echo "{}")
  
  if [ "$current_env" = "null" ]; then
    current_env="{}"
  fi
  
  # Add or update ALLOWED_ORIGINS in the environment variables
  updated_env=$(echo "$current_env" | jq --arg origins "$ALLOWED_ORIGINS" '. + {ALLOWED_ORIGINS: $origins}')
  
  # Update the Lambda function configuration
  if aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment "Variables=$updated_env" \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
    ((updated++))
    sleep 1  # Small delay to avoid rate limiting
  else
    echo "FAILED"
    ((failed++))
  fi
done

echo ""
echo "================================"
echo "CORS Environment Update Complete!"
echo "================================"
echo "Successfully updated: $updated Lambda functions"
echo "Failed: $failed"
echo ""
echo "Allowed origins set to:"
echo "- https://app.podcastflow.pro"
echo "- https://podcastflow.pro"
echo ""
echo "IMPORTANT: The Lambda function code still needs to be updated to use these environment variables."
echo "Currently, the Lambda functions are hardcoded to allow '*' for CORS."
echo ""
echo "To complete the CORS fix, you need to:"
echo "1. Update the Lambda function code to read from the ALLOWED_ORIGINS environment variable"
echo "2. Redeploy the Lambda functions with the updated code"
echo ""
echo "For now, as a temporary workaround, you may need to configure CORS at the API Gateway level."