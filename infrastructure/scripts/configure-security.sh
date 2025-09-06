#!/bin/bash

# Configure security settings for PodcastFlow Pro

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuring security settings...${NC}"

# Configuration
REGION="us-east-1"
TABLE_NAME="PodcastFlowPro"
REST_API_ID="6a2opgfepf"

# 1. Configure WAF (Web Application Firewall)
echo -e "${YELLOW}Setting up WAF rules...${NC}"

# Create IP set for blocked IPs
IP_SET_ID=$(aws wafv2 create-ip-set \
    --name PodcastFlowPro-BlockedIPs \
    --scope REGIONAL \
    --description "Blocked IP addresses" \
    --ip-address-version IPV4 \
    --addresses [] \
    --region $REGION \
    --query 'Summary.Id' \
    --output text 2>/dev/null || echo "existing")

if [ "$IP_SET_ID" != "existing" ]; then
    echo "Created IP set: $IP_SET_ID"
else
    echo "IP set already exists"
fi

# Create regex pattern set for malicious patterns
REGEX_SET_ID=$(aws wafv2 create-regex-pattern-set \
    --name PodcastFlowPro-MaliciousPatterns \
    --scope REGIONAL \
    --description "Patterns for detecting malicious requests" \
    --regular-expression-list \
        RegexString="(?i)(union.*select|select.*from|insert.*into|update.*set|delete.*from)" \
        RegexString="(?i)(<script|javascript:|onerror=|onload=)" \
        RegexString="\.\.\/|\.\.\\\\|%2e%2e%2f" \
    --region $REGION \
    --query 'Summary.Id' \
    --output text 2>/dev/null || echo "existing")

if [ "$REGEX_SET_ID" != "existing" ]; then
    echo "Created regex pattern set: $REGEX_SET_ID"
else
    echo "Regex pattern set already exists"
fi

# 2. Configure API Gateway throttling
echo -e "${YELLOW}Configuring API Gateway throttling...${NC}"

# Set account-level throttle limits
aws apigateway update-account \
    --patch-operations \
        op=replace,path=/throttle/burstLimit,value=5000 \
        op=replace,path=/throttle/rateLimit,value=1000 \
    --region $REGION || echo "Account throttling may already be configured"

# Configure usage plan
USAGE_PLAN_ID=$(aws apigateway create-usage-plan \
    --name PodcastFlowPro-Standard \
    --description "Standard usage plan with rate limits" \
    --throttle burstLimit=1000,rateLimit=500 \
    --quota limit=100000,period=DAY \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || echo "existing")

if [ "$USAGE_PLAN_ID" != "existing" ]; then
    echo "Created usage plan: $USAGE_PLAN_ID"
    
    # Associate with API stages
    aws apigateway update-usage-plan \
        --usage-plan-id $USAGE_PLAN_ID \
        --patch-operations \
            op=add,path=/apiStages,value=$REST_API_ID:prod \
        --region $REGION
else
    echo "Usage plan already exists"
fi

# 3. Create DLQ (Dead Letter Queue) for error handling
echo -e "${YELLOW}Creating Dead Letter Queue...${NC}"

DLQ_URL=$(aws sqs create-queue \
    --queue-name PodcastFlowPro-DLQ \
    --attributes MessageRetentionPeriod=1209600,VisibilityTimeout=300 \
    --region $REGION \
    --query 'QueueUrl' \
    --output text 2>/dev/null || echo "existing")

if [ "$DLQ_URL" != "existing" ]; then
    echo "Created DLQ: $DLQ_URL"
else
    echo "DLQ already exists"
    DLQ_URL=$(aws sqs get-queue-url --queue-name PodcastFlowPro-DLQ --region $REGION --query 'QueueUrl' --output text)
fi

# 4. Create SNS topic for security alerts
echo -e "${YELLOW}Creating SNS topic for alerts...${NC}"

ALERT_TOPIC_ARN=$(aws sns create-topic \
    --name PodcastFlowPro-SecurityAlerts \
    --region $REGION \
    --query 'TopicArn' \
    --output text)

echo "Alert topic ARN: $ALERT_TOPIC_ARN"

# Add email subscription (replace with actual email)
# aws sns subscribe \
#     --topic-arn $ALERT_TOPIC_ARN \
#     --protocol email \
#     --notification-endpoint security@podcastflowpro.com \
#     --region $REGION

# 5. Configure CloudWatch alarms
echo -e "${YELLOW}Setting up CloudWatch alarms...${NC}"

# High error rate alarm
aws cloudwatch put-metric-alarm \
    --alarm-name PodcastFlowPro-HighErrorRate \
    --alarm-description "Alert when error rate is high" \
    --metric-name ErrorCount \
    --namespace PodcastFlowPro/Errors \
    --statistic Sum \
    --period 300 \
    --threshold 50 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions $ALERT_TOPIC_ARN \
    --region $REGION || echo "Error rate alarm may already exist"

