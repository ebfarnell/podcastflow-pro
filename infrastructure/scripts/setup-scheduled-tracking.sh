#!/bin/bash

# Setup CloudWatch Events rule for scheduled tracking updates
# This script creates the rule to trigger tracking updates every 4 hours

set -e

RULE_NAME="podcastflow-tracking-schedule"
LAMBDA_NAME="podcastflow-tracking-scheduler"
REGION="${AWS_REGION:-us-east-1}"

echo "Setting up scheduled tracking updates..."

# Create CloudWatch Events rule for every 4 hours
echo "Creating CloudWatch Events rule: ${RULE_NAME}"
aws events put-rule \
    --name "${RULE_NAME}" \
    --schedule-expression "rate(4 hours)" \
    --description "Trigger product tracking updates every 4 hours" \
    --state ENABLED \
    --region "${REGION}"

# Get the Lambda function ARN (assuming it exists)
LAMBDA_ARN=$(aws lambda get-function --function-name "${LAMBDA_NAME}" --region "${REGION}" --query 'Configuration.FunctionArn' --output text 2>/dev/null || echo "")

if [ -z "$LAMBDA_ARN" ]; then
    echo "⚠️  Lambda function ${LAMBDA_NAME} not found."
    echo "You'll need to:"
    echo "1. Deploy the tracking scheduler Lambda function"
    echo "2. Run this script again to complete the setup"
    echo ""
    echo "For now, creating the rule without target..."
else
    echo "Adding Lambda target to CloudWatch Events rule..."
    
    # Add Lambda as target for the rule
    aws events put-targets \
        --rule "${RULE_NAME}" \
        --targets "Id"="1","Arn"="${LAMBDA_ARN}" \
        --region "${REGION}"

    # Give CloudWatch Events permission to invoke the Lambda
    echo "Adding permission for CloudWatch Events to invoke Lambda..."
    aws lambda add-permission \
        --function-name "${LAMBDA_NAME}" \
        --statement-id "AllowExecutionFromCloudWatch" \
        --action "lambda:InvokeFunction" \
        --principal "events.amazonaws.com" \
        --source-arn "arn:aws:events:${REGION}:$(aws sts get-caller-identity --query Account --output text):rule/${RULE_NAME}" \
        --region "${REGION}" \
        2>/dev/null || echo "Permission may already exist"

    echo "✅ Scheduled tracking setup complete!"
    echo "📅 Tracking will run every 4 hours"
    echo "🎯 Target: ${LAMBDA_ARN}"
fi

echo ""
echo "CloudWatch Events rule created: ${RULE_NAME}"
echo "Schedule: Every 4 hours"
echo ""
echo "To manually trigger tracking updates:"
echo "aws lambda invoke --function-name ${LAMBDA_NAME} --region ${REGION} /tmp/tracking-result.json"
echo ""
echo "To check rule status:"
echo "aws events describe-rule --name ${RULE_NAME} --region ${REGION}"
echo ""
echo "To disable scheduled tracking:"
echo "aws events disable-rule --name ${RULE_NAME} --region ${REGION}"