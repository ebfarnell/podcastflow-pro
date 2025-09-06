#!/bin/bash

# Configure API Gateway Routes for Settings Lambda Functions
# This script adds all the necessary routes to the existing API Gateway

set -e

echo "Configuring API Gateway Routes for Settings Functions..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

# Get API Gateway details
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='PodcastFlow-Pro-API'].id" --output text --region $REGION)

if [ -z "$API_ID" ]; then
    echo -e "${RED}Error: Could not find API Gateway. Please ensure PodcastFlowProAPI exists.${NC}"
    exit 1
fi

echo -e "${GREEN}Found API Gateway: ${API_ID}${NC}"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/'].id" --output text --region $REGION)

# Function to create resource and methods
create_api_resource() {
    local PARENT_ID=$1
    local PATH_PART=$2
    local LAMBDA_NAME=$3
    local METHODS=$4
    
    echo -e "${YELLOW}Creating resource: /${PATH_PART}${NC}"
    
    # Check if resource already exists
    RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='${PATH_PART}'].id" --output text --region $REGION)
    
    if [ -z "$RESOURCE_ID" ]; then
        # Create resource
        RESOURCE_ID=$(aws apigateway create-resource \
            --rest-api-id $API_ID \
            --parent-id $PARENT_ID \
            --path-part $PATH_PART \
            --query 'id' \
            --output text \
            --region $REGION)
    fi
    
    echo "Resource ID: $RESOURCE_ID"
    
    # Create methods
    for METHOD in $METHODS; do
        echo "Creating ${METHOD} method..."
        
        # Create method
        aws apigateway put-method \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --authorization-type AWS_IAM \
            --region $REGION 2>/dev/null || true
        
        # Create integration
        aws apigateway put-integration \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
            --region $REGION
        
        # Add CORS
        aws apigateway put-method-response \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --status-code 200 \
            --response-parameters "method.response.header.Access-Control-Allow-Origin=true" \
            --region $REGION 2>/dev/null || true
    done
    
    # Add OPTIONS method for CORS
    echo "Adding OPTIONS method for CORS..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION 2>/dev/null || true
    
    # Mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
        --region $REGION
    
    # OPTIONS method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --region $REGION 2>/dev/null || true
    
    # OPTIONS integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
    
    echo "Resource created: $RESOURCE_ID"
    return 0
}

