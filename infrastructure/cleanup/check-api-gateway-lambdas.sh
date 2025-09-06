#!/bin/bash

# Script to check API Gateway for Lambda integrations
# This helps identify which endpoints need to be cleaned up

API_ID="9uiib4zrdb"
REGION="us-east-1"
OUTPUT_FILE="api-gateway-lambda-analysis.txt"

echo "=== API Gateway Lambda Integration Analysis ==="
echo "Date: $(date)"
echo "API ID: $API_ID"
echo ""

# Get all resources
echo "Fetching API Gateway resources..."
aws apigateway get-resources --rest-api-id $API_ID --region $REGION --limit 500 --output json > api-resources.json

TOTAL_RESOURCES=$(jq '.items | length' api-resources.json)
echo "Total resources found: $TOTAL_RESOURCES"
echo ""

# Function to check integration
check_integration() {
    local RESOURCE_ID=$1
    local PATH=$2
    local METHOD=$3
    
    # Get integration details
    INTEGRATION=$(aws apigateway get-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --region $REGION \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        INTEGRATION_TYPE=$(echo $INTEGRATION | jq -r '.type // "unknown"')
        URI=$(echo $INTEGRATION | jq -r '.uri // ""')
        
        # Check if it's a Lambda integration
        if [[ "$INTEGRATION_TYPE" == "AWS" ]] || [[ "$INTEGRATION_TYPE" == "AWS_PROXY" ]]; then
            if [[ "$URI" == *"lambda"* ]]; then
                # Extract Lambda function name from URI
                LAMBDA_NAME=$(echo $URI | grep -oP 'function:[^/]+' | cut -d: -f2)
                echo "LAMBDA: $PATH [$METHOD] -> $LAMBDA_NAME (Type: $INTEGRATION_TYPE)"
                return 0
            fi
        fi
    fi
    return 1
}

# Analyze each resource
echo "Analyzing resources for Lambda integrations..." | tee $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

LAMBDA_COUNT=0
NON_LAMBDA_COUNT=0

# Process each resource
jq -r '.items[] | "\(.id)|\(.path)|\(.resourceMethods // {})"' api-resources.json | while IFS='|' read -r RESOURCE_ID PATH METHODS; do
    if [ "$METHODS" != "{}" ] && [ "$METHODS" != "null" ]; then
        # Extract method names
        METHOD_LIST=$(echo $METHODS | jq -r 'keys[]' 2>/dev/null)
        
        for METHOD in $METHOD_LIST; do
            if [ "$METHOD" != "OPTIONS" ]; then  # Skip OPTIONS methods
                if check_integration "$RESOURCE_ID" "$PATH" "$METHOD"; then
                    ((LAMBDA_COUNT++))
                    echo "$PATH [$METHOD] -> Lambda" >> $OUTPUT_FILE
                else
                    ((NON_LAMBDA_COUNT++))
                fi
            fi
        done
    fi
done

echo ""
echo "=== Summary ==="
echo "Total endpoints with Lambda integration: $LAMBDA_COUNT"
echo "Total endpoints without Lambda: $NON_LAMBDA_COUNT"
echo ""

# Check for our specific Lambda functions
echo "Checking for specific PodcastFlow Lambda functions..."
TARGET_LAMBDAS=("podcastflow-api-analytics" "podcastflow-api-organization" "podcastflow-api-user" "podcastflow-users")

for LAMBDA in "${TARGET_LAMBDAS[@]}"; do
    echo -n "Checking for $LAMBDA... "
    if grep -q "$LAMBDA" $OUTPUT_FILE 2>/dev/null; then
        echo "FOUND"
        grep "$LAMBDA" $OUTPUT_FILE
    else
        echo "Not found in API Gateway"
    fi
done

echo ""
echo "Analysis saved to: $OUTPUT_FILE"
echo "Full resource data: api-resources.json"

# Cleanup
rm -f api-resources.json