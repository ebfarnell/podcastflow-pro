#!/bin/bash

# Quick script to add AWS credentials to .env file
# Usage: ./add-aws-credentials.sh ACCESS_KEY_ID SECRET_ACCESS_KEY [REGION]

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 ACCESS_KEY_ID SECRET_ACCESS_KEY [REGION]"
    echo "Example: $0 AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY us-east-1"
    exit 1
fi

AWS_KEY_ID="$1"
AWS_SECRET_KEY="$2"
AWS_REGION="${3:-us-east-1}"
ENV_FILE="/home/ec2-user/podcastflow-pro/.env"

# Backup .env
cp "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"

# Remove old entries
sed -i '/^AWS_ACCESS_KEY_ID=/d' "$ENV_FILE"
sed -i '/^AWS_SECRET_ACCESS_KEY=/d' "$ENV_FILE"

# Add new credentials
echo "" >> "$ENV_FILE"
echo "# AWS Credentials for S3 Backups (Added $(date))" >> "$ENV_FILE"
echo "AWS_ACCESS_KEY_ID=$AWS_KEY_ID" >> "$ENV_FILE"
echo "AWS_SECRET_ACCESS_KEY=$AWS_SECRET_KEY" >> "$ENV_FILE"

# Update region
sed -i "s/^AWS_REGION=.*/AWS_REGION=$AWS_REGION/" "$ENV_FILE"

# Secure the file
chmod 600 "$ENV_FILE"

echo "✅ AWS credentials added to .env file"
echo "   Access Key: ${AWS_KEY_ID:0:10}..."
echo "   Region: $AWS_REGION"
echo ""
echo "🔄 Rebuilding application to apply changes..."