# Settings Features Deployment Guide

This guide explains how to deploy the new settings features (Team, Security, Billing, API/Webhooks, Backup) to production.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js and npm installed
3. Access to AWS Lambda, API Gateway, DynamoDB, and S3

## Deployment Steps

### 1. Deploy Lambda Functions

Run the deployment script to create/update all Lambda functions:

```bash
cd infrastructure/scripts
./deploy-settings-lambdas.sh
```

This script will:
- Deploy 5 new Lambda functions
- Create necessary IAM permissions
- Set up environment variables
- Create S3 bucket for backups

### 2. Configure API Gateway Routes

After Lambda functions are deployed, configure the API routes:

```bash
./configure-api-routes.sh
```

This script will:
- Add all necessary routes to API Gateway
- Configure Lambda integrations
- Set up CORS
- Deploy the API changes

### 3. Set Environment Variables

Update Lambda environment variables with production values:

#### For Billing Lambda:
```bash
aws lambda update-function-configuration \
  --function-name PodcastFlowPro-Billing \
  --environment Variables="{TABLE_NAME=PodcastFlowPro,STRIPE_SECRET_KEY=sk_live_YOUR_KEY}"
```

#### For Security Lambda:
```bash
aws lambda update-function-configuration \
  --function-name PodcastFlowPro-Security \
  --environment Variables="{TABLE_NAME=PodcastFlowPro,USER_POOL_ID=YOUR_POOL_ID,ENCRYPTION_KEY=YOUR_KEY}"
```

### 4. Test Endpoints

Run the test script to verify all endpoints are working:

```bash
./test-settings-endpoints.sh
```

### 5. Frontend Deployment

The frontend is automatically deployed via AWS Amplify when changes are pushed to the repository.

## API Endpoints Reference

### Team Management
- `GET /team/{organizationId}/members` - Get all team members
- `POST /team/{organizationId}/members` - Invite new member
- `PUT /team/{organizationId}/members/{memberId}` - Update member
- `DELETE /team/{organizationId}/members/{memberId}` - Remove member

### Security Settings
- `GET /security` - Get security settings
- `PUT /security/password` - Update password
- `GET /security/2fa` - Get 2FA status
- `POST /security/2fa` - Enable 2FA
- `PUT /security/2fa` - Verify 2FA code
- `DELETE /security/2fa` - Disable 2FA
- `GET /security/sessions` - Get active sessions
- `DELETE /security/sessions` - Revoke session
- `PUT /security/preferences` - Update security preferences

### Billing Management
- `GET /billing` - Get billing overview
- `POST /billing/subscription` - Create subscription
- `PUT /billing/subscription` - Update subscription
- `DELETE /billing/subscription` - Cancel subscription
- `POST /billing/payment-methods` - Add payment method
- `PUT /billing/payment-methods` - Set default payment method
- `DELETE /billing/payment-methods` - Remove payment method
- `GET /billing/invoices` - Get invoices
- `GET /billing/usage` - Get usage data

### API & Webhooks
- `GET /api-webhooks` - Get API settings
- `POST /api-webhooks/api-keys` - Create API key
- `PUT /api-webhooks/api-keys/{keyId}` - Update API key
- `DELETE /api-webhooks/api-keys/{keyId}` - Delete API key
- `POST /api-webhooks/webhooks` - Create webhook
- `PUT /api-webhooks/webhooks/{webhookId}` - Update webhook
- `DELETE /api-webhooks/webhooks/{webhookId}` - Delete webhook
- `POST /api-webhooks/webhooks/test` - Test webhook

### Backup & Export
- `GET /backups` - Get backup settings
- `POST /backups` - Create backup
- `DELETE /backups/{backupId}` - Delete backup
- `GET /backups/{backupId}/download` - Get download URL
- `PUT /backups/schedule` - Update backup schedule
- `POST /backups/export` - Export data
- `POST /backups/restore` - Restore backup

## Environment Variables

### Required for all Lambda functions:
- `TABLE_NAME` - DynamoDB table name (default: PodcastFlowPro)

### Additional variables by function:

**Security Lambda:**
- `USER_POOL_ID` - Cognito User Pool ID
- `ENCRYPTION_KEY` - Key for encrypting sensitive data

**Billing Lambda:**
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_STARTER_PRODUCT_ID` - Stripe product ID for Starter plan
- `STRIPE_STARTER_PRICE_ID` - Stripe price ID for Starter plan
- `STRIPE_PRO_PRODUCT_ID` - Stripe product ID for Professional plan
- `STRIPE_PRO_PRICE_ID` - Stripe price ID for Professional plan
- `STRIPE_ENTERPRISE_PRODUCT_ID` - Stripe product ID for Enterprise plan
- `STRIPE_ENTERPRISE_PRICE_ID` - Stripe price ID for Enterprise plan

**API/Webhooks Lambda:**
- `API_GATEWAY_ID` - API Gateway ID for API key management

**Backup Lambda:**
- `BACKUP_BUCKET` - S3 bucket for storing backups
- `BACKUP_STATE_MACHINE_ARN` - (Optional) Step Functions ARN for complex backups
- `LAMBDA_ARN` - Lambda function ARN for scheduled backups

## DynamoDB Schema

The Lambda functions use the following DynamoDB patterns:

### Team Members
- PK: `ORG#<organizationId>`
- SK: `MEMBER#<memberId>`

### Security Settings
- PK: `USER#<userId>`
- SK: `SECURITY`

### Sessions
- PK: `USER#<userId>`
- SK: `SESSION#<sessionId>`

### Billing
- PK: `ORG#<organizationId>`
- SK: `BILLING`

### API Keys
- PK: `ORG#<organizationId>`
- SK: `APIKEY#<keyId>`

### Webhooks
- PK: `ORG#<organizationId>`
- SK: `WEBHOOK#<webhookId>`

### Backups
- PK: `ORG#<organizationId>`
- SK: `BACKUP#<backupId>`

## Monitoring

### CloudWatch Logs
Each Lambda function creates a log group:
- `/aws/lambda/PodcastFlowPro-Team`
- `/aws/lambda/PodcastFlowPro-Security`
- `/aws/lambda/PodcastFlowPro-Billing`
- `/aws/lambda/PodcastFlowPro-APIWebhooks`
- `/aws/lambda/PodcastFlowPro-Backup`

### Alarms to Set Up
1. Lambda errors
2. API Gateway 4xx/5xx errors
3. DynamoDB throttling
4. S3 bucket size (for backups)

## Security Considerations

1. **API Keys**: Stored hashed in DynamoDB
2. **Webhooks**: Use HMAC signatures for verification
3. **2FA Secrets**: Encrypted before storage
4. **Backup Files**: Encrypted at rest in S3
5. **Stripe Keys**: Never logged or exposed in responses

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check API Gateway CORS configuration
2. **401 Unauthorized**: Verify Cognito authentication
3. **Lambda Timeouts**: Increase timeout in Lambda configuration
4. **DynamoDB Errors**: Check table exists and IAM permissions

### Debug Steps

1. Check CloudWatch logs for the specific Lambda
2. Test with the test script
3. Verify environment variables are set
4. Check IAM role permissions

## Rollback Plan

If issues occur:

1. Lambda functions support versioning - can rollback to previous version
2. API Gateway deployments can be rolled back
3. DynamoDB has point-in-time recovery enabled
4. S3 has versioning enabled for backup bucket