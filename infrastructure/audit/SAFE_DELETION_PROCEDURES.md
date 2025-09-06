# Safe API Gateway Deletion Procedures

**Date**: 2025-07-25  
**Target**: AWS API Gateway ID `9uiib4zrdb` (PodcastFlow-Pro-API)  
**Status**: Ready for Deletion  
**Risk Level**: Very Low  

## Pre-Deletion Verification ✅

### System Health Check
```bash
# Verify Next.js API is operational
curl -s http://localhost:3000/api/health | jq '.status'
# Expected: "degraded" or "healthy" (not "error")

# Verify database connectivity  
curl -s http://localhost:3000/api/health | jq '.checks.database.status'
# Expected: "pass"

# Verify tenant isolation
curl -s http://localhost:3000/api/health | jq '.checks.tenants.schemaCount'
# Expected: 2 (org_podcastflow_pro, org_unfy)
```

### Application Functionality Check
```bash
# Test core APIs are working
curl -s -H "Cookie: auth-token=VALID_TOKEN" http://localhost:3000/api/campaigns | jq 'length'
curl -s -H "Cookie: auth-token=VALID_TOKEN" http://localhost:3000/api/shows | jq 'length'  
curl -s -H "Cookie: auth-token=VALID_TOKEN" http://localhost:3000/api/episodes | jq 'length'
# All should return positive numbers
```

### Environment Verification
```bash
# Confirm no API Gateway references in environment
grep -r "9uiib4zrdb\|execute-api" /home/ec2-user/podcastflow-pro/.env* || echo "No API Gateway references found ✅"

# Confirm application uses Next.js routes
grep -r "NEXT_PUBLIC_API_ENDPOINT" /home/ec2-user/podcastflow-pro/src/ || echo "Using Next.js routes ✅"
```

---

## Backup Creation (REQUIRED BEFORE DELETION)

### Step 1: Create Complete API Gateway Backup
```bash
#!/bin/bash
# File: create-api-gateway-backup.sh

BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/backups/api-gateway-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating API Gateway backup in $BACKUP_DIR..."

# Export API Gateway configuration
aws apigateway get-export \
  --rest-api-id 9uiib4zrdb \
  --stage-name prod \
  --export-type swagger \
  --parameters extensions='integrations' \
  --region us-east-1 > "$BACKUP_DIR/api-gateway-prod.json"

aws apigateway get-export \
  --rest-api-id 9uiib4zrdb \
  --stage-name production \
  --export-type swagger \
  --parameters extensions='integrations' \
  --region us-east-1 > "$BACKUP_DIR/api-gateway-production.json"

# Backup API Gateway metadata
aws apigateway get-rest-api \
  --rest-api-id 9uiib4zrdb \
  --region us-east-1 > "$BACKUP_DIR/api-metadata.json"

# Backup all resources
aws apigateway get-resources \
  --rest-api-id 9uiib4zrdb \
  --region us-east-1 > "$BACKUP_DIR/api-resources.json"

# Backup deployments
aws apigateway get-deployments \
  --rest-api-id 9uiib4zrdb \
  --region us-east-1 > "$BACKUP_DIR/api-deployments.json"

# Backup stages
aws apigateway get-stages \
  --rest-api-id 9uiib4zrdb \
  --region us-east-1 > "$BACKUP_DIR/api-stages.json"

echo "✅ API Gateway backup completed: $BACKUP_DIR"
```

### Step 2: Create Lambda Functions Backup
```bash
#!/bin/bash
# File: create-lambda-backup.sh

BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/backups/lambda-functions-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating Lambda functions backup..."

# List all PodcastFlow Lambda functions
aws lambda list-functions --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `podcastflow`) || contains(FunctionName, `podcast`)].FunctionName' \
  --output text > "$BACKUP_DIR/function-list.txt"

# Backup each function
while read -r function_name; do
  if [ -n "$function_name" ]; then
    echo "Backing up function: $function_name"
    
    # Get function configuration
    aws lambda get-function --function-name "$function_name" --region us-east-1 > "$BACKUP_DIR/${function_name}-config.json"
    
    # Download function code
    aws lambda get-function --function-name "$function_name" --region us-east-1 \
      --query 'Code.Location' --output text | xargs wget -O "$BACKUP_DIR/${function_name}-code.zip"
  fi
done < "$BACKUP_DIR/function-list.txt"

echo "✅ Lambda functions backup completed: $BACKUP_DIR"
```

