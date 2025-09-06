#!/bin/bash

# Comprehensive backup script for PodcastFlow Pro

set -e

echo "======================================"
echo "PodcastFlow Pro - Project Backup"
echo "======================================"

# Configuration
BACKUP_DIR="/home/ec2-user/backups"
PROJECT_DIR="/home/ec2-user/podcastflow-pro"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="podcastflow-pro-backup-${TIMESTAMP}"
S3_BUCKET="podcastflow-backups-$(aws sts get-caller-identity --query Account --output text)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create backup directory
mkdir -p ${BACKUP_DIR}

echo -e "${GREEN}Step 1: Creating local backup...${NC}"

# Create backup excluding node_modules and .next
cd /home/ec2-user
tar -czf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz \
    --exclude='podcastflow-pro/node_modules' \
    --exclude='podcastflow-pro/.next' \
    --exclude='podcastflow-pro/logs' \
    --exclude='podcastflow-pro/temp' \
    podcastflow-pro/

echo "Local backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Size: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)"

echo -e "\n${GREEN}Step 2: Creating S3 bucket for backups...${NC}"

# Create S3 bucket if it doesn't exist
aws s3 mb s3://${S3_BUCKET} --region us-east-1 2>/dev/null || echo "Bucket already exists"

# Enable versioning on bucket
aws s3api put-bucket-versioning \
    --bucket ${S3_BUCKET} \
    --versioning-configuration Status=Enabled

echo -e "\n${GREEN}Step 3: Uploading to S3...${NC}"

# Upload to S3
aws s3 cp ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz \
    s3://${S3_BUCKET}/project-backups/ \
    --storage-class STANDARD_IA

echo -e "\n${GREEN}Step 4: Backing up infrastructure state...${NC}"

# Backup infrastructure configuration
cd ${PROJECT_DIR}
mkdir -p ${BACKUP_DIR}/infrastructure-state

# Export CloudFormation stacks
for stack in podcastflow-auth podcastflow-api podcastflow-production; do
    aws cloudformation describe-stacks \
        --stack-name ${stack} \
        --output json > ${BACKUP_DIR}/infrastructure-state/${stack}.json 2>/dev/null || echo "Stack ${stack} not found"
done

# Export Route 53 configuration
aws route53 list-resource-record-sets \
    --hosted-zone-id Z04345471WAC1KVXSQIGM \
    --output json > ${BACKUP_DIR}/infrastructure-state/route53-records.json 2>/dev/null || true

# Export DynamoDB table schema
aws dynamodb describe-table \
    --table-name podcastflow-pro \
    --output json > ${BACKUP_DIR}/infrastructure-state/dynamodb-schema.json

# List all secrets (not values)
aws secretsmanager list-secrets \
    --filters Key=name,Values=podcastflow \
    --output json > ${BACKUP_DIR}/infrastructure-state/secrets-list.json

# Zip infrastructure state
cd ${BACKUP_DIR}
tar -czf infrastructure-state-${TIMESTAMP}.tar.gz infrastructure-state/
aws s3 cp infrastructure-state-${TIMESTAMP}.tar.gz s3://${S3_BUCKET}/infrastructure-backups/

echo -e "\n${GREEN}Step 5: Creating backup documentation...${NC}"

# Create backup manifest
cat > ${BACKUP_DIR}/backup-manifest-${TIMESTAMP}.txt << EOF
PodcastFlow Pro Backup Manifest
================================
Date: $(date)
Timestamp: ${TIMESTAMP}

Project Backup:
- Location: s3://${S3_BUCKET}/project-backups/${BACKUP_NAME}.tar.gz
- Local: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz
- Size: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)

Infrastructure Backup:
- Location: s3://${S3_BUCKET}/infrastructure-backups/infrastructure-state-${TIMESTAMP}.tar.gz
- Includes: CloudFormation stacks, Route53 config, DynamoDB schema, Secrets list

Key Resources:
- Domain: podcastflow.pro
- Certificate ARN: arn:aws:acm:us-east-1:590183844530:certificate/6ab69690-10b8-4706-8b1a-c0cf75277926
- API Gateway: https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod
- Load Balancer: podcastflow-alb-883578496.us-east-1.elb.amazonaws.com
- DynamoDB Table: podcastflow-pro
- Cognito User Pool: us-east-1_n2gbeGsU4

Important Files Backed Up:
- All source code (src/)
- Infrastructure scripts (infrastructure/)
- Configuration files (.env.local, .env.production)
- Documentation (*.md files)
- Package configurations (package.json, tsconfig.json)

Not Included:
- node_modules/
- .next/ (build artifacts)
- logs/
- temp files

Restoration Command:
aws s3 cp s3://${S3_BUCKET}/project-backups/${BACKUP_NAME}.tar.gz .
tar -xzf ${BACKUP_NAME}.tar.gz
EOF

# Upload manifest
aws s3 cp ${BACKUP_DIR}/backup-manifest-${TIMESTAMP}.txt \
    s3://${S3_BUCKET}/manifests/

echo -e "\n${GREEN}Step 6: Setting up automated backups...${NC}"

# Create daily backup cron job
cat > ${PROJECT_DIR}/scripts/daily-backup.sh << 'DAILY'
#!/bin/bash
# Daily automated backup
/home/ec2-user/podcastflow-pro/scripts/backup-project.sh > /home/ec2-user/backups/backup-log-$(date +%Y%m%d).log 2>&1

# Keep only last 7 local backups
find /home/ec2-user/backups -name "podcastflow-pro-backup-*.tar.gz" -mtime +7 -delete
DAILY

chmod +x ${PROJECT_DIR}/scripts/daily-backup.sh

# Add to crontab (commented out - uncomment to enable)
# (crontab -l 2>/dev/null; echo "0 2 * * * /home/ec2-user/podcastflow-pro/scripts/daily-backup.sh") | crontab -

echo -e "\n${GREEN}Backup Summary${NC}"
echo "======================================"
echo -e "${GREEN}✅ Local backup:${NC} ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo -e "${GREEN}✅ S3 backup:${NC} s3://${S3_BUCKET}/project-backups/${BACKUP_NAME}.tar.gz"
echo -e "${GREEN}✅ Infrastructure:${NC} s3://${S3_BUCKET}/infrastructure-backups/"
echo -e "${GREEN}✅ Manifest:${NC} s3://${S3_BUCKET}/manifests/backup-manifest-${TIMESTAMP}.txt"
echo ""
echo -e "${YELLOW}To restore from this backup:${NC}"
echo "aws s3 cp s3://${S3_BUCKET}/project-backups/${BACKUP_NAME}.tar.gz ."
echo "tar -xzf ${BACKUP_NAME}.tar.gz"
echo ""
echo -e "${YELLOW}To enable daily backups:${NC}"
echo "Uncomment the crontab line in this script and run again"