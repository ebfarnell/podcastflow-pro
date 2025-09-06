#!/bin/bash

# Emergency Rollback Script for PodcastFlow Pro
# Use this script to restore resources if issues occur after deletion

set -e

# Configuration
REGION="us-east-1"
API_ID="9uiib4zrdb"
BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/backups"
S3_BACKUP_BUCKET="podcastflow-backups-590183844530"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to restore Lambda function
restore_lambda_function() {
    local FUNCTION_NAME=$1
    local BACKUP_DATE=$2
    
    log "Restoring Lambda function: $FUNCTION_NAME"
    
    # Check if backup exists
    CONFIG_FILE="$BACKUP_DIR/$BACKUP_DATE/lambda/configs/${FUNCTION_NAME}-config.json"
    CODE_FILE="$BACKUP_DIR/$BACKUP_DATE/lambda/code/${FUNCTION_NAME}.zip"
    
    if [ ! -f "$CONFIG_FILE" ]; then
        error "Config file not found: $CONFIG_FILE"
    fi
    
    if [ ! -f "$CODE_FILE" ]; then
        error "Code file not found: $CODE_FILE"
    fi
    
    # Extract configuration
    RUNTIME=$(jq -r '.Runtime' "$CONFIG_FILE")
    HANDLER=$(jq -r '.Handler' "$CONFIG_FILE")
    ROLE=$(jq -r '.Role' "$CONFIG_FILE")
    TIMEOUT=$(jq -r '.Timeout' "$CONFIG_FILE")
    MEMORY=$(jq -r '.MemorySize' "$CONFIG_FILE")
    
    # Create function
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime "$RUNTIME" \
        --role "$ROLE" \
        --handler "$HANDLER" \
        --timeout "$TIMEOUT" \
        --memory-size "$MEMORY" \
        --zip-file "fileb://$CODE_FILE" \
        --region $REGION || error "Failed to create Lambda function"
    
    # Restore environment variables if they exist
    ENV_VARS=$(jq -r '.Environment.Variables // empty' "$CONFIG_FILE")
    if [ ! -z "$ENV_VARS" ] && [ "$ENV_VARS" != "null" ]; then
        aws lambda update-function-configuration \
            --function-name "$FUNCTION_NAME" \
            --environment "Variables=$ENV_VARS" \
            --region $REGION || warning "Failed to set environment variables"
    fi
    
    log "✓ Lambda function restored: $FUNCTION_NAME"
}

# Function to restore API Gateway endpoint
restore_api_endpoint() {
    local PATH=$1
    local PARENT_PATH=$(dirname "$PATH")
    local RESOURCE_NAME=$(basename "$PATH")
    
    log "Restoring API Gateway endpoint: $PATH"
    
    # Get parent resource ID
    if [ "$PARENT_PATH" = "/" ]; then
        PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID \
            --region $REGION --query "items[?path=='/'].id" --output text)
    else
        PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID \
            --region $REGION --query "items[?path=='$PARENT_PATH'].id" --output text)
    fi
    
    if [ -z "$PARENT_ID" ]; then
        error "Parent resource not found for $PATH"
    fi
    
    # Create resource
    RESOURCE_ID=$(aws apigateway create-resource --rest-api-id $API_ID \
        --parent-id "$PARENT_ID" --path-part "$RESOURCE_NAME" \
        --region $REGION --query 'id' --output text) || error "Failed to create resource"
    
    log "✓ API Gateway resource created: $PATH (ID: $RESOURCE_ID)"
    echo "$RESOURCE_ID"
}

# Function to restore DynamoDB table from backup
restore_dynamodb_table() {
    local TABLE_NAME=$1
    local BACKUP_ARN=$2
    
    log "Restoring DynamoDB table: $TABLE_NAME from backup"
    
    # Restore from backup
    aws dynamodb restore-table-from-backup \
        --target-table-name "$TABLE_NAME" \
        --backup-arn "$BACKUP_ARN" \
        --region $REGION || error "Failed to restore DynamoDB table"
    
    # Wait for table to be active
    log "Waiting for table to become active..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region $REGION
    
    log "✓ DynamoDB table restored: $TABLE_NAME"
}

