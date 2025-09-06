#!/bin/bash

# API Configuration
API_ID="9uiib4zrdb"
REGION="us-east-1"
STAGE="prod"

# Function to add OPTIONS method with CORS
add_options_method() {
    local resource_id=$1
    local path=$2
    
    echo "Adding OPTIONS method to $path (Resource ID: $resource_id)"
    
    # Create OPTIONS method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
    
    # Add method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
        --region $REGION
    
    # Add integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # Add integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
}

# Function to add CORS headers to existing methods
add_cors_to_method() {
    local resource_id=$1
    local http_method=$2
    local path=$3
    
    echo "Adding CORS headers to $http_method $path (Resource ID: $resource_id)"
    
    # Check if method response exists, if not create it
    if ! aws apigateway get-method-response --rest-api-id $API_ID --resource-id $resource_id --http-method $http_method --status-code 200 --region $REGION 2>/dev/null; then
        # Add method response with CORS headers
        aws apigateway put-method-response \
            --rest-api-id $API_ID \
            --resource-id $resource_id \
            --http-method $http_method \
            --status-code 200 \
            --response-parameters "method.response.header.Access-Control-Allow-Origin=true" \
            --region $REGION
    else
        # Update existing method response to include CORS headers
        aws apigateway update-method-response \
            --rest-api-id $API_ID \
            --resource-id $resource_id \
            --http-method $http_method \
            --status-code 200 \
            --patch-operations op=add,path=/responseParameters/method.response.header.Access-Control-Allow-Origin,value=true \
            --region $REGION 2>/dev/null || echo "CORS header already exists for $http_method $path"
    fi
    
    # Check if integration response exists, if not skip (Lambda proxy integrations handle this)
    if aws apigateway get-integration-response --rest-api-id $API_ID --resource-id $resource_id --http-method $http_method --status-code 200 --region $REGION 2>/dev/null; then
        # Update integration response to include CORS headers
        aws apigateway update-integration-response \
            --rest-api-id $API_ID \
            --resource-id $resource_id \
            --http-method $http_method \
            --status-code 200 \
            --patch-operations op=add,path=/responseParameters/method.response.header.Access-Control-Allow-Origin,value="'*'" \
            --region $REGION 2>/dev/null || echo "CORS header already exists in integration response"
    fi
}

echo "Starting CORS configuration update for API: $API_ID"
echo "================================================"

# 1. Add OPTIONS method to /dashboard
add_options_method "8hjfl8" "/dashboard"

# 2. Add CORS headers to GET /dashboard
add_cors_to_method "8hjfl8" "GET" "/dashboard"

# 3. Add OPTIONS method to /analytics/dashboard
add_options_method "bacpt4" "/analytics/dashboard"

# 4. Add CORS headers to GET /analytics/dashboard
add_cors_to_method "bacpt4" "GET" "/analytics/dashboard"

# 5. Add OPTIONS method to /api-webhooks
add_options_method "duncs3" "/api-webhooks"

# 6. Add CORS headers to GET /api-webhooks
add_cors_to_method "duncs3" "GET" "/api-webhooks"

# 7. Add OPTIONS method to /backups
add_options_method "vmnp7t" "/backups"

# 8. Add CORS headers to GET /backups
add_cors_to_method "vmnp7t" "GET" "/backups"

# 9. Check and add CORS to endpoints with {id} paths that are missing OPTIONS
# /ad-approvals/{id}
add_options_method "17df64" "/ad-approvals/{id}"
add_cors_to_method "17df64" "GET" "/ad-approvals/{id}"
add_cors_to_method "17df64" "PUT" "/ad-approvals/{id}"
add_cors_to_method "17df64" "DELETE" "/ad-approvals/{id}"

# /agencies/{id}
add_options_method "69lhg0" "/agencies/{id}"
add_cors_to_method "69lhg0" "GET" "/agencies/{id}"
add_cors_to_method "69lhg0" "PUT" "/agencies/{id}"
add_cors_to_method "69lhg0" "DELETE" "/agencies/{id}"

# /episodes/{id}
add_options_method "9r4xhj" "/episodes/{id}"
add_cors_to_method "9r4xhj" "GET" "/episodes/{id}"
add_cors_to_method "9r4xhj" "PUT" "/episodes/{id}"
add_cors_to_method "9r4xhj" "DELETE" "/episodes/{id}"

# /campaigns/{id}
add_options_method "cr0isv" "/campaigns/{id}"
add_cors_to_method "cr0isv" "GET" "/campaigns/{id}"
add_cors_to_method "cr0isv" "PUT" "/campaigns/{id}"
add_cors_to_method "cr0isv" "DELETE" "/campaigns/{id}"

# /availability/{id}
add_options_method "dk7sbb" "/availability/{id}"
add_cors_to_method "dk7sbb" "GET" "/availability/{id}"
add_cors_to_method "dk7sbb" "PUT" "/availability/{id}"
add_cors_to_method "dk7sbb" "DELETE" "/availability/{id}"

# /advertisers/{id}
add_options_method "fdpvoh" "/advertisers/{id}"
add_cors_to_method "fdpvoh" "GET" "/advertisers/{id}"
add_cors_to_method "fdpvoh" "PUT" "/advertisers/{id}"
add_cors_to_method "fdpvoh" "DELETE" "/advertisers/{id}"

