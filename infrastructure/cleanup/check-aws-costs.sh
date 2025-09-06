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
