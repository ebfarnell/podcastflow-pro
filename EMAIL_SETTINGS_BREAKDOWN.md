# Email Settings Access Level Breakdown

## Overview
The current Email Settings component combines platform-level infrastructure settings with organization-specific preferences. This document provides a comprehensive breakdown of which settings should be accessible at each level.

## Access Level Categories

### 🔴 Master Account Only (Platform Infrastructure)
These settings affect the entire platform's email infrastructure and should only be configurable by the master account:

#### Email Provider Configuration
- **Provider Selection** (SES vs SMTP)
- **AWS SES Configuration**
  - AWS Region
  - Access Keys (if not using IAM roles)
  - Sandbox Mode vs Production Mode
  - Daily Quota Limits
  - Send Rate Limits
- **SMTP Configuration**
  - SMTP Host
  - SMTP Port
  - SMTP Security (TLS/SSL)
  - SMTP Authentication Credentials
- **Default From Address** (platform-wide noreply address)
- **Bounce/Complaint Handling Configuration**
- **Email Service Health Monitoring**
- **Platform-wide Email Suppression List**

#### Platform Email Templates
- **System Maintenance Notifications**
- **Platform-wide Security Alerts**
- **Service Status Updates**
- **Master Account Notifications**

#### Email System Monitoring
- **Real-time Email Metrics Dashboard**
- **Delivery Success/Failure Rates**
- **Bounce/Complaint Analytics**
- **Email Queue Management**
- **Email Service Cost Tracking**

### 🟡 Admin Account (Organization-wide Settings)
These settings affect all users within an organization and should be configurable by organization admins:

#### Organization Email Preferences
- **Organization Reply-To Address**
- **Organization Support Email**
- **Email Signature/Footer Content**

#### Notification Settings (Organization-wide defaults)
- **User Invitations** - Enable/disable welcome emails
- **Task Assignments** - Enable/disable task notification emails
- **Campaign Updates** - Enable/disable campaign status emails
- **Payment Reminders** - Enable/disable invoice/payment emails
- **Report Ready** - Enable/disable report completion emails
- **Deadline Reminders** - Enable/disable deadline notification emails

#### Organization Branding
- **Custom Email Templates** - Enable/disable
- **Organization Logo URL** for emails
- **Brand Colors** (primary/secondary)
- **Custom CSS for email templates**

#### Email Sending Rules
- **Daily sending limits per user**
- **Allowed recipient domains** (if restricted)
- **Email approval workflow** (if required)
- **CC/BCC rules for certain email types**

### 🟢 Individual User Settings
These settings are personal preferences that each user can configure:

#### Personal Email Preferences
- **Email notification frequency** (immediate, daily digest, weekly)
- **Notification categories to receive**
  - Task assignments to me
  - Comments on my work
  - Campaign status changes I'm involved in
  - Mentions in comments
- **Preferred email format** (HTML or plain text)
- **Unsubscribe from specific notification types**

## Implementation Recommendations

### 1. Create Separate Components
- `MasterEmailSettings.tsx` - Platform infrastructure settings
- `OrganizationEmailSettings.tsx` - Organization-wide preferences
- `UserEmailPreferences.tsx` - Individual user preferences

### 2. API Endpoint Structure
```
/api/master/email-settings - Master only
/api/organization/email-settings - Admin only
/api/user/email-preferences - Any authenticated user
```

### 3. Database Schema Updates
- Move platform settings to a dedicated table/config
- Store organization email settings in the Organization table
- Add user email preferences to the User table

### 4. Permission Checks
- Master settings require `role === 'master'`
- Organization settings require `role === 'admin' || role === 'master'`
- User preferences require authentication only

### 5. UI/UX Considerations
- Show only relevant settings based on user role
- Provide clear labels indicating scope of impact
- Add warnings for changes affecting multiple users
- Include preview functionality for email templates

## Security Considerations
- Never expose SMTP/SES credentials in frontend
- Validate email addresses and domains
- Implement rate limiting for email sending
- Log all email configuration changes
- Encrypt stored email credentials
- Implement email verification for new addresses

## Migration Path
1. Audit current email settings usage
2. Create new database schema for separated settings
3. Migrate existing settings to appropriate levels
4. Update API endpoints with proper permissions
5. Create new UI components
6. Test with different user roles
7. Deploy with feature flags
8. Monitor and gather feedback