# High API latency alarm
aws cloudwatch put-metric-alarm \
    --alarm-name PodcastFlowPro-HighAPILatency \
    --alarm-description "Alert when API latency is high" \
    --metric-name Latency \
    --namespace AWS/ApiGateway \
    --dimensions Name=ApiName,Value=PodcastFlowPro \
    --statistic Average \
    --period 300 \
    --threshold 1000 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions $ALERT_TOPIC_ARN \
    --region $REGION || echo "Latency alarm may already exist"

# DynamoDB throttling alarm
aws cloudwatch put-metric-alarm \
    --alarm-name PodcastFlowPro-DynamoDBThrottling \
    --alarm-description "Alert on DynamoDB throttling" \
    --metric-name UserErrors \
    --namespace AWS/DynamoDB \
    --dimensions Name=TableName,Value=$TABLE_NAME \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions $ALERT_TOPIC_ARN \
    --region $REGION || echo "DynamoDB alarm may already exist"

# 6. Update Lambda environment variables
echo -e "${YELLOW}Updating Lambda environment variables...${NC}"

LAMBDA_FUNCTIONS=$(aws lambda list-functions --region $REGION --query "Functions[?starts_with(FunctionName, 'PodcastFlowPro-')].FunctionName" --output text)

for FUNCTION in $LAMBDA_FUNCTIONS; do
    echo "Updating $FUNCTION..."
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION \
        --environment Variables="{
            TABLE_NAME=$TABLE_NAME,
            RATE_LIMIT_TABLE=$TABLE_NAME,
            DLQ_URL=$DLQ_URL,
            ERROR_ALERT_TOPIC_ARN=$ALERT_TOPIC_ARN,
            NODE_ENV=production
        }" \
        --region $REGION \
        --output text > /dev/null || echo "Failed to update $FUNCTION"
done

# 7. Configure API Gateway request validators
echo -e "${YELLOW}Creating request validators...${NC}"

VALIDATOR_ID=$(aws apigateway create-request-validator \
    --rest-api-id $REST_API_ID \
    --name RequestBodyValidator \
    --validate-request-body \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null || echo "existing")

if [ "$VALIDATOR_ID" != "existing" ]; then
    echo "Created request validator: $VALIDATOR_ID"
else
    echo "Request validator already exists"
fi

# 8. Enable CloudTrail for audit logging
echo -e "${YELLOW}Configuring CloudTrail...${NC}"

# Create S3 bucket for CloudTrail logs
TRAIL_BUCKET="podcastflowpro-cloudtrail-logs-${RANDOM}"
aws s3 mb s3://$TRAIL_BUCKET --region $REGION 2>/dev/null || echo "Trail bucket may already exist"

# Create CloudTrail
aws cloudtrail create-trail \
    --name PodcastFlowPro-AuditTrail \
    --s3-bucket-name $TRAIL_BUCKET \
    --is-multi-region-trail \
    --enable-log-file-validation \
    --region $REGION 2>/dev/null || echo "CloudTrail may already exist"

# Start logging
aws cloudtrail start-logging \
    --name PodcastFlowPro-AuditTrail \
    --region $REGION 2>/dev/null || echo "CloudTrail logging may already be started"

# 9. Configure secrets rotation
echo -e "${YELLOW}Setting up secrets rotation...${NC}"

# Create rotation Lambda (if needed)
# This would typically be done through CloudFormation or CDK

# 10. Create security dashboard
echo -e "${YELLOW}Creating CloudWatch dashboard...${NC}"

DASHBOARD_BODY=$(cat <<EOF
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["PodcastFlowPro/Errors", "ErrorCount", {"stat": "Sum"}],
                    ["AWS/Lambda", "Errors", {"stat": "Sum"}],
                    [".", "Throttles", {"stat": "Sum"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "$REGION",
                "title": "Error Metrics"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/ApiGateway", "Count", {"stat": "Sum"}],
                    [".", "4XXError", {"stat": "Sum"}],
                    [".", "5XXError", {"stat": "Sum"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "$REGION",
                "title": "API Gateway Metrics"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
                    [".", "ConsumedWriteCapacityUnits", {"stat": "Sum"}],
                    [".", "UserErrors", {"stat": "Sum"}]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "$REGION",
                "title": "DynamoDB Metrics"
            }
        }
    ]
}
EOF
)

aws cloudwatch put-dashboard \
    --dashboard-name PodcastFlowPro-Security \
    --dashboard-body "$DASHBOARD_BODY" \
    --region $REGION || echo "Dashboard may already exist"

echo -e "${GREEN}Security configuration completed!${NC}"
echo -e "${GREEN}Important: Remember to:${NC}"
echo -e "${GREEN}1. Subscribe to the SNS alert topic: $ALERT_TOPIC_ARN${NC}"
echo -e "${GREEN}2. Review and adjust WAF rules as needed${NC}"
echo -e "${GREEN}3. Configure API keys for external access${NC}"
echo -e "${GREEN}4. Set up regular security audits${NC}"
echo -e "${GREEN}5. Review CloudTrail logs regularly${NC}"