#!/bin/bash

# AWS Secrets Manager Setup Script for PodcastFlow Pro
# This script creates and configures secrets in AWS Secrets Manager

set -e

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
SECRET_PREFIX="podcastflow-pro"
ENVIRONMENT=${ENVIRONMENT:-"production"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== AWS Secrets Manager Setup ==="
echo "Region: $AWS_REGION"
echo "Prefix: $SECRET_PREFIX"
echo "Environment: $ENVIRONMENT"
echo ""

# Function to create or update a secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    full_secret_name="$SECRET_PREFIX/$secret_name"
    
    echo -n "Creating secret $full_secret_name... "
    
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$full_secret_name" --region $AWS_REGION >/dev/null 2>&1; then
        # Update existing secret
        aws secretsmanager update-secret \
            --secret-id "$full_secret_name" \
            --secret-string "$secret_value" \
            --region $AWS_REGION >/dev/null
        echo -e "${GREEN}Updated ✓${NC}"
    else
        # Create new secret
        aws secretsmanager create-secret \
            --name "$full_secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region $AWS_REGION >/dev/null
        echo -e "${GREEN}Created ✓${NC}"
    fi
}

# Generate secure random secrets
generate_secret() {
    openssl rand -base64 $1 | tr -d '\n'
}

# 1. Database Secrets
echo -e "\n${YELLOW}Setting up database secrets...${NC}"

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: DB_PASSWORD environment variable not set${NC}"
    echo "Please set: export DB_PASSWORD='your-secure-password'"
    exit 1
fi

DB_SECRETS=$(cat <<EOF
{
  "host": "localhost",
  "port": 5432,
  "database": "podcastflow_production",
  "username": "podcastflow",
  "password": "$DB_PASSWORD",
  "sslMode": "require",
  "maxConnections": 20,
  "idleTimeoutMillis": 30000
}
EOF
)

create_secret "database" "$DB_SECRETS" "PostgreSQL database connection secrets"

# 2. Application Secrets
echo -e "\n${YELLOW}Setting up application secrets...${NC}"

JWT_SECRET=$(generate_secret 64)
NEXTAUTH_SECRET=$(generate_secret 64)
ENCRYPTION_KEY=$(generate_secret 32)

