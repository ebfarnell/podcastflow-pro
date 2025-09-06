# PodcastFlow Pro - DynamoDB Schema

This document outlines the DynamoDB table structure for PodcastFlow Pro's master-level functionality.

## Table Name: `podcastflow-pro`

### Primary Key Structure
- **PK** (Partition Key): String - Entity type and ID
- **SK** (Sort Key): String - Entity subtype or additional identifier

### Entity Types

## 1. User Entities

### User Profile
```
PK: USER#{userId}
SK: PROFILE
```

**Attributes:**
- `userId`: String - Unique user identifier
- `email`: String - User email address
- `name`: String - Full name
- `role`: String - User role (master, admin, seller, client, producer, talent)
- `status`: String - Account status (active, suspended, inactive)
- `organizationId`: String - Associated organization ID
- `phone`: String - Phone number
- `avatar`: String - Avatar URL
- `createdAt`: String - ISO timestamp
- `updatedAt`: String - ISO timestamp
- `lastLogin`: String - ISO timestamp

### User Preferences
```
PK: USER#{userId}
SK: PREFERENCES
```

**Attributes:**
- `notifications`: Boolean - Email notifications enabled
- `theme`: String - UI theme preference
- `language`: String - Language preference
- `timezone`: String - User timezone
- `updatedAt`: String - ISO timestamp

## 2. Organization Entities

### Organization Profile
```
PK: ORG#{organizationId}
SK: PROFILE
```

**Attributes:**
- `organizationId`: String - Unique organization identifier
- `name`: String - Organization name
- `domain`: String - Email domain
- `plan`: String - Subscription plan (starter, professional, enterprise)
- `status`: String - Organization status (active, suspended, trial)
- `features`: List - Enabled features
- `limits`: Map - Usage limits
- `createdAt`: String - ISO timestamp
- `updatedAt`: String - ISO timestamp
- `createdBy`: String - User ID who created the organization

### Organization Settings
```
PK: ORG#{organizationId}
SK: SETTINGS
```

**Attributes:**
- `allowedDomains`: List - Allowed email domains for signup
- `requireApproval`: Boolean - Require admin approval for new users
- `ssoEnabled`: Boolean - Single sign-on enabled
- `customBranding`: Map - Custom branding settings
- `updatedAt`: String - ISO timestamp

## 3. Platform Settings

### Global Platform Settings
```
PK: PLATFORM
SK: SETTINGS
```

**Attributes:**
- `platformName`: String - Platform display name
- `supportEmail`: String - Support contact email
- `maintenanceMode`: Boolean - Platform maintenance mode
- `registrationEnabled`: Boolean - New user registration enabled
- `defaultUserRole`: String - Default role for new users
- `enforceSSL`: Boolean - Enforce HTTPS
- `sessionTimeout`: Number - Session timeout in hours
- `passwordMinLength`: Number - Minimum password length
- `requireMFA`: Boolean - Require multi-factor authentication
- `allowedDomains`: String - Comma-separated allowed domains
- `emailNotifications`: Boolean - Email notifications enabled
- `systemAlerts`: Boolean - System alerts enabled
- `maintenanceNotices`: Boolean - Maintenance notices enabled
- `weeklyReports`: Boolean - Weekly reports enabled
- `maxUploadSize`: Number - Max upload size in MB
- `storageQuota`: Number - Storage quota per organization in GB
- `backupRetention`: Number - Backup retention in days
- `rateLimitEnabled`: Boolean - API rate limiting enabled
- `requestsPerMinute`: Number - API requests per minute limit
- `apiVersioning`: Boolean - API versioning enabled
- `updatedAt`: String - ISO timestamp

## 4. Analytics Data

### Global Metrics
```
PK: ANALYTICS
SK: GLOBAL#{date}
```

**Attributes:**
- `date`: String - Date in YYYY-MM-DD format
- `totalUsers`: Number - Total user count
- `activeUsers`: Number - Active users in 24h
- `totalOrganizations`: Number - Total organization count
- `totalRevenue`: Number - Total revenue
- `storageUsed`: Number - Storage used in TB
- `apiCalls`: Number - API calls in 24h
- `uptime`: Number - System uptime percentage
- `avgResponseTime`: Number - Average response time in ms
- `createdAt`: String - ISO timestamp

### Organization Metrics
```
PK: ANALYTICS
SK: ORG#{organizationId}#{date}
```

**Attributes:**
- `organizationId`: String - Organization ID
- `date`: String - Date in YYYY-MM-DD format
- `users`: Number - User count
- `revenue`: Number - Monthly revenue
- `plan`: String - Subscription plan
- `storageUsed`: Number - Storage used in GB
- `apiCalls`: Number - API calls
- `activeUsers`: Number - Active users
- `createdAt`: String - ISO timestamp

## 5. Billing Data

### Organization Billing Records
```
PK: BILLING#{organizationId}
SK: RECORD#{date}
```

**Attributes:**
- `organizationId`: String - Organization ID
- `organizationName`: String - Organization name
- `plan`: String - Subscription plan
- `amount`: Number - Billing amount
- `status`: String - Billing status (paid, pending, overdue, failed)
- `dueDate`: String - Due date ISO timestamp
- `lastPayment`: String - Last payment date ISO timestamp
- `invoiceUrl`: String - Invoice download URL
- `createdAt`: String - ISO timestamp
- `updatedAt`: String - ISO timestamp

### Billing Metrics
```
PK: BILLING
SK: METRICS#{date}
```

**Attributes:**
- `date`: String - Date in YYYY-MM-DD format
- `totalRevenue`: Number - Total revenue
- `monthlyRecurring`: Number - Monthly recurring revenue
- `overdueAmount`: Number - Total overdue amount
- `churnRate`: Number - Churn rate percentage
- `createdAt`: String - ISO timestamp

## Access Patterns

### User Management
1. Get user profile: `PK = USER#{userId}, SK = PROFILE`
2. Get user preferences: `PK = USER#{userId}, SK = PREFERENCES`
3. List all users: `SCAN` with `FilterExpression: begins_with(PK, 'USER#') AND SK = 'PROFILE'`

### Organization Management
1. Get organization: `PK = ORG#{organizationId}, SK = PROFILE`
2. List all organizations: `SCAN` with `FilterExpression: begins_with(PK, 'ORG#') AND SK = 'PROFILE'`

### Analytics
1. Get global metrics: `PK = ANALYTICS, SK = GLOBAL#{date}`
2. Get organization metrics: `PK = ANALYTICS, SK = ORG#{organizationId}#{date}`

### Billing
1. Get organization billing: `PK = BILLING#{organizationId}`
2. Get billing metrics: `PK = BILLING, SK = METRICS#{date}`

### Platform Settings
1. Get platform settings: `PK = PLATFORM, SK = SETTINGS`

## Indexes

### GSI1: Organization Users
- **PK**: `organizationId`
- **SK**: `userId`
- Purpose: Query all users in an organization

### GSI2: Role-based Access
- **PK**: `role`
- **SK**: `userId`
- Purpose: Query users by role

### GSI3: Status-based Queries
- **PK**: `status`
- **SK**: `entityType#{entityId}`
- Purpose: Query entities by status (active, suspended, etc.)

## Sample Data Creation

To populate the table with sample data for testing, use the provided sample data in the `/docs/sample-data/` directory.