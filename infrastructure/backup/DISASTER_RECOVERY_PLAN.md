# PodcastFlow Pro Disaster Recovery Plan

Last Updated: 2025-07-25

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|-------------|
| Primary DBA | [Name] | [Phone/Email] | 24/7 |
| DevOps Lead | [Name] | [Phone/Email] | Business Hours |
| CTO | [Name] | [Phone/Email] | Emergency Only |
| AWS Support | N/A | AWS Console | 24/7 |

## System Overview

- **Application**: PodcastFlow Pro (Next.js + PostgreSQL)
- **Database**: PostgreSQL 16 (Multi-tenant with schema isolation)
- **Infrastructure**: AWS EC2 + RDS
- **Backup Locations**:
  - Local: `/home/ec2-user/podcastflow-pro/backups/`
  - S3: `s3://podcastflow-backups/backups/`
  - Retention: 30 days (daily), 12 months (monthly)

## Backup Schedule

| Type | Frequency | Time (UTC) | Retention |
|------|-----------|------------|----------|
| Full Database | Daily | 02:00 | 30 days |
| Incremental | Every 6 hours | 00:00, 06:00, 12:00, 18:00 | 7 days |
| Transaction Logs | Continuous | Real-time | 7 days |
| Monthly Archive | Monthly | 1st at 03:00 | 12 months |

## Disaster Scenarios & Recovery Procedures

### 1. Database Corruption

**Symptoms**: Application errors, data inconsistencies, PostgreSQL crash

**Recovery Steps**:

```bash
# 1. Stop application
pm2 stop podcastflow-pro

# 2. Verify corruption
PGPASSWORD=$DB_PASSWORD pg_dump -h localhost -U podcastflow -d podcastflow_production --schema-only > /tmp/test_dump.sql
# If this fails, database is likely corrupted

# 3. Find latest clean backup
ls -la /home/ec2-user/podcastflow-pro/backups/
# OR
aws s3 ls s3://podcastflow-backups/backups/ --recursive | sort | tail -20

# 4. Restore from backup
cd /home/ec2-user/podcastflow-pro/backups/[latest-backup]
export DB_PASSWORD='your-password'
export ENCRYPTION_KEY='your-encryption-key'
./restore.sh

# 5. Verify restoration
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production -c "SELECT COUNT(*) FROM public.\"User\";"

# 6. Restart application
pm2 restart podcastflow-pro

# 7. Run health check
curl https://app.podcastflow.pro/api/health
```

### 2. Accidental Data Deletion

**Symptoms**: Missing records, user complaints, audit log shows DELETE operations

**Recovery Steps**:

```bash
# 1. Identify what was deleted and when
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production << EOF
-- Check audit logs
SELECT * FROM public.tenant_access_log 
WHERE query_type = 'DELETE' 
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
EOF

# 2. For tenant-specific recovery
# Extract specific schema from backup
BACKUP_DIR="/home/ec2-user/podcastflow-pro/backups/[latest-backup]"
TENANT_SCHEMA="org_podcastflow_pro"

# Decrypt and extract tenant data
openssl enc -aes-256-cbc -d -pbkdf2 \
    -in "$BACKUP_DIR/${TENANT_SCHEMA}_backup.sql.gz.enc" \
    -out "$BACKUP_DIR/${TENANT_SCHEMA}_backup.sql.gz" \
    -pass pass:"$ENCRYPTION_KEY"

gunzip "$BACKUP_DIR/${TENANT_SCHEMA}_backup.sql.gz"

# 3. Restore specific tables or records
# Create temp schema for recovery
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production << EOF
CREATE SCHEMA recovery_temp;
EOF

# Restore to temp schema
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production \
    -c "SET search_path TO recovery_temp;" \
    -f "$BACKUP_DIR/${TENANT_SCHEMA}_backup.sql"

# 4. Copy missing data back
# Example: Restore deleted campaigns
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production << EOF
-- Copy missing records
INSERT INTO ${TENANT_SCHEMA}."Campaign" 
SELECT * FROM recovery_temp."Campaign" 
WHERE id NOT IN (SELECT id FROM ${TENANT_SCHEMA}."Campaign");

-- Clean up
DROP SCHEMA recovery_temp CASCADE;
EOF
```

### 3. Complete System Failure

**Symptoms**: EC2 instance down, RDS unavailable, application unreachable

**Recovery Steps**:

```bash
# 1. Launch new EC2 instance from AMI
aws ec2 run-instances \
    --image-id ami-xxxxx \
    --instance-type t3.large \
    --key-name podcastflow-key \
    --security-group-ids sg-xxxxx \
    --subnet-id subnet-xxxxx

# 2. Restore application code
ssh -i podcastflow-key.pem ec2-user@new-instance-ip

# Clone repository
git clone https://github.com/your-repo/podcastflow-pro.git
cd podcastflow-pro

# 3. Install dependencies
npm install
npm run build

# 4. Restore environment configuration
# Download from S3 or Secrets Manager
aws s3 cp s3://podcastflow-backups/config/.env.production.enc .env.production.enc
openssl enc -aes-256-cbc -d -pbkdf2 -in .env.production.enc -out .env.production

# 5. Restore database
# If RDS is down, create new RDS instance first
aws rds create-db-instance \
    --db-instance-identifier podcastflow-prod-new \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 16 \
    --allocated-storage 100 \
    --master-username podcastflow \
    --master-user-password $DB_PASSWORD

# Wait for RDS to be available
aws rds wait db-instance-available --db-instance-identifier podcastflow-prod-new

# 6. Restore database from S3 backup
aws s3 cp s3://podcastflow-backups/backups/latest-full-backup.tar.gz .
tar -xzf latest-full-backup.tar.gz
cd latest-full-backup
./restore.sh

# 7. Update DNS to point to new instance
# Update Route53 or your DNS provider

# 8. Start application
pm install pm2 -g
pm2 start ecosystem.config.js

# 9. Verify
curl https://app.podcastflow.pro/api/health
```

