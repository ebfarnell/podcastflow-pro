#!/bin/bash

# Setup Master Account for PodcastFlow Pro
# This creates the master account for Michael@unfy.com

set -e

REGION="us-east-1"
USER_POOL_ID="us-east-1_n2gbeGsU4"
TABLE_NAME="PodcastFlowPro"
MASTER_EMAIL="Michael@unfy.com"
MASTER_PASSWORD="Master123!Secure"  # You should change this after first login

echo "Setting up Master Account for PodcastFlow Pro..."
echo "============================================="

# Create master organization
MASTER_ORG_ID="org-master-$(date +%s)"
echo "Creating master organization..."

aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"ORG#$MASTER_ORG_ID\"},
        \"SK\": {\"S\": \"ORG#$MASTER_ORG_ID\"},
        \"GSI1PK\": {\"S\": \"ORGANIZATION\"},
        \"GSI1SK\": {\"S\": \"UNFY Master Organization\"},
        \"id\": {\"S\": \"$MASTER_ORG_ID\"},
        \"name\": {\"S\": \"UNFY Master Organization\"},
        \"domain\": {\"S\": \"unfy.com\"},
        \"plan\": {\"S\": \"master\"},
        \"status\": {\"S\": \"active\"},
        \"features\": {\"L\": [
            {\"S\": \"master_access\"},
            {\"S\": \"impersonation\"},
            {\"S\": \"org_management\"},
            {\"S\": \"global_analytics\"},
            {\"S\": \"platform_settings\"}
        ]},
        \"limits\": {\"M\": {
            \"organizations\": {\"N\": \"9999\"},
            \"global_users\": {\"N\": \"99999\"}
        }},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"},
        \"metadata\": {\"M\": {
            \"isMaster\": {\"BOOL\": true}
        }}
    }" \
    --region $REGION

echo "✓ Master organization created"

# Check if user already exists
echo "Checking if master user already exists..."
existing_user=$(aws cognito-idp list-users \
    --user-pool-id $USER_POOL_ID \
    --filter "email=\"$MASTER_EMAIL\"" \
    --region $REGION \
    --query 'Users[0].Username' \
    --output text 2>/dev/null || echo "None")

if [ "$existing_user" != "None" ] && [ "$existing_user" != "" ]; then
    echo "Master user already exists with ID: $existing_user"
    MASTER_USER_ID=$existing_user
    
    # Update the password
    echo "Updating master account password..."
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $MASTER_USER_ID \
        --password "$MASTER_PASSWORD" \
        --permanent \
        --region $REGION
else
    # Create new user in Cognito
    echo "Creating master user in Cognito..."
    MASTER_USER_ID=$(aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $MASTER_EMAIL \
        --user-attributes Name=email,Value=$MASTER_EMAIL Name=name,Value="Michael (Master)" Name=email_verified,Value=true \
        --temporary-password "$MASTER_PASSWORD" \
        --message-action SUPPRESS \
        --region $REGION \
        --query 'User.Username' \
        --output text)
    
    echo "Created user with ID: $MASTER_USER_ID"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $MASTER_USER_ID \
        --password "$MASTER_PASSWORD" \
        --permanent \
        --region $REGION
fi

# Create/Update master user in DynamoDB
echo "Creating master user record in database..."
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"USER#$MASTER_USER_ID\"},
        \"SK\": {\"S\": \"USER#$MASTER_USER_ID\"},
        \"GSI1PK\": {\"S\": \"USER\"},
        \"GSI1SK\": {\"S\": \"$MASTER_EMAIL\"},
        \"id\": {\"S\": \"$MASTER_USER_ID\"},
        \"email\": {\"S\": \"$MASTER_EMAIL\"},
        \"name\": {\"S\": \"Michael (Master)\"},
        \"role\": {\"S\": \"master\"},
        \"organizationId\": {\"S\": \"$MASTER_ORG_ID\"},
        \"status\": {\"S\": \"active\"},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"},
        \"updatedAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"},
        \"metadata\": {\"M\": {
            \"isMaster\": {\"BOOL\": true},
            \"canImpersonate\": {\"BOOL\": true},
            \"canManageOrgs\": {\"BOOL\": true}
        }}
    }" \
    --region $REGION

echo "✓ Master user created"

