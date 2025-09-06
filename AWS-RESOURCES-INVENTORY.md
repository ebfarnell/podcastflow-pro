# PodcastFlow Pro - AWS Resources Inventory
## Backup Date: July 1, 2025 10:02 AM UTC

---

## 🔐 AWS Account Information
- **Account ID**: 590183844530
- **Primary Region**: us-east-1
- **Application URL**: https://app.podcastflow.pro

---

## 📦 EC2 Resources

### Instance
- **Instance ID**: i-0d9deb55071dc1187
- **Instance Type**: t2.micro (or as configured)
- **Security Group**: sg-084b9f29ca55906a7 (launch-wizard-1)
- **Key Pair**: Your SSH key
- **Public IP**: Variable (use load balancer)
- **Status**: Running

### Security Group Rules
- **Inbound**:
  - Port 22 (SSH)
  - Port 80 (HTTP)
  - Port 443 (HTTPS)
  - Port 3000 (Application)
  - Port 3001 (Development)

---

## 🌐 Networking

### Application Load Balancer
- **Name**: podcastflow-alb (if exists)
- **DNS**: Points to app.podcastflow.pro
- **Target Group**: podcastflow-tg
- **Health Check**: Port 3000

### Route 53
- **Hosted Zone**: podcastflow.pro
- **Zone ID**: Z05843243TQJ2Y9M3YVOF
- **Records**:
  - A record: app.podcastflow.pro → ALB
  - NS records: AWS nameservers
- **Nameservers**:
  - ns-1156.awsdns-16.org
  - ns-1821.awsdns-35.co.uk
  - ns-466.awsdns-58.com
  - ns-752.awsdns-30.net

### Certificate Manager
- **Domain**: *.podcastflow.pro
- **Status**: Issued
- **Validation**: DNS

---

## 🔑 Authentication (Cognito)

### User Pool
- **Pool ID**: us-east-1_n2gbeGsU4
- **Pool Name**: podcastflow-user-pool
- **Client ID**: 1d1ietug719t4toq9q2642vdc4
- **Users**: Michael@unfy.com (admin)

---

## 🗄️ Database (DynamoDB)

### Table
- **Name**: podcastflow-pro
- **Primary Key**: PK (String), SK (String)
- **GSI**: GSI1 (GSI1PK, GSI1SK)
- **Billing Mode**: Pay-per-request
- **Backup**: podcastflow-pro-backup-20250701-100207

### Sample Data Structure
```
PK: CAMPAIGN#<id>, SK: METADATA
PK: ORG#<id>, SK: SETTINGS
PK: USER#<id>, SK: PROFILE
```

---

## 🚀 API Gateway

### REST API
- **API ID**: 9uiib4zrdb
- **Name**: PodcastFlow-Pro-API
- **Endpoint**: https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod
- **Stage**: prod
- **Authorizer**: CognitoAuthorizer (w4m7jv)

### Resources
- /campaigns (GET, POST)
- /campaigns/{id} (GET, PUT, DELETE)
- /analytics/dashboard (GET)
- /analytics/campaigns/{id} (GET)
- /uploads/presigned-url (POST)

---

## λ Lambda Functions

### Deployed Functions
1. **podcastflow-api-campaigns**
   - Runtime: nodejs18.x
   - Handler: index.handler
   - Environment: DYNAMODB_TABLE_NAME=podcastflow-pro

2. **podcastflow-api-analytics**
   - Runtime: nodejs18.x
   - Handler: index.handler
   - Environment: DYNAMODB_TABLE_NAME=podcastflow-pro

### Pending Deployment
3. **podcastflow-api-uploads**
   - Runtime: nodejs18.x
   - Handler: index.handler
   - Environment: S3_BUCKET_NAME=podcastflow-pro-uploads-590183844530

---

## 📁 S3 Buckets

### Backup Bucket
- **Name**: podcastflow-backups-590183844530
- **Purpose**: Application backups
- **Contents**:
  - /project-backups/ - Code backups
  - /infrastructure-backups/ - Config backups
  - /manifests/ - Backup manifests

### Upload Bucket
- **Name**: podcastflow-pro-uploads-590183844530
- **Purpose**: User file uploads
- **CORS**: Configured for app.podcastflow.pro
- **Structure**:
  - /campaigns/{campaignId}/ - Campaign assets

### Original Documentation
- **Name**: podcastflow
- **Path**: s3://podcastflow/PodcastFlow/
- **Purpose**: Original project documentation

---

## 👤 IAM Resources

### Lambda Execution Role
- **Role**: podcastflow-api-LambdaExecutionRole-GhmKBJfcPhbh
- **Policies**:
  - DynamoDB access
  - CloudWatch Logs
  - S3 access (for uploads)

---

## 📊 CloudWatch

### Log Groups
- /aws/lambda/podcastflow-api-campaigns
- /aws/lambda/podcastflow-api-analytics
- /pm2/podcastflow-pro (if configured)

---

## 🔄 Process Management

### PM2 Configuration
- **App Name**: podcastflow-pro
- **Script**: npm start
- **Port**: 3000
- **Instances**: 1

---

## 🔑 Environment Variables

### Required in .env.local / .env.production
```
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=us-east-1_n2gbeGsU4
NEXT_PUBLIC_USER_POOL_CLIENT_ID=1d1ietug719t4toq9q2642vdc4
NEXT_PUBLIC_API_ENDPOINT=https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod
DYNAMODB_TABLE_NAME=podcastflow-pro
```

### Pending Configuration
```
STRIPE_SECRET_KEY=<your-stripe-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable>
AWS_SES_FROM_EMAIL=<verified-email>
```

---

## 📈 Cost Estimate (Monthly)

### Current Resources
- EC2 t2.micro: ~$8-10
- ALB: ~$20
- Route 53: ~$1
- DynamoDB: ~$5-10 (depends on usage)
- Lambda: ~$1-5 (depends on invocations)
- S3: ~$1-5 (depends on storage)
- **Total**: ~$40-60/month

---

## 🚨 Important Notes

1. **Backups**: Automated DynamoDB backups should be configured
2. **Monitoring**: CloudWatch alarms should be set up
3. **Security**: Enable AWS GuardDuty and Security Hub
4. **Scaling**: Current setup is single-instance, consider Auto Scaling
5. **CDN**: CloudFront not yet configured

---

## 🔧 Restoration Commands

### Restore from S3 Backup
```bash
# Download backup
aws s3 cp s3://podcastflow-backups-590183844530/project-backups/podcastflow-pro-backup-20250701_100124.tar.gz .

# Extract
tar -xzf podcastflow-pro-backup-20250701_100124.tar.gz

# Restore dependencies
cd podcastflow-pro
npm install --legacy-peer-deps

# Start application
pm2 start npm --name podcastflow-pro -- start
```

### Restore DynamoDB
```bash
# From backup
aws dynamodb restore-table-from-backup \
  --target-table-name podcastflow-pro-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:590183844530:table/podcastflow-pro/backup/01751364128347-4a02acdf

# From JSON export
aws dynamodb batch-write-item --request-items file://dynamodb-backup-20250701.json
```

---

Last Updated: July 1, 2025 10:02 AM UTC