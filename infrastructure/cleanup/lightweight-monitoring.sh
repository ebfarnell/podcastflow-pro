#!/bin/bash

# Lightweight monitoring script for PodcastFlow Pro development
# This script sets up basic health checks and notifications

REGION="us-east-1"
APP_URL="https://app.podcastflow.pro"
HEALTH_ENDPOINT="$APP_URL/api/health"
LOG_FILE="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/monitoring.log"

echo "=== Setting Up Lightweight Monitoring ==="
echo "Date: $(date)" | tee -a $LOG_FILE

# 1. Create CloudWatch Alarm for high Lambda errors (remaining functions)
echo "Creating CloudWatch alarms for remaining Lambda functions..." | tee -a $LOG_FILE

REMAINING_FUNCTIONS=(
    "podcastflow-api-analytics"
    "podcastflow-api-organization"
    "podcastflow-api-user"
    "podcastflow-users"
)

for func in "${REMAINING_FUNCTIONS[@]}"; do
    echo -n "Creating error alarm for $func... " | tee -a $LOG_FILE
    aws cloudwatch put-metric-alarm \
        --alarm-name "$func-errors" \
        --alarm-description "High error rate for $func Lambda" \
        --metric-name Errors \
        --namespace AWS/Lambda \
        --statistic Sum \
        --period 300 \
        --threshold 10 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 1 \
        --dimensions Name=FunctionName,Value=$func \
        --region $REGION 2>>$LOG_FILE && echo "✓" | tee -a $LOG_FILE || echo "✗" | tee -a $LOG_FILE
done

# 2. Create simple health check script
echo -e "\nCreating health check script..." | tee -a $LOG_FILE
cat > /home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.sh << 'EOF'
#!/bin/bash
# Simple health check script

APP_URL="https://app.podcastflow.pro"
HEALTH_ENDPOINT="$APP_URL/api/health"
LOG_FILE="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.log"

echo "[$(date)] Running health check..." >> $LOG_FILE

# Check application health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "[$(date)] ✓ Application is healthy (HTTP $HTTP_STATUS)" >> $LOG_FILE
else
    echo "[$(date)] ✗ Application health check failed (HTTP $HTTP_STATUS)" >> $LOG_FILE
    # Could add email notification here if needed
fi

# Check PM2 process
if pm2 status | grep -q "podcastflow-pro.*online"; then
    echo "[$(date)] ✓ PM2 process is running" >> $LOG_FILE
else
    echo "[$(date)] ✗ PM2 process is not running!" >> $LOG_FILE
    # Attempt restart
    pm2 restart podcastflow-pro
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$(date)] ⚠ Disk usage is high: $DISK_USAGE%" >> $LOG_FILE
fi

# Rotate log if too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt 10485760 ]; then
    mv $LOG_FILE $LOG_FILE.old
    echo "[$(date)] Log rotated" > $LOG_FILE
fi
EOF

chmod +x /home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.sh
echo "✓ Health check script created" | tee -a $LOG_FILE

# 3. Set up cron job for health checks
echo -e "\nSetting up cron job for health checks..." | tee -a $LOG_FILE
(crontab -l 2>/dev/null | grep -v "health-check.sh"; echo "*/5 * * * * /home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.sh") | crontab -
echo "✓ Cron job created (runs every 5 minutes)" | tee -a $LOG_FILE

# 4. Create cost monitoring script
echo -e "\nCreating cost monitoring script..." | tee -a $LOG_FILE
cat > /home/ec2-user/podcastflow-pro/infrastructure/cleanup/check-aws-costs.sh << 'EOF'
#!/bin/bash
# Check AWS costs for remaining resources

REGION="us-east-1"
LOG_FILE="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/cost-report.log"

echo "=== AWS Cost Report - $(date) ===" | tee $LOG_FILE

# Lambda costs (minimal with low invocations)
echo -e "\nRemaining Lambda Functions:" | tee -a $LOG_FILE
aws lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'podcast')].[FunctionName, MemorySize]" \
    --output table | tee -a $LOG_FILE

# CloudWatch Logs (main ongoing cost)
echo -e "\nCloudWatch Log Groups (Storage Cost):" | tee -a $LOG_FILE
aws logs describe-log-groups --region $REGION \
    --query "logGroups[?contains(logGroupName, 'podcastflow')].{Name: logGroupName, StoredBytes: storedBytes}" \
    --output table | tee -a $LOG_FILE

# API Gateway (minimal cost)
echo -e "\nAPI Gateway Status:" | tee -a $LOG_FILE
echo "API ID: 9uiib4zrdb (Stages: prod, production)" | tee -a $LOG_FILE
echo "Estimated cost: ~$3.50/month for REST API" | tee -a $LOG_FILE

echo -e "\n=== Estimated Monthly Costs ==="  | tee -a $LOG_FILE
echo "Lambda Functions: ~$0 (pay per invocation, minimal usage)" | tee -a $LOG_FILE
echo "CloudWatch Logs: ~$5-10 (depends on log retention)" | tee -a $LOG_FILE
echo "API Gateway: ~$3.50 (REST API)" | tee -a $LOG_FILE
echo "Total: ~$10-15/month" | tee -a $LOG_FILE

echo -e "\nNote: Main costs are from EC2 instance and RDS database (not Lambda)" | tee -a $LOG_FILE
EOF

chmod +x /home/ec2-user/podcastflow-pro/infrastructure/cleanup/check-aws-costs.sh
echo "✓ Cost monitoring script created" | tee -a $LOG_FILE

# 5. Run initial health check
echo -e "\nRunning initial health check..." | tee -a $LOG_FILE
/home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.sh

# 6. Display monitoring summary
echo -e "\n=== Monitoring Setup Complete ===" | tee -a $LOG_FILE
echo "1. CloudWatch alarms created for remaining Lambda functions" | tee -a $LOG_FILE
echo "2. Health check script runs every 5 minutes via cron" | tee -a $LOG_FILE
echo "3. Logs location: /home/ec2-user/podcastflow-pro/infrastructure/cleanup/" | tee -a $LOG_FILE
echo "4. To check costs: ./check-aws-costs.sh" | tee -a $LOG_FILE
echo "5. To check health: ./health-check.sh" | tee -a $LOG_FILE
echo "6. View cron jobs: crontab -l" | tee -a $LOG_FILE

echo -e "\n✅ Lightweight monitoring is now active!" | tee -a $LOG_FILE