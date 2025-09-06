#!/bin/bash

echo "📧 Checking Verified Email Addresses"
echo "===================================="
echo ""

# Get verified email addresses
echo "✅ Currently verified email addresses:"
aws ses list-verified-email-addresses --region us-east-1 --query 'VerifiedEmailAddresses' --output table

echo ""
echo "🔄 Checking verification status for key addresses:"

# Key emails to check
EMAILS=(
    "noreply@podcastflow.pro"
    "support@podcastflow.pro" 
    "admin@podcastflow.pro"
)

for email in "${EMAILS[@]}"; do
    # Check if email is verified
    verified=$(aws ses list-verified-email-addresses --region us-east-1 --query "VerifiedEmailAddresses[?@=='$email']" --output text)
    
    if [ -n "$verified" ]; then
        echo "✅ $email - VERIFIED"
    else
        echo "⏳ $email - PENDING (check inbox for verification email)"
    fi
done

echo ""
echo "🎯 Once noreply@podcastflow.pro is verified, your email system will work!"
echo "📧 SES Console: https://console.aws.amazon.com/ses/#addresses"