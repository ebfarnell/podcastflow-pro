# Email Analytics Dashboard

## Overview
The Email Analytics Dashboard provides comprehensive insights into your email campaign performance, deliverability metrics, and template effectiveness. This real-time dashboard helps organizations monitor and optimize their email communications.

## Access
- **URL**: `/admin/email-analytics`
- **Required Role**: Admin
- **Permission**: `ANALYTICS_VIEW`

## Features

### 1. Date Range Selection
- Last 7 days
- Last 30 days (default)
- Last 90 days

### 2. Grouping Options
- Daily (default)
- Weekly
- Monthly

### 3. Summary Metrics
Real-time statistics displayed in dashboard cards:

- **Emails Sent**: Total number of emails sent
- **Delivered**: Count and delivery rate percentage
- **Opened**: Count and open rate percentage
- **Clicked**: Count and click rate percentage

### 4. Time Series Chart
Interactive line chart showing email activity trends:
- Sent emails
- Delivered emails
- Opened emails
- Clicked emails

### 5. Template Performance Table
Detailed performance metrics for each email template:
- Template name and category
- Total sent count
- Delivery rate percentage
- Open rate percentage
- Bounce count

### 6. Bounce Analytics
Pie chart visualization of bounce types:
- Permanent bounces
- Transient bounces
- Other bounce types

### 7. Suppression List Summary
Overview of email suppression reasons:
- Bounces
- Complaints
- Manual suppressions
- Unsubscribes

### 8. Smart Alerts
Automatic warnings for reputation issues:
- **Warning**: Bounce rate > 5%
- **Critical**: Complaint rate > 0.1%

## Export Functionality

### CSV Exports
Download detailed data in CSV format:
- **Summary Export**: Overall metrics and rates
- **Time Series Export**: Daily/weekly/monthly trends
- **Template Stats Export**: Performance by template

### PDF Reports
Generate comprehensive PDF reports including:
- Executive summary with key metrics
- Top performing templates
- Delivery issue analysis
- Warnings and recommendations
- Professional formatting with charts

## Filter Options

### Category Filter
Filter templates by category:
- Transactional
- Notification
- Marketing
- System
- All Categories

### Template Filter (Coming Soon)
Filter by specific template types

## API Endpoints

### Analytics Data
```
GET /api/email/analytics
```

Query Parameters:
- `startDate`: ISO date string
- `endDate`: ISO date string
- `groupBy`: day|week|month
- `templateKey`: (optional) specific template
- `category`: (optional) template category

### Export
```
POST /api/email/analytics/export
```

Request Body:
```json
{
  "format": "pdf",
  "data": {}, // analytics data
  "dateRange": {
    "days": 30,
    "groupBy": "day"
  }
}
```

## Performance Indicators

### Good Performance
- Delivery Rate: > 95%
- Open Rate: > 20%
- Click Rate: > 2%
- Bounce Rate: < 2%
- Complaint Rate: < 0.1%

### Needs Attention
- Delivery Rate: 90-95%
- Open Rate: 15-20%
- Bounce Rate: 2-5%

### Critical Issues
- Delivery Rate: < 90%
- Open Rate: < 15%
- Bounce Rate: > 5%
- Complaint Rate: > 0.1%

## Best Practices

1. **Regular Monitoring**
   - Check dashboard daily
   - Review weekly trends
   - Export monthly reports

2. **Template Optimization**
   - Monitor underperforming templates
   - A/B test subject lines
   - Improve content for low open rates

3. **List Hygiene**
   - Review suppression reasons
   - Clean bounce addresses
   - Handle complaints promptly

4. **Reputation Management**
   - Keep bounce rate below 5%
   - Keep complaint rate below 0.1%
   - Use double opt-in when possible

## Troubleshooting

### No Data Showing
1. Check date range selection
2. Verify email sending is active
3. Ensure tracking pixels are enabled

### Export Fails
1. Check browser popup blocker
2. Verify session is active
3. Try smaller date ranges

### Metrics Not Updating
1. Allow 5-10 minutes for processing
2. Check email queue status
3. Verify webhook configuration

## Integration with Email System

The analytics dashboard integrates with:
- Email queue processing
- SES webhook handling
- Real-time tracking events
- Template management system

## Data Retention
- Detailed logs: 90 days
- Aggregated metrics: 1 year
- Suppression list: Permanent

## Future Enhancements
- Email client breakdown
- Geographic analytics
- A/B testing interface
- Automated reporting
- Campaign comparison
- ROI tracking