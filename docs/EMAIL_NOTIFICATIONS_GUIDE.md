# Email Notifications System - Complete Guide

## Overview

PodcastFlow Pro's email notification system provides automated, event-driven email notifications for key business events. The system supports both immediate and scheduled notifications with customizable templates.

## Architecture

```
Event → NotificationService → EmailEventHandler → EmailService → SES
                ↓                      ↓
           In-App Notification    Email Queue
```

## Key Components

### 1. Notification Service (`/src/services/notifications/notification-service.ts`)
- Central hub for all notifications (in-app + email)
- Handles user preferences
- Provides specialized methods for common scenarios

### 2. Email Event Handler (`/src/services/email/event-handler.ts`)
- Maps events to email templates
- Handles template data preparation
- Supports bulk notifications

### 3. Email Templates
- 18 system templates for various events
- Organization-specific template overrides
- Handlebars templating with variables

### 4. Cron Job (`/api/cron/email-notifications`)
- Processes scheduled notifications
- Handles deadline reminders
- Sends payment reminders
- Manages daily digests

## Supported Events

### Task Management
- **task_assignment** - When a task is assigned to a user
- **task_completion** - When a task is marked complete
- **deadline_reminder** - Upcoming task deadlines

### Campaign Management
- **campaign_status_update** - Campaign status changes
- **campaign_launch** - Campaign goes live
- **budget_alert** - Budget threshold warnings
- **performance_alert** - Performance issues detected

### Approval Workflow
- **approval_request** - New item needs approval
- **spot_submitted** - Ad submitted for review
- **spot_approved** - Ad approved
- **spot_rejected** - Ad rejected
- **revision_requested** - Changes requested

### Financial
- **payment_reminder** - Invoice payment due
- **payment_received** - Payment confirmation

### System
- **user_invitation** - New user invited
- **report_ready** - Report generation complete
- **system_maintenance** - Maintenance announcements
- **daily_digest** - Daily activity summary

## Usage Examples

### Send Task Assignment Notification

```typescript
import { notificationService } from '@/services/notifications/notification-service'

// Notify user of task assignment
await notificationService.notifyTaskAssignment(
  assigneeId,
  {
    id: 'task-123',
    title: 'Review podcast script',
    description: 'Review and approve the script for episode 45',
    priority: 'high',
    dueDate: new Date('2025-08-01')
  },
  'John Smith', // Assigned by
  true // Send email
)
```

### Send Campaign Status Update

```typescript
// Notify team of campaign status change
await notificationService.notifyCampaignStatusChange(
  ['user1', 'user2', 'user3'], // User IDs
  {
    id: 'campaign-456',
    name: 'Summer Podcast Sponsorship'
  },
  'draft',
  'active',
  'Jane Doe', // Updated by
  'Campaign approved and ready to launch',
  true // Send email
)
```

### Send Custom Event Email

```typescript
import { emailEventHandler } from '@/services/email/event-handler'

// Send custom notification using event handler
await emailEventHandler.handleEvent({
  type: 'payment_reminder',
  recipients: ['client@example.com'],
  organizationId: 'org-123',
  data: {
    clientName: 'ABC Company',
    invoiceNumber: 'INV-2025-001',
    amountDue: '$5,000.00',
    dueDate: '2025-08-15',
    daysOverdue: 0,
    isOverdue: false,
    paymentLink: 'https://app.podcastflow.pro/invoices/inv-123/pay'
  }
})
```

### Queue Notifications for Later

```typescript
// Queue a notification for specific time
await emailEventHandler.queueEvent({
  type: 'deadline_reminder',
  recipients: ['user@example.com'],
  organizationId: 'org-123',
  data: {
    itemTitle: 'Q3 Campaign Report',
    deadline: '2025-08-01 5:00 PM'
  },
  scheduledFor: new Date('2025-07-31 09:00:00'), // Send day before
  priority: 3 // Higher priority
})
```

## Email Templates

### Template Structure

Each template includes:
- **key**: Unique identifier
- **name**: Display name
- **subject**: Email subject (supports variables)
- **htmlContent**: HTML email body
- **textContent**: Plain text fallback
- **variables**: List of required variables
- **category**: Template category

### Template Variables

Common variables available in all templates:
- `{{supportEmail}}` - Support email address
- `{{currentYear}}` - Current year
- `{{appUrl}}` - Application URL
- `{{organizationName}}` - Organization name

### Creating Custom Templates

