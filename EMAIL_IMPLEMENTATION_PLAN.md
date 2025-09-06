# Email System Implementation Plan

## Overview
This plan outlines a safe, incremental approach to implement the complete email system without breaking existing functionality. Each phase includes rollback procedures and testing requirements.

## Pre-Implementation Checklist
- [ ] Create full system backup
- [ ] Document current working features
- [ ] Set up feature flags for gradual rollout
- [ ] Prepare rollback scripts
- [ ] Set build timeout to 10 minutes for all builds

## Phase 1: Database Foundation (Day 1-2)
**Goal**: Create database schema without affecting existing tables

### Tasks:
1. **Create new tables in public schema**
   ```sql
   -- Platform settings (single row)
   CREATE TABLE IF NOT EXISTS platform_email_settings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider VARCHAR(10) DEFAULT 'ses',
     ses_config JSONB DEFAULT '{}',
     smtp_config JSONB DEFAULT '{}',
     quota_limits JSONB DEFAULT '{"dailyQuota": 50000, "sendRate": 14}',
     monitoring JSONB DEFAULT '{}',
     suppression_list JSONB DEFAULT '{"enabled": true}',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW(),
     updated_by UUID
   );

   -- Email suppression list
   CREATE TABLE IF NOT EXISTS email_suppression_list (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email VARCHAR(255) UNIQUE NOT NULL,
     reason VARCHAR(50), -- 'bounce', 'complaint', 'manual'
     added_at TIMESTAMP DEFAULT NOW(),
     metadata JSONB
   );

   -- Email logs for tracking
   CREATE TABLE IF NOT EXISTS email_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID,
     user_id UUID,
     recipient VARCHAR(255),
     subject VARCHAR(255),
     template_key VARCHAR(50),
     status VARCHAR(20), -- 'queued', 'sent', 'delivered', 'bounced', 'complained'
     provider_message_id VARCHAR(255),
     sent_at TIMESTAMP,
     delivered_at TIMESTAMP,
     opened_at TIMESTAMP,
     clicked_at TIMESTAMP,
     bounced_at TIMESTAMP,
     metadata JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Update existing tables (non-breaking)**
   ```sql
   -- Add to Organization table
   ALTER TABLE "Organization" 
   ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}';
   
   ALTER TABLE "Organization" 
   ADD COLUMN IF NOT EXISTS email_branding JSONB DEFAULT '{}';

   -- Add to User table
   ALTER TABLE "User" 
   ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT 
   '{"enabled": true, "frequency": "immediate", "format": "html"}';
   
   ALTER TABLE "User" 
   ADD COLUMN IF NOT EXISTS unsubscribe_tokens JSONB DEFAULT '{}';
   ```

3. **Create email templates table per organization schema**
   ```sql
   -- Run for each org schema
   CREATE TABLE IF NOT EXISTS email_templates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     template_key VARCHAR(50) UNIQUE NOT NULL,
     name VARCHAR(100),
     subject VARCHAR(255),
     html_content TEXT,
     text_content TEXT,
     variables JSONB,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

### Testing:
- Verify all tables created successfully
- Ensure existing queries still work
- Test that default values are applied

### Rollback:
- DROP TABLE statements for new tables
- Remove added columns from existing tables

## Phase 2: API Infrastructure (Day 3-4)
**Goal**: Create API endpoints that return mock data initially

### Tasks:
1. **Create base email service**
   ```typescript
   // src/lib/email/email-service.ts
   export class EmailService {
     // Initially returns mock data
     async sendEmail(options: EmailOptions): Promise<EmailResult> {
       // Log to database, return success
     }
   }
   ```

2. **Implement Master API endpoints**
   - `GET /api/master/email-settings`
   - `PUT /api/master/email-settings`
   - `POST /api/master/email-settings/test`
   - `GET /api/master/email-settings/metrics`

3. **Implement Organization API endpoints**
   - `GET /api/organization/email-settings`
   - `PUT /api/organization/email-settings`
   - `GET /api/organization/email-templates`
   - `POST /api/organization/email-templates/preview`

4. **Implement User API endpoints**
   - `GET /api/user/email-preferences`
   - `PUT /api/user/email-preferences`
   - `POST /api/user/unsubscribe/:token`

### Testing:
- All endpoints return appropriate mock data
- Proper authentication/authorization
- Error handling for invalid requests

### Rollback:
- Remove new API files
- No database changes needed

## Phase 3: Connect Frontend to APIs (Day 5)
**Goal**: Wire up existing UI components to real APIs

### Tasks:
1. **Update API service layer**
   - Add email settings methods to masterApi
   - Add organization email methods
   - Add user preference methods

2. **Replace mock data in components**
   - Update MasterEmailSettings to use real API
   - Update OrganizationEmailSettings to use real API
   - Update UserEmailPreferences to use real API

3. **Add loading states and error handling**
   - Implement proper loading indicators
   - Handle API errors gracefully
   - Add retry logic for failed requests

### Testing:
- Settings load correctly for each role
- Changes persist to database
- Error states display properly

### Rollback:
- Revert to mock data in components
- Keep API endpoints returning mock data

## Phase 4: Email Provider Integration (Day 6-7)
**Goal**: Implement actual email sending (feature-flagged)

### Tasks:
1. **AWS SES Integration**
   ```typescript
   // src/lib/email/providers/ses-provider.ts
   import { SESClient } from '@aws-sdk/client-ses'
   ```