# Main rollback menu
main() {
    echo -e "${RED}=== EMERGENCY ROLLBACK PROCEDURE ===${NC}"
    echo -e "${RED}Use this only if issues occur after resource deletion${NC}"
    echo ""
    
    # List available backups
    echo -e "${YELLOW}Available backups:${NC}"
    ls -la "$BACKUP_DIR" 2>/dev/null | grep "^d" | awk '{print $9}' | grep -E "[0-9]{8}-[0-9]{6}"
    echo ""
    
    read -p "Enter backup date to use (YYYYMMDD-HHMMSS): " BACKUP_DATE
    
    if [ ! -d "$BACKUP_DIR/$BACKUP_DATE" ]; then
        error "Backup not found: $BACKUP_DIR/$BACKUP_DATE"
    fi
    
    while true; do
        echo -e "\n${YELLOW}What do you need to restore?${NC}"
        echo "1) Single Lambda function"
        echo "2) All Lambda functions from Phase 3"
        echo "3) API Gateway endpoints"
        echo "4) DynamoDB table"
        echo "5) Complete Phase rollback"
        echo "6) Exit"
        
        read -p "Select option: " option
        
        case $option in
            1)
                read -p "Enter Lambda function name: " FUNCTION_NAME
                restore_lambda_function "$FUNCTION_NAME" "$BACKUP_DATE"
                ;;
            
            2)
                echo "Restoring all Lambda functions..."
                for config in "$BACKUP_DIR/$BACKUP_DATE/lambda/configs"/*-config.json; do
                    if [ -f "$config" ]; then
                        FUNCTION_NAME=$(basename "$config" | sed 's/-config.json//')
                        restore_lambda_function "$FUNCTION_NAME" "$BACKUP_DATE"
                    fi
                done
                ;;
            
            3)
                echo "Note: This requires manual configuration of methods and integrations"
                read -p "Enter API endpoint path (e.g., /campaigns): " ENDPOINT_PATH
                restore_api_endpoint "$ENDPOINT_PATH"
                echo "Next steps:"
                echo "1. Add methods (GET, POST, etc.) via AWS Console"
                echo "2. Configure Lambda integration"
                echo "3. Deploy API changes"
                ;;
            
            4)
                echo "Available DynamoDB backup ARNs:"
                cat "$BACKUP_DIR/$BACKUP_DATE/dynamodb/backup-arns.txt" 2>/dev/null || echo "No backup ARNs found"
                read -p "Enter table name to restore: " TABLE_NAME
                read -p "Enter backup ARN: " BACKUP_ARN
                restore_dynamodb_table "$TABLE_NAME" "$BACKUP_ARN"
                ;;
            
            5)
                echo -e "${YELLOW}Select phase to rollback:${NC}"
                echo "1) Phase 1: CloudWatch Logs (Note: Cannot restore deleted logs)"
                echo "2) Phase 2: API Gateway endpoints"
                echo "3) Phase 3: Lambda functions"
                echo "4) Phase 5: IAM roles"
                read -p "Enter phase: " phase
                
                case $phase in
                    1)
                        warning "CloudWatch Logs cannot be restored once deleted"
                        warning "New log groups will be created automatically when Lambda functions are invoked"
                        ;;
                    2)
                        warning "API Gateway restoration requires manual intervention"
                        echo "Steps:"
                        echo "1. Open AWS Console > API Gateway"
                        echo "2. Import API from backup: $BACKUP_DIR/$BACKUP_DATE/api-gateway/api-export-prod.json"
                        echo "3. Configure Lambda integrations"
                        echo "4. Deploy to prod and production stages"
                        ;;
                    3)
                        confirm "Restore all Lambda functions from Phase 3? (yes/no): "
                        # Restore Lambda functions logic here
                        ;;
                    4)
                        log "Restoring IAM role: PodcastFlowProLambdaRole"
                        # This is complex - would need to recreate role and policies
                        warning "IAM role restoration requires manual steps:"
                        echo "1. Create role with trust policy from backup"
                        echo "2. Attach policies listed in backup"
                        echo "3. Update Lambda functions to use role"
                        ;;
                esac
                ;;
            
            6)
                break
                ;;
            
            *)
                echo "Invalid option"
                ;;
        esac
    done
    
    echo -e "\n${GREEN}Rollback procedure complete${NC}"
    echo "Next steps:"
    echo "1. Verify restored resources in AWS Console"
    echo "2. Test application functionality"
    echo "3. Monitor logs for errors"
    echo "4. Update team on rollback status"
}

# Quick restore functions for common scenarios
quick_restore_critical_lambdas() {
    log "Quick restore of critical Lambda functions..."
    
    CRITICAL_LAMBDAS=(
        "podcastflow-api-user"
        "podcastflow-api-organization"
        "PodcastFlowPro-PodcastFlowPro-users"
    )
    
    for func in "${CRITICAL_LAMBDAS[@]}"; do
        restore_lambda_function "$func" "$1"
    done
}

# Confirm function
confirm() {
    read -p "$1" response
    if [[ "$response" != "yes" ]]; then
        echo "Aborted"
        exit 1
    fi
}

# Check if running as emergency
if [ "$1" = "--emergency" ]; then
    echo -e "${RED}EMERGENCY MODE: Restoring critical functions${NC}"
    LATEST_BACKUP=$(ls -1 "$BACKUP_DIR" | grep -E "[0-9]{8}-[0-9]{6}" | sort -r | head -1)
    quick_restore_critical_lambdas "$LATEST_BACKUP"
else
    main
fi