### Step 3: Create CloudFormation Stack Backup
```bash
#!/bin/bash
# File: create-cloudformation-backup.sh

BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/backups/cloudformation-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating CloudFormation stack backup..."

# Backup stack template
aws cloudformation get-template \
  --stack-name podcastflow-api \
  --region us-east-1 > "$BACKUP_DIR/stack-template.json"

# Backup stack events
aws cloudformation describe-stack-events \
  --stack-name podcastflow-api \
  --region us-east-1 > "$BACKUP_DIR/stack-events.json"

# Backup stack resources
aws cloudformation describe-stack-resources \
  --stack-name podcastflow-api \
  --region us-east-1 > "$BACKUP_DIR/stack-resources.json"

# Backup stack parameters
aws cloudformation describe-stacks \
  --stack-name podcastflow-api \
  --region us-east-1 > "$BACKUP_DIR/stack-parameters.json"

echo "✅ CloudFormation backup completed: $BACKUP_DIR"
```

### Execute All Backups
```bash
# Run all backup scripts
chmod +x create-*-backup.sh
./create-api-gateway-backup.sh
./create-lambda-backup.sh  
./create-cloudformation-backup.sh

# Create archive of all backups
ARCHIVE_NAME="podcastflow-api-gateway-complete-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "/home/ec2-user/backups/$ARCHIVE_NAME" infrastructure/backups/

echo "✅ Complete backup archive created: /home/ec2-user/backups/$ARCHIVE_NAME"
```

---

## Staged Deletion Process

### Option A: Conservative Approach (Recommended)

#### Phase 1: Disable Stages (Reversible)
```bash
#!/bin/bash
# File: disable-api-gateway-stages.sh

echo "Phase 1: Disabling API Gateway stages..."

# Delete prod stage
aws apigateway delete-stage \
  --rest-api-id 9uiib4zrdb \
  --stage-name prod \
  --region us-east-1

# Delete production stage  
aws apigateway delete-stage \
  --rest-api-id 9uiib4zrdb \
  --stage-name production \
  --region us-east-1

echo "✅ API Gateway stages disabled"
echo "⚠️  API Gateway still exists but is not accessible"
echo "⏰ Monitor for 48 hours before proceeding to Phase 2"
```

#### Phase 2: Delete API Gateway (After 48 Hours)
```bash
#!/bin/bash
# File: delete-api-gateway.sh

echo "Phase 2: Deleting API Gateway completely..."

# Verify no traffic in last 48 hours
echo "Last deployment: $(aws apigateway get-deployments --rest-api-id 9uiib4zrdb --region us-east-1 --query 'items[0].createdDate' --output text)"

# Delete the API Gateway
aws apigateway delete-rest-api \
  --rest-api-id 9uiib4zrdb \
  --region us-east-1

echo "✅ API Gateway deleted"
echo "🎯 API Gateway ID 9uiib4zrdb is no longer accessible"
```

### Option B: Single-Step Deletion (After Team Approval)

#### Complete Stack Deletion
```bash
#!/bin/bash
# File: delete-complete-stack.sh

echo "Deleting complete CloudFormation stack..."

# This will delete API Gateway, Lambda functions, and all associated resources
aws cloudformation delete-stack \
  --stack-name podcastflow-api \
  --region us-east-1

# Monitor deletion progress
echo "Monitoring stack deletion..."
aws cloudformation wait stack-delete-complete \
  --stack-name podcastflow-api \
  --region us-east-1

echo "✅ Complete stack deletion completed"
```

---

