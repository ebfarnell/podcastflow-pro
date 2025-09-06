#!/bin/bash

# Deploy all new module Lambda functions in sequence

set -e

# List of modules to deploy
MODULES=(
    "insertion-orders"
    "agencies"
    "advertisers"
    "shows"
    "episodes"
    "availability"
    "ad-approvals"
    "ad-copy"
    "contracts"
    "reports"
    "financials"
)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment of all new Lambda functions...${NC}"

# Counter for progress
TOTAL=${#MODULES[@]}
CURRENT=0

# Deploy each module
for module in "${MODULES[@]}"; do
    CURRENT=$((CURRENT + 1))
    echo -e "\n${YELLOW}[$CURRENT/$TOTAL] Deploying $module...${NC}"
    
    if ./deploy-single-lambda.sh "$module"; then
        echo -e "${GREEN}✓ $module deployed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to deploy $module${NC}"
        exit 1
    fi
done

echo -e "\n${GREEN}All Lambda functions deployed successfully!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "- Total functions deployed: $TOTAL"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure API Gateway routes for all modules"
echo "2. Test the endpoints"
echo "3. Update frontend API service to connect to new endpoints"