# Function to create nested resources
create_nested_resource() {
    local PARENT_ID=$1
    local PATH=$2
    local LAMBDA_NAME=$3
    local METHODS=$4
    
    IFS='/' read -ra PARTS <<< "$PATH"
    local CURRENT_PARENT=$PARENT_ID
    
    for i in "${!PARTS[@]}"; do
        if [ ! -z "${PARTS[$i]}" ]; then
            local PART="${PARTS[$i]}"
            
            # Check if this part contains a parameter
            if [[ $PART == *"{"*"}"* ]]; then
                # It's a path parameter
                echo -e "${YELLOW}Creating path parameter: ${PART}${NC}"
            fi
            
            # Check if resource exists
            local EXISTING_ID=$(aws apigateway get-resources \
                --rest-api-id $API_ID \
                --query "items[?pathPart=='${PART}' && parentId=='${CURRENT_PARENT}'].id" \
                --output text \
                --region $REGION)
            
            if [ -z "$EXISTING_ID" ]; then
                # Create resource
                EXISTING_ID=$(aws apigateway create-resource \
                    --rest-api-id $API_ID \
                    --parent-id $CURRENT_PARENT \
                    --path-part "${PART}" \
                    --query 'id' \
                    --output text \
                    --region $REGION)
                echo "Created resource: ${PART} (${EXISTING_ID})"
            else
                echo "Resource exists: ${PART} (${EXISTING_ID})"
            fi
            
            CURRENT_PARENT=$EXISTING_ID
            
            # If this is the last part, create methods
            if [ $i -eq $((${#PARTS[@]} - 1)) ]; then
                for METHOD in $METHODS; do
                    echo "Creating ${METHOD} method on ${PART}..."
                    
                    # Create method
                    aws apigateway put-method \
                        --rest-api-id $API_ID \
                        --resource-id $EXISTING_ID \
                        --http-method $METHOD \
                        --authorization-type AWS_IAM \
                        --region $REGION 2>/dev/null || true
                    
                    # Create integration
                    aws apigateway put-integration \
                        --rest-api-id $API_ID \
                        --resource-id $EXISTING_ID \
                        --http-method $METHOD \
                        --type AWS_PROXY \
                        --integration-http-method POST \
                        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
                        --region $REGION
                done
                
                # Add OPTIONS for CORS
                aws apigateway put-method \
                    --rest-api-id $API_ID \
                    --resource-id $EXISTING_ID \
                    --http-method OPTIONS \
                    --authorization-type NONE \
                    --region $REGION 2>/dev/null || true
                
                aws apigateway put-integration \
                    --rest-api-id $API_ID \
                    --resource-id $EXISTING_ID \
                    --http-method OPTIONS \
                    --type MOCK \
                    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
                    --region $REGION
            fi
        fi
    done
}

# 1. Create Team routes
echo -e "\n${GREEN}1. Creating Team Management routes${NC}"
create_api_resource "$ROOT_ID" "team" "PodcastFlowPro-Team" "GET POST PUT DELETE OPTIONS"
TEAM_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='team'].id" --output text --region $REGION)
create_nested_resource "$TEAM_ID" "{organizationId}/members" "PodcastFlowPro-Team" "GET POST"
create_nested_resource "$TEAM_ID" "{organizationId}/members/{memberId}" "PodcastFlowPro-Team" "GET PUT DELETE"

# 2. Create Security routes
echo -e "\n${GREEN}2. Creating Security Settings routes${NC}"
create_api_resource "$ROOT_ID" "security" "PodcastFlowPro-Security" "GET OPTIONS"
SECURITY_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='security'].id" --output text --region $REGION)
create_api_resource "$SECURITY_ID" "password" "PodcastFlowPro-Security" "PUT"
create_api_resource "$SECURITY_ID" "2fa" "PodcastFlowPro-Security" "GET POST PUT DELETE"
create_api_resource "$SECURITY_ID" "sessions" "PodcastFlowPro-Security" "GET DELETE"
create_api_resource "$SECURITY_ID" "preferences" "PodcastFlowPro-Security" "PUT"

# 3. Create Billing routes
echo -e "\n${GREEN}3. Creating Billing Management routes${NC}"
create_api_resource "$ROOT_ID" "billing" "PodcastFlowPro-Billing" "GET OPTIONS"
BILLING_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='billing'].id" --output text --region $REGION)
create_api_resource "$BILLING_ID" "subscription" "PodcastFlowPro-Billing" "POST PUT DELETE"
create_api_resource "$BILLING_ID" "payment-methods" "PodcastFlowPro-Billing" "POST PUT DELETE"
create_api_resource "$BILLING_ID" "invoices" "PodcastFlowPro-Billing" "GET"
create_api_resource "$BILLING_ID" "usage" "PodcastFlowPro-Billing" "GET"

# 4. Create API/Webhooks routes
echo -e "\n${GREEN}4. Creating API/Webhooks routes${NC}"
create_api_resource "$ROOT_ID" "api-webhooks" "PodcastFlowPro-APIWebhooks" "GET OPTIONS"
API_WEBHOOKS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='api-webhooks'].id" --output text --region $REGION)
create_api_resource "$API_WEBHOOKS_ID" "api-keys" "PodcastFlowPro-APIWebhooks" "POST"
create_nested_resource "$API_WEBHOOKS_ID" "api-keys/{keyId}" "PodcastFlowPro-APIWebhooks" "PUT DELETE"
create_api_resource "$API_WEBHOOKS_ID" "webhooks" "PodcastFlowPro-APIWebhooks" "POST"
create_nested_resource "$API_WEBHOOKS_ID" "webhooks/{webhookId}" "PodcastFlowPro-APIWebhooks" "PUT DELETE"
WEBHOOKS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='webhooks' && parentId=='${API_WEBHOOKS_ID}'].id" --output text --region $REGION)
create_api_resource "$WEBHOOKS_ID" "test" "PodcastFlowPro-APIWebhooks" "POST"

# 5. Create Backup routes
echo -e "\n${GREEN}5. Creating Backup/Export routes${NC}"
create_api_resource "$ROOT_ID" "backups" "PodcastFlowPro-Backup" "GET POST OPTIONS"
BACKUPS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?pathPart=='backups'].id" --output text --region $REGION)
create_nested_resource "$BACKUPS_ID" "{backupId}" "PodcastFlowPro-Backup" "DELETE"
create_nested_resource "$BACKUPS_ID" "{backupId}/download" "PodcastFlowPro-Backup" "GET"
create_api_resource "$BACKUPS_ID" "schedule" "PodcastFlowPro-Backup" "PUT"
create_api_resource "$BACKUPS_ID" "export" "PodcastFlowPro-Backup" "POST"
create_api_resource "$BACKUPS_ID" "restore" "PodcastFlowPro-Backup" "POST"

# Deploy the API
echo -e "\n${GREEN}Deploying API changes...${NC}"
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Settings Lambda Functions Deployment" \
    --query 'id' \
    --output text \
    --region $REGION)

echo -e "\n${GREEN}API Gateway routes configured successfully!${NC}"
echo -e "Deployment ID: ${DEPLOYMENT_ID}"
echo -e "\nAPI Endpoint: https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Test the endpoints using curl or Postman"
echo "2. Check CloudWatch logs for any Lambda errors"
echo "3. Update frontend if API endpoint has changed"