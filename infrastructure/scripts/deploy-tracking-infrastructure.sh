#!/bin/bash

# Deploy complete product tracking infrastructure
# This script deploys all Lambda functions, sets up scheduled jobs, and configures the tracking system

set -e

REGION="${AWS_REGION:-us-east-1}"
TABLE_NAME="podcastflow-pro"
TRACKING_LAMBDA_NAME="podcastflow-tracking"
SCHEDULER_LAMBDA_NAME="podcastflow-tracking-scheduler"
CAMPAIGNS_LAMBDA_NAME="podcastflow-campaigns"

echo "🚀 Deploying Product Tracking Infrastructure"
echo "============================================="
echo ""

# Step 1: Package and deploy tracking Lambda
echo "📦 Step 1: Deploying tracking service Lambda..."
cd ../lambdas/tracking

# Install dependencies
echo "Installing dependencies..."
npm install

# Create deployment package
echo "Creating deployment package..."
zip -r tracking-lambda.zip . -x "*.git*" "node_modules/.cache/*" "*.env*"

# Deploy or update Lambda function
if aws lambda get-function --function-name "${TRACKING_LAMBDA_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "Updating existing tracking Lambda function..."
    aws lambda update-function-code \
        --function-name "${TRACKING_LAMBDA_NAME}" \
        --zip-file fileb://tracking-lambda.zip \
        --region "${REGION}"
else
    echo "Creating new tracking Lambda function..."
    aws lambda create-function \
        --function-name "${TRACKING_LAMBDA_NAME}" \
        --runtime "nodejs18.x" \
        --role "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role" \
        --handler "index.handler" \
        --zip-file fileb://tracking-lambda.zip \
        --timeout 300 \
        --memory-size 512 \
        --environment Variables="{DYNAMODB_TABLE_NAME=${TABLE_NAME},CARRIER_SECRETS_NAME=podcastflow-carrier-credentials}" \
        --region "${REGION}"
fi

# Update environment variables
echo "Updating tracking Lambda environment..."
aws lambda update-function-configuration \
    --function-name "${TRACKING_LAMBDA_NAME}" \
    --environment Variables="{DYNAMODB_TABLE_NAME=${TABLE_NAME},CARRIER_SECRETS_NAME=podcastflow-carrier-credentials}" \
    --region "${REGION}"

echo "✅ Tracking service Lambda deployed"

# Step 2: Deploy scheduler Lambda
echo ""
echo "📅 Step 2: Deploying tracking scheduler Lambda..."

# Create scheduler deployment package
zip -r scheduler-lambda.zip . -x "*.git*" "node_modules/.cache/*" "*.env*" "tracking-lambda.zip"

# Deploy or update scheduler Lambda function
if aws lambda get-function --function-name "${SCHEDULER_LAMBDA_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "Updating existing scheduler Lambda function..."
    aws lambda update-function-code \
        --function-name "${SCHEDULER_LAMBDA_NAME}" \
        --zip-file fileb://scheduler-lambda.zip \
        --region "${REGION}"
else
    echo "Creating new scheduler Lambda function..."
    aws lambda create-function \
        --function-name "${SCHEDULER_LAMBDA_NAME}" \
        --runtime "nodejs18.x" \
        --role "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role" \
        --handler "scheduledTracker.handler" \
        --zip-file fileb://scheduler-lambda.zip \
        --timeout 900 \
        --memory-size 1024 \
        --environment Variables="{DYNAMODB_TABLE_NAME=${TABLE_NAME},CARRIER_SECRETS_NAME=podcastflow-carrier-credentials}" \
        --region "${REGION}"
fi

echo "✅ Tracking scheduler Lambda deployed"

# Step 3: Update campaigns Lambda
echo ""
echo "🔄 Step 3: Updating campaigns Lambda with tracking endpoints..."
cd ../campaigns

# Update campaigns Lambda environment to include tracking Lambda name
aws lambda update-function-configuration \
    --function-name "${CAMPAIGNS_LAMBDA_NAME}" \
    --environment Variables="{DYNAMODB_TABLE_NAME=${TABLE_NAME},TRACKING_LAMBDA_NAME=${TRACKING_LAMBDA_NAME}}" \
    --region "${REGION}"

# Redeploy campaigns Lambda with updated code
zip -r campaigns-lambda.zip . -x "*.git*" "node_modules/.cache/*" "*.env*"

aws lambda update-function-code \
    --function-name "${CAMPAIGNS_LAMBDA_NAME}" \
    --zip-file fileb://campaigns-lambda.zip \
    --region "${REGION}"

echo "✅ Campaigns Lambda updated with tracking integration"

# Step 4: Setup scheduled tracking
echo ""
echo "⏰ Step 4: Setting up scheduled tracking updates..."
cd ../scripts
./setup-scheduled-tracking.sh

echo "✅ Scheduled tracking configured"

