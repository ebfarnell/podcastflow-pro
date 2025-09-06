#!/bin/bash

# Script to check Lambda integrations for all endpoints
API_ID="9uiib4zrdb"
REGION="us-east-1"

echo "Endpoint,Method,Lambda Function,Integration Type"

# Get all resources
aws apigateway get-resources --rest-api-id $API_ID --region $REGION --limit 500 --output json > /tmp/resources.json

# Extract paths with methods
jq -r '.items[] | select(.resourceMethods) | .id + "|" + .path + "|" + (.resourceMethods | keys | join(","))' /tmp/resources.json | while IFS='|' read -r resource_id path methods; do
    # For each method, check integration
    IFS=',' read -ra method_array <<< "$methods"
    for method in "${method_array[@]}"; do
        if [ "$method" != "OPTIONS" ]; then
            integration=$(aws apigateway get-integration --rest-api-id $API_ID --resource-id "$resource_id" --http-method "$method" --region $REGION 2>/dev/null | jq -r '.uri // "none"' | grep -oP 'function:\K[^/]+' || echo "no-integration")
            echo "$path,$method,$integration,Lambda"
        fi
    done
done | sort