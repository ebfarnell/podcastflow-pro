#!/bin/bash

# PodcastFlow Pro Backup Script
# Creates comprehensive backups of code and database

set -e

# Configuration
BACKUP_DIR="/home/ec2-user/backups"
PROJECT_DIR="/home/ec2-user/podcastflow-pro"
DB_NAME="podcastflow_production"
DB_USER="podcastflow"
DB_PASS="PodcastFlow2025Prod"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== PodcastFlow Pro Backup Script ===${NC}"
echo "Timestamp: $TIMESTAMP"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# 1. Backup Database
echo -e "\n${YELLOW}Backing up database...${NC}"
PGPASSWORD=$DB_PASS pg_dump -U $DB_USER -h localhost $DB_NAME > "$BACKUP_DIR/database-$TIMESTAMP.sql"
gzip "$BACKUP_DIR/database-$TIMESTAMP.sql"
echo -e "${GREEN}✓ Database backed up to: database-$TIMESTAMP.sql.gz${NC}"

# 2. Backup Application Code
echo -e "\n${YELLOW}Backing up application code...${NC}"
cd /home/ec2-user
tar -czf "$BACKUP_DIR/podcastflow-code-$TIMESTAMP.tar.gz" \
  --exclude='podcastflow-pro/node_modules' \
  --exclude='podcastflow-pro/.next' \
  --exclude='podcastflow-pro/.git' \
  --exclude='podcastflow-pro/logs' \
  --exclude='*.log' \
  podcastflow-pro/
echo -e "${GREEN}✓ Code backed up to: podcastflow-code-$TIMESTAMP.tar.gz${NC}"

# 3. Backup Environment Files
echo -e "\n${YELLOW}Backing up configuration files...${NC}"
cd "$PROJECT_DIR"
tar -czf "$BACKUP_DIR/podcastflow-env-$TIMESTAMP.tar.gz" \
  .env \
  .env.production \
  ecosystem.config.js \
  prisma/schema.prisma \
  package.json \
  package-lock.json

echo -e "${GREEN}✓ Configuration backed up to: podcastflow-env-$TIMESTAMP.tar.gz${NC}"

# 4. Backup Nginx Configuration
echo -e "\n${YELLOW}Backing up Nginx configuration...${NC}"
sudo tar -czf "$BACKUP_DIR/nginx-config-$TIMESTAMP.tar.gz" \
  -C /etc/nginx/conf.d/ podcastflow.conf
echo -e "${GREEN}✓ Nginx config backed up to: nginx-config-$TIMESTAMP.tar.gz${NC}"

# 5. Create manifest file
echo -e "\n${YELLOW}Creating backup manifest...${NC}"
cat > "$BACKUP_DIR/manifest-$TIMESTAMP.txt" << EOF
PodcastFlow Pro Backup Manifest
==============================
Timestamp: $TIMESTAMP
Date: $(date)

Files Created:
- database-$TIMESTAMP.sql.gz (PostgreSQL database dump)
- podcastflow-code-$TIMESTAMP.tar.gz (Application code)
- podcastflow-env-$TIMESTAMP.tar.gz (Environment and config files)
- nginx-config-$TIMESTAMP.tar.gz (Nginx configuration)

Database: $DB_NAME
Application Path: $PROJECT_DIR

To Restore:
1. Database: gunzip < database-$TIMESTAMP.sql.gz | PGPASSWORD=$DB_PASS psql -U $DB_USER -h localhost $DB_NAME
2. Code: tar -xzf podcastflow-code-$TIMESTAMP.tar.gz -C /home/ec2-user/
3. Config: tar -xzf podcastflow-env-$TIMESTAMP.tar.gz -C $PROJECT_DIR/
4. Nginx: sudo tar -xzf nginx-config-$TIMESTAMP.tar.gz -C /etc/nginx/conf.d/
EOF

echo -e "${GREEN}✓ Manifest created${NC}"

# 6. Show backup summary
echo -e "\n${GREEN}=== Backup Complete ===${NC}"
echo "Location: $BACKUP_DIR"
echo -e "\nBackup files:"
ls -lh "$BACKUP_DIR"/*$TIMESTAMP* | awk '{print "  - " $9 " (" $5 ")"}'

# 7. Cleanup old backups (keep last 7 days)
echo -e "\n${YELLOW}Cleaning up old backups...${NC}"
find "$BACKUP_DIR" -type f -name "*.tar.gz" -o -name "*.sql.gz" -mtime +7 -delete
echo -e "${GREEN}✓ Old backups cleaned${NC}"

echo -e "\n${GREEN}Backup completed successfully!${NC}"