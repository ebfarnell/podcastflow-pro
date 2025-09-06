#!/bin/bash
# Simple health check script

APP_URL="https://app.podcastflow.pro"
HEALTH_ENDPOINT="$APP_URL/api/health"
LOG_FILE="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/health-check.log"

echo "[$(date)] Running health check..." >> $LOG_FILE

# Check application health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "[$(date)] ✓ Application is healthy (HTTP $HTTP_STATUS)" >> $LOG_FILE
else
    echo "[$(date)] ✗ Application health check failed (HTTP $HTTP_STATUS)" >> $LOG_FILE
    # Could add email notification here if needed
fi

# Check PM2 process
if pm2 status | grep -q "podcastflow-pro.*online"; then
    echo "[$(date)] ✓ PM2 process is running" >> $LOG_FILE
else
    echo "[$(date)] ✗ PM2 process is not running!" >> $LOG_FILE
    # Attempt restart
    pm2 restart podcastflow-pro
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$(date)] ⚠ Disk usage is high: $DISK_USAGE%" >> $LOG_FILE
fi

# Rotate log if too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt 10485760 ]; then
    mv $LOG_FILE $LOG_FILE.old
    echo "[$(date)] Log rotated" > $LOG_FILE
fi
