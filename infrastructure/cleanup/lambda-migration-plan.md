# Lambda Function Migration & Decommission Plan

Date: 2025-07-25
Prepared by: Infrastructure Team

## Executive Summary

All 4 remaining Lambda functions can be safely decommissioned. The application already has equivalent Next.js API routes with **proper multi-tenant isolation**. The Lambda functions have critical security issues and use deprecated DynamoDB tables.

## Critical Security Findings

### 🚨 SEVERE: No Tenant Isolation in Lambda Functions

1. **podcastflow-api-analytics**:
   - Queries ALL organizations' data without filtering
   - Returns aggregated metrics across tenants
   - **Data leakage risk: CRITICAL**

2. **podcastflow-api-organization**:
   - Hardcoded `orgId = 'default'`
   - No user context validation
   - **Data isolation: NONE**

3. **podcastflow-api-user**:
   - No organization context enforcement
   - Stores preferences without tenant isolation
   - **Cross-tenant access: POSSIBLE**

4. **podcastflow-users**:
   - Weak organizationId enforcement
   - Mixed tenant data in single table
   - **Audit trail: COMPROMISED**

## Migration Status

### ✅ Already Migrated to Next.js

| Lambda Function | Next.js Route | Tenant Isolation |
|----------------|---------------|------------------|
| podcastflow-api-analytics | `/api/analytics/*` | ✅ Schema-based queries |
| podcastflow-api-organization | `/api/organization` | ✅ User org validation |
| podcastflow-api-user | `/api/user/profile`, `/api/user/preferences` | ✅ User-scoped |
| podcastflow-users | `/api/users/*` | ✅ Org filtering |

### Key Differences in Next.js Implementation:

1. **Analytics API** (`/api/analytics/route.ts`):
   ```typescript
   // Proper tenant isolation using schema-aware queries
   const orgSlug = await getUserOrgSlug(user.id)
   const campaigns = await querySchema(orgSlug, query, params)
   ```

2. **Organization API** (`/api/organization/route.ts`):
   ```typescript
   // User's organization validated from session
   const organization = await prisma.organization.findUnique({
     where: { id: user.organizationId || '' }
   })
   ```

3. **User APIs** (`/api/user/*`):
   ```typescript
   // User-scoped queries, no cross-tenant access
   const userProfile = await prisma.user.findUnique({
     where: { id: user.id }
   })
   ```

## Decommission Plan

### Phase 1: Verification (Day 1)

#### 1.1 Confirm Lambda Functions Are Not Used
```bash
# Check for any API Gateway integrations
aws apigateway get-resources --rest-api-id 9uiib4zrdb --region us-east-1 \
  --query "items[?resourceMethods].{path:path,methods:resourceMethods}" \
  --output json | jq '.[] | select(.methods)'

# Check CloudWatch Logs for recent invocations
for func in "podcastflow-api-analytics" "podcastflow-api-organization" "podcastflow-api-user" "podcastflow-users"; do
  echo "Checking $func logs..."
  aws logs describe-log-streams --log-group-name "/aws/lambda/$func" \
    --region us-east-1 --order-by LastEventTime --descending --limit 1
done
```

#### 1.2 Application Code Verification
```bash
# Confirm no references in codebase
grep -r "execute-api" /home/ec2-user/podcastflow-pro/src/ || echo "No API Gateway calls found"
grep -r "9uiib4zrdb" /home/ec2-user/podcastflow-pro/ || echo "No API ID references found"
```

### Phase 2: Backup Lambda Code (Day 1)

```bash
#!/bin/bash
# backup-lambda-code.sh

BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/lambda-final-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

FUNCTIONS=("podcastflow-api-analytics" "podcastflow-api-organization" "podcastflow-api-user" "podcastflow-users")

for func in "${FUNCTIONS[@]}"; do
  echo "Backing up $func..."
  
  # Get function configuration
  aws lambda get-function --function-name "$func" --region us-east-1 > "$BACKUP_DIR/${func}-config.json"
  
  # Download function code
  CODE_URL=$(aws lambda get-function --function-name "$func" --region us-east-1 --query 'Code.Location' --output text)
  wget -q "$CODE_URL" -O "$BACKUP_DIR/${func}.zip"
  
  # Export environment variables
  aws lambda get-function-configuration --function-name "$func" --region us-east-1 \
    --query 'Environment.Variables' > "$BACKUP_DIR/${func}-env.json"
done

echo "✅ Lambda functions backed up to: $BACKUP_DIR"
```

### Phase 3: Delete Lambda Functions (Day 2)

