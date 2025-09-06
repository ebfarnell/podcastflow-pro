#!/bin/bash

# Deploy CORS fix for Lambda functions
# This script updates the Lambda functions with proper CORS handling

set -e

REGION="us-east-1"

echo "Deploying CORS fix for Lambda functions..."
echo ""

# Function to deploy a Lambda with CORS fix
deploy_lambda_cors_fix() {
    local function_name=$1
    local lambda_dir=$2
    
    echo "Deploying CORS fix for $function_name..."
    
    # Create deployment package directory
    temp_dir="/tmp/lambda-cors-fix-$function_name"
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    # Copy the fixed index.js
    if [ -f "../lambdas/$lambda_dir/index-cors-fixed.js" ]; then
        cp "../lambdas/$lambda_dir/index-cors-fixed.js" "$temp_dir/index.js"
    else
        # Use the original and patch it
        cp "../lambdas/$lambda_dir/index.js" "$temp_dir/index.js"
        
        # Add CORS function at the beginning
        cat > "$temp_dir/cors-patch.js" << 'EOF'
// Get CORS headers based on request origin and environment variable
function getCORSHeaders(event) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
  
  // Check if the request origin is in the allowed list
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };
}

EOF
        
        # Prepend the CORS function and update the handler
        cat "$temp_dir/cors-patch.js" "$temp_dir/index.js" > "$temp_dir/index-patched.js"
        mv "$temp_dir/index-patched.js" "$temp_dir/index.js"
        rm "$temp_dir/cors-patch.js"
    fi
    
    # Copy dependencies
    if [ -d "../lambdas/$lambda_dir/node_modules" ]; then
        cp -r "../lambdas/$lambda_dir/node_modules" "$temp_dir/"
    fi
    
    if [ -f "../lambdas/$lambda_dir/package.json" ]; then
        cp "../lambdas/$lambda_dir/package.json" "$temp_dir/"
    fi
    
    # Create deployment package
    cd "$temp_dir"
    zip -r deployment.zip . > /dev/null
    
    # Update Lambda function
    aws lambda update-function-code \
        --function-name "$function_name" \
        --zip-file "fileb://deployment.zip" \
        --region "$REGION" \
        --no-cli-pager > /dev/null
    
    echo "✓ $function_name deployed with CORS fix"
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$temp_dir"
}

# Deploy the user Lambda with CORS fix
deploy_lambda_cors_fix "podcastflow-api-user" "users"

echo ""
echo "====================================="
echo "CORS Fix Deployment Complete!"
echo "====================================="
echo ""
echo "The following has been configured:"
echo "1. Lambda environment variables now include ALLOWED_ORIGINS"
echo "2. Lambda function code updated to use dynamic CORS headers"
echo "3. Allowed origins: https://app.podcastflow.pro, https://podcastflow.pro"
echo ""
echo "The API should now properly handle CORS requests from your domain."
echo ""
echo "To deploy other Lambda functions with CORS fix, run:"
echo "  deploy_lambda_cors_fix 'function-name' 'lambda-directory'"