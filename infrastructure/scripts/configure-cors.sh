#!/bin/bash

# Configure CORS for all Lambda functions
# This script updates environment variables for proper CORS configuration

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENV:-production}"

# Production domains
PRODUCTION_ORIGINS="https://app.podcastflow.pro,https://podcastflow.pro"
STAGING_ORIGINS="https://staging.podcastflow.pro,http://localhost:3000"
DEVELOPMENT_ORIGINS="http://localhost:3000,http://localhost:3001"

# Set allowed origins based on environment
case $ENVIRONMENT in
  production)
    ALLOWED_ORIGINS=$PRODUCTION_ORIGINS
    ;;
  staging)
    ALLOWED_ORIGINS=$STAGING_ORIGINS
    ;;
  development)
    ALLOWED_ORIGINS=$DEVELOPMENT_ORIGINS
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "Configuring CORS for environment: $ENVIRONMENT"
echo "Allowed origins: $ALLOWED_ORIGINS"

# Lambda functions to update
LAMBDA_FUNCTIONS=(
  "podcastflow-analytics"
  "podcastflow-campaigns"
  "podcastflow-financials"
  "podcastflow-shows"
  "podcastflow-episodes"
  "podcastflow-advertisers"
  "podcastflow-reports"
  "podcastflow-deadlines"
  "podcastflow-dashboard"
  "podcastflow-team"
  "podcastflow-organization"
  "podcastflow-security"
  "podcastflow-backup"
  "podcastflow-api-webhooks"
  "podcastflow-tracking"
)

# Update each Lambda function's environment variables
for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "Updating CORS for $FUNCTION_NAME..."
  
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment "Variables={ALLOWED_ORIGINS=$ALLOWED_ORIGINS}" \
    --region $REGION 2>/dev/null || echo "Function $FUNCTION_NAME may not exist yet"
done

echo "CORS configuration complete!"

# Create a Lambda CORS helper module
cat > ../lambdas/shared/cors.js << 'EOF'
// Shared CORS configuration for Lambda functions

const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
  return origins.split(',').map(origin => origin.trim());
};

const getCORSHeaders = (origin) => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin);
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };
};

module.exports = { getCORSHeaders, getAllowedOrigins };
EOF

echo "Created shared CORS module at ../lambdas/shared/cors.js"

# Update all Lambda functions to use the shared CORS module
echo "
To use the shared CORS module in your Lambda functions:

1. Copy the cors.js file to your Lambda deployment package
2. Import it in your handler:
   const { getCORSHeaders } = require('./cors');

3. Use it in your responses:
   const headers = getCORSHeaders(event.headers?.origin);
   
   return {
     statusCode: 200,
     headers,
     body: JSON.stringify(data)
   };
"