# Step 5: Setup API Gateway routes (if needed)
echo ""
echo "🌐 Step 5: Setting up API Gateway routes..."

# Get API Gateway ID (assuming it exists)
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='podcastflow-api'].id" --output text 2>/dev/null || echo "")

if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
    echo "Found API Gateway: ${API_ID}"
    
    # Add tracking routes to API Gateway
    # This would require more complex API Gateway configuration
    # For now, we'll note that this needs to be done manually
    echo "⚠️  Manual step required: Add tracking endpoints to API Gateway"
    echo "   Routes needed:"
    echo "   - POST /campaigns/{id}/shipments"
    echo "   - GET /campaigns/{id}/shipments"
    echo "   - PUT /shipments/{id}/status"
    echo "   - POST /shipments/{id}/track"
    echo "   - POST /shipments/batch-track"
    echo "   - POST /webhooks/tracking"
else
    echo "⚠️  API Gateway not found. Manual setup required."
fi

# Step 6: Grant necessary permissions
echo ""
echo "🔐 Step 6: Setting up permissions..."

# Grant tracking Lambda permissions to access DynamoDB and Secrets Manager
echo "Setting up IAM permissions for tracking service..."

# Note: These permissions should be added to the lambda-execution-role
echo "⚠️  Ensure the lambda-execution-role has the following permissions:"
echo "   - dynamodb:GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan"
echo "   - secretsmanager:GetSecretValue"
echo "   - lambda:InvokeFunction (for campaigns Lambda to call tracking Lambda)"

# Grant campaigns Lambda permission to invoke tracking Lambda
aws lambda add-permission \
    --function-name "${TRACKING_LAMBDA_NAME}" \
    --statement-id "AllowCampaignsLambdaInvoke" \
    --action "lambda:InvokeFunction" \
    --principal "lambda.amazonaws.com" \
    --source-arn "arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${CAMPAIGNS_LAMBDA_NAME}" \
    --region "${REGION}" \
    2>/dev/null || echo "Permission may already exist"

echo "✅ Basic permissions configured"

# Step 7: Test deployment
echo ""
echo "🧪 Step 7: Testing deployment..."

# Test tracking Lambda
echo "Testing tracking Lambda..."
TEST_RESULT=$(aws lambda invoke \
    --function-name "${TRACKING_LAMBDA_NAME}" \
    --payload '{"httpMethod":"GET","resource":"/shipments/active","queryStringParameters":{"limit":"1"}}' \
    --region "${REGION}" \
    /tmp/tracking-test.json 2>/dev/null || echo "FAILED")

if [ "$TEST_RESULT" != "FAILED" ]; then
    RESPONSE=$(cat /tmp/tracking-test.json)
    if echo "$RESPONSE" | grep -q '"statusCode":200'; then
        echo "✅ Tracking Lambda test passed"
    else
        echo "⚠️  Tracking Lambda test returned: $RESPONSE"
    fi
else
    echo "❌ Tracking Lambda test failed"
fi

# Test scheduler Lambda
echo "Testing scheduler Lambda..."
aws lambda invoke \
    --function-name "${SCHEDULER_LAMBDA_NAME}" \
    --region "${REGION}" \
    /tmp/scheduler-test.json >/dev/null 2>&1 && echo "✅ Scheduler Lambda test passed" || echo "⚠️  Scheduler Lambda test failed"

# Cleanup
cd ../tracking
rm -f *.zip
cd ../campaigns
rm -f *.zip

echo ""
echo "🎉 Product Tracking Infrastructure Deployment Complete!"
echo "======================================================"
echo ""
echo "✅ Components deployed:"
echo "   - Tracking service Lambda: ${TRACKING_LAMBDA_NAME}"
echo "   - Scheduled tracker Lambda: ${SCHEDULER_LAMBDA_NAME}"
echo "   - Updated campaigns Lambda: ${CAMPAIGNS_LAMBDA_NAME}"
echo "   - CloudWatch Events rule: podcastflow-tracking-schedule"
echo "   - Carrier credentials secret: podcastflow-carrier-credentials"
echo ""
echo "⚠️  Next steps:"
echo "   1. Update carrier API credentials in AWS Secrets Manager"
echo "   2. Add API Gateway routes for tracking endpoints"
echo "   3. Update IAM permissions if needed"
echo "   4. Test with real tracking numbers"
echo ""
echo "📖 Documentation:"
echo "   - Carrier API setup: See setup-carrier-credentials.sh output"
echo "   - Scheduled tracking: Every 4 hours via CloudWatch Events"
echo "   - Manual tracking: aws lambda invoke --function-name ${SCHEDULER_LAMBDA_NAME}"
echo ""
echo "🔍 Monitoring:"
echo "   - CloudWatch Logs: /aws/lambda/${TRACKING_LAMBDA_NAME}"
echo "   - CloudWatch Logs: /aws/lambda/${SCHEDULER_LAMBDA_NAME}"
echo "   - Metrics: Lambda invocations, errors, duration"