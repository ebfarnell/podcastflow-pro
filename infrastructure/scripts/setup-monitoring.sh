#!/bin/bash

# Set up CloudWatch monitoring and alerts

set -e

echo "========================================="
echo "PodcastFlow Pro - Monitoring Setup"
echo "========================================="

REGION="us-east-1"
SNS_TOPIC="podcastflow-alerts"
EMAIL=${1:-"alerts@podcastflow.pro"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Step 1: Creating SNS Topic for Alerts...${NC}"

# Create SNS topic
TOPIC_ARN=$(aws sns create-topic \
    --name ${SNS_TOPIC} \
    --region ${REGION} \
    --query TopicArn \
    --output text)

echo "SNS Topic created: ${TOPIC_ARN}"

# Subscribe email to topic
echo "Subscribing ${EMAIL} to alerts..."
aws sns subscribe \
    --topic-arn ${TOPIC_ARN} \
    --protocol email \
    --notification-endpoint ${EMAIL} \
    --region ${REGION}

echo -e "${YELLOW}Check your email to confirm the subscription!${NC}"

echo -e "\n${GREEN}Step 2: Creating CloudWatch Alarms...${NC}"

# Get Lambda function names
CAMPAIGN_FUNCTION="podcastflow-api-campaigns"
ANALYTICS_FUNCTION="podcastflow-api-analytics"

# Lambda Error Rate Alarm
echo "Creating Lambda error rate alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "${CAMPAIGN_FUNCTION}-error-rate" \
    --alarm-description "Alert when Lambda function has high error rate" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=FunctionName,Value=${CAMPAIGN_FUNCTION} \
    --alarm-actions ${TOPIC_ARN} \
    --region ${REGION}

# Lambda Duration Alarm
echo "Creating Lambda duration alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "${CAMPAIGN_FUNCTION}-duration" \
    --alarm-description "Alert when Lambda function is running slowly" \
    --metric-name Duration \
    --namespace AWS/Lambda \
    --statistic Average \
    --period 300 \
    --threshold 5000 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --dimensions Name=FunctionName,Value=${CAMPAIGN_FUNCTION} \
    --alarm-actions ${TOPIC_ARN} \
    --region ${REGION}

# API Gateway 4XX Errors
echo "Creating API Gateway 4XX error alarm..."
API_NAME="PodcastFlow-Pro-API"
aws cloudwatch put-metric-alarm \
    --alarm-name "api-gateway-4xx-errors" \
    --alarm-description "Alert on high 4XX error rate" \
    --metric-name 4XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --threshold 50 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=ApiName,Value=${API_NAME} \
    --alarm-actions ${TOPIC_ARN} \
    --region ${REGION}

# API Gateway 5XX Errors
echo "Creating API Gateway 5XX error alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "api-gateway-5xx-errors" \
    --alarm-description "Alert on any 5XX errors" \
    --metric-name 5XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=ApiName,Value=${API_NAME} \
    --alarm-actions ${TOPIC_ARN} \
    --region ${REGION}

# DynamoDB Alarms
TABLE_NAME="podcastflow-pro"

echo "Creating DynamoDB throttle alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "dynamodb-throttles" \
    --alarm-description "Alert on DynamoDB throttling" \
    --metric-name UserErrors \
    --namespace AWS/DynamoDB \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=TableName,Value=${TABLE_NAME} \
    --alarm-actions ${TOPIC_ARN} \
    --region ${REGION}

echo -e "\n${GREEN}Step 3: Creating CloudWatch Dashboard...${NC}"

# Create CloudWatch Dashboard
cat > /tmp/dashboard.json << EOF
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/Lambda", "Invocations", { "stat": "Sum" } ],
                    [ ".", "Errors", { "stat": "Sum" } ],
                    [ ".", "Duration", { "stat": "Average" } ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "${REGION}",
                "title": "Lambda Function Metrics"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApiGateway", "Count", { "stat": "Sum" } ],
                    [ ".", "4XXError", { "stat": "Sum" } ],
                    [ ".", "5XXError", { "stat": "Sum" } ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "${REGION}",
                "title": "API Gateway Metrics"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/DynamoDB", "ConsumedReadCapacityUnits", { "stat": "Sum" } ],
                    [ ".", "ConsumedWriteCapacityUnits", { "stat": "Sum" } ],
                    [ ".", "UserErrors", { "stat": "Sum" } ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "${REGION}",
                "title": "DynamoDB Metrics"
            }
        }
    ]
}
EOF

