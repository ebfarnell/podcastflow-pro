#!/bin/bash

# Phased Deletion Plan for PodcastFlow Pro
# Date: 2025-07-25
# This script guides through safe, phased deletion of unused resources

set -e

# Configuration
REGION="us-east-1"
API_ID="9uiib4zrdb"
BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/backups"
LOG_FILE="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/deletion-log-$(date +%Y%m%d-%H%M%S).txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

confirm() {
    echo -e "${YELLOW}$1${NC}"
    read -p "Proceed? (yes/no): " response
    if [[ "$response" != "yes" ]]; then
        echo "Aborted by user"
        exit 1
    fi
}

# Verification functions
verify_app_health() {
    log "Verifying application health..."
    
    # Check PM2 status
    if pm2 status | grep -q "online"; then
        log "✓ PM2 process is online"
    else
        error "✗ PM2 process is not online"
        return 1
    fi
    
    # Check API health
    if curl -s http://localhost:3000/api/health | grep -q "ok"; then
        log "✓ API health check passed"
    else
        error "✗ API health check failed"
        return 1
    fi
    
    # Check for recent errors in logs
    ERROR_COUNT=$(pm2 logs podcastflow-pro --lines 100 --nostream 2>/dev/null | grep -i "error" | wc -l)
    if [ "$ERROR_COUNT" -lt 5 ]; then
        log "✓ Low error count in logs ($ERROR_COUNT errors)"
    else
        warning "⚠ High error count in logs ($ERROR_COUNT errors)"
    fi
    
    return 0
}

# PHASE 1: CloudWatch Log Groups (No Risk)
phase1_cloudwatch_cleanup() {
    echo -e "\n${BLUE}=== PHASE 1: CloudWatch Log Groups Cleanup ===${NC}"
    log "Starting Phase 1: Removing empty CloudWatch Log Groups"
    
    # Get empty log groups
    EMPTY_LOG_GROUPS=$(aws logs describe-log-groups --region $REGION \
        --query "logGroups[?storedBytes==\`0\` && contains(logGroupName, 'lambda')].logGroupName" \
        --output text)
    
    if [ -z "$EMPTY_LOG_GROUPS" ]; then
        log "No empty log groups found"
        return 0
    fi
    
    # Count log groups
    LOG_GROUP_COUNT=$(echo "$EMPTY_LOG_GROUPS" | wc -w)
    log "Found $LOG_GROUP_COUNT empty log groups"
    
    confirm "Delete $LOG_GROUP_COUNT empty CloudWatch Log Groups?"
    
    # Delete each log group
    for log_group in $EMPTY_LOG_GROUPS; do
        log "Deleting log group: $log_group"
        aws logs delete-log-group --log-group-name "$log_group" --region $REGION 2>/dev/null || \
            error "Failed to delete $log_group"
    done
    
    log "Phase 1 complete: Deleted $LOG_GROUP_COUNT log groups"
    
    # Verify app health
    sleep 5
    verify_app_health
}

# PHASE 2: API Gateway Endpoints (Low Risk)
phase2_api_gateway_cleanup() {
    echo -e "\n${BLUE}=== PHASE 2: API Gateway Cleanup ===${NC}"
    log "Starting Phase 2: Removing unused API Gateway endpoints"
    
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
    
    confirm "Delete ${#ENDPOINTS_TO_REMOVE[@]} API Gateway endpoints?"
    
    # Delete each endpoint
    for endpoint in "${ENDPOINTS_TO_REMOVE[@]}"; do
        log "Removing endpoint: $endpoint"
        
        # Get resource ID
        RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
            --query "items[?path=='$endpoint'].id" --output text 2>/dev/null)
        
        if [ ! -z "$RESOURCE_ID" ] && [ "$RESOURCE_ID" != "None" ]; then
            # Delete all methods
            for method in GET POST PUT DELETE OPTIONS; do
                aws apigateway delete-method --rest-api-id $API_ID \
                    --resource-id "$RESOURCE_ID" --http-method $method \
                    --region $REGION 2>/dev/null || true
            done
            
            # Delete resource
            aws apigateway delete-resource --rest-api-id $API_ID \
                --resource-id "$RESOURCE_ID" --region $REGION 2>/dev/null || \
                error "Failed to delete resource $endpoint"
        fi
    done
    
    # Deploy changes
    log "Deploying API Gateway changes..."
    DEPLOYMENT_ID=$(aws apigateway create-deployment --rest-api-id $API_ID \
        --stage-name prod --description "Phase 2 cleanup - removed unused endpoints" \
        --region $REGION --query 'id' --output text)
    
    log "Deployment created: $DEPLOYMENT_ID"
    
    # Also deploy to production stage
    aws apigateway create-deployment --rest-api-id $API_ID \
        --stage-name production --description "Phase 2 cleanup - removed unused endpoints" \
        --region $REGION >/dev/null
    
    log "Phase 2 complete: Removed ${#ENDPOINTS_TO_REMOVE[@]} endpoints"
    
    # Verify app health
    sleep 10
    verify_app_health
    
    # Additional verification
    log "Testing that removed endpoints return 404..."
    TEST_ENDPOINT="https://api.podcastflow.pro/v1/ad-approvals"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_ENDPOINT" || echo "000")
    if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "403" ]; then
        log "✓ Removed endpoints returning 404/403 as expected"
    else
        warning "⚠ Unexpected response code: $HTTP_CODE"
    fi
}