# /insertion-orders/{id}
add_options_method "gdjyk2" "/insertion-orders/{id}"
add_cors_to_method "gdjyk2" "GET" "/insertion-orders/{id}"
add_cors_to_method "gdjyk2" "PUT" "/insertion-orders/{id}"
add_cors_to_method "gdjyk2" "DELETE" "/insertion-orders/{id}"

# /ad-copy/{id}
add_options_method "ks6fhm" "/ad-copy/{id}"
add_cors_to_method "ks6fhm" "GET" "/ad-copy/{id}"
add_cors_to_method "ks6fhm" "PUT" "/ad-copy/{id}"
add_cors_to_method "ks6fhm" "DELETE" "/ad-copy/{id}"

# /contracts/{id}
add_options_method "mdu4zi" "/contracts/{id}"
add_cors_to_method "mdu4zi" "GET" "/contracts/{id}"
add_cors_to_method "mdu4zi" "PUT" "/contracts/{id}"
add_cors_to_method "mdu4zi" "DELETE" "/contracts/{id}"

# /reports/{id}
add_options_method "tupyql" "/reports/{id}"
add_cors_to_method "tupyql" "GET" "/reports/{id}"
add_cors_to_method "tupyql" "PUT" "/reports/{id}"
add_cors_to_method "tupyql" "DELETE" "/reports/{id}"

# /financials/{id}
add_options_method "yiigg0" "/financials/{id}"
add_cors_to_method "yiigg0" "GET" "/financials/{id}"
add_cors_to_method "yiigg0" "PUT" "/financials/{id}"
add_cors_to_method "yiigg0" "DELETE" "/financials/{id}"

# /shows/{id}
add_options_method "zpgtex" "/shows/{id}"
add_cors_to_method "zpgtex" "GET" "/shows/{id}"
add_cors_to_method "zpgtex" "PUT" "/shows/{id}"
add_cors_to_method "zpgtex" "DELETE" "/shows/{id}"

# Also ensure CORS headers are on all methods for endpoints that already have OPTIONS
# /campaigns
add_cors_to_method "se7193" "GET" "/campaigns"
add_cors_to_method "se7193" "POST" "/campaigns"
add_cors_to_method "se7193" "PUT" "/campaigns"
add_cors_to_method "se7193" "DELETE" "/campaigns"

# /episodes
add_cors_to_method "eb3x22" "GET" "/episodes"
add_cors_to_method "eb3x22" "POST" "/episodes"

# /shows
add_cors_to_method "3kjgst" "GET" "/shows"
add_cors_to_method "3kjgst" "POST" "/shows"

# /advertisers
add_cors_to_method "pnot7g" "GET" "/advertisers"
add_cors_to_method "pnot7g" "POST" "/advertisers"

# /agencies
add_cors_to_method "s9ctk8" "GET" "/agencies"
add_cors_to_method "s9ctk8" "POST" "/agencies"

# /ad-approvals
add_cors_to_method "w7413i" "GET" "/ad-approvals"
add_cors_to_method "w7413i" "POST" "/ad-approvals"

# /ad-copy
add_cors_to_method "zlshvl" "GET" "/ad-copy"
add_cors_to_method "zlshvl" "POST" "/ad-copy"

# /availability
add_cors_to_method "rfq7wu" "GET" "/availability"
add_cors_to_method "rfq7wu" "POST" "/availability"

# /contracts
add_cors_to_method "q7949j" "GET" "/contracts"
add_cors_to_method "q7949j" "POST" "/contracts"

# /financials
add_cors_to_method "25xsno" "GET" "/financials"
add_cors_to_method "25xsno" "POST" "/financials"

# /insertion-orders
add_cors_to_method "2jpbtr" "GET" "/insertion-orders"
add_cors_to_method "2jpbtr" "POST" "/insertion-orders"

# /organization
add_cors_to_method "g5b17c" "GET" "/organization"
add_cors_to_method "g5b17c" "PUT" "/organization"

# /reports
add_cors_to_method "ifklzq" "GET" "/reports"
add_cors_to_method "ifklzq" "POST" "/reports"

# /team
add_cors_to_method "kt7xxk" "GET" "/team"
add_cors_to_method "kt7xxk" "POST" "/team"
add_cors_to_method "kt7xxk" "PUT" "/team"
add_cors_to_method "kt7xxk" "DELETE" "/team"

# /user/preferences
add_cors_to_method "0uq5r7" "GET" "/user/preferences"
add_cors_to_method "0uq5r7" "PUT" "/user/preferences"

# /user/profile
add_cors_to_method "3dnznw" "GET" "/user/profile"
add_cors_to_method "3dnznw" "PUT" "/user/profile"

echo ""
echo "================================================"
echo "CORS configuration updates completed!"
echo ""
echo "Deploying changes to $STAGE stage..."

# Deploy the changes
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE \
    --description "Added CORS configuration to all endpoints" \
    --region $REGION

echo ""
echo "Deployment completed successfully!"
echo "API Gateway URL: https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE"