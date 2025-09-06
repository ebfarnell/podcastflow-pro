#!/bin/bash

# Setup test users for PodcastFlow Pro
# This script creates test users in Cognito and DynamoDB for each role

set -e

REGION="us-east-1"
USER_POOL_ID="us-east-1_n2gbeGsU4"
TABLE_NAME="PodcastFlowPro"
API_ENDPOINT="https://6a2opgfepf.execute-api.us-east-1.amazonaws.com/prod"

echo "Setting up test users for PodcastFlow Pro..."

# Test user data
declare -A USERS=(
    ["admin"]='{"email":"admin@podcastflow.test","password":"Admin123!","name":"System Administrator","role":"admin"}'
    ["seller"]='{"email":"seller@podcastflow.test","password":"Seller123!","name":"Sarah Seller","role":"seller"}'
    ["producer"]='{"email":"producer@podcastflow.test","password":"Producer123!","name":"Paul Producer","role":"producer"}'
    ["talent"]='{"email":"talent@podcastflow.test","password":"Talent123!","name":"Tina Talent","role":"talent"}'
    ["client"]='{"email":"client@podcastflow.test","password":"Client123!","name":"Charlie Client","role":"client"}'
)

# Function to create user in Cognito
create_cognito_user() {
    local email=$1
    local password=$2
    local name=$3
    
    echo "Creating Cognito user: $email"
    
    # Check if user already exists
    existing_user=$(aws cognito-idp list-users \
        --user-pool-id $USER_POOL_ID \
        --filter "email=\"$email\"" \
        --region $REGION \
        --query 'Users[0].Username' \
        --output text 2>/dev/null || echo "None")
    
    if [ "$existing_user" != "None" ] && [ "$existing_user" != "" ]; then
        echo "User $email already exists with ID: $existing_user"
        # Delete existing user
        aws cognito-idp admin-delete-user \
            --user-pool-id $USER_POOL_ID \
            --username $existing_user \
            --region $REGION || true
        echo "Deleted existing user"
    fi
    
    # Create new user
    user_id=$(aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $email \
        --user-attributes Name=email,Value=$email Name=name,Value="$name" Name=email_verified,Value=true \
        --temporary-password "$password" \
        --message-action SUPPRESS \
        --region $REGION \
        --query 'User.Username' \
        --output text)
    
    echo "Created user with ID: $user_id"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $user_id \
        --password "$password" \
        --permanent \
        --region $REGION
    
    echo "Set permanent password for $email"
    
    return 0
}

# Function to create user in DynamoDB
create_dynamodb_user() {
    local user_id=$1
    local email=$2
    local name=$3
    local role=$4
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    
    echo "Creating DynamoDB record for user: $email (role: $role)"
    
    # Create user item
    aws dynamodb put-item \
        --table-name $TABLE_NAME \
        --item "{
            \"PK\": {\"S\": \"USER#$user_id\"},
            \"SK\": {\"S\": \"USER#$user_id\"},
            \"GSI1PK\": {\"S\": \"USER\"},
            \"GSI1SK\": {\"S\": \"$email\"},
            \"id\": {\"S\": \"$user_id\"},
            \"email\": {\"S\": \"$email\"},
            \"name\": {\"S\": \"$name\"},
            \"role\": {\"S\": \"$role\"},
            \"organizationId\": {\"S\": \"test-org\"},
            \"status\": {\"S\": \"active\"},
            \"createdAt\": {\"S\": \"$timestamp\"},
            \"updatedAt\": {\"S\": \"$timestamp\"},
            \"metadata\": {\"M\": {
                \"isTestAccount\": {\"BOOL\": true}
            }}
        }" \
        --region $REGION
    
    echo "Created DynamoDB record for $email"
}

# Create each test user
for role in "${!USERS[@]}"; do
    user_data="${USERS[$role]}"
    email=$(echo $user_data | jq -r '.email')
    password=$(echo $user_data | jq -r '.password')
    name=$(echo $user_data | jq -r '.name')
    user_role=$(echo $user_data | jq -r '.role')
    
    echo "========================================="
    echo "Creating $role user..."
    
    # Create in Cognito
    create_cognito_user "$email" "$password" "$name"
    
    # Get the user ID
    user_id=$(aws cognito-idp list-users \
        --user-pool-id $USER_POOL_ID \
        --filter "email=\"$email\"" \
        --region $REGION \
        --query 'Users[0].Username' \
        --output text)
    
    if [ "$user_id" != "None" ] && [ "$user_id" != "" ]; then
        # Create in DynamoDB
        create_dynamodb_user "$user_id" "$email" "$name" "$user_role"
    else
        echo "ERROR: Failed to get user ID for $email"
    fi
    
    echo "Completed setup for $role user"
    echo ""
