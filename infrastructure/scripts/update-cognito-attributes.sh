#!/bin/bash

# Update Cognito User Pool with custom attributes for roles

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get User Pool ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region us-east-1 --query 'UserPools[?Name==`podcastflow-pro-users`].Id' --output text)

if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}Error: Could not find User Pool 'podcastflow-pro-users'${NC}"
    exit 1
fi

echo -e "${GREEN}Found User Pool: ${USER_POOL_ID}${NC}"

# Update User Pool to add custom attributes
echo -e "${YELLOW}Updating User Pool with custom attributes...${NC}"

# Note: Custom attributes cannot be added after user pool creation
# We need to document these for manual creation or use during initial setup
cat << EOF > cognito-custom-attributes.json
{
  "CustomAttributes": [
    {
      "Name": "role",
      "AttributeDataType": "String",
      "DeveloperOnlyAttribute": false,
      "Mutable": true,
      "Required": false,
      "StringAttributeConstraints": {
        "MinLength": "1",
        "MaxLength": "20"
      }
    },
    {
      "Name": "organizationId",
      "AttributeDataType": "String", 
      "DeveloperOnlyAttribute": false,
      "Mutable": true,
      "Required": false,
      "StringAttributeConstraints": {
        "MinLength": "1",
        "MaxLength": "50"
      }
    },
    {
      "Name": "permissions",
      "AttributeDataType": "String",
      "DeveloperOnlyAttribute": false,
      "Mutable": true,
      "Required": false,
      "StringAttributeConstraints": {
        "MinLength": "0",
        "MaxLength": "2048"
      }
    }
  ]
}
EOF

echo -e "${YELLOW}Custom attributes definition saved to cognito-custom-attributes.json${NC}"
echo -e "${RED}NOTE: Custom attributes cannot be added to existing user pools.${NC}"
echo -e "${RED}These attributes must be added during user pool creation.${NC}"

# Update app client to include custom attributes in ID token
echo -e "${YELLOW}Updating app client settings...${NC}"

# Get app client ID
APP_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $USER_POOL_ID --region us-east-1 --query 'UserPoolClients[0].ClientId' --output text)

if [ -z "$APP_CLIENT_ID" ]; then
    echo -e "${RED}Error: Could not find App Client${NC}"
    exit 1
fi

echo -e "${GREEN}Found App Client: ${APP_CLIENT_ID}${NC}"

# Update app client to include custom attributes
aws cognito-idp update-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-id $APP_CLIENT_ID \
    --read-attributes \
        "email" \
        "name" \
        "phone_number" \
        "custom:role" \
        "custom:organizationId" \
        "custom:permissions" \
    --write-attributes \
        "email" \
        "name" \
        "phone_number" \
        "custom:role" \
        "custom:organizationId" \
        "custom:permissions" \
    --region us-east-1

echo -e "${GREEN}App client updated successfully!${NC}"

# Create Lambda trigger for pre-token generation to add custom claims
echo -e "${YELLOW}Note: To include custom attributes in ID tokens, you need to:${NC}"
echo -e "1. Create a Lambda function for pre-token generation"
echo -e "2. Add it as a trigger in Cognito"
echo -e "3. Use the Lambda to add custom claims to the token"

# Create sample pre-token generation Lambda
cat << 'EOF' > pre-token-generation-lambda.js
exports.handler = async (event) => {
    // Add custom claims to ID token
    event.response = {
        claimsOverrideDetails: {
            claimsToAddOrOverride: {
                'custom:role': event.request.userAttributes['custom:role'] || 'client',
                'custom:organizationId': event.request.userAttributes['custom:organizationId'] || 'default',
                'custom:permissions': event.request.userAttributes['custom:permissions'] || ''
            }
        }
    };
    
    return event;
};
EOF

echo -e "${GREEN}Sample pre-token generation Lambda created: pre-token-generation-lambda.js${NC}"
echo -e "${YELLOW}Deploy this Lambda and add it as a pre-token generation trigger in Cognito${NC}"