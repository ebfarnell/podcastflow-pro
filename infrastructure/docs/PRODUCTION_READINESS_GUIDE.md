# PodcastFlow Pro Production Readiness Guide

Last Updated: 2025-07-25

## Overview

This guide documents all production readiness improvements implemented for PodcastFlow Pro, focusing on security, scalability, reliability, and multi-tenant data isolation.

## Table of Contents

1. [Secrets Management](#secrets-management)
2. [Scalability Patterns](#scalability-patterns)
3. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
4. [Database Health Monitoring](#database-health-monitoring)
5. [Multi-Tenant Isolation](#multi-tenant-isolation)
6. [Implementation Guide](#implementation-guide)

## Secrets Management

### AWS Secrets Manager Integration

**Location**: `/infrastructure/security/secrets-manager.ts`

#### Features:
- Centralized credential management
- Automatic secret rotation support
- Local caching to reduce API calls
- Fallback to environment variables

#### Setup:
1. Store secrets in AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret --name podcastflow/database \
     --secret-string '{"url":"postgresql://...", "password":"..."}'
   ```

2. Grant EC2 instance IAM permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": [
         "secretsmanager:GetSecretValue",
         "secretsmanager:DescribeSecret"
       ],
       "Resource": "arn:aws:secretsmanager:*:*:secret:podcastflow/*"
     }]
   }
   ```

3. Use in application:
   ```typescript
   import { loadSecretsToEnv } from '@/infrastructure/security/secrets-manager'
   await loadSecretsToEnv() // Call at startup
   ```

### Environment Configuration

**Template**: `/infrastructure/security/.env.example`

Comprehensive environment variable template with:
- Database configuration
- AWS service settings
- Rate limiting parameters
- Multi-tenant configuration
- Feature flags

## Scalability Patterns

### Pagination

**Location**: `/src/lib/api/pagination.ts`

#### Features:
- Offset-based pagination (traditional)
- Cursor-based pagination (for large datasets)
- Consistent API response format
- SQL injection prevention
- Maximum 100 items per page

#### Usage:
```typescript
// In API route
import { getPaginationParams, createPaginatedResponse } from '@/lib/api/pagination'

export async function GET(request: NextRequest) {
  const params = getPaginationParams(request)
  const { data, total } = await fetchData(params)
  return NextResponse.json(createPaginatedResponse(data, total, params))
}
```

### Rate Limiting

**Location**: `/src/lib/api/rate-limit.ts`

#### Features:
- Per-tenant rate limiting
- Redis-backed sliding window
- Different limits for authenticated vs anonymous
- Graceful degradation if Redis unavailable
- Burst allowance for spike handling

#### Configuration:
```env
# Default: 100 requests per 15 minutes
API_RATE_LIMIT=100
API_RATE_WINDOW=900000
API_RATE_LIMIT_PER_TENANT=1000
API_RATE_BURST=20
```

#### Usage:
```typescript
// In API route
import { withRateLimit } from '@/lib/api/rate-limit'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse
  
  // Process request...
}
```

## Backup and Disaster Recovery

### Automated Backup System

**Script**: `/infrastructure/backup/automated-backup.sh`

#### Features:
- Full database backups
- Per-tenant backup capability
- AES-256 encryption
- Automatic S3 upload
- Retention policy enforcement
- Auto-generated restore scripts

#### Backup Types:
1. **Full Backup**: All schemas and data
   ```bash
   ./automated-backup.sh full
   ```

2. **Tenant Backup**: Specific organization
   ```bash
   ./automated-backup.sh tenant org_podcastflow_pro
   ```

#### Schedule with Cron:
```bash
# Daily full backup at 2 AM
0 2 * * * /home/ec2-user/podcastflow-pro/infrastructure/backup/automated-backup.sh full

# Weekly tenant backups
0 3 * * 0 /home/ec2-user/podcastflow-pro/infrastructure/backup/automated-backup.sh tenant org_podcastflow_pro
```

### Disaster Recovery Plan

**Document**: `/infrastructure/backup/DISASTER_RECOVERY_PLAN.md`

#### Scenarios Covered:
1. Database Corruption
2. Accidental Data Deletion
3. Complete System Failure
4. Ransomware Attack
5. Data Breach / Tenant Data Exposure

#### Recovery Time Objectives:
- Database Corruption: 1 hour
- Data Deletion: 2 hours
- System Failure: 4 hours
- Ransomware: 8 hours
- Data Breach: 30 minutes

## Database Health Monitoring

### Health Check Endpoint

**Location**: `/src/app/api/health/route.ts`

#### Endpoints:
- `GET /api/health` - Full health check with metrics
- `HEAD /api/health` - Lightweight status check

#### Health Checks:
1. **Database Connectivity**
   - Connection test
   - Response time measurement
   - Threshold: 1 second

2. **Tenant Isolation**
   - Schema verification
   - Isolation function check
   - Sample schema listing

3. **Performance Metrics**
   - Cache hit ratio (>90%)
   - Connection usage (<80%)
   - Table count tracking

#### Response Example:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-25T08:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection healthy",
      "responseTime": 47
    },
    "tenants": {
      "status": "pass",
      "message": "Tenant isolation verified",
      "details": {
        "schemaCount": 2,
        "sampleSchemas": ["org_podcastflow_pro", "org_unfy"]
      }
    },
    "performance": {
      "status": "pass",
      "message": "Performance metrics within thresholds",
      "metrics": {
        "cacheHitRate": 99.98,
        "activeConnections": 6,
        "tableCount": 105
      }
    }
  }
}
```

### Database Monitoring Queries

**Location**: `/infrastructure/monitoring/database-health.sql`

#### Available Queries:
- Slow query logging configuration
- Database size and growth tracking
- Index usage analysis
- Table bloat detection
- Connection and lock monitoring
- Cache hit ratio analysis
- Tenant-specific health checks

## Multi-Tenant Isolation

### Architecture
- **Schema-based isolation**: Each organization has its own PostgreSQL schema
- **Naming convention**: `org_<organization_slug>`
- **Complete data separation**: No cross-tenant queries possible
- **Database-level security**: Schema permissions enforced by PostgreSQL

### Implementation
```typescript
// Example: Query organization-specific data
const campaigns = await prisma.$queryRaw`
  SELECT * FROM ${Prisma.raw(`"${orgSchema}"."Campaign"`)}
  WHERE status = 'active'
`
```

### Security Measures:
1. Schema access restricted by database roles
2. API-level organization verification
3. Audit logging for all tenant data access
4. No shared tables for business data

## Implementation Guide

### 1. Initial Setup

```bash
# Clone production readiness improvements
cd /home/ec2-user/podcastflow-pro/infrastructure

# Set up environment variables
cp security/.env.example ../.env.production
# Edit .env.production with your values

# Install dependencies
npm install ioredis
```

### 2. Configure AWS Services

```bash
# Configure AWS CLI
aws configure

# Create S3 bucket for backups
aws s3 mb s3://podcastflow-backups

# Enable versioning for ransomware protection
aws s3api put-bucket-versioning \
  --bucket podcastflow-backups \
  --versioning-configuration Status=Enabled

# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name podcastflow/database \
  --secret-string '{"url":"postgresql://...", "password":"..."}'
```

### 3. Set Up Automated Backups

```bash
# Make backup script executable
chmod +x infrastructure/backup/automated-backup.sh

# Test backup
./infrastructure/backup/automated-backup.sh full

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/ec2-user/podcastflow-pro/infrastructure/backup/automated-backup.sh full
```

### 4. Enable Health Monitoring

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Set up monitoring (e.g., with CloudWatch)
aws cloudwatch put-metric-alarm \
  --alarm-name podcastflow-health \
  --alarm-description "PodcastFlow health check" \
  --metric-name HealthCheck \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 2
```

### 5. Configure Rate Limiting

```bash
# Install Redis (if not already installed)
sudo yum install redis6
sudo systemctl enable redis6
sudo systemctl start redis6

# Add Redis configuration to .env.production
echo "REDIS_URL=redis://localhost:6379" >> .env.production
```

### 6. Apply Database Optimizations

```bash
# Connect to database
PGPASSWORD=$DB_PASSWORD psql -U podcastflow -d podcastflow_production

# Run optimization queries
\i infrastructure/monitoring/database-health.sql
```

## Best Practices

### Security
1. **Never commit secrets** to version control
2. **Rotate credentials** regularly (quarterly)
3. **Use least privilege** IAM policies
4. **Enable audit logging** for all sensitive operations
5. **Encrypt backups** with strong keys

### Performance
1. **Monitor cache hit rates** (target >95%)
2. **Index frequently queried columns**
3. **Use pagination** for all list endpoints
4. **Implement request caching** where appropriate
5. **Regular VACUUM** operations on PostgreSQL

### Reliability
1. **Test backups monthly** with full restoration
2. **Document all procedures** with step-by-step guides
3. **Monitor all critical metrics** with alerts
4. **Maintain runbooks** for common issues
5. **Practice disaster recovery** scenarios

### Multi-Tenancy
1. **Verify organization context** in every API call
2. **Use schema-based queries** for all business data
3. **Audit cross-tenant access** attempts
4. **Test tenant isolation** regularly
5. **Monitor per-tenant resource usage**

## Monitoring Checklist

- [ ] Health endpoint returns 200 status
- [ ] Database cache hit rate >95%
- [ ] Active connections <80% of max
- [ ] Daily backups completing successfully
- [ ] S3 backup uploads verified
- [ ] Rate limiting active and logging
- [ ] No cross-tenant data access in logs
- [ ] SSL certificates valid >30 days
- [ ] Disk usage <80%
- [ ] Memory usage <90%

## Troubleshooting

### High Database Response Time
1. Check active queries: `SELECT * FROM pg_stat_activity WHERE state != 'idle'`
2. Analyze slow queries: Check PostgreSQL logs
3. Review indexes: Run index usage queries
4. Consider connection pooling adjustments

### Backup Failures
1. Check disk space: `df -h`
2. Verify AWS credentials: `aws s3 ls`
3. Review backup logs: Check script output
4. Test database connectivity
5. Ensure encryption key is available

### Rate Limiting Issues
1. Check Redis connectivity: `redis-cli ping`
2. Review rate limit settings in environment
3. Monitor Redis memory usage
4. Check for proper key expiration

### Tenant Isolation Concerns
1. Audit schema access logs
2. Review API authentication
3. Check for hardcoded organization IDs
4. Verify schema naming conventions
5. Test with different user accounts

## Support

For additional support or questions:
1. Check logs: `pm2 logs podcastflow-pro`
2. Review monitoring dashboards
3. Consult disaster recovery documentation
4. Contact DevOps team lead

---

Remember: **Security and reliability are ongoing processes, not one-time implementations.**