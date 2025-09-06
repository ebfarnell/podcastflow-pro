#!/bin/bash

# Script to update all Lambda functions to use proper CORS configuration
# This will update the Lambda code to use the shared CORS module

set -e

echo "Updating Lambda functions to use shared CORS configuration..."

# List of all Lambda directories
LAMBDA_DIRS=(
  "activity-log"
  "ad-approvals"
  "ad-copy"
  "advertisers"
  "agencies"
  "analytics"
  "api-webhooks"
  "auth"
  "authorizer"
  "availability"
  "backup"
  "billing"
  "billing-overview"
  "campaigns"
  "clients"
  "contracts"
  "dashboard"
  "deadlines"
  "deals"
  "episodes"
  "financials"
  "insertion-orders"
  "integrations"
  "invoices"
  "monitoring"
  "notifications"
  "organization"
  "organizations"
  "permissions"
  "permissions-check"
  "reports"
  "role-assignment"
  "role-permissions"
  "security"
  "show-assignment"
  "shows"
  "team"
  "tracking"
  "uploads"
  "user"
  "users"
  "websocket"
)

# Function to update a Lambda function's index.js
update_lambda_function() {
  local dir=$1
  local index_file="../lambdas/$dir/index.js"
  
  if [ -f "$index_file" ]; then
    echo "Updating $dir/index.js..."
    
    # Create a backup
    cp "$index_file" "$index_file.bak"
    
    # Update the file to use the shared CORS module
    # This is a simple replacement - in production you'd want more sophisticated parsing
    sed -i '1i const { getCORSHeaders } = require('\''../shared/cors'\'');' "$index_file"
    
    # Replace hardcoded CORS headers with dynamic ones
    sed -i "s/'Access-Control-Allow-Origin': '\*'/getCORSHeaders(event.headers?.origin || event.headers?.Origin)/g" "$index_file"
    
    # Replace CORS_HEADERS constant definition
    sed -i '/const CORS_HEADERS = {/,/};/c\
const CORS_HEADERS = getCORSHeaders(event.headers?.origin || event.headers?.Origin);' "$index_file"
    
    echo "Updated $dir/index.js"
  else
    echo "Warning: $index_file not found"
  fi
}

# Update each Lambda function
for dir in "${LAMBDA_DIRS[@]}"; do
  update_lambda_function "$dir"
done

echo "Lambda function updates complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes made to each Lambda function"
echo "2. Copy the shared/cors.js file to each Lambda deployment package"
echo "3. Run the deployment scripts to update the Lambda functions in AWS"
echo "4. Set the ALLOWED_ORIGINS environment variable for each Lambda function"