#!/bin/bash

# Deployment script for PodcastFlow Pro

set -e

# Configuration
STACK_NAME="podcastflow-pro"
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
S3_BUCKET="${DEPLOYMENT_BUCKET:-podcastflow-deployments}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying PodcastFlow Pro - Environment: ${ENVIRONMENT}${NC}"

# Check AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Create deployment bucket if it doesn't exist
if ! aws s3 ls "s3://${S3_BUCKET}" > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating deployment bucket...${NC}"
    aws s3 mb "s3://${S3_BUCKET}" --region "${REGION}"
fi

# Package Lambda functions
echo -e "${YELLOW}Packaging Lambda functions...${NC}"
for func in auth campaigns integrations analytics; do
    if [ -d "../lambdas/${func}" ]; then
        echo "Packaging ${func} function..."
        cd "../lambdas/${func}"
        npm install --production
        zip -r "${func}.zip" .
        aws s3 cp "${func}.zip" "s3://${S3_BUCKET}/lambdas/${func}.zip"
        rm "${func}.zip"
        cd -
    fi
done

# Package and deploy CloudFormation template
echo -e "${YELLOW}Packaging CloudFormation template...${NC}"
aws cloudformation package \
    --template-file ../cloudformation/template.yaml \
    --s3-bucket "${S3_BUCKET}" \
    --output-template-file ../cloudformation/packaged-template.yaml

echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
aws cloudformation deploy \
    --template-file ../cloudformation/packaged-template.yaml \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --parameter-overrides Environment="${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --region "${REGION}"

# Get stack outputs
echo -e "${YELLOW}Getting stack outputs...${NC}"
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs' \
    --output table

# Build and deploy frontend
echo -e "${YELLOW}Building frontend application...${NC}"
cd ../../
npm install
npm run build

# Deploy to Amplify or S3 (depending on setup)
if [ "${DEPLOY_FRONTEND}" = "true" ]; then
    echo -e "${YELLOW}Deploying frontend...${NC}"
    # Add frontend deployment logic here
fi

echo -e "${GREEN}Deployment complete!${NC}"