#!/bin/bash
# Script to verify email addresses in AWS SES

if [ -z "$1" ]; then
    echo "Usage: ./verify-email.sh email@example.com"
    exit 1
fi

EMAIL=$1
REGION=${AWS_SES_REGION:-us-east-1}

echo "Verifying email address: $EMAIL in region $REGION"
aws ses verify-email-identity --email-address "$EMAIL" --region "$REGION"

if [ $? -eq 0 ]; then
    echo "✅ Verification email sent to $EMAIL"
    echo "The recipient must click the verification link in the email to complete verification."
    echo ""
    echo "To check verification status:"
    echo "aws ses get-identity-verification-attributes --identities $EMAIL --region $REGION"
else
    echo "❌ Failed to send verification email"
fi