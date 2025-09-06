#!/bin/bash

# YouTube Daily Sync Script
# This script is called by cron to trigger daily YouTube sync

# Set the API endpoint
API_URL="https://app.podcastflow.pro/api/cron/youtube-sync"

# Optional: Add a secret for authentication (set in .env.production as CRON_SECRET)
CRON_SECRET="${CRON_SECRET:-your-secret-key-here}"

# Log the sync attempt
echo "[$(date)] Starting YouTube daily sync..." >> /home/ec2-user/podcastflow-pro/logs/youtube-sync.log

# Call the sync endpoint
response=$(curl -s -X GET \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${API_URL}")

# Log the response
echo "[$(date)] Sync response: ${response}" >> /home/ec2-user/podcastflow-pro/logs/youtube-sync.log

# Check if successful
if echo "${response}" | grep -q '"organizationsSynced"'; then
  echo "[$(date)] YouTube sync completed successfully" >> /home/ec2-user/podcastflow-pro/logs/youtube-sync.log
else
  echo "[$(date)] YouTube sync failed or returned unexpected response" >> /home/ec2-user/podcastflow-pro/logs/youtube-sync.log
fi