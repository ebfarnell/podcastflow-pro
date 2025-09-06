# API Gateway Cleanup - Dashboard Endpoints
Date: 2025-07-25

## Summary
Removing unused dashboard endpoints from API Gateway that were previously served by Lambda functions but have been migrated to Next.js API routes.

## Endpoints Being Removed

### 1. `/dashboard`
- **Current Integration**: `podcastflow-api-analytics` Lambda
- **Last Used**: Not invoked in past 7 days
- **Replacement**: Next.js route at `/api/dashboard`
- **Resource ID**: To be determined during removal

### 2. `/analytics/dashboard`  
- **Current Integration**: `podcastflow-api-analytics` Lambda
- **Last Used**: Not invoked in past 7 days
- **Replacement**: Next.js route at `/api/dashboard`
- **Resource ID**: To be determined during removal

### 3. `/analytics/campaigns/{id}`
- **Current Integration**: `podcastflow-api-analytics` Lambda
- **Last Used**: Not invoked in past 7 days
- **Replacement**: Next.js route at `/api/analytics/campaigns/[id]`
- **Resource ID**: To be determined during removal

## Lambda Function Status

### `podcastflow-api-analytics`
- **Purpose**: Originally served analytics and dashboard data
- **Current State**: Returns only mock data
- **Last Invoked**: 2025-07-22 (3 days ago)
- **Dependencies**: Only the 3 endpoints being removed
- **Action**: Keep Lambda for now, only remove API Gateway integrations

## Verification Steps
1. ✅ No dedicated dashboard Lambda exists
2. ✅ Analytics Lambda only serves mock data
3. ✅ No recent invocations (last: July 22)
4. ✅ Next.js routes handle all dashboard traffic
5. ✅ No CloudFormation management of these resources

## Commands for Removal

```bash
# Get resource IDs
DASHBOARD_ID=$(aws apigateway get-resources --rest-api-id 9uiib4zrdb --region us-east-1 --query "items[?path=='/dashboard'].id" --output text)
ANALYTICS_DASHBOARD_ID=$(aws apigateway get-resources --rest-api-id 9uiib4zrdb --region us-east-1 --query "items[?path=='/analytics/dashboard'].id" --output text)
ANALYTICS_CAMPAIGN_ID=$(aws apigateway get-resources --rest-api-id 9uiib4zrdb --region us-east-1 --query "items[?path=='/analytics/campaigns/{id}'].id" --output text)

# Remove methods and resources
aws apigateway delete-method --rest-api-id 9uiib4zrdb --resource-id $DASHBOARD_ID --http-method GET --region us-east-1
aws apigateway delete-method --rest-api-id 9uiib4zrdb --resource-id $DASHBOARD_ID --http-method OPTIONS --region us-east-1
aws apigateway delete-resource --rest-api-id 9uiib4zrdb --resource-id $DASHBOARD_ID --region us-east-1

# Deploy changes
aws apigateway create-deployment --rest-api-id 9uiib4zrdb --stage-name prod --region us-east-1
```

## Rollback Plan
If issues arise:
1. Resources can be recreated via AWS Console
2. Lambda function remains intact
3. CloudFormation template in `/infrastructure/cloudformation/` can be referenced

## Testing
- Dashboard at https://app.podcastflow.pro continues to work
- All API calls go to Next.js endpoints
- No 404 errors in application logs