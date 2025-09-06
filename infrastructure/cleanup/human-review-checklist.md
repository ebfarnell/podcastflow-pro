# Human Review Checklist for Uncertain Resources
Date: 2025-07-25

## CRITICAL: Resources Requiring Human Review Before Deletion

### 1. WebSocket Infrastructure
**Resources:**
- Lambda: `podcastflow-websocket-handler` (0 invocations in 7 days)
- DynamoDB: `WebSocketConnections`
- DynamoDB: `WebSocketSubscriptions`
- IAM Role: `podcastflow-websocket-stack-WebSocketLambdaRole-*`

**Review Questions:**
- [ ] Is real-time functionality currently used in the application?
- [ ] Are there any chat, live updates, or notification features that depend on WebSocket?
- [ ] Check frontend code: `grep -r "WebSocket\|ws://" src/`
- [ ] Are any clients using real-time features?
- [ ] Future plans for real-time features?

**Recommended Actions:**
- [ ] Search codebase for WebSocket connections
- [ ] Check with product team about real-time features
- [ ] Review client contracts for real-time SLAs
- [ ] Test notification systems

### 2. Low-Activity Lambda Functions (1-14 invocations)
**Functions with Recent Activity:**
```
PodcastFlowPro-PodcastFlowPro-clients (1 invocation)
podcastflow-api-analytics (3 invocations)
podcastflow-users (3 invocations)
podcastflow-api-organization (9 invocations)
podcastflow-api-user (9 invocations)
PodcastFlowPro-PodcastFlowPro-users (14 invocations)
```

**Review Questions for Each:**
- [ ] What triggered these invocations in the last 7 days?
- [ ] Are these being phased out or still actively used?
- [ ] Check CloudWatch Logs for invocation patterns
- [ ] Are these called by scheduled tasks or user actions?
- [ ] Dependencies in codebase: `grep -r "function-name" src/`

**Investigation Commands:**
```bash
# Check invocation patterns
aws logs tail /aws/lambda/FUNCTION_NAME --since 7d --region us-east-1

# Check what's calling the function
aws logs filter-log-events --log-group-name /aws/lambda/FUNCTION_NAME \
  --filter-pattern "START RequestId" --start-time $(date -d '7 days ago' +%s)000
```

### 3. API Gateway Endpoints with Minimal Traffic
**Review These Endpoints:**
- `/organization` endpoints (tied to active Lambda)
- `/users` endpoints (tied to active Lambda)
- `/campaigns` endpoints (tied to active Lambda)

**Questions:**
- [ ] Are these legacy endpoints still needed?
- [ ] Do any external integrations use these?
- [ ] Check API keys and usage plans
- [ ] Review any documentation mentioning these endpoints

### 4. DynamoDB Tables
**Tables to Review:**
- `PodcastFlowPro` - Legacy table
- `podcastflow-pro` - Legacy table

**Questions:**
- [ ] Last write timestamp?
- [ ] Any critical data not migrated to PostgreSQL?
- [ ] Backup verification before deletion?
- [ ] Check for any Lambda functions reading these tables

**Verification Commands:**
```bash
# Check table metrics
aws cloudwatch get-metric-statistics --namespace AWS/DynamoDB \
  --metric-name UserErrors --dimensions Name=TableName,Value=TABLE_NAME \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 86400 --statistics Sum

# Scan for recent items
aws dynamodb scan --table-name TABLE_NAME --limit 10 \
  --projection-expression "updatedAt,createdAt,#t" \
  --expression-attribute-names '{"#t":"type"}'
```

### 5. S3 Buckets
**Buckets to Review:**
- `podcastflow-deployments-1751349654` - Old deployments
- `podcastflow-lambda-deployments` - Lambda deployments
- `podcastflow` - General bucket

**Questions:**
- [ ] Any critical deployment artifacts?
- [ ] Historical data needed for compliance?
- [ ] Check bucket policies and access logs
- [ ] Size and cost of storage?

### 6. Marketing Analytics Resources
**Unknown Resources Found:**
- Multiple `MarketingAnalytics-*` Lambda functions
- Associated log groups and IAM roles

**Questions:**
- [ ] Different project or related to PodcastFlow?
- [ ] Check AWS account for other projects
- [ ] Who owns these resources?
- [ ] Safe to ignore in this cleanup?

## Special Investigation Required

### For Each Resource with 1+ Invocations:

1. **Check CloudWatch Insights:**
```
fields @timestamp, @message
| filter @message like /START RequestId/
| stats count() by bin(1d)
```

2. **Trace Invocation Source:**
```bash
# Get X-Ray traces if available
aws xray get-trace-summaries --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --region us-east-1
```

3. **Check Scheduled Events:**
```bash
# List CloudWatch Events rules
aws events list-rules --region us-east-1 | grep -B2 -A2 "FUNCTION_NAME"
```

## Stakeholder Questions

### Technical Team:
- [ ] Any undocumented dependencies on these resources?
- [ ] Scheduled jobs or cron tasks using these endpoints?
- [ ] Third-party integrations we should check?
- [ ] Any disaster recovery procedures using these resources?

### Product Team:
- [ ] Features planned that might need these resources?
- [ ] Any client-specific customizations using legacy endpoints?
- [ ] Historical data retention requirements?

### DevOps Team:
- [ ] Monitoring or alerting dependent on these resources?
- [ ] Backup/restore procedures using these resources?
- [ ] CI/CD pipelines referencing these resources?

## Verification Before Proceeding

### Must Complete Before Any Deletion:
1. [ ] All questions above answered
2. [ ] Stakeholder sign-off received
3. [ ] Test environment verified without these resources
4. [ ] Backup integrity confirmed
5. [ ] Rollback plan tested
6. [ ] Communication sent to all parties

### Risk Assessment:
- **WebSocket Resources**: HIGH RISK - May affect real-time features
- **Active Lambda Functions**: MEDIUM RISK - Still receiving traffic
- **Legacy DynamoDB Tables**: LOW RISK - If data migrated
- **Empty Log Groups**: NO RISK - Safe to delete
- **Unused Lambda Functions**: LOW RISK - No recent invocations

## Sign-Off Required

Before proceeding with deletion of reviewed resources:

- Technical Lead: _________________ Date: _______
- Product Owner: _________________ Date: _______
- DevOps Lead: __________________ Date: _______
- Client Success: ________________ Date: _______

## Notes Section

Use this space to document findings:

```
Resource: _______________
Finding: _______________
Decision: [ ] Keep [ ] Delete [ ] Monitor
Reason: _______________
```