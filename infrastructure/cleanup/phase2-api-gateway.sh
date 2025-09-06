#!/bin/bash

# Phase 2: API Gateway Cleanup Script
set -e

REGION="us-east-1"
API_ID="9uiib4zrdb"
LOG_FILE="phase2-api-gateway-$(date +%Y%m%d-%H%M%S).log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Phase 2: API Gateway Cleanup ===${NC}" | tee $LOG_FILE
echo "Removing unused API Gateway endpoints that have been migrated to Next.js" | tee -a $LOG_FILE

# List of endpoints to remove
ENDPOINTS_TO_REMOVE=(
    "/ad-approvals"
    "/ad-approvals/{id}"
    "/ad-copy"
    "/ad-copy/{id}"
    "/advertisers"
    "/advertisers/{id}"
    "/agencies"
    "/agencies/{id}"
    "/availability"
    "/availability/{id}"
    "/contracts"
    "/contracts/{id}"
    "/episodes"
    "/episodes/{id}"
    "/episodes/stats"
    "/financials"
    "/financials/{id}"
    "/insertion-orders"
    "/insertion-orders/{id}"
    "/reports"
    "/reports/{id}"
    "/shows"
    "/shows/{id}"
    "/shows/stats"
    "/backups"
    "/team"
    "/api-webhooks"
)

echo -e "\nEndpoints to remove: ${#ENDPOINTS_TO_REMOVE[@]}" | tee -a $LOG_FILE

# Delete each endpoint
DELETED_COUNT=0
for endpoint in "${ENDPOINTS_TO_REMOVE[@]}"; do
    echo -n "Removing $endpoint... " | tee -a $LOG_FILE
    
    # Get resource ID
    RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
        --query "items[?path=='$endpoint'].id" --output text 2>/dev/null)
    
    if [ ! -z "$RESOURCE_ID" ] && [ "$RESOURCE_ID" != "None" ]; then
        # Delete all methods first
        for method in GET POST PUT DELETE OPTIONS; do
            aws apigateway delete-method --rest-api-id $API_ID \
                --resource-id "$RESOURCE_ID" --http-method $method \
                --region $REGION 2>/dev/null || true
        done
        
        # Delete resource
        if aws apigateway delete-resource --rest-api-id $API_ID \
            --resource-id "$RESOURCE_ID" --region $REGION 2>/dev/null; then
            echo -e "${GREEN}✓${NC}" | tee -a $LOG_FILE
            ((DELETED_COUNT++))
        else
            echo -e "${RED}✗${NC}" | tee -a $LOG_FILE
        fi
    else
        echo -e "${YELLOW}Not found${NC}" | tee -a $LOG_FILE
    fi
done

echo -e "\nDeleted $DELETED_COUNT endpoints" | tee -a $LOG_FILE

# Deploy changes
echo -e "\nDeploying API Gateway changes..." | tee -a $LOG_FILE
DEPLOYMENT_ID=$(aws apigateway create-deployment --rest-api-id $API_ID \
    --stage-name prod --description "Phase 2 cleanup - removed unused endpoints" \
    --region $REGION --query 'id' --output text 2>/dev/null)

if [ ! -z "$DEPLOYMENT_ID" ]; then
    echo "Deployment to 'prod' stage: $DEPLOYMENT_ID" | tee -a $LOG_FILE
else
    echo -e "${RED}Failed to deploy to prod stage${NC}" | tee -a $LOG_FILE
fi

# Also deploy to production stage
DEPLOYMENT_ID2=$(aws apigateway create-deployment --rest-api-id $API_ID \
    --stage-name production --description "Phase 2 cleanup - removed unused endpoints" \
    --region $REGION --query 'id' --output text 2>/dev/null)

if [ ! -z "$DEPLOYMENT_ID2" ]; then
    echo "Deployment to 'production' stage: $DEPLOYMENT_ID2" | tee -a $LOG_FILE
else
    echo -e "${RED}Failed to deploy to production stage${NC}" | tee -a $LOG_FILE
fi

echo -e "\n${GREEN}Phase 2 Complete!${NC}" | tee -a $LOG_FILE
echo "Log file: $LOG_FILE"