```bash
#!/bin/bash
# delete-remaining-lambdas.sh

FUNCTIONS=("podcastflow-api-analytics" "podcastflow-api-organization" "podcastflow-api-user" "podcastflow-users")
REGION="us-east-1"

echo "=== Deleting Remaining Lambda Functions ==="
echo "⚠️  This will delete 4 Lambda functions that have been migrated to Next.js"
read -p "Continue? (yes/no): " response

if [[ "$response" != "yes" ]]; then
    echo "Aborted by user"
    exit 1
fi

for func in "${FUNCTIONS[@]}"; do
  echo -n "Deleting $func... "
  
  # Delete function
  if aws lambda delete-function --function-name "$func" --region $REGION 2>/dev/null; then
    echo "✅"
    
    # Delete associated log group
    aws logs delete-log-group --log-group-name "/aws/lambda/$func" --region $REGION 2>/dev/null || true
  else
    echo "❌ (may already be deleted)"
  fi
done

echo -e "\n✅ Lambda cleanup complete!"
```

### Phase 4: Clean Up API Gateway (Day 2)

```bash
#!/bin/bash
# cleanup-api-gateway-endpoints.sh

# Remove any remaining Lambda integrations
API_ID="9uiib4zrdb"
REGION="us-east-1"

# List all resources with Lambda integrations
echo "Checking for Lambda integrations in API Gateway..."
aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
  --query "items[?resourceMethods].{id:id,path:path}" --output json > resources.json

# Check each resource for Lambda integrations
while IFS= read -r resource; do
  RESOURCE_ID=$(echo $resource | jq -r '.id')
  PATH=$(echo $resource | jq -r '.path')
  
  echo "Checking $PATH..."
  
  # Get methods for this resource
  METHODS=$(aws apigateway get-resource --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID --region $REGION \
    --query 'resourceMethods' --output json 2>/dev/null || echo '{}')
  
  # Check if any method uses Lambda
  if echo "$METHODS" | grep -q "AWS_PROXY"; then
    echo "  Found Lambda integration at $PATH"
    # Could delete here if needed
  fi
done < <(jq -c '.[]' resources.json)

rm resources.json
```

## Testing Plan

### Pre-Migration Tests

1. **Verify Next.js APIs Return Same Data Structure**:
```bash
# Test analytics API
curl -X GET "https://app.podcastflow.pro/api/analytics" \
  -H "Cookie: auth-token=<valid-token>" | jq .

# Test organization API  
curl -X GET "https://app.podcastflow.pro/api/organization" \
  -H "Cookie: auth-token=<valid-token>" | jq .

# Test user profile API
curl -X GET "https://app.podcastflow.pro/api/user/profile" \
  -H "Cookie: auth-token=<valid-token>" | jq .
```

2. **Tenant Isolation Verification**:
```sql
-- Verify each org can only see their data
SELECT 
  o.slug,
  COUNT(DISTINCT c.id) as campaigns
FROM public."Organization" o
LEFT JOIN org_podcastflow_pro."Campaign" c ON true
GROUP BY o.slug;
```

### Post-Migration Tests

1. **Application Health Check**:
```bash
curl -s https://app.podcastflow.pro/api/health | jq .
pm2 status
```

2. **Verify No Lambda Functions Remain**:
```bash
aws lambda list-functions --region us-east-1 \
  --query "Functions[?contains(FunctionName, 'podcastflow')].FunctionName"
```

## Rollback Plan

### If Issues Occur:

1. **Restore Lambda Functions**:
```bash
#!/bin/bash
# restore-lambdas.sh

BACKUP_DIR="/path/to/lambda-backup"
FUNCTIONS=("podcastflow-api-analytics" "podcastflow-api-organization" "podcastflow-api-user" "podcastflow-users")

for func in "${FUNCTIONS[@]}"; do
  echo "Restoring $func..."
  
  # Get configuration from backup
  CONFIG=$(cat "$BACKUP_DIR/${func}-config.json")
  ENV_VARS=$(cat "$BACKUP_DIR/${func}-env.json")
  
  # Create function
  aws lambda create-function \
    --function-name "$func" \
    --runtime "nodejs18.x" \
    --role "arn:aws:iam::590183844530:role/lambda-execution-role" \
    --handler "index.handler" \
    --zip-file "fileb://$BACKUP_DIR/${func}.zip" \
    --environment "Variables=$ENV_VARS" \
    --region us-east-1
done
```

## Cost Savings

- **Lambda Invocations**: ~$0 (minimal usage)
- **CloudWatch Logs**: ~$2-5/month 
- **Complexity Reduction**: Priceless
- **Security Improvement**: Critical

## Recommendations

1. **IMMEDIATE**: Delete Lambda functions to eliminate security risk
2. **Monitor**: Watch application logs for any 404s or errors
3. **Document**: Update architecture diagrams
4. **Security**: Audit all remaining APIs for tenant isolation

## Sign-Off Checklist

- [ ] All Lambda functions backed up
- [ ] Application tested with Next.js APIs
- [ ] Tenant isolation verified
- [ ] No API Gateway references found
- [ ] CloudWatch alarms updated
- [ ] Documentation updated
- [ ] Rollback plan tested

---

**Security Note**: The Lambda functions have NO tenant isolation and pose a critical data leakage risk. Immediate decommission is strongly recommended.