#!/bin/bash

# Deploy all Lambda functions

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Lambda function list
LAMBDA_FUNCTIONS=(
  "role-permissions"
  "campaigns"
  "shows"
  "role-assignment"
  "permissions-check"
  "show-assignment"
)

# Deploy each Lambda function
for LAMBDA_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
    LAMBDA_DIR="/home/ec2-user/podcastflow-pro/infrastructure/lambdas/$LAMBDA_NAME"
    
    echo -e "${YELLOW}Deploying $LAMBDA_NAME Lambda...${NC}"
    
    # Check if directory exists
    if [ ! -d "$LAMBDA_DIR" ]; then
        echo -e "${RED}Error: Lambda directory not found: $LAMBDA_DIR${NC}"
        continue
    fi
    
    cd "$LAMBDA_DIR"
    
    # Copy shared auth middleware
    echo -e "${YELLOW}Copying shared middleware...${NC}"
    cp -r ../shared .
    
    # Install dependencies
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install --production
    
    # Create deployment package
    echo -e "${YELLOW}Creating deployment package...${NC}"
    rm -f deployment.zip
    zip -r deployment.zip . -x "*.git*" "*.DS_Store" "*test*" "*spec*"
    
    # Check if Lambda function exists
    FUNCTION_NAME="PodcastFlowPro-PodcastFlowPro-$LAMBDA_NAME"
    if aws lambda get-function --function-name $FUNCTION_NAME --region us-east-1 2>/dev/null; then
        # Update existing function
        echo -e "${YELLOW}Updating existing Lambda function...${NC}"
        aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --zip-file fileb://deployment.zip \
            --region us-east-1
            
        # Update environment variables
        aws lambda update-function-configuration \
            --function-name $FUNCTION_NAME \
            --environment Variables="{TABLE_NAME=PodcastFlowPro,USER_POOL_ID=us-east-1_n2gbeGsU4}" \
            --timeout 30 \
            --memory-size 256 \
            --region us-east-1
    else
        # Create new function
        echo -e "${YELLOW}Creating new Lambda function...${NC}"
        aws lambda create-function \
            --function-name $FUNCTION_NAME \
            --runtime nodejs18.x \
            --role arn:aws:iam::590183844530:role/PodcastFlowProLambdaRole \
            --handler index.handler \
            --zip-file fileb://deployment.zip \
            --timeout 30 \
            --memory-size 256 \
            --environment Variables="{TABLE_NAME=PodcastFlowPro,USER_POOL_ID=us-east-1_n2gbeGsU4}" \
            --region us-east-1
    fi
    
    # Clean up
    rm -f deployment.zip
    rm -rf shared
    
    echo -e "${GREEN}Successfully deployed $LAMBDA_NAME Lambda!${NC}"
done

echo -e "${GREEN}All Lambda functions deployed successfully!${NC}"

# Configure API Gateway endpoints
echo -e "${YELLOW}Configuring API Gateway endpoints...${NC}"

# Run API configuration scripts
cd /home/ec2-user/podcastflow-pro/infrastructure/scripts

if [ -f "configure-api-authorizer.sh" ]; then
    echo -e "${YELLOW}Configuring API authorizer...${NC}"
    chmod +x configure-api-authorizer.sh
    ./configure-api-authorizer.sh
fi

if [ -f "configure-remaining-apis.sh" ]; then
    echo -e "${YELLOW}Configuring remaining API endpoints...${NC}"
    chmod +x configure-remaining-apis.sh
    ./configure-remaining-apis.sh
fi

echo -e "${GREEN}Deployment complete!${NC}"