# PHASE 3: Unused Lambda Functions (Medium Risk)
phase3_lambda_cleanup() {
    echo -e "\n${BLUE}=== PHASE 3: Lambda Functions Cleanup ===${NC}"
    log "Starting Phase 3: Removing unused Lambda functions"
    
    # List of Lambda functions to remove (0 invocations)
    LAMBDA_FUNCTIONS_TO_REMOVE=(
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
    )
    
    # Add all PodcastFlowPro-PodcastFlowPro-* functions with 0 invocations
    ZERO_INVOCATION_FUNCTIONS=$(cat <<EOF
PodcastFlowPro-PodcastFlowPro-activity-log
PodcastFlowPro-PodcastFlowPro-ad-approvals
PodcastFlowPro-PodcastFlowPro-ad-copy
PodcastFlowPro-PodcastFlowPro-advertisers
PodcastFlowPro-PodcastFlowPro-agencies
PodcastFlowPro-PodcastFlowPro-authorizer
PodcastFlowPro-PodcastFlowPro-availability
PodcastFlowPro-PodcastFlowPro-billing-overview
PodcastFlowPro-PodcastFlowPro-campaigns
PodcastFlowPro-PodcastFlowPro-contracts
PodcastFlowPro-PodcastFlowPro-deals
PodcastFlowPro-PodcastFlowPro-episodes
PodcastFlowPro-PodcastFlowPro-financials
PodcastFlowPro-PodcastFlowPro-insertion-orders
PodcastFlowPro-PodcastFlowPro-notifications
PodcastFlowPro-PodcastFlowPro-organizations
PodcastFlowPro-PodcastFlowPro-permissions
PodcastFlowPro-PodcastFlowPro-permissions-check
PodcastFlowPro-PodcastFlowPro-reports
PodcastFlowPro-PodcastFlowPro-role-assignment
PodcastFlowPro-PodcastFlowPro-role-permissions
PodcastFlowPro-PodcastFlowPro-show-assignment
PodcastFlowPro-PodcastFlowPro-shows
EOF
)
    
    LAMBDA_FUNCTIONS_TO_REMOVE+=($ZERO_INVOCATION_FUNCTIONS)
    
    confirm "Delete ${#LAMBDA_FUNCTIONS_TO_REMOVE[@]} Lambda functions with 0 invocations?"
    
    # Delete each Lambda function
    for func in "${LAMBDA_FUNCTIONS_TO_REMOVE[@]}"; do
        if [ ! -z "$func" ]; then
            log "Deleting Lambda function: $func"
            
            # Delete function
            aws lambda delete-function --function-name "$func" \
                --region $REGION 2>/dev/null || error "Failed to delete $func"
            
            # Delete associated log group
            aws logs delete-log-group --log-group-name "/aws/lambda/$func" \
                --region $REGION 2>/dev/null || true
        fi
    done
    
    log "Phase 3 complete: Deleted ${#LAMBDA_FUNCTIONS_TO_REMOVE[@]} Lambda functions"
    
    # Verify app health
    sleep 15
    verify_app_health
    
    # Check Lambda count
    REMAINING_LAMBDAS=$(aws lambda list-functions --region $REGION \
        --query "length(Functions[?contains(FunctionName, 'odcast')])")
    log "Remaining PodcastFlow Lambda functions: $REMAINING_LAMBDAS"
}

