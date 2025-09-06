#!/bin/bash

# Create test users in Cognito for each role

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# User Pool ID
USER_POOL_ID="us-east-1_n2gbeGsU4"
REGION="us-east-1"

# Test user configurations
declare -A TEST_USERS=(
    ["admin"]="admin@podcastflow.test|Admin123!|System Administrator"
    ["seller"]="seller@podcastflow.test|Seller123!|Sarah Seller"
    ["producer"]="producer@podcastflow.test|Producer123!|Paul Producer"
    ["talent"]="talent@podcastflow.test|Talent123!|Tina Talent"
    ["client"]="client@podcastflow.test|Client123!|Charlie Client"
)

# Function to create user
create_user() {
    local ROLE=$1
    local USER_DATA=$2
    
    IFS='|' read -r EMAIL PASSWORD NAME <<< "$USER_DATA"
    
    echo -e "${YELLOW}Creating $ROLE user: $EMAIL${NC}"
    
    # Create user in Cognito
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $EMAIL \
        --user-attributes \
            Name=email,Value=$EMAIL \
            Name=name,Value="$NAME" \
            Name=email_verified,Value=true \
            Name=custom:role,Value=$ROLE \
            Name=custom:organizationId,Value="test-org" \
        --message-action SUPPRESS \
        --region $REGION 2>/dev/null || echo -e "${YELLOW}User $EMAIL already exists${NC}"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $EMAIL \
        --password "$PASSWORD" \
        --permanent \
        --region $REGION 2>/dev/null || echo -e "${RED}Failed to set password for $EMAIL${NC}"
    
    echo -e "${GREEN}Created $ROLE user successfully${NC}"
}

# Create all test users
for ROLE in "${!TEST_USERS[@]}"; do
    create_user "$ROLE" "${TEST_USERS[$ROLE]}"
done

# Create additional users for team scenarios
echo -e "${YELLOW}Creating additional team users...${NC}"

# Additional sellers
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username seller2@podcastflow.test \
    --user-attributes \
        Name=email,Value=seller2@podcastflow.test \
        Name=name,Value="Sam Seller" \
        Name=email_verified,Value=true \
        Name=custom:role,Value=seller \
        Name=custom:organizationId,Value="test-org" \
    --message-action SUPPRESS \
    --region $REGION 2>/dev/null || echo "User exists"

aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username seller2@podcastflow.test \
    --password "Seller123!" \
    --permanent \
    --region $REGION 2>/dev/null

# Additional producers
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username producer2@podcastflow.test \
    --user-attributes \
        Name=email,Value=producer2@podcastflow.test \
        Name=name,Value="Patricia Producer" \
        Name=email_verified,Value=true \
        Name=custom:role,Value=producer \
        Name=custom:organizationId,Value="test-org" \
    --message-action SUPPRESS \
    --region $REGION 2>/dev/null || echo "User exists"

aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username producer2@podcastflow.test \
    --password "Producer123!" \
    --permanent \
    --region $REGION 2>/dev/null

# Additional talent
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username talent2@podcastflow.test \
    --user-attributes \
        Name=email,Value=talent2@podcastflow.test \
        Name=name,Value="Tom Talent" \
        Name=email_verified,Value=true \
        Name=custom:role,Value=talent \
        Name=custom:organizationId,Value="test-org" \
    --message-action SUPPRESS \
    --region $REGION 2>/dev/null || echo "User exists"

aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username talent2@podcastflow.test \
    --password "Talent123!" \
    --permanent \
    --region $REGION 2>/dev/null

echo -e "${GREEN}All test users created successfully!${NC}"
echo -e "${GREEN}Test User Credentials:${NC}"
echo -e "Admin: admin@podcastflow.test / Admin123!"
echo -e "Seller: seller@podcastflow.test / Seller123!"
echo -e "Producer: producer@podcastflow.test / Producer123!"
echo -e "Talent: talent@podcastflow.test / Talent123!"
echo -e "Client: client@podcastflow.test / Client123!"
echo -e "\nAdditional team members:"
echo -e "Seller 2: seller2@podcastflow.test / Seller123!"
echo -e "Producer 2: producer2@podcastflow.test / Producer123!"
echo -e "Talent 2: talent2@podcastflow.test / Talent123!"