# AWS SES Bounce and Complaint Notifications Setup

This guide explains how to configure AWS SES to handle bounce and complaint notifications for PodcastFlow Pro.

## Overview

When emails bounce or recipients mark them as spam, AWS SES can notify our application via SNS (Simple Notification Service). This allows us to:

1. Automatically update email delivery status
2. Add hard bounces to the suppression list
3. Track complaints and maintain sender reputation
4. Generate analytics on email performance

## Architecture

```
SES → SNS Topic → HTTPS Webhook → /api/webhooks/ses → Database Updates
```

## Prerequisites

1. AWS credentials with permissions for:
   - SNS: CreateTopic, Subscribe, SetTopicAttributes
   - SES: CreateConfigurationSet, PutConfigurationSetEventDestination

2. SES must be in production mode (not sandbox) for your sending domain

## Setup Instructions

### 1. Run the Setup Script

```bash
cd /home/ec2-user/podcastflow-pro
node scripts/setup-ses-notifications.js
```

This script will:
- Create an SNS topic for SES notifications
- Configure the topic policy to allow SES to publish
- Subscribe your webhook endpoint to the topic
- Create a SES configuration set
- Configure bounce, complaint, and delivery notifications

### 2. Confirm SNS Subscription

After running the script:
1. Check the application logs: `pm2 logs podcastflow-pro`
2. Look for "SNS Subscription Confirmation URL"
3. Visit the URL to confirm the subscription
4. Or check your email for a confirmation link

### 3. Update Environment Variables

Add these to your `.env.production` file:

```env
AWS_SES_TOPIC_ARN=arn:aws:sns:us-west-2:123456789012:podcastflow-ses-notifications
SES_CONFIGURATION_SET=podcastflow-notifications
```

### 4. Restart the Application

```bash
pm2 restart podcastflow-pro
```

## Testing the Setup

### Test Bounce Handling

Send an email to a non-existent address:

```javascript
// In your application or via API
await emailService.sendEmail({
  to: 'bounce@simulator.amazonses.com',
  subject: 'Test Bounce',
  html: '<p>This email will bounce</p>',
  text: 'This email will bounce'
})
```

Then check:
1. `EmailLog` table - should show `bouncedAt` timestamp
2. `EmailSuppressionList` table - should have entry with reason "hard_bounce"
3. `EmailTrackingEvent` table - should have bounce event

### Test Complaint Handling

```javascript
await emailService.sendEmail({
  to: 'complaint@simulator.amazonses.com',
  subject: 'Test Complaint',
  html: '<p>This email will generate a complaint</p>',
  text: 'This email will generate a complaint'
})
```

## Webhook Endpoint Details

The webhook at `/api/webhooks/ses` handles:

### Bounce Notifications
- Updates EmailLog with bounce details
- Creates EmailTrackingEvent record
- Adds permanent bounces to suppression list

### Complaint Notifications
- Updates EmailLog with complaint timestamp
- Creates EmailTrackingEvent record
- Adds complainers to suppression list

### Delivery Notifications
- Updates EmailLog with delivery confirmation
- Useful for tracking successful deliveries

## Monitoring

### Check Webhook Health

```bash
# View recent webhook calls
pm2 logs podcastflow-pro | grep "SES webhook"
```

### Database Queries

```sql
-- Recent bounces
SELECT * FROM "EmailLog" 
WHERE "bouncedAt" IS NOT NULL 
ORDER BY "bouncedAt" DESC 
LIMIT 10;

-- Suppression list stats
SELECT reason, COUNT(*) 
FROM "EmailSuppressionList" 
GROUP BY reason;

-- Email tracking events
SELECT "eventType", COUNT(*) 
FROM "EmailTrackingEvent" 
WHERE "timestamp" > NOW() - INTERVAL '24 hours'
GROUP BY "eventType";
```

## Troubleshooting

### Webhook Not Receiving Notifications

1. Check SNS subscription is confirmed:
   ```bash
   aws sns list-subscriptions-by-topic --topic-arn YOUR_TOPIC_ARN
   ```

2. Verify webhook is accessible:
   ```bash
   curl -X POST https://app.podcastflow.pro/api/webhooks/ses \
     -H "Content-Type: application/json" \
     -d '{"Type": "Notification", "Message": "{}"}'
   ```

3. Check SES configuration set:
   ```bash
   aws ses get-configuration-set --configuration-set-name podcastflow-notifications
   ```

### Notifications Not Being Processed

1. Check PM2 logs for errors
2. Verify database connection
3. Check webhook signature verification is working

## Security Considerations

1. The webhook validates that notifications come from the expected SNS topic ARN
2. In production, implement full SNS signature verification
3. Use HTTPS for the webhook endpoint (already configured)
4. Regularly review the suppression list for false positives

## Maintenance

### Monthly Tasks

1. Review suppression list for false positives
2. Check email reputation metrics
3. Analyze bounce and complaint rates
4. Clean up old EmailTrackingEvent records (>90 days)

### Monitoring Alerts

Set up alerts for:
- Bounce rate > 5%
- Complaint rate > 0.1%
- Webhook errors
- Suppression list growth rate

## Related Documentation

- [Email Template System](./EMAIL_TEMPLATES.md)
- [Email Analytics Dashboard](./EMAIL_ANALYTICS.md)
- [AWS SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)