# PodcastFlow Pro - Production Deployment Guide

## Overview

This guide covers deploying PodcastFlow Pro to production with the new PostgreSQL database backend. The application is currently running on this EC2 instance with DynamoDB, but needs to be updated to use the new PostgreSQL-based system.

## Current Status

- ✅ Application running on EC2 with PM2
- ✅ Code updated to use PostgreSQL + Prisma
- ✅ Authentication system implemented
- ⏳ Need PostgreSQL database for production
- ⏳ Need to run deployment with new code

## Deployment Options

### Option 1: AWS RDS PostgreSQL (Recommended for Production)

1. **Create RDS Instance**
   - See [AWS RDS Setup Guide](./docs/AWS_RDS_SETUP.md)
   - Estimated cost: $15-50/month depending on instance size

2. **Configure Environment**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your RDS details
   ```

3. **Deploy**
   ```bash
   ./scripts/deploy-production.sh --seed
   ```

### Option 2: Local PostgreSQL (Testing Only)

1. **Install PostgreSQL**
   ```bash
   ./scripts/setup-local-postgres.sh
   ```

2. **Configure Environment**
   ```bash
   cp .env.local .env
   ```

3. **Deploy**
   ```bash
   npm run db:setup
   ./scripts/deploy-production.sh
   ```

### Option 3: External PostgreSQL Service

Use any PostgreSQL service (Supabase, Neon, Railway, etc.):

1. **Get Database URL from your provider**

2. **Configure Environment**
   ```bash
   cp .env.production.example .env.production
   # Add your database URL
   ```

3. **Deploy**
   ```bash
   ./scripts/deploy-production.sh --seed
   ```

## Quick Deployment Steps

### For Immediate Testing (Local PostgreSQL):

```bash
# 1. Set up local PostgreSQL
./scripts/setup-local-postgres.sh

# 2. Copy environment config
cp .env.local .env

# 3. Install dependencies (if not already done)
npm install --legacy-peer-deps

# 4. Generate Prisma client
npx prisma generate

# 5. Push database schema
npx prisma db push

# 6. Seed database with test data
npm run db:seed

# 7. Build application
npm run build

# 8. Restart with PM2
pm2 restart podcastflow-pro

# 9. Check logs
pm2 logs podcastflow-pro
```

### For Production (AWS RDS):

1. **Create RDS PostgreSQL instance** (see AWS_RDS_SETUP.md)

2. **Update .env.production**
   ```env
   DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/podcastflow?sslmode=require"
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   # ... other variables
   ```

3. **Run deployment script**
   ```bash
   ./scripts/deploy-production.sh --seed
   ```

## Environment Variables

### Required Variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret-key"

# AWS (already configured on EC2)
AWS_REGION="us-west-2"
S3_BUCKET_NAME="podcastflow-pro-uploads"

# Email
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_HOST="smtp.example.com"
EMAIL_PORT="587"
EMAIL_USER="smtp-user"
EMAIL_PASSWORD="smtp-password"
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Check application status
pm2 status

# View logs
pm2 logs podcastflow-pro

# Test database connection
npx prisma db push --skip-generate
```

### 2. Access Application

- URL: `http://your-ec2-ip:3000`
- Default login credentials (after seeding):
  - Master: master@podcastflow.com / masterpassword123
  - Admin: admin@demomedia.com / adminpassword123

### 3. Configure Domain (Optional)

Update nginx configuration for your domain:
```bash
sudo nano /etc/nginx/conf.d/podcastflow.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring

### Application Logs
```bash
pm2 logs podcastflow-pro
pm2 monit
```

### Database
- Use RDS Performance Insights
- Or: `npx prisma studio` for data browsing

### System
```bash
./monitor.sh  # If available
htop
df -h
```

## Troubleshooting

### Database Connection Failed
1. Check DATABASE_URL format
2. Verify network connectivity
3. Check security groups (for RDS)
4. Test with psql client

### Application Won't Start
1. Check PM2 logs: `pm2 logs podcastflow-pro`
2. Verify all dependencies installed
3. Check build output
4. Ensure port 3000 is available

### Build Failures
1. Clear .next directory: `rm -rf .next`
2. Clear node_modules: `rm -rf node_modules && npm install --legacy-peer-deps`
3. Check disk space: `df -h`

## Rollback Procedure

If deployment fails:

```bash
# Stop current deployment
pm2 stop podcastflow-pro

# Restore previous build (if available)
# Or rebuild from previous commit

# Restart
pm2 start ecosystem.config.js --env production
```

## Security Checklist

- [ ] Strong database password
- [ ] NEXTAUTH_SECRET is random and secure
- [ ] RDS is not publicly accessible
- [ ] Security groups properly configured
- [ ] SSL/TLS enabled for database connections
- [ ] Regular backups configured
- [ ] Monitoring alerts set up

## Next Steps

1. **Choose your database option** (RDS recommended for production)
2. **Run the appropriate deployment steps**
3. **Verify everything is working**
4. **Configure monitoring and backups**
5. **Set up your domain and SSL certificate**

For questions or issues, check the logs first:
- Application logs: `pm2 logs podcastflow-pro`
- Database logs: AWS RDS console or `psql` client
- System logs: `/var/log/messages`