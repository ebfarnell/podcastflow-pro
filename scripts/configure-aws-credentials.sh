#!/bin/bash

echo "🔐 AWS Credentials Configuration for PodcastFlow Pro"
echo "===================================================="
echo
echo "This script will help you configure AWS credentials for S3 backups."
echo "Your credentials will be stored securely in the .env file."
echo

# Function to validate AWS credentials
validate_credentials() {
    local key_id=$1
    local secret_key=$2
    local region=${3:-us-east-1}
    
    # Test credentials with a simple S3 list operation
    AWS_ACCESS_KEY_ID="$key_id" \
    AWS_SECRET_ACCESS_KEY="$secret_key" \
    AWS_REGION="$region" \
    aws s3 ls --max-items 1 >/dev/null 2>&1
    
    return $?
}

# Check if .env file exists
ENV_FILE="/home/ec2-user/podcastflow-pro/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Backup current .env file
cp "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
echo "✅ Created backup of .env file"

# Check current configuration
echo
echo "Current Configuration:"
echo "----------------------"
grep -q "AWS_ACCESS_KEY_ID" "$ENV_FILE" && echo "AWS_ACCESS_KEY_ID: [CONFIGURED]" || echo "AWS_ACCESS_KEY_ID: [NOT SET]"
grep -q "AWS_SECRET_ACCESS_KEY" "$ENV_FILE" && echo "AWS_SECRET_ACCESS_KEY: [CONFIGURED]" || echo "AWS_SECRET_ACCESS_KEY: [NOT SET]"
echo "AWS_REGION: $(grep "AWS_REGION" "$ENV_FILE" | head -1 | cut -d'=' -f2)"
echo "S3_BUCKET_NAME: $(grep "S3_BUCKET_NAME" "$ENV_FILE" | cut -d'=' -f2)"
echo

# Prompt for credentials
echo "Enter AWS Credentials (or press Enter to skip):"
echo "-------------------------------------------------"
read -p "AWS Access Key ID: " AWS_KEY_ID
read -s -p "AWS Secret Access Key: " AWS_SECRET_KEY
echo
read -p "AWS Region [us-east-1]: " AWS_REGION

# Set defaults
AWS_REGION=${AWS_REGION:-us-east-1}

if [ -z "$AWS_KEY_ID" ] || [ -z "$AWS_SECRET_KEY" ]; then
    echo
    echo "⚠️  No credentials provided. Skipping configuration."
    echo "Note: Backups will only be stored locally without AWS credentials."
    exit 0
fi

# Validate credentials
echo
echo "🔍 Validating AWS credentials..."
if validate_credentials "$AWS_KEY_ID" "$AWS_SECRET_KEY" "$AWS_REGION"; then
    echo "✅ AWS credentials are valid!"
    
    # Update .env file
    echo
    echo "📝 Updating .env file..."
    
    # Remove old entries if they exist
    sed -i '/^AWS_ACCESS_KEY_ID=/d' "$ENV_FILE"
    sed -i '/^AWS_SECRET_ACCESS_KEY=/d' "$ENV_FILE"
    
    # Add new credentials
    echo "" >> "$ENV_FILE"
    echo "# AWS Credentials for S3 Backups" >> "$ENV_FILE"
    echo "AWS_ACCESS_KEY_ID=$AWS_KEY_ID" >> "$ENV_FILE"
    echo "AWS_SECRET_ACCESS_KEY=$AWS_SECRET_KEY" >> "$ENV_FILE"
    
    # Update region if different
    sed -i "s/^AWS_REGION=.*/AWS_REGION=$AWS_REGION/" "$ENV_FILE"
    
    echo "✅ Credentials saved to .env file"
    
    # Set proper permissions
    chmod 600 "$ENV_FILE"
    echo "✅ File permissions secured (600)"
    
    # Test S3 bucket access
    echo
    echo "🪣 Testing S3 bucket access..."
    BUCKET_NAME=$(grep "S3_BUCKET_NAME" "$ENV_FILE" | cut -d'=' -f2)
    
    if [ ! -z "$BUCKET_NAME" ]; then
        AWS_ACCESS_KEY_ID="$AWS_KEY_ID" \
        AWS_SECRET_ACCESS_KEY="$AWS_SECRET_KEY" \
        AWS_REGION="$AWS_REGION" \
        aws s3 ls "s3://$BUCKET_NAME" --max-items 1 >/dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully connected to S3 bucket: $BUCKET_NAME"
        else
            echo "⚠️  Could not access bucket: $BUCKET_NAME"
            echo "   This might be normal if the bucket doesn't exist yet."
        fi
    fi
    
    echo
    echo "🚀 Configuration complete!"
    echo
    echo "Next steps:"
    echo "1. The application will be rebuilt and restarted"
    echo "2. Future backups will automatically upload to S3"
    echo "3. S3 path: s3://$BUCKET_NAME/organizations/{orgId}/backups/"
    
else
    echo "❌ Invalid AWS credentials!"
    echo "Please check your Access Key ID and Secret Access Key."
    echo
    echo "To create new AWS credentials:"
    echo "1. Log into AWS Console"
    echo "2. Go to IAM → Users → Your User → Security credentials"
    echo "3. Create new access key"
    echo "4. Ensure user has S3 permissions (AmazonS3FullAccess or custom policy)"
    exit 1
fi