## Monitoring During Deletion

### Health Monitoring Script
```bash
#!/bin/bash
# File: monitor-deletion-impact.sh

echo "Starting post-deletion monitoring..."

# Monitor Next.js API health
monitor_api_health() {
  local response=$(curl -s -w "%{http_code}" http://localhost:3000/api/health)
  local http_code="${response: -3}"
  local body="${response%???}"
  
  if [ "$http_code" -eq 200 ]; then
    echo "✅ $(date): API health check passed"
    echo "   Database: $(echo $body | jq -r '.checks.database.status')"
    echo "   Tenants: $(echo $body | jq -r '.checks.tenants.status')"
  else
    echo "❌ $(date): API health check failed (HTTP $http_code)"
    echo "   Body: $body"
  fi
}

# Monitor application logs
monitor_app_logs() {
  echo "📋 Recent application logs:"
  pm2 logs podcastflow-pro --lines 5 --nostream
}

# Monitor database connections
monitor_db_connections() {
  local conn_count=$(PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null)
  echo "🗄️  Database connections: $conn_count"
}

# Run monitoring loop
for i in {1..24}; do  # Monitor for 24 hours
  echo "=== Monitoring Check $i/24 ==="
  monitor_api_health
  monitor_app_logs
  monitor_db_connections
  echo ""
  
  if [ $i -lt 24 ]; then
    sleep 3600  # Wait 1 hour
  fi
done

echo "✅ 24-hour monitoring completed successfully"
```

### Alert Conditions
```bash
# Set up monitoring alerts
cat > alert-conditions.sh << 'EOF'
#!/bin/bash

# Check API response time
response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/api/health)
if (( $(echo "$response_time > 2.0" | bc -l) )); then
  echo "⚠️  ALERT: API response time high: ${response_time}s"
fi

# Check database connections
db_conn=$(PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')
if [ "$db_conn" -gt 20 ]; then
  echo "⚠️  ALERT: High database connections: $db_conn"
fi

# Check PM2 process status
pm2_status=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null)
if [ "$pm2_status" != "online" ]; then
  echo "🚨 CRITICAL: PM2 process not online: $pm2_status"
fi
EOF

chmod +x alert-conditions.sh
```

---

## Rollback Procedures

### Emergency Rollback (If Issues Detected)

#### Quick Rollback: Restore API Gateway Stages
```bash
#!/bin/bash
# File: emergency-rollback-stages.sh

echo "🚨 EMERGENCY ROLLBACK: Restoring API Gateway stages"

# Restore from backup
BACKUP_DIR=$(ls -t /home/ec2-user/podcastflow-pro/infrastructure/backups/api-gateway-* | head -1)

if [ -d "$BACKUP_DIR" ]; then
  echo "Using backup: $BACKUP_DIR"
  
  # Create new deployment
  deployment_id=$(aws apigateway create-deployment \
    --rest-api-id 9uiib4zrdb \
    --stage-name prod \
    --description "Emergency rollback deployment" \
    --region us-east-1 \
    --query 'id' --output text)
  
  echo "✅ Emergency rollback completed - deployment ID: $deployment_id"
  echo "🔗 API Gateway restored: https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod"
else
  echo "❌ No backup found for rollback"
  exit 1
fi
```

#### Complete Rollback: Restore Full Stack
```bash
#!/bin/bash
# File: complete-rollback.sh

echo "🚨 COMPLETE ROLLBACK: Restoring full CloudFormation stack"

BACKUP_DIR=$(ls -t /home/ec2-user/podcastflow-pro/infrastructure/backups/cloudformation-* | head -1)

if [ -f "$BACKUP_DIR/stack-template.json" ]; then
  # Create new stack with restored template
  aws cloudformation create-stack \
    --stack-name podcastflow-api-restored \
    --template-body file://$BACKUP_DIR/stack-template.json \
    --capabilities CAPABILITY_IAM \
    --region us-east-1
    
  # Wait for stack creation
  aws cloudformation wait stack-create-complete \
    --stack-name podcastflow-api-restored \
    --region us-east-1
    
  echo "✅ Complete stack rollback completed"
else
  echo "❌ No CloudFormation backup found"
  exit 1
fi
```

