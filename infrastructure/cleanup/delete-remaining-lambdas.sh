#!/bin/bash

# Script to delete remaining Lambda functions after migration to Next.js
# CRITICAL: These Lambda functions have NO tenant isolation!

set -e

REGION="us-east-1"
LOG_FILE="lambda-deletion-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Lambda Function Deletion Script ===" | tee $LOG_FILE
echo "Date: $(date)" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Lambda functions to delete
FUNCTIONS=(
    "podcastflow-api-analytics"
    "podcastflow-api-organization" 
    "podcastflow-api-user"
    "podcastflow-users"
)

echo -e "${RED}⚠️  CRITICAL SECURITY WARNING ⚠️${NC}" | tee -a $LOG_FILE
echo "These Lambda functions have NO tenant isolation and pose a data leakage risk!" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

echo "Functions to delete:" | tee -a $LOG_FILE
for func in "${FUNCTIONS[@]}"; do
    echo "  - $func" | tee -a $LOG_FILE
done
echo "" | tee -a $LOG_FILE

# Verify backup exists
BACKUP_DIR=$(ls -td /home/ec2-user/podcastflow-pro/infrastructure/cleanup/lambda-final-backup-* 2>/dev/null | head -1)
if [ -z "$BACKUP_DIR" ]; then
    echo -e "${RED}ERROR: No backup found! Run backup-remaining-lambdas.sh first.${NC}" | tee -a $LOG_FILE
    exit 1
fi

echo -e "${GREEN}✓ Backup found at: $BACKUP_DIR${NC}" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Final confirmation
echo -e "${YELLOW}This will permanently delete 4 Lambda functions.${NC}" | tee -a $LOG_FILE
echo "The application already uses Next.js APIs with proper tenant isolation." | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
read -p "Are you sure you want to proceed? Type 'DELETE' to confirm: " confirmation

if [ "$confirmation" != "DELETE" ]; then
    echo "Deletion cancelled by user." | tee -a $LOG_FILE
    exit 1
fi

echo "" | tee -a $LOG_FILE
echo "Starting deletion process..." | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Track results
DELETED_COUNT=0
FAILED_COUNT=0

# Delete each Lambda function
for func in "${FUNCTIONS[@]}"; do
    echo -n "Deleting $func... " | tee -a $LOG_FILE
    
    # Delete the function
    if aws lambda delete-function --function-name "$func" --region $REGION 2>>$LOG_FILE; then
        echo -e "${GREEN}✓${NC}" | tee -a $LOG_FILE
        ((DELETED_COUNT++))
        
        # Try to delete associated CloudWatch Log Group
        LOG_GROUP="/aws/lambda/$func"
        echo -n "  Deleting log group $LOG_GROUP... " | tee -a $LOG_FILE
        if aws logs delete-log-group --log-group-name "$LOG_GROUP" --region $REGION 2>>$LOG_FILE; then
            echo -e "${GREEN}✓${NC}" | tee -a $LOG_FILE
        else
            echo -e "${YELLOW}⚠ (may not exist)${NC}" | tee -a $LOG_FILE
        fi
        
    else
        echo -e "${RED}✗${NC}" | tee -a $LOG_FILE
        ((FAILED_COUNT++))
    fi
    
    echo "" | tee -a $LOG_FILE
done

# Check remaining Lambda functions
echo "Checking remaining Lambda functions..." | tee -a $LOG_FILE
REMAINING=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'podcastflow')].FunctionName" --output json)
REMAINING_COUNT=$(echo $REMAINING | jq '. | length')

echo "" | tee -a $LOG_FILE
echo "=== Deletion Summary ===" | tee -a $LOG_FILE
echo "Deleted: $DELETED_COUNT functions" | tee -a $LOG_FILE
echo "Failed: $FAILED_COUNT functions" | tee -a $LOG_FILE
echo "Remaining PodcastFlow Lambda functions: $REMAINING_COUNT" | tee -a $LOG_FILE

if [ $REMAINING_COUNT -gt 0 ]; then
    echo "" | tee -a $LOG_FILE
    echo "Remaining functions:" | tee -a $LOG_FILE
    echo $REMAINING | jq -r '.[]' | tee -a $LOG_FILE
fi

echo "" | tee -a $LOG_FILE
echo "=== Next Steps ===" | tee -a $LOG_FILE
echo "1. Monitor application logs for any errors" | tee -a $LOG_FILE
echo "2. Clean up API Gateway endpoints (if needed)" | tee -a $LOG_FILE
echo "3. Update monitoring/alarms" | tee -a $LOG_FILE
echo "4. Document the architectural change" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

if [ $DELETED_COUNT -eq ${#FUNCTIONS[@]} ]; then
    echo -e "${GREEN}✅ Lambda cleanup completed successfully!${NC}" | tee -a $LOG_FILE
    echo "" | tee -a $LOG_FILE
    echo -e "${GREEN}🔐 Security improved: All functions without tenant isolation have been removed.${NC}" | tee -a $LOG_FILE
else
    echo -e "${YELLOW}⚠️  Lambda cleanup partially completed. Check log for details.${NC}" | tee -a $LOG_FILE
fi

echo "" | tee -a $LOG_FILE
echo "Log file: $LOG_FILE" | tee -a $LOG_FILE