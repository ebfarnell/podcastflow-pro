#!/bin/bash

# Email queue processor script
# This should be called by cron every 5 minutes

echo "[$(date)] Processing email queue..."

# Call the email queue API endpoint
curl -X POST http://localhost:3000/api/cron/email-queue \
  -H "Authorization: Bearer podcastflow-cron-2025" \
  -H "Content-Type: application/json" \
  --max-time 300

echo "[$(date)] Email queue processing complete"