Organizations can override system templates:

```javascript
// Via API
POST /api/organization/email-templates
{
  "key": "task-assignment",
  "name": "Custom Task Assignment",
  "subject": "New Task: {{taskTitle}} - Due {{dueDate}}",
  "htmlContent": "<custom HTML>",
  "textContent": "Custom plain text",
  "variables": ["taskTitle", "dueDate", "assigneeName"]
}
```

## Cron Job Configuration

The email notification cron job runs periodically to:

1. **Process Deadline Reminders**
   - Tasks due in next 24 hours
   - Urgent reminders for <4 hours

2. **Send Budget Alerts**
   - 75% budget usage warning
   - 90% budget usage critical alert

3. **Payment Reminders**
   - Overdue invoices
   - Upcoming due dates (3 days)

4. **Daily Digests**
   - Unread notifications summary
   - New task assignments
   - Campaign updates

### Running the Cron Job

```bash
# Manual trigger
curl -X POST https://app.podcastflow.pro/api/cron/email-notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Schedule with crontab (every 4 hours)
0 */4 * * * curl -X POST https://app.podcastflow.pro/api/cron/email-notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## User Preferences

Users can control notifications via preferences:

```typescript
// Get user preferences
const prefs = await notificationService.getUserNotificationPreferences(userId)

// Update preferences
await notificationService.updateUserNotificationPreferences(userId, {
  email: true,               // Enable email notifications
  taskAssignments: true,     // Task assignment emails
  campaignUpdates: false,    // Campaign update emails
  paymentReminders: true,    // Payment reminder emails
  emailFrequency: 'daily'    // daily, weekly, or instant
})
```

## Testing

### Test Individual Notifications

```bash
node scripts/test-email-notifications.js
```

### Test Email Templates

```bash
# Send test email with template
curl -X POST https://app.podcastflow.pro/api/organization/email-templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "templateKey": "task-assignment",
    "templateData": {
      "taskTitle": "Test Task",
      "assigneeName": "John Doe"
    }
  }'
```

### Check Email Queue

```sql
-- View pending emails
SELECT * FROM "EmailQueue" 
WHERE status = 'pending' 
ORDER BY "createdAt" DESC;

-- View email logs
SELECT * FROM "EmailLog" 
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

## Monitoring

### Key Metrics to Track

1. **Email Delivery Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'delivered') * 100.0 / COUNT(*) as delivery_rate
   FROM "EmailLog"
   WHERE "createdAt" > NOW() - INTERVAL '24 hours';
   ```

2. **Notification Engagement**
   ```sql
   SELECT 
     type,
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE read = true) as read,
     COUNT(*) FILTER (WHERE read = true) * 100.0 / COUNT(*) as read_rate
   FROM "Notification"
   WHERE "createdAt" > NOW() - INTERVAL '7 days'
   GROUP BY type;
   ```

3. **Queue Performance**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     AVG(attempts) as avg_attempts
   FROM "EmailQueue"
   GROUP BY status;
   ```

### Alerts to Configure

- Email bounce rate > 5%
- Email complaint rate > 0.1%
- Queue backlog > 1000 emails
- Cron job failures

## Best Practices

1. **Batch Notifications**
   - Use bulk notification methods for multiple recipients
   - Queue non-urgent notifications

2. **Respect User Preferences**
   - Always check email notification settings
   - Honor unsubscribe requests

3. **Template Design**
   - Keep templates concise and actionable
   - Include clear CTAs
   - Test across email clients

4. **Error Handling**
   - Log all failures for debugging
   - Implement retry logic for transient failures
   - Monitor suppression list growth

5. **Performance**
   - Use database indexes on frequently queried fields
   - Implement pagination for large recipient lists
   - Consider rate limiting for bulk sends

## Troubleshooting

### Emails Not Sending

1. Check email service configuration
2. Verify SES is not in sandbox mode
3. Check recipient isn't suppressed
4. Review queue processor logs

### Templates Not Found

1. Verify template exists in database
2. Check organization ID is correct
3. Ensure template is active

### Cron Job Issues

1. Verify cron secret is correct
2. Check server timezone settings
3. Review cron job logs
4. Ensure database connectivity

## Future Enhancements

- [ ] SMS notifications
- [ ] Push notifications
- [ ] Webhook notifications
- [ ] Template A/B testing
- [ ] Advanced scheduling rules
- [ ] Notification bundling
- [ ] Rich media in emails