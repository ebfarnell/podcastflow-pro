#!/bin/bash

# Configure API Gateway Routes for New Modules Lambda Functions
# This script adds all the necessary routes to the existing API Gateway

set -e

echo "Configuring API Gateway Routes for New Modules..."

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
    echo -e "${RED}Error: Could not find API Gateway. Please ensure PodcastFlow-Pro-API exists.${NC}"
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
        
        # Delete existing method if it exists
        aws apigateway delete-method \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --region $REGION 2>/dev/null || true
        
        # Create method
        aws apigateway put-method \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --authorization-type AWS_IAM \
            --region $REGION
        
        # Create integration
        aws apigateway put-integration \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
            --region $REGION
        
        # Add method response
        aws apigateway put-method-response \
            --rest-api-id $API_ID \
            --resource-id $RESOURCE_ID \
            --http-method $METHOD \
            --status-code 200 \
            --response-models '{"application/json":"Empty"}' \
            --region $REGION 2>/dev/null || true
    done
    
    # Add OPTIONS method for CORS
    echo "Adding OPTIONS method for CORS..."
    
    # Delete existing OPTIONS method if it exists
    aws apigateway delete-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --region $REGION 2>/dev/null || true
    
    # Create OPTIONS method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
    
    # Create mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # Add OPTIONS method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --response-models '{"application/json":"Empty"}' \
        --region $REGION
    
    # Add integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
    
    # Return value is set in RESOURCE_ID variable
}

# Function to create sub-resource with ID parameter
create_sub_resource() {
    local PARENT_ID=$1
    local PATH_PART=$2
    local LAMBDA_NAME=$3
    local METHODS=$4
    
    echo -e "${YELLOW}Creating sub-resource: /{id}${NC}"
    
    # Create {id} resource
    ID_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $PARENT_ID \
        --path-part "{id}" \
        --query 'id' \
        --output text \
        --region $REGION 2>/dev/null) || \
    ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?parentId=='${PARENT_ID}' && pathPart=='{id}'].id" --output text --region $REGION)
    
    echo "ID Resource: $ID_RESOURCE"
    
    # Create methods for {id} resource
    for METHOD in $METHODS; do
        echo "Creating ${METHOD} method for {id}..."
        
        # Delete existing method if it exists
        aws apigateway delete-method \
            --rest-api-id $API_ID \
            --resource-id $ID_RESOURCE \
            --http-method $METHOD \
            --region $REGION 2>/dev/null || true
        
        # Create method
        aws apigateway put-method \
            --rest-api-id $API_ID \
            --resource-id $ID_RESOURCE \
            --http-method $METHOD \
            --authorization-type AWS_IAM \
            --region $REGION
        
        # Create integration
        aws apigateway put-integration \
            --rest-api-id $API_ID \
            --resource-id $ID_RESOURCE \
            --http-method $METHOD \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations" \
            --region $REGION
        
        # Add method response
        aws apigateway put-method-response \
            --rest-api-id $API_ID \
            --resource-id $ID_RESOURCE \
            --http-method $METHOD \
            --status-code 200 \
            --response-models '{"application/json":"Empty"}' \
            --region $REGION 2>/dev/null || true
    done
}

echo -e "\n${GREEN}Configuring routes for new modules...${NC}"

# Configure Insertion Orders routes
echo -e "\n${YELLOW}1. Configuring Insertion Orders routes${NC}"
create_api_resource $ROOT_ID "insertion-orders" "PodcastFlowPro-Insertion-Orders" "GET POST"
IO_RESOURCE=$RESOURCE_ID
create_sub_resource $IO_RESOURCE "insertion-orders" "PodcastFlowPro-Insertion-Orders" "GET PUT DELETE"

# Configure Agencies routes
echo -e "\n${YELLOW}2. Configuring Agencies routes${NC}"
create_api_resource $ROOT_ID "agencies" "PodcastFlowPro-Agencies" "GET POST"
AGENCIES_RESOURCE=$RESOURCE_ID
create_sub_resource $AGENCIES_RESOURCE "agencies" "PodcastFlowPro-Agencies" "GET PUT DELETE"

# Configure Advertisers routes
echo -e "\n${YELLOW}3. Configuring Advertisers routes${NC}"
create_api_resource $ROOT_ID "advertisers" "PodcastFlowPro-Advertisers" "GET POST"
ADVERTISERS_RESOURCE=$RESOURCE_ID
create_sub_resource $ADVERTISERS_RESOURCE "advertisers" "PodcastFlowPro-Advertisers" "GET PUT DELETE"

