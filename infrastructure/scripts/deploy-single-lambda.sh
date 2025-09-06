#!/bin/bash

# Deploy a single Lambda function

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Lambda name is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide Lambda function name${NC}"
    echo "Usage: ./deploy-single-lambda.sh <lambda-name>"
    exit 1
fi

LAMBDA_NAME=$1
LAMBDA_DIR="/home/ec2-user/podcastflow-pro/infrastructure/lambdas/$LAMBDA_NAME"

echo -e "${YELLOW}Deploying $LAMBDA_NAME Lambda...${NC}"

# Check if directory exists
if [ ! -d "$LAMBDA_DIR" ]; then
    echo -e "${RED}Error: Lambda directory not found: $LAMBDA_DIR${NC}"
    exit 1
fi

cd "$LAMBDA_DIR"

# Clean up
rm -rf node_modules deployment.zip shared

# Copy shared auth middleware
echo -e "${YELLOW}Copying shared middleware...${NC}"
cp -r ../shared .

# Install only production dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
# Use Lambda-specific package.json if it exists
if [ -f "../package.json" ]; then
    cp ../package.json package.json
    npm install --production --no-optional
    rm -f package.json
else
    npm install --production --no-optional
fi

# Remove unnecessary files
find node_modules -name "*.md" -delete
find node_modules -name "*.txt" -delete
find node_modules -name "*.yml" -delete
find node_modules -name "*.yaml" -delete
find node_modules -name ".travis.yml" -delete
find node_modules -name ".npmignore" -delete
find node_modules -name ".gitignore" -delete
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "example" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
zip -r deployment.zip . -x "*.git*" "*.DS_Store" "*test*" "*spec*" "*.md" "*.txt"

# Check package size
PACKAGE_SIZE=$(stat -f%z deployment.zip 2>/dev/null || stat -c%s deployment.zip)
PACKAGE_SIZE_MB=$((PACKAGE_SIZE / 1024 / 1024))
echo -e "${YELLOW}Package size: ${PACKAGE_SIZE_MB}MB${NC}"

if [ $PACKAGE_SIZE -gt 69905067 ]; then
    echo -e "${RED}Error: Package too large (${PACKAGE_SIZE_MB}MB). Max is 50MB for direct upload.${NC}"
    exit 1
fi

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