### 4. Ransomware Attack

**Symptoms**: Encrypted files, ransom demands, suspicious processes

**Recovery Steps**:

```bash
# 1. IMMEDIATELY isolate affected systems
# Remove instance from load balancer
aws elb deregister-instances-from-load-balancer \
    --load-balancer-name podcastflow-lb \
    --instances i-xxxxx

# 2. Snapshot current state for forensics
aws ec2 create-snapshot \
    --volume-id vol-xxxxx \
    --description "Ransomware incident - $(date)"

# 3. Notify security team and law enforcement
# Document everything

# 4. Spin up clean environment from trusted AMI
# Use AMI from before the attack
aws ec2 describe-images \
    --owners self \
    --query "Images[?CreationDate<'2025-07-20'].{ID:ImageId,Date:CreationDate,Name:Name}" \
    --output table

# 5. Restore from immutable S3 backups
# S3 Object Lock prevents ransomware from encrypting backups
aws s3api get-object \
    --bucket podcastflow-backups \
    --key backups/podcastflow-backup-full-20250724-020000.tar.gz \
    --version-id xxxxx \
    backup.tar.gz

# 6. Follow complete system failure recovery steps
# 7. Implement additional security measures
# 8. Change all passwords and rotate all secrets
```

### 5. Data Breach / Tenant Data Exposure

**Symptoms**: Unauthorized access logs, customer complaints, data in wrong tenant

**Recovery Steps**:

```bash
# 1. Identify scope of breach
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production << EOF
-- Check access logs
SELECT 
    user_id,
    organization_id,
    accessed_schema,
    query_type,
    created_at
FROM public.tenant_access_log
WHERE accessed_schema != 'public'
AND organization_id != accessed_schema
ORDER BY created_at DESC
LIMIT 100;
EOF

# 2. Lock affected accounts
PGPASSWORD=$DB_PASSWORD psql -h localhost -U podcastflow -d podcastflow_production << EOF
-- Disable affected users
UPDATE public."User" 
SET "isActive" = false
WHERE id IN (SELECT DISTINCT user_id FROM suspicious_access_list);

-- Force logout
DELETE FROM public."Session"
WHERE "userId" IN (SELECT DISTINCT user_id FROM suspicious_access_list);
EOF

# 3. Audit data access
# Generate report of all accessed data
./generate-breach-report.sh > breach-report-$(date +%Y%m%d).txt

# 4. Notify affected customers
# Use breach notification template

# 5. Restore correct data isolation
# Review and fix any cross-tenant queries
grep -r "querySchema" /home/ec2-user/podcastflow-pro/src/ | grep -v "getUserOrgSlug"

# 6. Implement additional access controls
```

## Testing & Validation

### Monthly Disaster Recovery Test

1. **Backup Validation**
   ```bash
   # Test backup integrity
   ./test-backup-integrity.sh
   ```

2. **Restore Test**
   ```bash
   # Restore to test environment
   ./restore-to-test-env.sh
   ```

3. **Failover Test**
   ```bash
   # Test failover procedures
   ./test-failover.sh
   ```

## Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual RTO | Data Loss (RPO) |
|----------|------------|------------|----------------|
| Database Corruption | 1 hour | 45 min | 6 hours |
| Data Deletion | 2 hours | 1.5 hours | 0 (point-in-time) |
| System Failure | 4 hours | 3 hours | 6 hours |
| Ransomware | 8 hours | 6 hours | 24 hours |
| Data Breach | 30 min | 20 min | N/A |

## Post-Recovery Checklist

- [ ] Application accessible
- [ ] All tenants can log in
- [ ] Database connections stable
- [ ] Background jobs running
- [ ] Email sending working
- [ ] File uploads working
- [ ] Payment processing verified
- [ ] Monitoring alerts configured
- [ ] Backup jobs resumed
- [ ] Incident report filed
- [ ] Customer communication sent
- [ ] Security review completed
- [ ] Lessons learned documented

## Automation Scripts

All disaster recovery scripts are located in:
```
/home/ec2-user/podcastflow-pro/infrastructure/backup/
├── automated-backup.sh
├── restore-database.sh
├── test-backup-integrity.sh
├── restore-to-test-env.sh
├── generate-breach-report.sh
└── emergency-contacts.txt
```

## Important Notes

1. **Always test backups** - A backup is only good if it can be restored
2. **Document everything** - Keep detailed logs during any incident
3. **Communicate early** - Notify stakeholders as soon as an incident is confirmed
4. **Preserve evidence** - Take snapshots before making changes
5. **Follow the plan** - Don't improvise during a crisis

---

*This document should be reviewed quarterly and after any major infrastructure change.*