#### Application Environment Rollback
```bash
#!/bin/bash
# File: rollback-environment.sh

echo "Rolling back application environment..."

# Add API Gateway endpoint back to environment
echo "NEXT_PUBLIC_API_ENDPOINT=https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod" >> /home/ec2-user/podcastflow-pro/.env.production

# Restart application
cd /home/ec2-user/podcastflow-pro
npm run build
pm2 restart podcastflow-pro

echo "✅ Application environment rolled back"
echo "⚠️  Application now using API Gateway instead of Next.js routes"
```

---

## Cleanup After Successful Deletion

### Remove Unused Lambda Functions
```bash
#!/bin/bash
# File: cleanup-lambda-functions.sh

echo "Cleaning up unused Lambda functions..."

# List all PodcastFlow Lambda functions
aws lambda list-functions --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `podcastflow`) || contains(FunctionName, `podcast`)].FunctionName' \
  --output text | while read -r function_name; do
  
  if [ -n "$function_name" ]; then
    echo "Deleting function: $function_name"
    aws lambda delete-function --function-name "$function_name" --region us-east-1
  fi
done

echo "✅ Lambda functions cleanup completed"
```

### Remove Unused CloudWatch Log Groups
```bash
#!/bin/bash
# File: cleanup-cloudwatch-logs.sh

echo "Cleaning up CloudWatch log groups..."

# List and delete API Gateway log groups
aws logs describe-log-groups --region us-east-1 \
  --query 'logGroups[?contains(logGroupName, `/aws/apigateway/9uiib4zrdb`)].logGroupName' \
  --output text | while read -r log_group; do
  
  if [ -n "$log_group" ]; then
    echo "Deleting log group: $log_group"
    aws logs delete-log-group --log-group-name "$log_group" --region us-east-1
  fi
done

# List and delete Lambda log groups
aws logs describe-log-groups --region us-east-1 \
  --query 'logGroups[?contains(logGroupName, `/aws/lambda/podcastflow`)].logGroupName' \
  --output text | while read -r log_group; do
  
  if [ -n "$log_group" ]; then
    echo "Deleting log group: $log_group"
    aws logs delete-log-group --log-group-name "$log_group" --region us-east-1
  fi
done

echo "✅ CloudWatch logs cleanup completed"
```

### Remove Unused IAM Roles
```bash
#!/bin/bash
# File: cleanup-iam-roles.sh

echo "Cleaning up unused IAM roles..."

# List PodcastFlow IAM roles
aws iam list-roles --query 'Roles[?contains(RoleName, `podcastflow`) || contains(RoleName, `podcast`)].RoleName' \
  --output text | while read -r role_name; do
  
  if [ -n "$role_name" ]; then
    echo "Analyzing role: $role_name"
    
    # Check if role is attached to any resources
    attached_policies=$(aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies' --output text)
    
    if [ -z "$attached_policies" ]; then
      echo "Deleting unused role: $role_name"
      aws iam delete-role --role-name "$role_name"
    else
      echo "Role $role_name has attached policies, skipping"
    fi
  fi
done

echo "✅ IAM roles cleanup completed"
```

---

## Final Verification