2. **SMTP Provider**
   ```typescript
   // src/lib/email/providers/smtp-provider.ts
   import nodemailer from 'nodemailer'
   ```

3. **Provider factory with feature flag**
   ```typescript
   // Check feature flag before sending real emails
   if (process.env.ENABLE_EMAIL_SENDING === 'true') {
     // Send real email
   } else {
     // Log to database only
   }
   ```

4. **Implement queue system**
   - Create email queue table
   - Background job for processing
   - Retry logic for failures

### Testing:
- Test with feature flag OFF (no emails sent)
- Test with feature flag ON in staging
- Verify rate limiting works
- Check error handling

### Rollback:
- Turn off feature flag
- Emails continue to be logged only

## Phase 5: Template System (Day 8-9)
**Goal**: Implement email template rendering

### Tasks:
1. **Template engine setup**
   - Use Handlebars or similar
   - Support variables and conditionals
   - HTML and text versions

2. **Default templates**
   ```typescript
   const defaultTemplates = {
     userInvitation: { ... },
     taskAssignment: { ... },
     campaignUpdate: { ... },
     // etc.
   }
   ```

3. **Template preview API**
   - Render with sample data
   - Return HTML for preview

4. **Template customization**
   - Apply organization branding
   - Custom CSS injection
   - Logo replacement

### Testing:
- All default templates render correctly
- Variables are replaced properly
- Custom branding applies correctly
- Preview matches sent emails

### Rollback:
- Use basic templates without customization
- Disable template preview

## Phase 6: Tracking & Analytics (Day 10-11)
**Goal**: Implement email tracking

### Tasks:
1. **Open tracking**
   - Add tracking pixel to HTML emails
   - Create endpoint to record opens

2. **Click tracking**
   - Wrap links with tracking URLs
   - Record click events

3. **Bounce/Complaint handling**
   - SES webhook endpoint
   - SMTP bounce parsing
   - Auto-add to suppression list

4. **Analytics dashboard**
   - Real-time metrics
   - Historical data
   - Cost tracking

### Testing:
- Tracking pixels load correctly
- Click tracking doesn't break links
- Webhooks process correctly
- Metrics are accurate

### Rollback:
- Disable tracking features
- Remove tracking from templates

## Phase 7: Advanced Features (Day 12-13)
**Goal**: Implement remaining features

### Tasks:
1. **Digest scheduling**
   - Cron job for digests
   - Aggregate notifications
   - Respect user preferences

2. **Unsubscribe system**
   - Generate secure tokens
   - One-click unsubscribe
   - Preference center

3. **Domain validation**
   - Check allowed domains
   - Validate email addresses
   - Apply sending rules

4. **Audit logging**
   - Log all email activities
   - Track configuration changes
   - Security audit trail

### Testing:
- Digests send on schedule
- Unsubscribe links work
- Domain restrictions apply
- Audit logs are complete

### Rollback:
- Disable advanced features
- Basic email sending continues

## Phase 8: Production Rollout (Day 14)
**Goal**: Enable all features in production

### Tasks:
1. **Gradual rollout**
   - Enable for internal users first
   - Roll out to 10% of users
   - Monitor for issues
   - Full rollout

2. **Monitoring setup**
   - Email delivery rates
   - Error rates
   - Performance metrics
   - Cost tracking

3. **Documentation**
   - User guides
   - API documentation
   - Troubleshooting guide
   - Admin manual

### Testing:
- Load testing at scale
- Monitor all metrics
- Verify no degradation
- Check all features work

### Rollback:
- Feature flags for quick disable
- Revert to previous email system
- Keep logs for debugging

## Risk Mitigation

### Backup Strategy
- Daily automated backups before each phase
- Test restore procedure
- Keep 7 days of backups

### Feature Flags
```typescript
const EMAIL_FEATURES = {
  SENDING_ENABLED: false,
  TRACKING_ENABLED: false,
  TEMPLATES_ENABLED: false,
  DIGESTS_ENABLED: false,
  ADVANCED_FEATURES: false
}
```

### Monitoring
- Set up alerts for:
  - High bounce rates
  - Delivery failures
  - Rate limit hits
  - Error spikes

### Communication
- Notify users of upcoming changes
- Provide status updates
- Have support ready

## Success Criteria
- [ ] All email settings UI functional
- [ ] Emails sending successfully
- [ ] < 0.1% bounce rate
- [ ] > 99% delivery rate
- [ ] No performance degradation
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Team trained

## Timeline Summary
- **Phase 1-2**: Days 1-4 (Database & APIs)
- **Phase 3-4**: Days 5-7 (Integration & Providers)
- **Phase 5-6**: Days 8-11 (Templates & Tracking)
- **Phase 7-8**: Days 12-14 (Advanced & Rollout)
- **Total**: 14 working days (3 weeks)

## Build Configuration
**IMPORTANT**: All builds must use 10-minute timeout:
```bash
npm run build  # Already configured with timeout: 600000
```

## Questions Before Starting
1. Do you approve this phased approach?
2. Should we start with Phase 1 (database schema)?
3. Any specific concerns about the implementation?
4. Preferred email provider (AWS SES or SMTP)?
5. Any features that should be prioritized differently?

Please confirm you're ready to proceed with this plan, and I'll begin with Phase 1.