APP_SECRETS=$(cat <<EOF
{
  "jwtSecret": "$JWT_SECRET",
  "nextAuthSecret": "$NEXTAUTH_SECRET",
  "encryptionKey": "$ENCRYPTION_KEY",
  "sessionDurationHours": 8,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

create_secret "app" "$APP_SECRETS" "Application secrets for authentication and encryption"

# 3. Email Secrets (AWS SES)
echo -e "\n${YELLOW}Setting up email secrets...${NC}"

if [ -z "$SES_SMTP_USERNAME" ] || [ -z "$SES_SMTP_PASSWORD" ]; then
    echo -e "${YELLOW}Warning: SES SMTP credentials not provided${NC}"
    echo "Skipping email configuration. Set SES_SMTP_USERNAME and SES_SMTP_PASSWORD to configure."
else
    EMAIL_SECRETS=$(cat <<EOF
{
  "host": "email-smtp.${AWS_REGION}.amazonaws.com",
  "port": 587,
  "username": "$SES_SMTP_USERNAME",
  "password": "$SES_SMTP_PASSWORD",
  "from": "noreply@podcastflow.pro",
  "replyTo": "support@podcastflow.pro",
  "useTls": true
}
EOF
    )
    
    create_secret "email" "$EMAIL_SECRETS" "Email configuration for AWS SES"
fi

# 4. Third-party Integration Secrets
echo -e "\n${YELLOW}Setting up third-party integration secrets...${NC}"

THIRD_PARTY_SECRETS=$(cat <<EOF
{
  "quickbooksClientId": "${QUICKBOOKS_CLIENT_ID:-}",
  "quickbooksClientSecret": "${QUICKBOOKS_CLIENT_SECRET:-}",
  "youtubeApiKey": "${YOUTUBE_API_KEY:-}",
  "megaphoneApiKey": "${MEGAPHONE_API_KEY:-}",
  "megaphoneApiSecret": "${MEGAPHONE_API_SECRET:-}",
  "sentryDsn": "${SENTRY_DSN:-}"
}
EOF
)

create_secret "third-party" "$THIRD_PARTY_SECRETS" "Third-party API credentials"

# 5. Backup Encryption Key
echo -e "\n${YELLOW}Setting up backup encryption key...${NC}"

BACKUP_KEY=$(generate_secret 32)

BACKUP_SECRETS=$(cat <<EOF
{
  "encryptionKey": "$BACKUP_KEY",
  "algorithm": "aes-256-cbc"
}
EOF
)

create_secret "backup" "$BACKUP_SECRETS" "Backup encryption configuration"

# 6. Create rotation schedule
echo -e "\n${YELLOW}Setting up secret rotation...${NC}"

# Database password rotation (monthly)
echo -n "Creating database password rotation schedule... "
aws secretsmanager put-secret-rotation-schedule \
    --secret-id "$SECRET_PREFIX/database" \
    --rotation-rules '{"AutomaticallyAfterDays": 30}' \
    --region $AWS_REGION >/dev/null 2>&1 || echo -e "${YELLOW}Skipped (requires Lambda function)${NC}"

# Application secrets rotation (quarterly)
echo -n "Creating application secrets rotation schedule... "
aws secretsmanager put-secret-rotation-schedule \
    --secret-id "$SECRET_PREFIX/app" \
    --rotation-rules '{"AutomaticallyAfterDays": 90}' \
    --region $AWS_REGION >/dev/null 2>&1 || echo -e "${YELLOW}Skipped (requires Lambda function)${NC}"

# 7. Set up IAM policy for the application
echo -e "\n${YELLOW}Creating IAM policy for application access...${NC}"

POLICY_NAME="PodcastFlowProSecretsAccess"
POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:*:secret:${SECRET_PREFIX}/*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:ListSecrets",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "secretsmanager:Name": "${SECRET_PREFIX}/*"
        }
      }
    }
  ]
}
EOF
)

echo "$POLICY_DOCUMENT" > /tmp/secrets-policy.json

echo -n "Creating IAM policy... "
aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document file:///tmp/secrets-policy.json \
    --description "Allows PodcastFlow Pro to access its secrets" \
    2>/dev/null && echo -e "${GREEN}Created ✓${NC}" || echo -e "${YELLOW}Already exists${NC}"

rm -f /tmp/secrets-policy.json

# 8. Generate environment file for local testing
echo -e "\n${YELLOW}Generating .env.secrets for local testing...${NC}"

cat > .env.secrets << EOF
# AWS Secrets Manager Configuration
# Add these to your .env file

AWS_SECRETS_MANAGER_REGION=$AWS_REGION
AWS_SECRETS_PREFIX=$SECRET_PREFIX

# For local development, you can also use these directly:
# (In production, these will be loaded from Secrets Manager)

JWT_SECRET=$JWT_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
BACKUP_ENCRYPTION_KEY=$BACKUP_KEY
EOF

echo -e "${GREEN}Local secrets file created: .env.secrets${NC}"

# Summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo "Secrets created in AWS Secrets Manager:"
echo "  - $SECRET_PREFIX/database"
echo "  - $SECRET_PREFIX/app"
echo "  - $SECRET_PREFIX/email"
echo "  - $SECRET_PREFIX/third-party"
echo "  - $SECRET_PREFIX/backup"
echo ""
echo "Next steps:"
echo "1. Attach the '$POLICY_NAME' policy to your EC2 instance role or ECS task role"
echo "2. Update your application to use the SecretsManager class"
echo "3. Test secret retrieval with: aws secretsmanager get-secret-value --secret-id $SECRET_PREFIX/app"
echo "4. Set up Lambda functions for automatic rotation (optional)"
echo ""
echo -e "${GREEN}✅ AWS Secrets Manager setup complete!${NC}"