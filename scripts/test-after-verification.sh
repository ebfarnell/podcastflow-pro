#!/bin/bash

echo "🧪 Testing Email System After Verification"
echo "=========================================="
echo ""

# Check verification status
echo "📧 Checking verification status..."
status=$(aws ses get-identity-verification-attributes --identities noreply@podcastflow.pro --region us-east-1 --query 'VerificationAttributes."noreply@podcastflow.pro".VerificationStatus' --output text)

echo "📍 noreply@podcastflow.pro status: $status"
echo ""

if [ "$status" = "Success" ]; then
    echo "✅ VERIFIED! Testing email delivery..."
    echo ""
    
    # Run the direct email test
    node scripts/test-email-direct.js
    
    echo ""
    echo "🎉 If the test passed, your invitation system is now fully functional!"
    echo "📧 Try sending an invitation through the web interface"
    
elif [ "$status" = "Pending" ]; then
    echo "⏳ Still pending verification"
    echo "🔔 Please check your inbox for verification emails and click the links"
    echo "📧 Look for emails from: noreply@ses-verification.amazonaws.com"
    echo ""
    echo "🔗 You can also check here:"
    echo "   https://console.aws.amazon.com/ses/#addresses"
    
else
    echo "❌ Verification failed or email not found"
    echo "🔄 You may need to request verification again"
fi

echo ""
echo "=========================================="