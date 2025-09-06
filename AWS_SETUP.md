# AWS S3 Backup Configuration Guide

## Overview
PodcastFlow Pro supports automatic backup uploads to Amazon S3 for secure off-site storage. Each organization's backups are stored in isolated folders within the S3 bucket.

## S3 Bucket Structure
```
s3://podcastflow-pro-uploads-590183844530/
└── organizations/
    ├── {org-id-1}/
    │   └── backups/
    │       ├── db-2025-08-25T04-27-23.sql.gz
    │       └── export-2025-08-25T03-56-20.zip
    └── {org-id-2}/
        └── backups/
```

## Configuration Methods

### Method 1: Interactive Configuration Script (Recommended)
```bash
cd /home/ec2-user/podcastflow-pro
./scripts/configure-aws-credentials.sh
```
This script will:
- Prompt for your AWS credentials
- Validate the credentials
- Save them securely to the .env file
- Test S3 bucket access

### Method 2: Quick Add Script
If you have your credentials ready:
```bash
cd /home/ec2-user/podcastflow-pro
./scripts/add-aws-credentials.sh YOUR_ACCESS_KEY YOUR_SECRET_KEY us-east-1
```

### Method 3: Manual Configuration
Add to `/home/ec2-user/podcastflow-pro/.env`:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

### Method 4: IAM Role (EC2 Best Practice)
If running on EC2, attach an IAM role with the policy in `scripts/aws-s3-backup-policy.json`

## Creating AWS Credentials

### Step 1: Create IAM User
1. Log into AWS Console
2. Navigate to IAM → Users → Add User
3. User name: `podcastflow-backup`
4. Access type: ✅ Programmatic access

### Step 2: Set Permissions
Either:
- **Option A**: Attach existing policy `AmazonS3FullAccess` (simple but broad)
- **Option B**: Create custom policy using `scripts/aws-s3-backup-policy.json` (recommended)

To create custom policy:
1. IAM → Policies → Create Policy
2. Select JSON tab
3. Paste contents of `scripts/aws-s3-backup-policy.json`
4. Name: `PodcastFlowS3BackupPolicy`
5. Attach to your IAM user

### Step 3: Save Credentials
After creating the user, AWS will show:
- Access key ID (example: `AKIAIOSFODNN7EXAMPLE`)
- Secret access key (example: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

⚠️ **IMPORTANT**: Save these immediately - the secret key won't be shown again!

## After Configuration

### Rebuild and Deploy
After adding credentials, rebuild the application:
```bash
cd /home/ec2-user/podcastflow-pro
NODE_OPTIONS="--max-old-space-size=4096" timeout 600 npm run build
pm2 restart podcastflow-pro --update-env
```

### Verify Configuration
Test that backups upload to S3:
1. Log into the application as admin
2. Go to Settings → Backups
3. Create a new backup
4. Check PM2 logs: `pm2 logs podcastflow-pro --lines 50`
5. Look for: "✅ Successfully uploaded to S3"

### Check S3 Bucket
```bash
# List backups in S3
aws s3 ls s3://podcastflow-pro-uploads-590183844530/organizations/ --recursive
```

## Troubleshooting

### Invalid Credentials Error
```
Error: The AWS Access Key Id you provided does not exist in our records
```
**Solution**: Check that credentials are correct and the IAM user is active

### Access Denied Error
```
Error: Access Denied
```
**Solution**: Ensure IAM user has S3 permissions for the bucket

### Bucket Not Found
```
Error: The specified bucket does not exist
```
**Solution**: Verify bucket name in .env file matches actual S3 bucket

### Credentials Not Loaded
```
Error: Resolved credential object is not valid
```
**Solution**: Ensure credentials are in .env and application was rebuilt/restarted

## Security Best Practices

1. **Never commit credentials to git**
   - .env is in .gitignore
   - Don't add credentials to any tracked files

2. **Use IAM roles on EC2**
   - More secure than access keys
   - No credentials to manage

3. **Rotate credentials regularly**
   - Create new access keys periodically
   - Delete old keys after updating

4. **Use minimum required permissions**
   - Custom policy is better than S3FullAccess
   - Only grant access to specific bucket/paths

5. **Enable MFA for IAM user**
   - Add extra security layer
   - Especially for production environments

## Support
For issues with AWS configuration, check:
- PM2 logs: `pm2 logs podcastflow-pro`
- AWS credentials: `aws configure list`
- S3 access: `aws s3 ls s3://podcastflow-pro-uploads-590183844530/`