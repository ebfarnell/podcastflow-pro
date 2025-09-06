#!/bin/bash

# Set up AWS Secrets Manager for PodcastFlow Pro

set -e

echo "======================================="
echo "PodcastFlow Pro - Secrets Management"
echo "======================================="

REGION="us-east-1"
ENV=${1:-"production"}

# Generate secure random passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

echo "Setting up secrets for environment: ${ENV}"

# Step 1: Create master admin credentials
ADMIN_PASSWORD=$(generate_password)
echo "Creating admin credentials..."
aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/admin-credentials" \
    --description "Admin login credentials" \
    --secret-string "{
        \"username\": \"${ADMIN_EMAIL:-admin@podcastflowpro.com}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"mfa_secret\": \"$(generate_password)\"
    }" \
    --region ${REGION} || echo "Secret may already exist"

# Step 2: Database credentials
echo "Creating database credentials..."
aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/database" \
    --description "DynamoDB access configuration" \
    --secret-string "{
        \"table_name\": \"podcastflow-pro-${ENV}\",
        \"region\": \"${REGION}\",
        \"read_capacity\": 5,
        \"write_capacity\": 5
    }" \
    --region ${REGION} || echo "Secret may already exist"

# Step 3: Third-party API keys (placeholders)
echo "Creating third-party API keys..."
aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/stripe" \
    --description "Stripe payment processing" \
    --secret-string "{
        \"publishable_key\": \"pk_test_placeholder\",
        \"secret_key\": \"sk_test_placeholder\",
        \"webhook_secret\": \"whsec_placeholder\",
        \"mode\": \"test\"
    }" \
    --region ${REGION} || echo "Secret may already exist"

aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/integrations" \
    --description "Third-party integration API keys" \
    --secret-string "{
        \"spotify\": {
            \"client_id\": \"placeholder\",
            \"client_secret\": \"placeholder\"
        },
        \"apple_podcasts\": {
            \"key_id\": \"placeholder\",
            \"issuer_id\": \"placeholder\",
            \"private_key\": \"placeholder\"
        },
        \"google_analytics\": {
            \"tracking_id\": \"placeholder\",
            \"api_key\": \"placeholder\"
        },
        \"hubspot\": {
            \"api_key\": \"placeholder\"
        },
        \"mailchimp\": {
            \"api_key\": \"placeholder\",
            \"list_id\": \"placeholder\"
        }
    }" \
    --region ${REGION} || echo "Secret may already exist"

# Step 4: JWT and encryption keys
JWT_SECRET=$(generate_password)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "Creating security keys..."
aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/security" \
    --description "Security and encryption keys" \
    --secret-string "{
        \"jwt_secret\": \"${JWT_SECRET}\",
        \"encryption_key\": \"${ENCRYPTION_KEY}\",
        \"cookie_secret\": \"$(generate_password)\",
        \"csrf_secret\": \"$(generate_password)\"
    }" \
    --region ${REGION} || echo "Secret may already exist"

# Step 5: Email configuration
echo "Creating email configuration..."
aws secretsmanager create-secret \
    --name "podcastflow/${ENV}/email" \
    --description "Email service configuration" \
    --secret-string "{
        \"ses_region\": \"${REGION}\",
        \"from_email\": \"noreply@podcastflowpro.com\",
        \"support_email\": \"support@podcastflowpro.com\",
        \"smtp_host\": \"email-smtp.${REGION}.amazonaws.com\",
        \"smtp_port\": 587
    }" \
    --region ${REGION} || echo "Secret may already exist"

# Step 6: Create IAM policy for Lambda to access secrets
echo "Creating IAM policy for secrets access..."
cat > /tmp/secrets-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": [
                "arn:aws:secretsmanager:${REGION}:*:secret:podcastflow/${ENV}/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": "*",
            "Condition": {
                "StringLike": {
                    "kms:ViaService": [
                        "secretsmanager.${REGION}.amazonaws.com"
                    ]
                }
            }
        }
    ]
}
EOF

aws iam create-policy \
    --policy-name PodcastFlowSecretsAccess-${ENV} \
    --policy-document file:///tmp/secrets-policy.json \
    --description "Allows Lambda functions to access PodcastFlow secrets" \
    --region ${REGION} || echo "Policy may already exist"

# Step 7: Update Lambda execution role
ROLE_NAME="podcastflow-api-LambdaExecutionRole-*"
POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/PodcastFlowSecretsAccess-${ENV}"

echo "Attaching secrets policy to Lambda role..."
for role in $(aws iam list-roles --query "Roles[?contains(RoleName, 'podcastflow-api-LambdaExecutionRole')].RoleName" --output text); do
    aws iam attach-role-policy \
        --role-name $role \
        --policy-arn $POLICY_ARN || echo "Policy may already be attached"
done

# Step 8: Create helper script to retrieve secrets
cat > ../../scripts/get-secret.sh << 'EOF'
#!/bin/bash
# Helper script to retrieve secrets

SECRET_ID=$1
REGION=${2:-"us-east-1"}

if [ -z "$SECRET_ID" ]; then
    echo "Usage: $0 <secret-id> [region]"
    echo "Example: $0 podcastflow/production/admin-credentials"
    exit 1
fi

aws secretsmanager get-secret-value \
    --secret-id $SECRET_ID \
    --region $REGION \
    --query SecretString \
    --output text | jq '.'
EOF

chmod +x ../../scripts/get-secret.sh

# Step 9: Update Cognito user with new secure password
echo "Updating admin user in Cognito..."
USER_POOL_ID=$(grep NEXT_PUBLIC_USER_POOL_ID ../../.env.local | cut -d '=' -f2)

if [ -n "$USER_POOL_ID" ]; then
    # First, delete the old user
    aws cognito-idp admin-delete-user \
        --user-pool-id ${USER_POOL_ID} \
        --username "Michael@unfy.com" \
        --region ${REGION} 2>/dev/null || echo "User may not exist"
    
    # Create new secure admin user
    aws cognito-idp admin-create-user \
        --user-pool-id ${USER_POOL_ID} \
        --username "admin@podcastflowpro.com" \
        --user-attributes \
            Name=email,Value=admin@podcastflowpro.com \
            Name=email_verified,Value=true \
        --temporary-password "${ADMIN_PASSWORD}" \
        --message-action SUPPRESS \
        --region ${REGION}
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id ${USER_POOL_ID} \
        --username "admin@podcastflowpro.com" \
        --password "${ADMIN_PASSWORD}" \
        --permanent \
        --region ${REGION}
fi

echo ""
echo "========================================="
echo "Secrets setup complete!"
echo "========================================="
echo ""
echo "Admin Credentials:"
echo "  Username: admin@podcastflowpro.com"
echo "  Password: ${ADMIN_PASSWORD}"
echo ""
echo "IMPORTANT: Save these credentials securely!"
echo ""
echo "To retrieve any secret:"
echo "  ./scripts/get-secret.sh podcastflow/${ENV}/secret-name"
echo ""
echo "Next steps:"
echo "1. Update Stripe keys when you have production credentials"
echo "2. Add real API keys for integrations"
echo "3. Configure email sending with SES"