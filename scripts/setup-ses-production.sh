#!/bin/bash

# Script to request SES production access and verify domains
# This script should be run when ready to move from SES sandbox to production

echo "🚀 Setting up SES for Production"
echo "================================"

# Check if we have AWS CLI configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "📧 Current SES Status:"
aws ses get-account-sending-enabled --region us-east-1

echo ""
echo "📊 Current Send Quota:"
aws ses get-send-quota --region us-east-1

echo ""
echo "📋 Current Verified Identities:"
aws ses list-identities --region us-east-1

echo ""
echo "🔍 Verification Status:"
IDENTITIES=$(aws ses list-identities --region us-east-1 --query 'Identities' --output text)
if [ ! -z "$IDENTITIES" ]; then
    aws ses get-identity-verification-attributes --identities $IDENTITIES --region us-east-1
fi

echo ""
echo "📝 To Move to Production:"
echo "1. Verify your domain (recommended) or individual email addresses"
echo "2. Request production access through AWS SES console:"
echo "   https://console.aws.amazon.com/ses/home?region=us-east-1#/account"
echo "3. Complete the request form with:"
echo "   - Use case: Transactional emails (user invitations, password resets)"
echo "   - Website: podcastflow.pro"
echo "   - Description: Podcast advertising management platform sending user invitations"
echo "   - Expected volume: 100-500 emails per day"
echo ""
echo "🌐 To verify domain (recommended for production):"
echo "   aws ses verify-domain-identity --domain podcastflow.pro --region us-east-1"
echo ""
echo "📧 To verify individual emails (for testing):"
echo "   aws ses verify-email-identity --email-address your-email@domain.com --region us-east-1"
echo ""
echo "⚠️  Note: Until production access is granted, you can only send emails to verified addresses."
echo "   This is why email invitations currently show as 'logged to console' in development."