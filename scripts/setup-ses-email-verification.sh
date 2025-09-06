#!/bin/bash

echo "🚀 AWS SES Email Verification Setup"
echo "=================================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Get current AWS region
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "📍 Using AWS Region: $REGION"
echo ""

# Emails to verify
EMAILS=(
    "noreply@podcastflow.pro"
    "support@podcastflow.pro"
    "admin@podcastflow.pro"
)

echo "📧 Verifying email addresses..."
echo ""

for email in "${EMAILS[@]}"; do
    echo "🔄 Requesting verification for: $email"
    
    # Try to verify the email address
    result=$(aws ses verify-email-identity --email-address "$email" --region "$REGION" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo "✅ Verification email sent to: $email"
        echo "   Check the inbox and click the verification link"
    else
        echo "❌ Failed to send verification for: $email"
        echo "   Error: $result"
    fi
    echo ""
done

echo "=================================================="
echo "📋 Next Steps:"
echo "1. Check the email inboxes for verification emails"
echo "2. Click the verification links in each email"
echo "3. Return to AWS SES Console to confirm verification status"
echo ""
echo "🌐 AWS SES Console: https://console.aws.amazon.com/ses/"
echo "📍 Region: $REGION"
echo ""
echo "⏱️  Verification usually takes 1-2 minutes after clicking the link"
echo "=================================================="