done

echo "========================================="
echo "Creating sample data for testing..."

# Create test organization
echo "Creating test organization..."
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"ORG#test-org\"},
        \"SK\": {\"S\": \"ORG#test-org\"},
        \"GSI1PK\": {\"S\": \"ORGANIZATION\"},
        \"GSI1SK\": {\"S\": \"PodcastFlow Test Organization\"},
        \"id\": {\"S\": \"test-org\"},
        \"name\": {\"S\": \"PodcastFlow Test Organization\"},
        \"plan\": {\"S\": \"professional\"},
        \"status\": {\"S\": \"active\"},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"}
    }" \
    --region $REGION || true

# Create sample show
echo "Creating sample show..."
show_id="show-$(date +%s)"
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"SHOW#$show_id\"},
        \"SK\": {\"S\": \"METADATA\"},
        \"GSI1PK\": {\"S\": \"SHOW\"},
        \"GSI1SK\": {\"S\": \"Tech Talk Today\"},
        \"id\": {\"S\": \"$show_id\"},
        \"name\": {\"S\": \"Tech Talk Today\"},
        \"description\": {\"S\": \"A daily podcast about technology trends and innovations\"},
        \"category\": {\"S\": \"Technology\"},
        \"frequency\": {\"S\": \"Daily\"},
        \"averageListeners\": {\"N\": \"50000\"},
        \"demographics\": {\"M\": {
            \"ageRange\": {\"S\": \"25-44\"},
            \"gender\": {\"M\": {
                \"male\": {\"N\": \"60\"},
                \"female\": {\"N\": \"40\"}
            }}
        }},
        \"status\": {\"S\": \"active\"},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"}
    }" \
    --region $REGION || true

# Create sample client
echo "Creating sample client..."
client_id="client-$(date +%s)"
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"CLIENT#$client_id\"},
        \"SK\": {\"S\": \"METADATA\"},
        \"GSI1PK\": {\"S\": \"CLIENT\"},
        \"GSI1SK\": {\"S\": \"TechCorp Inc\"},
        \"id\": {\"S\": \"$client_id\"},
        \"name\": {\"S\": \"TechCorp Inc\"},
        \"industry\": {\"S\": \"Technology\"},
        \"website\": {\"S\": \"https://techcorp.example.com\"},
        \"contactEmail\": {\"S\": \"contact@techcorp.example.com\"},
        \"status\": {\"S\": \"active\"},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"}
    }" \
    --region $REGION || true

# Create sample campaign
echo "Creating sample campaign..."
campaign_id="campaign-$(date +%s)"
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"CAMPAIGN#$campaign_id\"},
        \"SK\": {\"S\": \"METADATA\"},
        \"GSI1PK\": {\"S\": \"CAMPAIGN\"},
        \"GSI1SK\": {\"S\": \"$(date -u +"%Y-%m-%d")\"},
        \"id\": {\"S\": \"$campaign_id\"},
        \"name\": {\"S\": \"Summer Tech Launch 2024\"},
        \"client\": {\"S\": \"$client_id\"},
        \"clientName\": {\"S\": \"TechCorp Inc\"},
        \"startDate\": {\"S\": \"2024-06-01\"},
        \"endDate\": {\"S\": \"2024-08-31\"},
        \"budget\": {\"N\": \"50000\"},
        \"objective\": {\"S\": \"Brand Awareness\"},
        \"targetShows\": {\"L\": [
            {\"S\": \"$show_id\"}
        ]},
        \"status\": {\"S\": \"active\"},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"}
    }" \
    --region $REGION || true

echo ""
echo "========================================="
echo "Test user setup complete!"
echo ""
echo "Test Accounts:"
echo "- Admin: admin@podcastflow.test / Admin123!"
echo "- Seller: seller@podcastflow.test / Seller123!"
echo "- Producer: producer@podcastflow.test / Producer123!"
echo "- Talent: talent@podcastflow.test / Talent123!"
echo "- Client: client@podcastflow.test / Client123!"
echo ""
echo "Sample data created:"
echo "- Organization: PodcastFlow Test Organization"
echo "- Show: Tech Talk Today"
echo "- Client: TechCorp Inc"
echo "- Campaign: Summer Tech Launch 2024"
echo ""
echo "You can now log in with any of these accounts at the login page!"