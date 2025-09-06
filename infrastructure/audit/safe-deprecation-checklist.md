# Safe Deprecation Checklist for PodcastFlow Pro
Date: 2025-07-25

## Pre-Deprecation Checklist

### 1. Backup Everything
- [ ] Create full AWS account backup using AWS Backup
- [ ] Export all Lambda function code and configurations
- [ ] Backup DynamoDB tables to S3
- [ ] Document all resource ARNs being removed
- [ ] Save API Gateway configuration export
- [ ] Create EC2 snapshot of current application state

### 2. Verify Current State
- [ ] Confirm application works without issues
- [ ] Check error logs are clean
- [ ] Document current monthly AWS costs
- [ ] Take screenshots of CloudWatch dashboards
- [ ] Note current API response times

## Phase 1: CloudWatch Logs Cleanup (No Risk)

### Empty Log Groups to Delete:
```bash
# List empty log groups
aws logs describe-log-groups --region us-east-1 \
  --query "logGroups[?storedBytes==\`0\`].logGroupName" \
  --output text

# Delete each empty log group
aws logs delete-log-group --log-group-name <LOG_GROUP_NAME> --region us-east-1
```

### Checklist:
- [ ] List all empty log groups
- [ ] Verify they haven't been written to recently
- [ ] Delete log groups one by one
- [ ] Verify no new errors in application

## Phase 2: API Gateway Cleanup (Low Risk)

### Endpoints to Remove:
```bash
# For each endpoint, get resource ID first
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id 9uiib4zrdb \
  --region us-east-1 --query "items[?path=='<PATH>'].id" --output text)

# Remove methods
aws apigateway delete-method --rest-api-id 9uiib4zrdb \
  --resource-id $RESOURCE_ID --http-method GET --region us-east-1

# Remove resource
aws apigateway delete-resource --rest-api-id 9uiib4zrdb \
  --resource-id $RESOURCE_ID --region us-east-1

# Deploy changes
aws apigateway create-deployment --rest-api-id 9uiib4zrdb \
  --stage-name prod --description "Removed unused endpoints" --region us-east-1
```

### Endpoints List:
- [ ] /ad-approvals (and /ad-approvals/{id})
- [ ] /ad-copy (and /ad-copy/{id})
- [ ] /advertisers (and /advertisers/{id})
- [ ] /agencies (and /agencies/{id})
- [ ] /availability (and /availability/{id})
- [ ] /contracts (and /contracts/{id})
- [ ] /episodes (and /episodes/{id}, /episodes/stats)
- [ ] /financials (and /financials/{id})
- [ ] /insertion-orders (and /insertion-orders/{id})
- [ ] /reports (and /reports/{id})
- [ ] /shows (and /shows/{id}, /shows/stats)
- [ ] /backups
- [ ] /team
- [ ] /api-webhooks

### Verification:
- [ ] Test each endpoint returns 404
- [ ] Check application still works
- [ ] Monitor error logs for 1 hour
- [ ] No increase in error rate

## Phase 3: Lambda Function Cleanup (Medium Risk)

### For Each Unused Lambda:

#### 1. Backup Function:
```bash
# Download function code
aws lambda get-function --function-name <FUNCTION_NAME> \
  --region us-east-1 --query Code.Location --output text | \
  xargs wget -O <FUNCTION_NAME>.zip

# Export configuration
aws lambda get-function-configuration --function-name <FUNCTION_NAME> \
  --region us-east-1 > <FUNCTION_NAME>-config.json
```

#### 2. Delete Function:
```bash
# Delete the function
aws lambda delete-function --function-name <FUNCTION_NAME> --region us-east-1

# Delete associated log group
aws logs delete-log-group \
  --log-group-name /aws/lambda/<FUNCTION_NAME> --region us-east-1
```

