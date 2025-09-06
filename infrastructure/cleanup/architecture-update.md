# PodcastFlow Pro Architecture Update
Date: 2025-07-25

## Current Architecture (Post-Cleanup)

### Technology Stack
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                     │
│                 Next.js 14 + TypeScript                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Application Layer (EC2)                  │
│              Next.js API Routes + PM2                    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Database (PostgreSQL)                   │
│              Multi-tenant Schema Architecture            │
└─────────────────────────────────────────────────────────┘
```

### Active AWS Services

#### Compute
- **EC2**: Single instance running Next.js application
- **Lambda**: 6 active functions (under review for deprecation)
  - `podcastflow-api-user` (authentication)
  - `podcastflow-api-organization` (organization management)
  - `PodcastFlowPro-PodcastFlowPro-users` (user management)
  - `podcastflow-api-analytics` (analytics - may be deprecated)
  - `podcastflow-users` (user operations)
  - `PodcastFlowPro-PodcastFlowPro-clients` (client management)

#### Storage
- **S3 Buckets**:
  - `podcastflow-pro-uploads-590183844530` - User uploaded files
  - `podcastflow-backups-590183844530` - System backups
  - `podcastflow` - General storage (under review)

#### Database
- **RDS PostgreSQL**: Primary database with multi-tenant schemas
- **DynamoDB**: 2-4 tables under review for removal

#### Networking
- **CloudFront**: CDN for static assets
- **Route 53**: DNS management
- **API Gateway**: Minimal usage, most endpoints removed

### Removed Components

#### Lambda Functions (47 removed)
- All campaign management functions
- All show/episode management functions
- All financial/billing functions
- All reporting functions
- Legacy integration functions

#### API Gateway Endpoints (26 removed)
- All CRUD endpoints for business entities
- Now handled by Next.js API routes at `/api/*`

#### CloudWatch Resources
- 20+ empty log groups
- Associated metrics and alarms

### Data Flow

#### Authentication Flow
```
User Login → Next.js → PostgreSQL Session Table → JWT Cookie
```

#### API Request Flow
```
Client → Next.js Route → PostgreSQL (Schema-based) → Response
```

#### File Upload Flow
```
Client → Next.js → S3 Presigned URL → Direct Upload → S3
```

### Multi-Tenant Architecture

```
PostgreSQL Database
├── public schema
│   ├── User
│   ├── Organization
│   ├── Session
│   └── BillingPlan
│
├── org_podcastflow_pro schema
│   ├── Campaign
│   ├── Show
│   ├── Episode
│   └── (40+ tables)
│
└── org_unfy schema
    ├── Campaign
    ├── Show
    ├── Episode
    └── (40+ tables)
```

### Security Model

#### Application Security
- Session-based authentication
- JWT tokens in httpOnly cookies
- Role-based access control (RBAC)
- Schema isolation for multi-tenancy

#### Infrastructure Security
- VPC with private subnets
- Security groups limiting access
- IAM roles with least privilege
- Encrypted data at rest and in transit

### Monitoring & Logging

#### Application Monitoring
- PM2 for process management
- Custom health endpoints
- Error tracking in application logs

#### Infrastructure Monitoring
- CloudWatch for remaining Lambda functions
- S3 access logs
- PostgreSQL query logs

### Backup Strategy

#### Database
- Automated RDS snapshots (daily)
- Point-in-time recovery enabled
- Manual exports to S3 (weekly)

#### Application
- Code in Git (GitHub)
- Environment configs backed up
- Infrastructure as Code (partial)

### Cost Optimization

#### Monthly Costs (Estimated)
- EC2: $50-100
- RDS: $100-200
- S3: $10-20
- Lambda: <$5 (minimal usage)
- CloudWatch: <$5
- **Total**: ~$165-330/month

#### Savings from Cleanup
- Lambda functions: ~$0 (pay-per-use, but reduced complexity)
- API Gateway: ~$3.50/million requests
- DynamoDB: ~$25-50/month
- CloudWatch Logs: ~$5-10/month
- **Total Savings**: ~$35-65/month

### Future Architecture Goals

1. **Complete Lambda Deprecation**
   - Migrate remaining 6 Lambda functions to Next.js
   - Remove API Gateway entirely
   - Simplify IAM permissions

2. **Database Optimization**
   - Remove legacy DynamoDB tables
   - Optimize PostgreSQL indexes
   - Implement connection pooling

3. **Performance Improvements**
   - Implement Redis caching
   - Add CDN for API responses
   - Optimize database queries

4. **Scalability Preparation**
   - Container-ready application
   - Horizontal scaling plan
   - Load balancer configuration

### Documentation Updates Needed

1. **API Documentation**
   - Remove references to Lambda endpoints
   - Update to Next.js route documentation
   - Include authentication requirements

2. **Deployment Guide**
   - Remove Lambda deployment steps
   - Simplify to PM2/Next.js deployment
   - Update environment variables

3. **Developer Onboarding**
   - Update architecture diagrams
   - Remove DynamoDB references
   - Focus on PostgreSQL/Next.js

### Risk Assessment

#### Low Risk
- Removed resources had no recent usage
- All functionality migrated to Next.js
- Comprehensive backups available

#### Medium Risk
- WebSocket infrastructure (pending review)
- Low-activity Lambda functions
- Legacy data in DynamoDB

#### Mitigation
- Phased approach with verification
- Rollback procedures prepared
- Monitoring for 48 hours post-cleanup