# PHASE 4: Review Required Resources
phase4_review_resources() {
    echo -e "\n${BLUE}=== PHASE 4: Resources Requiring Review ===${NC}"
    log "Phase 4: Listing resources that require human review"
    
    echo -e "${YELLOW}The following resources require human review before deletion:${NC}"
    
    echo -e "\n${YELLOW}1. WebSocket Infrastructure:${NC}"
    echo "   - Lambda: podcastflow-websocket-handler"
    echo "   - Tables: WebSocketConnections, WebSocketSubscriptions"
    echo "   - Status: 0 invocations but may be needed for real-time features"
    
    echo -e "\n${YELLOW}2. Low-Activity Lambda Functions:${NC}"
    echo "   - PodcastFlowPro-PodcastFlowPro-clients (1 invocation)"
    echo "   - podcastflow-api-analytics (3 invocations)"
    echo "   - podcastflow-users (3 invocations)"
    echo "   - podcastflow-api-organization (9 invocations)"
    echo "   - podcastflow-api-user (9 invocations)"
    echo "   - PodcastFlowPro-PodcastFlowPro-users (14 invocations)"
    
    echo -e "\n${YELLOW}3. DynamoDB Tables:${NC}"
    echo "   - PodcastFlowPro (legacy)"
    echo "   - podcastflow-pro (legacy)"
    
    echo -e "\n${YELLOW}4. S3 Buckets:${NC}"
    echo "   - podcastflow-deployments-1751349654"
    echo "   - podcastflow-lambda-deployments"
    
    log "Please review human-review-checklist.md before proceeding"
}

# PHASE 5: IAM Cleanup (Low Risk, after Lambda deletion)
phase5_iam_cleanup() {
    echo -e "\n${BLUE}=== PHASE 5: IAM Roles Cleanup ===${NC}"
    log "Starting Phase 5: Removing unused IAM roles"
    
    confirm "Delete PodcastFlowProLambdaRole (used by deleted Lambda functions)?"
    
    # Detach policies first
    log "Detaching policies from PodcastFlowProLambdaRole..."
    ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
        --role-name PodcastFlowProLambdaRole \
        --query 'AttachedPolicies[*].PolicyArn' --output text 2>/dev/null)
    
    for policy in $ATTACHED_POLICIES; do
        aws iam detach-role-policy --role-name PodcastFlowProLambdaRole \
            --policy-arn "$policy" 2>/dev/null || true
    done
    
    # Delete inline policies
    INLINE_POLICIES=$(aws iam list-role-policies \
        --role-name PodcastFlowProLambdaRole \
        --query 'PolicyNames[*]' --output text 2>/dev/null)
    
    for policy in $INLINE_POLICIES; do
        aws iam delete-role-policy --role-name PodcastFlowProLambdaRole \
            --policy-name "$policy" 2>/dev/null || true
    done
    
    # Delete role
    log "Deleting IAM role..."
    aws iam delete-role --role-name PodcastFlowProLambdaRole 2>/dev/null || \
        error "Failed to delete PodcastFlowProLambdaRole"
    
    log "Phase 5 complete: IAM cleanup done"
}

# Main execution
main() {
    echo -e "${BLUE}=== PodcastFlow Pro Phased Resource Cleanup ===${NC}"
    echo -e "${BLUE}Date: $(date)${NC}"
    echo -e "${BLUE}Log file: $LOG_FILE${NC}"
    echo ""
    
    # Check prerequisites
    warning "Prerequisites:"
    echo "1. Backup completed using backup-all-resources.sh"
    echo "2. Human review checklist reviewed"
    echo "3. Stakeholder approval received"
    echo "4. Off-peak hours preferred"
    echo ""
    
    confirm "Have all prerequisites been met?"
    
    # Initial health check
    log "Performing initial health check..."
    if ! verify_app_health; then
        error "Initial health check failed. Aborting cleanup."
        exit 1
    fi
    
    # Execute phases
    while true; do
        echo -e "\n${YELLOW}Select phase to execute:${NC}"
        echo "1) Phase 1: CloudWatch Log Groups (No Risk)"
        echo "2) Phase 2: API Gateway Endpoints (Low Risk)"
        echo "3) Phase 3: Lambda Functions (Medium Risk)"
        echo "4) Phase 4: Review Required Resources"
        echo "5) Phase 5: IAM Cleanup (After Lambda)"
        echo "6) Exit"
        
        read -p "Enter phase number: " phase
        
        case $phase in
            1) phase1_cloudwatch_cleanup ;;
            2) phase2_api_gateway_cleanup ;;
            3) phase3_lambda_cleanup ;;
            4) phase4_review_resources ;;
            5) phase5_iam_cleanup ;;
            6) break ;;
            *) echo "Invalid selection" ;;
        esac
        
        echo -e "\n${GREEN}Phase complete. Check application and logs before proceeding.${NC}"
        echo "Recommended: Wait 5-10 minutes and monitor for issues."
    done
    
    echo -e "\n${GREEN}=== Cleanup Process Complete ===${NC}"
    echo "Log file: $LOG_FILE"
    echo "Next steps:"
    echo "1. Monitor application for 24-48 hours"
    echo "2. Check AWS bill next month for cost reduction"
    echo "3. Update documentation with removed resources"
}

# Run main function
main