# Create master permissions
echo "Setting up master permissions..."
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"PERMISSIONS#master\"},
        \"SK\": {\"S\": \"PERMISSIONS#master\"},
        \"GSI1PK\": {\"S\": \"PERMISSIONS\"},
        \"GSI1SK\": {\"S\": \"master\"},
        \"role\": {\"S\": \"master\"},
        \"permissions\": {\"M\": {
            \"platform\": {\"M\": {
                \"viewAll\": {\"BOOL\": true},
                \"manageOrganizations\": {\"BOOL\": true},
                \"impersonate\": {\"BOOL\": true},
                \"manageBilling\": {\"BOOL\": true},
                \"manageFeatures\": {\"BOOL\": true},
                \"viewGlobalAnalytics\": {\"BOOL\": true},
                \"managePlatformSettings\": {\"BOOL\": true}
            }},
            \"organizations\": {\"M\": {
                \"view\": {\"BOOL\": true},
                \"create\": {\"BOOL\": true},
                \"edit\": {\"BOOL\": true},
                \"delete\": {\"BOOL\": true},
                \"suspend\": {\"BOOL\": true},
                \"manageFeatures\": {\"BOOL\": true},
                \"manageLimits\": {\"BOOL\": true},
                \"viewAsOrg\": {\"BOOL\": true}
            }},
            \"users\": {\"M\": {
                \"viewAll\": {\"BOOL\": true},
                \"createAny\": {\"BOOL\": true},
                \"editAny\": {\"BOOL\": true},
                \"deleteAny\": {\"BOOL\": true},
                \"impersonateAny\": {\"BOOL\": true}
            }},
            \"data\": {\"M\": {
                \"viewAllOrgs\": {\"BOOL\": true},
                \"editAllOrgs\": {\"BOOL\": true},
                \"exportAllOrgs\": {\"BOOL\": true}
            }}
        }},
        \"updatedAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"}
    }" \
    --region $REGION

echo "✓ Master permissions configured"

# Create a sample client organization to demonstrate multi-tenancy
echo ""
echo "Creating sample client organization..."
SAMPLE_ORG_ID="org-acme-$(date +%s)"

aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "{
        \"PK\": {\"S\": \"ORG#$SAMPLE_ORG_ID\"},
        \"SK\": {\"S\": \"ORG#$SAMPLE_ORG_ID\"},
        \"GSI1PK\": {\"S\": \"ORGANIZATION\"},
        \"GSI1SK\": {\"S\": \"ACME Corporation\"},
        \"id\": {\"S\": \"$SAMPLE_ORG_ID\"},
        \"name\": {\"S\": \"ACME Corporation\"},
        \"domain\": {\"S\": \"acme.example.com\"},
        \"plan\": {\"S\": \"professional\"},
        \"status\": {\"S\": \"active\"},
        \"features\": {\"L\": [
            {\"S\": \"campaigns\"},
            {\"S\": \"shows\"},
            {\"S\": \"episodes\"},
            {\"S\": \"ad_approvals\"},
            {\"S\": \"analytics\"},
            {\"S\": \"advanced_analytics\"},
            {\"S\": \"billing\"},
            {\"S\": \"integrations\"},
            {\"S\": \"api_access\"},
            {\"S\": \"audit_logs\"},
            {\"S\": \"backups\"}
        ]},
        \"limits\": {\"M\": {
            \"users\": {\"N\": \"50\"},
            \"campaigns\": {\"N\": \"100\"},
            \"shows\": {\"N\": \"20\"},
            \"storage\": {\"N\": \"1000\"}
        }},
        \"createdAt\": {\"S\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"},
        \"createdBy\": {\"S\": \"$MASTER_USER_ID\"}
    }" \
    --region $REGION

echo "✓ Sample organization created"

echo ""
echo "============================================="
echo "Master Account Setup Complete!"
echo ""
echo "Master Account Credentials:"
echo "  Email: $MASTER_EMAIL"
echo "  Password: $MASTER_PASSWORD"
echo "  Organization: UNFY Master Organization"
echo "  Role: Master"
echo ""
echo "Master Capabilities:"
echo "  ✓ Create and manage organizations"
echo "  ✓ Set organization-level permissions and features"
echo "  ✓ View platform as any organization"
echo "  ✓ Impersonate any user"
echo "  ✓ Manage global platform settings"
echo "  ✓ Access all data across all organizations"
echo ""
echo "Sample Organization Created:"
echo "  Name: ACME Corporation"
echo "  Plan: Professional"
echo "  ID: $SAMPLE_ORG_ID"
echo ""
echo "IMPORTANT: Please change your password after first login!"
echo "============================================="