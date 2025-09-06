# AWS RDS PostgreSQL Setup Guide

## Overview

This guide will help you set up an AWS RDS PostgreSQL database for PodcastFlow Pro production deployment.

## Step 1: Create RDS PostgreSQL Instance

### Via AWS Console:

1. **Navigate to RDS**
   - Go to AWS Console → RDS → Create database

2. **Choose Database Creation Method**
   - Select "Standard create"

3. **Engine Options**
   - Engine type: PostgreSQL
   - Version: PostgreSQL 15.x (or latest stable)

4. **Templates**
   - Choose "Production" for high availability
   - Or "Dev/Test" for cost savings

5. **Settings**
   - DB instance identifier: `podcastflow-pro-db`
   - Master username: `podcastflow`
   - Master password: Generate a strong password

6. **Instance Configuration**
   - DB instance class: `db.t3.small` (minimum for production)
   - Storage: 20 GB minimum, enable autoscaling

7. **Connectivity**
   - VPC: Same VPC as your EC2 instance
   - Public access: No (for security)
   - VPC security group: Create new
   - Database port: 5432

8. **Database Authentication**
   - Password authentication

9. **Additional Configuration**
   - Initial database name: `podcastflow`
   - Enable automated backups
   - Backup retention: 7 days
   - Enable encryption

### Via AWS CLI:

```bash
aws rds create-db-instance \
  --db-instance-identifier podcastflow-pro-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username podcastflow \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --db-name podcastflow \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --no-publicly-accessible
```

## Step 2: Configure Security Group

1. **Edit RDS Security Group**
   - Add inbound rule:
     - Type: PostgreSQL
     - Port: 5432
     - Source: Your EC2 security group ID

2. **Edit EC2 Security Group**
   - Ensure outbound rules allow traffic to RDS

## Step 3: Get Connection Details

After creation (takes ~10 minutes):

1. Go to RDS → Databases → podcastflow-pro-db
2. Copy the endpoint (e.g., `podcastflow-pro-db.xxxxxxxxxxxx.us-west-2.rds.amazonaws.com`)

## Step 4: Configure PodcastFlow Pro

1. **Create Production Environment File**
   ```bash
   cp .env.production.example .env.production
   ```

2. **Update DATABASE_URL**
   ```
   DATABASE_URL="postgresql://podcastflow:YOUR_PASSWORD@podcastflow-pro-db.xxxxxxxxxxxx.us-west-2.rds.amazonaws.com:5432/podcastflow?sslmode=require"
   ```

## Step 5: Test Connection

From your EC2 instance:

```bash
# Install PostgreSQL client (if needed)
sudo yum install postgresql15

# Test connection
psql "postgresql://podcastflow:YOUR_PASSWORD@your-rds-endpoint:5432/podcastflow?sslmode=require"
```

## Step 6: Initialize Database

Run the deployment script:

```bash
cd /home/ec2-user/podcastflow-pro
./scripts/deploy-production.sh --seed
```

## Cost Optimization

### For Development/Testing:
- Use `db.t3.micro` (free tier eligible)
- Stop instance when not in use
- Disable Multi-AZ

### For Production:
- Use at least `db.t3.small`
- Enable Multi-AZ for high availability
- Set up read replicas for scaling
- Use reserved instances for cost savings

## Monitoring

1. **Enable Performance Insights**
   - Free for 7 days of history
   - Helps identify slow queries

2. **CloudWatch Alarms**
   - CPU utilization > 80%
   - Storage space < 10%
   - Connection count anomalies

3. **Enhanced Monitoring**
   - 60-second granularity
   - OS-level metrics

## Backup Strategy

1. **Automated Backups**
   - Already enabled with 7-day retention
   - Point-in-time recovery available

2. **Manual Snapshots**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier podcastflow-pro-db \
     --db-snapshot-identifier podcastflow-pro-snapshot-$(date +%Y%m%d)
   ```

3. **Cross-Region Backups**
   - Copy snapshots to another region for DR

## Security Best Practices

1. **Encryption**
   - Enable encryption at rest (already done)
   - Use SSL/TLS for connections (sslmode=require)

2. **Access Control**
   - Use IAM authentication for additional security
   - Rotate passwords regularly
   - Use AWS Secrets Manager for credentials

3. **Network Security**
   - Keep RDS in private subnet
   - Use security groups restrictively
   - Enable VPC Flow Logs

## Maintenance

1. **Updates**
   - Enable auto minor version upgrade
   - Schedule maintenance windows

2. **Scaling**
   - Vertical: Change instance class
   - Horizontal: Add read replicas
   - Storage: Enable autoscaling

## Troubleshooting

### Connection Issues:
1. Check security groups
2. Verify VPC settings
3. Confirm endpoint and credentials
4. Check RDS instance status

### Performance Issues:
1. Review Performance Insights
2. Check slow query log
3. Analyze execution plans
4. Consider scaling up

### Cost Issues:
1. Review instance class
2. Check storage usage
3. Consider reserved instances
4. Use Aurora Serverless for variable workloads