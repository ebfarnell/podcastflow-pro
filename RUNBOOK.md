# PodcastFlow Pro - Operations Runbook

## Table of Contents
1. [System Overview](#system-overview)
2. [90% Campaign Automation Workflow](#90-campaign-automation-workflow)
3. [Troubleshooting Guide](#troubleshooting-guide)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Emergency Procedures](#emergency-procedures)
6. [Maintenance Procedures](#maintenance-procedures)

---

## System Overview

### Application Stack
- **Frontend**: Next.js 15.4.3 with TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL 15.13 (Multi-tenant)
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)
- **Infrastructure**: AWS EC2

### Key URLs
- Production: https://app.podcastflow.pro
- API Health: https://app.podcastflow.pro/api/health
- Workflow Health: https://app.podcastflow.pro/api/workflow/health

### Database Connection
```bash
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production
```

---

## 90% Campaign Automation Workflow

### Overview
The 90% automation workflow automatically triggers approval requests when campaigns reach 90% probability, managing inventory reservations and order creation.

### Workflow Architecture
```
User Updates Campaign → API Handler → Workflow Service → Database Updates
                                           ↓
                                    Approval Request
                                           ↓
                                    Admin Reviews
                                        ↙     ↘
                                   Approve   Reject
                                      ↓         ↓
                                   Order     Revert
```

### Key Components

#### 1. Campaign Update Handler
- **File**: `/src/app/api/campaigns/[id]/route.ts`
- **Function**: Detects probability changes and triggers workflow
- **Key Check**: Old probability < 90 && new probability >= 90

#### 2. Workflow Service
- **File**: `/src/lib/workflow/campaign-workflow-service.ts`
- **Functions**:
  - `handleProbabilityChange()` - Main workflow trigger
  - `createInventoryReservation()` - Reserve ad spots
  - `processApproval()` - Handle approve/reject actions

#### 3. Workflow Logger
- **File**: `/src/lib/workflow/workflow-logger.ts`
- **Purpose**: Structured logging and metrics collection
- **Phases**: INITIALIZATION → VALIDATION → EXECUTION → COMPLETION

#### 4. Approval API
- **File**: `/src/app/api/campaigns/approvals/[id]/route.ts`
- **Methods**:
  - GET - Fetch approval details
  - PUT - Process approve/reject action

#### 5. Health Monitoring
- **Endpoint**: `/api/workflow/health`
- **Checks**:
  - Database connectivity
  - Active workflows count
  - Pending approvals count
  - Success/failure metrics

### Database Tables Involved
```sql
-- Organization-specific schema tables
"Campaign" - Main campaign data
"CampaignApproval" - Approval requests and status
"Order" - Approved campaigns converted to orders
"InventoryReservation" - Reserved ad spots
"Activity" - Audit trail
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Workflow Not Triggering at 90%

**Symptoms:**
- Campaign updated to 90% but no approval request created
- No activity log entry for workflow trigger

**Diagnosis:**
```bash
# Check campaign status
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT id, name, probability, \"approvalRequestId\", \"reservationId\" 
FROM org_podcastflow_pro.\"Campaign\" 
WHERE probability >= 90 AND \"approvalRequestId\" IS NULL;"

# Check recent workflow logs
pm2 logs podcastflow-pro --lines 100 | grep -i workflow
```

**Solutions:**
1. Verify campaign doesn't already have `approvalRequestId`
2. Check if probability jump was from below 90 to 90+
3. Verify user has permission to trigger workflow
4. Check for database transaction failures in logs

#### 2. Approval Request Stuck in Pending

**Symptoms:**
- Approval request created but admin can't approve/reject
- API returns errors when processing approval

**Diagnosis:**
```bash
# Check pending approvals
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT ca.*, c.name as campaign_name 
FROM org_podcastflow_pro.\"CampaignApproval\" ca
JOIN org_podcastflow_pro.\"Campaign\" c ON c.id = ca.\"campaignId\"
WHERE ca.status = 'pending';"

# Check for lock issues
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT pid, usename, query, state, wait_event_type, wait_event 
FROM pg_stat_activity 
WHERE state != 'idle' AND query LIKE '%Campaign%';"
```

**Solutions:**
1. Check if campaign still exists and is valid
2. Verify admin user has correct permissions
3. Look for database locks or long-running transactions
4. Manually update approval status if needed (emergency only)

#### 3. Inventory Not Released on Rejection

**Symptoms:**
- Campaign rejected but inventory still shows as reserved
- Cannot schedule other campaigns on same dates

**Diagnosis:**
```bash
# Check orphaned reservations
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT ir.*, c.probability, c.status 
FROM org_podcastflow_pro.\"InventoryReservation\" ir
JOIN org_podcastflow_pro.\"Campaign\" c ON c.id = ir.\"campaignId\"
WHERE c.probability < 90 OR c.status != 'won';"
```

**Solutions:**
1. Manually delete orphaned reservations:
```sql
DELETE FROM org_podcastflow_pro."InventoryReservation" 
WHERE "campaignId" IN (
  SELECT id FROM org_podcastflow_pro."Campaign" 
  WHERE probability < 90 AND "reservationId" IS NULL
);
```

#### 4. Order Not Created After Approval

**Symptoms:**
- Campaign approved but no order created
- Campaign shows 100% but no order record

**Diagnosis:**
```bash
# Check campaigns without orders
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT c.id, c.name, c.probability, c.status, o.id as order_id
FROM org_podcastflow_pro.\"Campaign\" c
LEFT JOIN org_podcastflow_pro.\"Order\" o ON o.\"campaignId\" = c.id
WHERE c.probability = 100 AND c.status = 'won' AND o.id IS NULL;"
```

**Solutions:**
1. Manually create order for approved campaign
2. Check for unique constraint violations in Order table
3. Verify all required fields are present in Campaign

#### 5. Workflow Health Endpoint Errors

**Symptoms:**
- `/api/workflow/health` returns 500 error
- Monitoring shows workflow as unhealthy

**Diagnosis:**
```bash
# Test health endpoint
curl -s https://app.podcastflow.pro/api/workflow/health | jq .

# Check database connectivity
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "SELECT 1;"

# Check PM2 process
pm2 status podcastflow-pro
```

**Solutions:**
1. Restart application: `pm2 restart podcastflow-pro`
2. Check database connection settings
3. Verify environment variables are loaded
4. Check for memory issues: `pm2 monit`

---

## Monitoring & Alerting

### Key Metrics to Monitor

#### Application Metrics
```bash
# Check workflow metrics
curl -s https://app.podcastflow.pro/api/workflow/health | jq '.checks.workflows.metrics'

# Monitor PM2 metrics
pm2 monit

# Check application logs
pm2 logs podcastflow-pro --lines 100
```

#### Database Metrics
```sql
-- Active workflows count
SELECT COUNT(*) as active_workflows 
FROM org_podcastflow_pro."CampaignApproval" 
WHERE status = 'pending';

-- Daily workflow volume
SELECT DATE(\"createdAt\"), COUNT(*) 
FROM org_podcastflow_pro."CampaignApproval" 
GROUP BY DATE(\"createdAt\") 
ORDER BY 1 DESC LIMIT 7;

-- Success rate
SELECT 
  COUNT(CASE WHEN status = 'approved' THEN 1 END)::float / 
  NULLIF(COUNT(*), 0) * 100 as approval_rate
FROM org_podcastflow_pro."CampaignApproval"
WHERE "createdAt" > NOW() - INTERVAL '7 days';
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Pending Approvals | > 10 | > 20 | Notify admin team |
| Workflow Success Rate | < 90% | < 75% | Check for systematic issues |
| Response Time | > 2s | > 5s | Check database performance |
| Error Rate | > 1% | > 5% | Review error logs |
| Memory Usage | > 80% | > 95% | Restart PM2 process |

### Monitoring Scripts

Create monitoring script at `/home/ec2-user/monitor-workflow.sh`:
```bash
#!/bin/bash
# Workflow monitoring script

echo "=== Workflow Health Check ==="
curl -s https://app.podcastflow.pro/api/workflow/health | jq .

echo -e "\n=== Pending Approvals ==="
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -t -c "
SELECT COUNT(*) FROM org_podcastflow_pro.\"CampaignApproval\" WHERE status = 'pending';"

echo -e "\n=== Recent Workflow Activity ==="
pm2 logs podcastflow-pro --lines 20 --nostream | grep -i "workflow"

echo -e "\n=== Application Status ==="
pm2 status
```

---

## Emergency Procedures

### 1. Workflow Complete Failure

If the workflow system completely fails:

```bash
# 1. Disable workflow temporarily
echo "DISABLE_90PCT_WORKFLOW=true" >> /home/ec2-user/podcastflow-pro/.env.production

# 2. Restart application
pm2 restart podcastflow-pro

# 3. Process pending approvals manually
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production

# 4. Re-enable workflow after fix
# Remove DISABLE_90PCT_WORKFLOW from .env.production
pm2 restart podcastflow-pro
```

### 2. Database Lock Issues

```sql
-- Find blocking queries
SELECT 
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking 
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.query LIKE '%Campaign%';

-- Kill blocking query (use with caution)
SELECT pg_terminate_backend(pid);
```

### 3. Memory Overflow

```bash
# Check memory usage
free -h
pm2 monit

# Restart with increased memory limit
pm2 delete podcastflow-pro
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ecosystem.config.js

# Clear PM2 logs if disk space issue
pm2 flush
```

### 4. Rollback Procedure

If a deployment breaks the workflow:

```bash
# 1. Restore from backup
cd /home/ec2-user
tar -xzf backups/podcastflow-backup-[LATEST].tar.gz

# 2. Restore database if needed
PGPASSWORD=PodcastFlow2025Prod pg_restore -U podcastflow -d podcastflow_production backup.dump

# 3. Rebuild and restart
cd podcastflow-pro
npm ci
npm run build
pm2 restart podcastflow-pro
```

---

## Maintenance Procedures

### Daily Checks
1. Review pending approvals count
2. Check workflow success rate
3. Monitor error logs for patterns
4. Verify backup completion

### Weekly Tasks
1. Analyze workflow performance metrics
2. Review and clean old approval records
3. Check for orphaned inventory reservations
4. Update monitoring thresholds if needed

### Monthly Tasks
1. Performance analysis and optimization
2. Database index maintenance
3. Clean up old workflow logs
4. Review and update documentation

### Cleanup Scripts

```sql
-- Clean old completed approvals (keep 90 days)
DELETE FROM org_podcastflow_pro."CampaignApproval" 
WHERE status IN ('approved', 'rejected') 
AND "updatedAt" < NOW() - INTERVAL '90 days';

-- Clean orphaned reservations
DELETE FROM org_podcastflow_pro."InventoryReservation" ir
WHERE NOT EXISTS (
  SELECT 1 FROM org_podcastflow_pro."Campaign" c 
  WHERE c.id = ir."campaignId"
);

-- Vacuum and analyze tables
VACUUM ANALYZE org_podcastflow_pro."Campaign";
VACUUM ANALYZE org_podcastflow_pro."CampaignApproval";
VACUUM ANALYZE org_podcastflow_pro."Order";
VACUUM ANALYZE org_podcastflow_pro."InventoryReservation";
```

---

## Contact Information

### Escalation Path
1. **Level 1**: Application logs and basic troubleshooting
2. **Level 2**: Database queries and workflow analysis
3. **Level 3**: Code changes and deployment

### Key Files Reference
- Workflow Service: `/src/lib/workflow/campaign-workflow-service.ts`
- Approval API: `/src/app/api/campaigns/approvals/[id]/route.ts`
- Health Endpoint: `/src/app/api/workflow/health/route.ts`
- Activity Logger: `/src/services/activity-service.ts`
- Database Helper: `/src/lib/db/schema-db.ts`

### Useful Commands
```bash
# View real-time logs
pm2 logs podcastflow-pro --lines 100

# Check specific workflow
pm2 logs podcastflow-pro | grep -A5 -B5 "workflow-id"

# Database console
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production

# Restart application
pm2 restart podcastflow-pro

# Full rebuild
npm run build && pm2 restart podcastflow-pro
```

---

*Last Updated: August 9, 2025*
*Version: 1.0*