aws cloudwatch put-dashboard \
    --dashboard-name PodcastFlowPro \
    --dashboard-body file:///tmp/dashboard.json \
    --region ${REGION}

echo -e "\n${GREEN}Step 4: Setting up Application Logs...${NC}"

# Create log groups if they don't exist
for log_group in "/aws/lambda/${CAMPAIGN_FUNCTION}" "/aws/lambda/${ANALYTICS_FUNCTION}"; do
    aws logs create-log-group \
        --log-group-name ${log_group} \
        --region ${REGION} 2>/dev/null || echo "Log group ${log_group} already exists"
    
    # Set retention policy
    aws logs put-retention-policy \
        --log-group-name ${log_group} \
        --retention-in-days 30 \
        --region ${REGION}
done

echo -e "\n${GREEN}Step 5: Creating Error Tracking Integration...${NC}"

# Create Sentry integration script
cat > ../../src/lib/monitoring.ts << 'EOF'
// Error tracking and monitoring utilities

interface ErrorContext {
  user?: { id: string; email: string }
  tags?: Record<string, string>
  extra?: Record<string, any>
}

class MonitoringService {
  private initialized = false

  init() {
    if (this.initialized) return
    
    // Initialize error tracking in production
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      // Add Sentry or other error tracking service initialization here
      this.initialized = true
    }
  }

  captureError(error: Error, context?: ErrorContext) {
    console.error('Error captured:', error, context)
    
    // In production, send to error tracking service
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      // Send to Sentry, Rollbar, etc.
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    console.log(`[${level.toUpperCase()}]`, message)
    
    // In production, send to logging service
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      // Send to logging service
    }
  }

  setUser(user: { id: string; email: string }) {
    // Set user context for error tracking
  }

  trackEvent(eventName: string, properties?: Record<string, any>) {
    // Track custom events for analytics
    if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
      console.log('Event tracked:', eventName, properties)
      // Send to analytics service (Google Analytics, Mixpanel, etc.)
    }
  }
}

export const monitoring = new MonitoringService()
EOF

# Create health check endpoint
cat > ../../src/app/api/health/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

const dynamodb = new DynamoDBClient({ region: process.env.NEXT_PUBLIC_AWS_REGION })

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'unknown',
      api: 'healthy'
    }
  }

  try {
    // Check DynamoDB connection
    await dynamodb.send({ input: {} } as any)
    checks.checks.database = 'healthy'
  } catch (error) {
    checks.checks.database = 'unhealthy'
    checks.status = 'degraded'
  }

  return NextResponse.json(checks, {
    status: checks.status === 'healthy' ? 200 : 503
  })
}
EOF

echo -e "\n${GREEN}Step 6: Creating Uptime Monitor...${NC}"

# Create synthetic canary for uptime monitoring
cat > /tmp/canary-script.js << 'EOF'
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const apiCanaryBlueprint = async function () {
    const urls = [
        'https://app.podcastflow.pro/api/health',
        'https://api.podcastflow.pro/campaigns'
    ];
    
    for (const url of urls) {
        const response = await synthetics.executeHttpStep(
            `Check ${url}`,
            {
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (response.statusCode !== 200) {
            throw new Error(`${url} returned ${response.statusCode}`);
        }
    }
};

exports.handler = async () => {
    return await synthetics.runCanary(apiCanaryBlueprint);
};
EOF

echo -e "\n${GREEN}Monitoring setup complete!${NC}"
echo ""
echo "✅ SNS alerts topic created"
echo "✅ CloudWatch alarms configured"
echo "✅ Dashboard created: https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=PodcastFlowPro"
echo "✅ Log retention policies set"
echo "✅ Health check endpoint created"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Confirm your email subscription for alerts"
echo "2. Test the health endpoint: curl https://app.podcastflow.pro/api/health"
echo "3. View dashboard: aws cloudwatch get-dashboard --dashboard-name PodcastFlowPro"
echo "4. Consider adding Sentry for detailed error tracking"