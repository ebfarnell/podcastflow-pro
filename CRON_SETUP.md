# PodcastFlow Pro - Cron Job Setup

## Email Queue Processor

The email queue processor should run every 5 minutes to process pending emails.

### Option 1: Using crontab (if available)

Add this line to your crontab:
```bash
*/5 * * * * /home/ec2-user/podcastflow-pro/scripts/process-email-queue.sh >> /home/ec2-user/podcastflow-pro/logs/email-queue.log 2>&1
```

### Option 2: Using systemd timers

1. Copy the service files:
```bash
sudo cp /home/ec2-user/podcastflow-pro/scripts/email-queue.service /etc/systemd/system/
sudo cp /home/ec2-user/podcastflow-pro/scripts/email-queue.timer /etc/systemd/system/
```

2. Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable email-queue.timer
sudo systemctl start email-queue.timer
```

3. Check status:
```bash
sudo systemctl status email-queue.timer
sudo systemctl list-timers
```

### Option 3: Manual Testing

Run the processor manually:
```bash
curl -X POST http://localhost:3000/api/cron/email-queue \
  -H "Authorization: Bearer podcastflow-cron-2025" \
  -H "Content-Type: application/json"
```

## Other Cron Jobs

### Email Notifications (Daily at 9 AM)
```bash
0 9 * * * curl -X POST http://localhost:3000/api/cron/email-notifications -H "Authorization: Bearer podcastflow-cron-2025"
```

### Monthly Billing (1st of each month at 2 AM)
```bash
0 2 1 * * curl -X POST http://localhost:3000/api/cron/monthly-billing -H "Authorization: Bearer podcastflow-cron-2025"
```

## Monitoring

Check email queue status:
```bash
curl http://localhost:3000/api/cron/email-queue
```

View system logs:
```bash
pm2 logs podcastflow-pro | grep -i email
```