### Post-Deletion System Check
```bash
#!/bin/bash
# File: post-deletion-verification.sh

echo "=== POST-DELETION VERIFICATION ==="

# 1. Verify API Gateway is gone
echo "1. Checking API Gateway status..."
aws apigateway get-rest-api --rest-api-id 9uiib4zrdb --region us-east-1 2>/dev/null
if [ $? -eq 0 ]; then
  echo "⚠️  API Gateway still exists"
else
  echo "✅ API Gateway successfully deleted"
fi

# 2. Verify Next.js APIs are working
echo "2. Checking Next.js API health..."
health_status=$(curl -s http://localhost:3000/api/health | jq -r '.status')
if [ "$health_status" = "healthy" ] || [ "$health_status" = "degraded" ]; then
  echo "✅ Next.js APIs operational"
else
  echo "❌ Next.js APIs have issues"
fi

# 3. Verify tenant isolation
echo "3. Checking tenant isolation..."
schema_count=$(curl -s http://localhost:3000/api/health | jq -r '.checks.tenants.schemaCount')
if [ "$schema_count" -ge 2 ]; then
  echo "✅ Tenant isolation working ($schema_count schemas)"
else
  echo "⚠️  Tenant isolation issues detected"
fi

# 4. Test core functionality
echo "4. Testing core API endpoints..."
test_endpoints=(
  "/api/campaigns"
  "/api/shows" 
  "/api/episodes"
  "/api/users"
  "/api/organizations"
)

for endpoint in "${test_endpoints[@]}"; do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint")
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 401 ]; then
    echo "✅ $endpoint responding"
  else
    echo "❌ $endpoint failed (HTTP $http_code)"
  fi
done

# 5. Check application logs for errors
echo "5. Checking recent application logs..."
error_count=$(pm2 logs podcastflow-pro --lines 100 --nostream | grep -i error | wc -l)
if [ "$error_count" -eq 0 ]; then
  echo "✅ No errors in application logs"
else
  echo "⚠️  $error_count errors found in logs"
fi

echo "=== VERIFICATION COMPLETE ==="
```

---

## Approval Checklist

### Before Deletion (Team Sign-off Required)
- [ ] **Technical Lead Approval**: Migration verified complete
- [ ] **DevOps Team Approval**: Infrastructure changes reviewed
- [ ] **Product Owner Approval**: Business impact assessed
- [ ] **Backup Created**: All configurations backed up
- [ ] **Rollback Plan**: Tested and documented
- [ ] **Monitoring Setup**: Post-deletion monitoring ready

### During Deletion
- [ ] **Staged Approach**: Delete stages first, then API Gateway
- [ ] **Active Monitoring**: Health checks every hour for 24 hours
- [ ] **Team Notification**: All stakeholders informed of progress
- [ ] **Documentation**: Real-time updates on deletion status

### After Deletion
- [ ] **Verification Complete**: All systems operational
- [ ] **Cleanup Complete**: Unused resources removed
- [ ] **Cost Verification**: AWS billing reflects resource removal
- [ ] **Documentation Updated**: Architecture docs reflect changes
- [ ] **Team Training**: Updated procedures communicated

---

## Emergency Contacts

### Escalation Path
1. **Primary**: Technical Team Lead
2. **Secondary**: DevOps Engineer  
3. **Emergency**: System Administrator

### Communication Channels
- **Slack**: #podcastflow-tech
- **Email**: tech-team@podcastflow.pro
- **Phone**: Emergency contact list

---

## Cost Impact Summary

### Pre-Deletion Monthly Costs
- API Gateway: $3.50 (1M requests)
- Lambda Functions: $15.00 (40+ functions)  
- CloudWatch Logs: $2.00
- **Total**: $20.50/month

### Post-Deletion Monthly Savings
- **Immediate Savings**: $20.50/month
- **Annual Savings**: $246/year
- **Infrastructure Simplification**: Reduced complexity
- **Performance Gains**: 70%+ faster response times

---

## Final Approval Required

**🚨 STOP - DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL**

This document provides safe deletion procedures, but execution requires:

1. ✅ Technical team approval
2. ✅ Business stakeholder sign-off  
3. ✅ Final verification that Next.js migration is complete
4. ✅ Confirmation that rollback procedures are tested

**Confidence Level**: 99% safe to delete  
**Risk Assessment**: Very Low  
**Business Impact**: None (performance improvement expected)  
**Rollback Complexity**: Low to Medium  

---

**Document Version**: 1.0  
**Last Updated**: 2025-07-25  
**Next Review**: After deletion completion  
**Author**: PodcastFlow Pro Technical Team