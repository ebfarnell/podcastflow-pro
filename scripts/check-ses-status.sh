#!/bin/bash

echo "📊 AWS SES Account Status Check"
echo "=================================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get current AWS region
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "📍 AWS Region: $REGION"
echo "👤 AWS Account: $(aws sts get-caller-identity --query Account --output text)"
echo ""

# Check sending quota
echo "📈 SENDING QUOTA & LIMITS:"
quota_info=$(aws ses describe-account-sending-enabled --region "$REGION" 2>/dev/null)
send_quota=$(aws ses get-send-quota --region "$REGION" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ SES API accessible"
    
    # Parse send quota information
    max_24hour=$(echo "$send_quota" | jq -r '.Max24HourSend // "N/A"')
    max_send_rate=$(echo "$send_quota" | jq -r '.MaxSendRate // "N/A"')
    sent_last_24=$(echo "$send_quota" | jq -r '.SentLast24Hours // "N/A"')
    
    echo "   📊 Max 24-hour send: $max_24hour emails"
    echo "   ⚡ Max send rate: $max_send_rate emails/second"
    echo "   📤 Sent last 24h: $sent_last_24 emails"
else
    echo "❌ Cannot access SES API"
fi
echo ""

# Check verified identities
echo "✉️  VERIFIED IDENTITIES:"
verified=$(aws ses list-verified-email-addresses --region "$REGION" 2>/dev/null)

if [ $? -eq 0 ]; then
    emails=$(echo "$verified" | jq -r '.VerifiedEmailAddresses[]' 2>/dev/null)
    
    if [ -z "$emails" ]; then
        echo "   ❌ No verified email addresses found"
    else
        echo "$emails" | while read email; do
            echo "   ✅ $email"
        done
    fi
else
    echo "   ❌ Cannot retrieve verified emails"
fi
echo ""

# Check sending statistics
echo "📊 SENDING STATISTICS (Last 24 hours):"
stats=$(aws ses get-send-statistics --region "$REGION" 2>/dev/null)

if [ $? -eq 0 ]; then
    # Get the most recent data point
    latest=$(echo "$stats" | jq -r '.SendDataPoints | sort_by(.Timestamp) | last')
    
    if [ "$latest" != "null" ]; then
        bounces=$(echo "$latest" | jq -r '.Bounces // 0')
        complaints=$(echo "$latest" | jq -r '.Complaints // 0')
        delivery_attempts=$(echo "$latest" | jq -r '.DeliveryAttempts // 0')
        rejects=$(echo "$latest" | jq -r '.Rejects // 0')
        timestamp=$(echo "$latest" | jq -r '.Timestamp')
        
        echo "   📤 Delivery attempts: $delivery_attempts"
        echo "   ⚠️  Bounces: $bounces"
        echo "   🚫 Complaints: $complaints"
        echo "   ❌ Rejects: $rejects"
        echo "   🕒 Last updated: $timestamp"
    else
        echo "   📭 No recent sending activity"
    fi
else
    echo "   ❌ Cannot retrieve sending statistics"
fi
echo ""

# Check if in sandbox mode
echo "🔒 SANDBOX STATUS:"
if [ "$max_24hour" = "200" ]; then
    echo "   ⚠️  IN SANDBOX MODE"
    echo "   📝 Can only send to verified addresses"
    echo "   📊 Limited to 200 emails per 24 hours"
    echo "   🚀 Request production access to remove these limits"
else
    echo "   ✅ PRODUCTION ACCESS ENABLED"
    echo "   📤 Can send to any email address"
fi
echo ""

echo "=================================================="
echo "🔗 USEFUL LINKS:"
echo "📧 SES Console: https://console.aws.amazon.com/ses/"
echo "📋 Request Production Access: https://console.aws.amazon.com/ses/#dashboard"
echo "📊 Sending Statistics: https://console.aws.amazon.com/ses/#dashboard-sendingstatistics"
echo "✉️  Verified Identities: https://console.aws.amazon.com/ses/#addresses"
echo "=================================================="