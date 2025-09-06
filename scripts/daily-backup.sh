#!/bin/bash
# Daily automated backup
/home/ec2-user/podcastflow-pro/scripts/backup-project.sh > /home/ec2-user/backups/backup-log-$(date +%Y%m%d).log 2>&1

# Keep only last 7 local backups
find /home/ec2-user/backups -name "podcastflow-pro-backup-*.tar.gz" -mtime +7 -delete
