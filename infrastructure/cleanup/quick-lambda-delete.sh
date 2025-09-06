#!/bin/bash

# Quick Lambda deletion for confirmed unused functions
REGION="us-east-1"

echo "=== Quick Lambda Cleanup ==="
echo "Deleting confirmed unused Lambda functions..."

# First batch - definitely unused
BATCH1=(
    "PodcastFlowPro-Ad-Approvals"
    "PodcastFlowPro-Ad-Copy"
    "PodcastFlowPro-Advertisers"
    "PodcastFlowPro-Agencies"
    "PodcastFlowPro-Availability"
    "PodcastFlowPro-Contracts"
    "PodcastFlowPro-Episodes"
    "PodcastFlowPro-Financials"
    "PodcastFlowPro-Shows"
    "PodcastFlowPro-Reports"
    "PodcastFlowPro-Billing"
    "PodcastFlowPro-Insertion-Orders"
    "PodcastFlowPro-Backup"
    "PodcastFlowPro-Security"
    "PodcastFlowPro-Team"
)

for func in "${BATCH1[@]}"; do
    echo -n "Deleting $func... "
    if aws lambda delete-function --function-name "$func" --region $REGION 2>/dev/null; then
        echo "✓"
        # Delete log group
        aws logs delete-log-group --log-group-name "/aws/lambda/$func" --region $REGION 2>/dev/null || true
    else
        echo "✗ (may already be deleted)"
    fi
done

echo ""
echo "Batch 1 complete. Checking Lambda count..."
COUNT=$(aws lambda list-functions --region $REGION --query "length(Functions[?contains(FunctionName, 'PodcastFlow')])" --output text)
echo "Remaining PodcastFlow Lambda functions: $COUNT"