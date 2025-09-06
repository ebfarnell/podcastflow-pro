# Database Setup Guide

## Overview

PodcastFlow Pro uses PostgreSQL as its primary database with Prisma ORM for database access. This guide will help you set up the database for development and production environments.

## Prerequisites

- PostgreSQL 13+ installed and running
- Node.js 18+ and npm installed
- AWS credentials configured (for S3 file storage)
- SMTP server credentials (for email notifications)

## Quick Start

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib

   # macOS
   brew install postgresql
   brew services start postgresql

   # Create a database
   sudo -u postgres createdb podcastflow
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/podcastflow"
   
   # Authentication
   NEXTAUTH_SECRET="your-secret-key-here"
   
   # AWS (for file storage)
   AWS_REGION="us-west-2"
   AWS_ACCESS_KEY_ID="your-access-key"
   AWS_SECRET_ACCESS_KEY="your-secret-key"
   S3_BUCKET_NAME="your-bucket-name"
   
   # Email (for notifications)
   EMAIL_FROM="noreply@podcastflow.com"
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT="587"
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASSWORD="your-app-password"
   ```

3. **Run Database Setup**:
   ```bash
   npm run db:setup
   ```

   This will:
   - Check database connectivity
   - Generate Prisma client
   - Create database schema
   - Seed sample data

## Manual Setup

If you prefer to set up the database manually:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed sample data
npm run db:seed
```

## Database Schema

The database includes the following main entities:

- **Organizations**: Media companies managing podcasts
- **Users**: System users with different roles (admin, sales, producer, talent, client)
- **Shows**: Podcast shows managed by organizations
- **Episodes**: Individual podcast episodes
- **Advertisers**: Companies advertising on podcasts
- **Campaigns**: Advertising campaigns
- **AdApprovals**: Workflow for approving ad spots
- **SpotSubmissions**: Submitted audio files for approval
- **Comments**: Discussion on ad approvals
- **Notifications**: System notifications for users

## User Roles

The system supports the following user roles:

- **master**: Super admin with full access
- **admin**: Organization admin
- **sales**: Sales representatives
- **producer**: Podcast producers
- **talent**: Podcast talent/hosts
- **client**: External clients (advertisers)

## Sample Data

After seeding, you can log in with these credentials:

**Master Admin**:
- Email: master@podcastflow.com
- Password: masterpassword123

**Demo Media Admin**:
- Email: admin@demomedia.com
- Password: adminpassword123

**Sales Rep**:
- Email: sales@demomedia.com
- Password: salespassword123

**Producer**:
- Email: producer@demomedia.com
- Password: producerpassword123

**Talent**:
- Email: talent@demomedia.com
- Password: talentpassword123

## Development Tools

### Prisma Studio

View and edit your database data through a visual interface:

```bash
npm run db:studio
```

This will open Prisma Studio at http://localhost:5555

### Database Migrations

For production deployments, use migrations instead of db:push:

```bash
# Create a new migration
npm run db:migrate

# Deploy migrations in production
npx prisma migrate deploy
```

### Reset Database

To completely reset the database and reseed:

```bash
npm run db:reset
```

⚠️ **Warning**: This will delete all existing data!

## Production Deployment

For production deployment:

1. Use a managed PostgreSQL service (AWS RDS, Heroku Postgres, etc.)
2. Set DATABASE_URL to your production database
3. Run migrations: `npx prisma migrate deploy`
4. Generate Prisma client: `npx prisma generate`
5. Seed initial data if needed (customize seed script for production)

## Troubleshooting

### Connection Errors

If you get connection errors:

1. Check PostgreSQL is running: `sudo service postgresql status`
2. Verify DATABASE_URL format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
3. Check database exists: `psql -U postgres -c "\l"`
4. Verify user permissions: `psql -U postgres -c "\du"`

### Migration Issues

If migrations fail:

1. Check for pending migrations: `npx prisma migrate status`
2. Reset migrations: `npx prisma migrate reset`
3. Check schema validity: `npx prisma validate`

### Performance

For better performance:

1. Add database indexes (already included in schema)
2. Use connection pooling (Prisma handles this)
3. Monitor query performance with logging
4. Use Prisma query optimization features

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@localhost:5432/db |
| NEXTAUTH_SECRET | Secret for JWT signing | random-32-char-string |
| AWS_REGION | AWS region for S3 | us-west-2 |
| AWS_ACCESS_KEY_ID | AWS access key | AKIAXXXXXXXXX |
| AWS_SECRET_ACCESS_KEY | AWS secret key | wJaXXXXXXXXXX |
| S3_BUCKET_NAME | S3 bucket for uploads | podcastflow-uploads |
| EMAIL_FROM | From address for emails | noreply@podcastflow.com |
| EMAIL_HOST | SMTP server host | smtp.gmail.com |
| EMAIL_PORT | SMTP server port | 587 |
| EMAIL_USER | SMTP username | your-email@gmail.com |
| EMAIL_PASSWORD | SMTP password | app-specific-password |