# Configure Shows routes
echo -e "\n${YELLOW}4. Configuring Shows routes${NC}"
create_api_resource $ROOT_ID "shows" "PodcastFlowPro-Shows" "GET POST"
SHOWS_RESOURCE=$RESOURCE_ID
create_sub_resource $SHOWS_RESOURCE "shows" "PodcastFlowPro-Shows" "GET PUT DELETE"

# Configure Episodes routes
echo -e "\n${YELLOW}5. Configuring Episodes routes${NC}"
create_api_resource $ROOT_ID "episodes" "PodcastFlowPro-Episodes" "GET POST"
EPISODES_RESOURCE=$RESOURCE_ID
create_sub_resource $EPISODES_RESOURCE "episodes" "PodcastFlowPro-Episodes" "GET PUT DELETE"

# Configure Availability routes
echo -e "\n${YELLOW}6. Configuring Availability routes${NC}"
create_api_resource $ROOT_ID "availability" "PodcastFlowPro-Availability" "GET POST"
AVAILABILITY_RESOURCE=$RESOURCE_ID
create_sub_resource $AVAILABILITY_RESOURCE "availability" "PodcastFlowPro-Availability" "GET PUT DELETE"

# Configure Ad Approvals routes
echo -e "\n${YELLOW}7. Configuring Ad Approvals routes${NC}"
create_api_resource $ROOT_ID "ad-approvals" "PodcastFlowPro-PodcastFlowPro-ad-approvals" "GET POST"
AD_APPROVALS_RESOURCE=$RESOURCE_ID
create_sub_resource $AD_APPROVALS_RESOURCE "ad-approvals" "PodcastFlowPro-PodcastFlowPro-ad-approvals" "GET PUT DELETE"

# Configure Ad Copy routes
echo -e "\n${YELLOW}8. Configuring Ad Copy routes${NC}"
create_api_resource $ROOT_ID "ad-copy" "PodcastFlowPro-Ad-Copy" "GET POST"
AD_COPY_RESOURCE=$RESOURCE_ID
create_sub_resource $AD_COPY_RESOURCE "ad-copy" "PodcastFlowPro-Ad-Copy" "GET PUT DELETE"

# Configure Contracts routes
echo -e "\n${YELLOW}9. Configuring Contracts routes${NC}"
create_api_resource $ROOT_ID "contracts" "PodcastFlowPro-Contracts" "GET POST"
CONTRACTS_RESOURCE=$RESOURCE_ID
create_sub_resource $CONTRACTS_RESOURCE "contracts" "PodcastFlowPro-Contracts" "GET PUT DELETE"

# Configure Reports routes
echo -e "\n${YELLOW}10. Configuring Reports routes${NC}"
create_api_resource $ROOT_ID "reports" "PodcastFlowPro-Reports" "GET POST"
REPORTS_RESOURCE=$RESOURCE_ID
create_sub_resource $REPORTS_RESOURCE "reports" "PodcastFlowPro-Reports" "GET PUT DELETE"

# Configure Financials routes
echo -e "\n${YELLOW}11. Configuring Financials routes${NC}"
create_api_resource $ROOT_ID "financials" "PodcastFlowPro-Financials" "GET POST"
FINANCIALS_RESOURCE=$RESOURCE_ID
create_sub_resource $FINANCIALS_RESOURCE "financials" "PodcastFlowPro-Financials" "GET PUT DELETE"

# Deploy the API
echo -e "\n${GREEN}Deploying API Gateway...${NC}"
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Deployment of new module routes" \
    --query 'id' \
    --output text \
    --region $REGION)

echo -e "${GREEN}API Gateway deployed successfully! Deployment ID: ${DEPLOYMENT_ID}${NC}"

# Get the API endpoint
API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"

echo -e "\n${GREEN}API Configuration Complete!${NC}"
echo -e "${YELLOW}API Endpoint: ${API_ENDPOINT}${NC}"
echo ""
echo "New module endpoints:"
echo "  - ${API_ENDPOINT}/insertion-orders"
echo "  - ${API_ENDPOINT}/agencies"
echo "  - ${API_ENDPOINT}/advertisers"
echo "  - ${API_ENDPOINT}/shows"
echo "  - ${API_ENDPOINT}/episodes"
echo "  - ${API_ENDPOINT}/availability"
echo "  - ${API_ENDPOINT}/ad-approvals"
echo "  - ${API_ENDPOINT}/ad-copy"
echo "  - ${API_ENDPOINT}/contracts"
echo "  - ${API_ENDPOINT}/reports"
echo "  - ${API_ENDPOINT}/financials"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the endpoints with AWS IAM authentication"
echo "2. Update frontend API service to use these endpoints"
echo "3. Ensure DynamoDB has proper indexes configured"