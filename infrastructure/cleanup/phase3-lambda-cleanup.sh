#!/bin/bash

# Phase 3: Lambda Functions Cleanup
set -e

REGION="us-east-1"
LOG_FILE="phase3-lambda-cleanup-$(date +%Y%m%d-%H%M%S).log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Phase 3: Lambda Functions Cleanup ===${NC}" | tee $LOG_FILE
echo "Deleting Lambda functions with 0 invocations in the last 7 days" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Lambda functions with 0 invocations (confirmed)
LAMBDA_FUNCTIONS_TO_DELETE=(
    "PodcastFlowPro-APIWebhooks"
    "PodcastFlowPro-Ad-Approvals"
    "PodcastFlowPro-Ad-Copy"
    "PodcastFlowPro-Advertisers"
    "PodcastFlowPro-Agencies"
    "PodcastFlowPro-Availability"
    "PodcastFlowPro-Backup"
    "PodcastFlowPro-Billing"
    "PodcastFlowPro-Contracts"
    "PodcastFlowPro-Episodes"
    "PodcastFlowPro-Financials"
    "PodcastFlowPro-Insertion-Orders"
    "PodcastFlowPro-Reports"
    "PodcastFlowPro-Security"
    "PodcastFlowPro-Shows"
    "PodcastFlowPro-Team"
    "PodcastFlowPro-master-analytics"
    "PodcastFlowPro-master-billing"
    "PodcastFlowPro-master-organizations"
    "PodcastFlowPro-master-settings"
    "PodcastFlowPro-master-users"
    "PodcastFlowPro-PodcastFlowPro-activity-log"
    "PodcastFlowPro-PodcastFlowPro-ad-approvals"
    "PodcastFlowPro-PodcastFlowPro-ad-copy"
    "PodcastFlowPro-PodcastFlowPro-advertisers"
    "PodcastFlowPro-PodcastFlowPro-agencies"
    "PodcastFlowPro-PodcastFlowPro-authorizer"
    "PodcastFlowPro-PodcastFlowPro-availability"
    "PodcastFlowPro-PodcastFlowPro-billing-overview"
    "PodcastFlowPro-PodcastFlowPro-campaigns"
    "PodcastFlowPro-PodcastFlowPro-contracts"
    "PodcastFlowPro-PodcastFlowPro-deals"
    "PodcastFlowPro-PodcastFlowPro-episodes"
    "PodcastFlowPro-PodcastFlowPro-financials"
    "PodcastFlowPro-PodcastFlowPro-insertion-orders"
    "PodcastFlowPro-PodcastFlowPro-notifications"
    "PodcastFlowPro-PodcastFlowPro-organizations"
    "PodcastFlowPro-PodcastFlowPro-permissions"
    "PodcastFlowPro-PodcastFlowPro-permissions-check"
    "PodcastFlowPro-PodcastFlowPro-reports"
    "PodcastFlowPro-PodcastFlowPro-role-assignment"
    "PodcastFlowPro-PodcastFlowPro-role-permissions"
    "PodcastFlowPro-PodcastFlowPro-show-assignment"
    "PodcastFlowPro-PodcastFlowPro-shows"
    "podcastflow-api-campaigns"
    "podcastflow-permissions"
    "podcastflow-websocket-handler"
)

echo "Functions to delete: ${#LAMBDA_FUNCTIONS_TO_DELETE[@]}" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Confirmation
echo -e "${YELLOW}WARNING: This will delete ${#LAMBDA_FUNCTIONS_TO_DELETE[@]} Lambda functions!${NC}"
echo -e "${YELLOW}Make sure you have completed the backup.${NC}"
read -p "Continue? (yes/no): " response
if [[ "$response" != "yes" ]]; then
    echo "Aborted by user"
    exit 1
fi

# Delete each Lambda function
DELETED_COUNT=0
FAILED_COUNT=0

for func in "${LAMBDA_FUNCTIONS_TO_DELETE[@]}"; do
    echo -n "Deleting $func... " | tee -a $LOG_FILE
    
    # Delete function
    if aws lambda delete-function --function-name "$func" \
        --region $REGION 2>>$LOG_FILE; then
        echo -e "${GREEN}✓${NC}" | tee -a $LOG_FILE
        ((DELETED_COUNT++))
        
        # Try to delete associated log group
        LOG_GROUP="/aws/lambda/$func"
        aws logs delete-log-group --log-group-name "$LOG_GROUP" \
            --region $REGION 2>/dev/null || true
    else
        echo -e "${RED}✗${NC}" | tee -a $LOG_FILE
        ((FAILED_COUNT++))
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.5
done

echo "" | tee -a $LOG_FILE
echo -e "${GREEN}Summary:${NC}" | tee -a $LOG_FILE
echo "- Deleted: $DELETED_COUNT functions" | tee -a $LOG_FILE
echo "- Failed: $FAILED_COUNT functions" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Show remaining Lambda functions
echo "Remaining PodcastFlow Lambda functions:" | tee -a $LOG_FILE
aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'odcast')].[FunctionName]" \
    --output table | tee -a $LOG_FILE

echo "" | tee -a $LOG_FILE
echo -e "${GREEN}Phase 3 Complete!${NC}" | tee -a $LOG_FILE
echo "Log file: $LOG_FILE"

# Verify app health
echo "" | tee -a $LOG_FILE
echo "Checking application health..." | tee -a $LOG_FILE
if curl -s http://localhost:3000/api/health | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Application health check passed${NC}" | tee -a $LOG_FILE
else
    echo -e "${RED}✗ Application health check failed!${NC}" | tee -a $LOG_FILE
fi