### Functions to Remove (in order):
- [ ] PodcastFlowPro-APIWebhooks
- [ ] PodcastFlowPro-Ad-Approvals
- [ ] PodcastFlowPro-Ad-Copy
- [ ] PodcastFlowPro-Advertisers
- [ ] PodcastFlowPro-Agencies
- [ ] PodcastFlowPro-Availability
- [ ] PodcastFlowPro-Backup
- [ ] PodcastFlowPro-Billing
- [ ] PodcastFlowPro-Contracts
- [ ] PodcastFlowPro-Episodes
- [ ] PodcastFlowPro-Financials
- [ ] PodcastFlowPro-Insertion-Orders
- [ ] PodcastFlowPro-Reports
- [ ] PodcastFlowPro-Security
- [ ] PodcastFlowPro-Shows
- [ ] PodcastFlowPro-Team
- [ ] All PodcastFlowPro-PodcastFlowPro-* variants (31 functions)

### Post-Deletion:
- [ ] Verify application functionality
- [ ] Check for any 502/503 errors
- [ ] Monitor for 4 hours
- [ ] Check AWS Lambda console is cleaner

## Phase 4: DynamoDB Cleanup (Higher Risk)

### 1. Backup Tables:
```bash
# Create on-demand backup
aws dynamodb create-backup --table-name <TABLE_NAME> \
  --backup-name <TABLE_NAME>-final-backup-$(date +%Y%m%d) \
  --region us-east-1

# Export to S3
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:590183844530:table/<TABLE_NAME> \
  --s3-bucket podcastflow-backups-590183844530 \
  --s3-prefix dynamodb-exports/<TABLE_NAME>
```

### 2. Delete Tables:
```bash
# Delete table
aws dynamodb delete-table --table-name <TABLE_NAME> --region us-east-1
```

### Tables to Review:
- [ ] PodcastFlowPro (verify not used)
- [ ] podcastflow-pro (verify not used)
- [ ] WebSocketConnections (check if WebSocket is used)
- [ ] WebSocketSubscriptions (check if WebSocket is used)

## Phase 5: IAM Role Cleanup

### After Lambda Deletion:
```bash
# Delete unused role
aws iam delete-role --role-name PodcastFlowProLambdaRole

# First, detach all policies
aws iam list-attached-role-policies --role-name PodcastFlowProLambdaRole
aws iam detach-role-policy --role-name PodcastFlowProLambdaRole \
  --policy-arn <POLICY_ARN>
```

## Post-Cleanup Verification

### Immediate (0-1 hour):
- [ ] Application loads without errors
- [ ] All user roles can log in
- [ ] Core features work (dashboard, campaigns, shows)
- [ ] No 500/502/503 errors
- [ ] PM2 process stable

### Short-term (1-24 hours):
- [ ] Monitor CloudWatch for new errors
- [ ] Check user feedback/complaints
- [ ] Verify all Next.js API routes responding
- [ ] Database queries working normally
- [ ] No performance degradation

### Long-term (1-7 days):
- [ ] AWS bill shows cost reduction
- [ ] No unexpected errors in logs
- [ ] Application performance improved
- [ ] No customer complaints
- [ ] Team productivity unaffected

## Rollback Procedures

### If Lambda Removal Causes Issues:
1. Recreate Lambda from backup zip
2. Use saved configuration JSON
3. Recreate API Gateway integration
4. Deploy API Gateway changes

### If DynamoDB Removal Causes Issues:
1. Restore from on-demand backup
2. Or recreate table and import from S3 export
3. Update any environment variables
4. Restart application

### Emergency Commands:
```bash
# Quick rollback of API Gateway
aws apigateway create-deployment --rest-api-id 9uiib4zrdb \
  --stage-name prod --description "Emergency rollback" \
  --canary-settings percentTraffic=0.0 --region us-east-1

# Restart application
pm2 restart podcastflow-pro

# Check application logs
pm2 logs podcastflow-pro --lines 100
```

## Contact Information

### During Cleanup:
- AWS Support Case: [Create before starting]
- Team Lead: [Contact info]
- On-call Engineer: [Contact info]

### Escalation Path:
1. Check PM2 logs
2. Check CloudWatch Logs
3. Rollback affected phase
4. Contact team lead
5. Open AWS Support case

---
Remember: Take it slow, verify each step, and don't hesitate to pause if anything seems wrong.