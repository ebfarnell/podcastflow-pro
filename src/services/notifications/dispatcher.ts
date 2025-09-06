import prisma from '@/lib/db/prisma'
import { SESProvider } from '@/services/email/providers/ses-provider'
import { EmailProviderConfig } from '@/services/email/providers/types'
import { safeQuerySchema } from '@/lib/db/schema-db'
import crypto from 'crypto'

// All notification event types for the platform
export type NotificationEventType = 
  // Campaign workflow events
  | 'campaign_created'
  | 'campaign_status_changed'
  | 'campaign_approval_requested'
  | 'campaign_approved'
  | 'campaign_rejected'
  // Scheduling & Inventory
  | 'schedule_saved'
  | 'schedule_committed' 
  | 'schedule_commit_failed'
  | 'inventory_reserved'
  | 'inventory_released'
  | 'inventory_conflict_detected'
  // Talent/Producer approvals
  | 'talent_approval_requested'
  | 'talent_approval_granted'
  | 'talent_approval_denied'
  | 'producer_approval_requested'
  | 'producer_approval_granted'
  | 'producer_approval_denied'
  // Billing
  | 'invoice_generated'
  | 'prebill_generated'
  | 'payment_received'
  | 'payment_overdue'
  // Data integrations
  | 'youtube_quota_threshold_reached'
  | 'youtube_quota_reset'
  | 'megaphone_sync_failed'
  | 'megaphone_sync_recovered'
  // General
  | 'test_email'

export interface NotificationEvent {
  type: NotificationEventType
  organizationId: string
  organizationSlug: string
  data: Record<string, any>
  recipientOverrides?: string[] // Override default recipients
}

// Role-based recipient matrix for each event type
const DEFAULT_RECIPIENT_MATRIX: Record<NotificationEventType, string[]> = {
  // Campaign events
  campaign_created: ['admin', 'sales'],
  campaign_status_changed: ['admin', 'sales'],
  campaign_approval_requested: ['admin'],
  campaign_approved: ['admin', 'sales'],
  campaign_rejected: ['admin', 'sales'],
  // Scheduling
  schedule_saved: ['admin', 'producer'],
  schedule_committed: ['admin', 'producer', 'sales'],
  schedule_commit_failed: ['admin', 'producer'],
  inventory_reserved: ['admin', 'producer'],
  inventory_released: ['admin', 'producer'],
  inventory_conflict_detected: ['admin', 'producer'],
  // Approvals
  talent_approval_requested: ['talent'],
  talent_approval_granted: ['admin', 'producer', 'sales'],
  talent_approval_denied: ['admin', 'producer', 'sales'],
  producer_approval_requested: ['producer'],
  producer_approval_granted: ['admin', 'sales'],
  producer_approval_denied: ['admin', 'sales'],
  // Billing
  invoice_generated: ['admin', 'sales'],
  prebill_generated: ['admin', 'sales'],
  payment_received: ['admin'],
  payment_overdue: ['admin'],
  // Integrations
  youtube_quota_threshold_reached: ['admin'],
  youtube_quota_reset: ['admin'],
  megaphone_sync_failed: ['admin'],
  megaphone_sync_recovered: ['admin'],
  // General
  test_email: []
}

export class NotificationDispatcher {
  private sesProvider: SESProvider | null = null
  private initialized = false

  async initialize(organizationId: string): Promise<void> {
    if (this.initialized) return

    try {
      // Get organization settings
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          settings: true
        }
      })

      if (!organization) {
        throw new Error('Organization not found')
      }

      const settings = organization.settings as any || {}
      const emailSettings = settings.emailSettings || {}

      // Configure SES provider
      const sesConfig: EmailProviderConfig = {
        provider: 'ses',
        sesConfig: {
          region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          fromEmail: emailSettings.fromEmail || process.env.EMAIL_FROM || 'notifications@app.podcastflow.pro',
          fromName: emailSettings.fromName || organization.name || 'PodcastFlow Pro',
          replyTo: emailSettings.replyToAddress || process.env.REPLY_TO_EMAIL || 'support@podcastflow.pro',
          useIAMRole: false
        }
      }

      this.sesProvider = new SESProvider()
      await this.sesProvider.initialize(sesConfig)
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize notification dispatcher:', error)
      throw error
    }
  }

  async dispatch(event: NotificationEvent): Promise<boolean> {
    try {
      // Initialize if needed
      await this.initialize(event.organizationId)

      // Generate idempotency key to prevent duplicates
      const idempotencyKey = crypto
        .createHash('md5')
        .update(`${event.type}-${event.organizationId}-${JSON.stringify(event.data)}-${Date.now()}`)
        .digest('hex')

      // Check if we've already processed this event
      const existing = await prisma.notificationDelivery.findUnique({
        where: { idempotencyKey }
      })

      if (existing) {
        console.log(`Notification already delivered: ${idempotencyKey}`)
        return true
      }

      // Get recipients based on event type and org settings
      const recipients = await this.getRecipients(event)

      if (recipients.length === 0) {
        console.log(`No recipients for event ${event.type}`)
        return true
      }

      // Get email template
      const template = await this.getTemplate(event)

      // Queue notification for each recipient
      const deliveries = await Promise.all(
        recipients.map(async (recipient) => {
          try {
            // Create delivery record
            const delivery = await prisma.notificationDelivery.create({
              data: {
                idempotencyKey: `${idempotencyKey}-${recipient.id}`,
                eventType: event.type,
                eventPayload: event.data,
                organizationId: event.organizationId,
                recipientId: recipient.id,
                recipientEmail: recipient.email,
                channel: 'email',
                status: 'pending',
                attempts: 0
              }
            })

            // Send email
            const emailSent = await this.sendEmail(
              recipient.email,
              template.subject,
              template.html,
              template.text,
              event
            )

            // Update delivery status
            await prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: emailSent ? 'delivered' : 'failed',
                attempts: 1,
                metadata: emailSent ? { messageId: emailSent } : null
              }
            })

            return emailSent
          } catch (error) {
            console.error(`Failed to deliver to ${recipient.email}:`, error)
            return false
          }
        })
      )

      const successCount = deliveries.filter(Boolean).length
      console.log(`Notification ${event.type} delivered to ${successCount}/${recipients.length} recipients`)

      return successCount > 0
    } catch (error) {
      console.error('Notification dispatch error:', error)
      return false
    }
  }

  private async getRecipients(event: NotificationEvent): Promise<Array<{ id: string; email: string }>> {
    // If specific recipients are provided, use them
    if (event.recipientOverrides && event.recipientOverrides.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          email: { in: event.recipientOverrides },
          organizationId: event.organizationId
        },
        select: {
          id: true,
          email: true
        }
      })
      return users
    }

    // Get organization email settings
    const organization = await prisma.organization.findUnique({
      where: { id: event.organizationId },
      select: { settings: true }
    })

    const settings = organization?.settings as any || {}
    const emailSettings = settings.emailSettings || {}
    const recipientMatrix = emailSettings.recipientMatrix || DEFAULT_RECIPIENT_MATRIX

    // Get roles that should receive this event type
    const roles = recipientMatrix[event.type] || DEFAULT_RECIPIENT_MATRIX[event.type] || []

    if (roles.length === 0) {
      return []
    }

    // Get users with these roles
    const users = await prisma.user.findMany({
      where: {
        organizationId: event.organizationId,
        role: { in: roles },
        email: { not: null }
      },
      select: {
        id: true,
        email: true
      }
    })

    // Filter out suppressed emails
    const suppressedEmails = await prisma.emailSuppressionList.findMany({
      where: {
        email: { in: users.map(u => u.email!) }
      },
      select: { email: true }
    })

    const suppressedSet = new Set(suppressedEmails.map(s => s.email))
    return users.filter(u => u.email && !suppressedSet.has(u.email)) as Array<{ id: string; email: string }>
  }

  private async getTemplate(event: NotificationEvent): Promise<{ subject: string; html: string; text: string }> {
    // Check for org-specific template
    const customTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        organizationId: event.organizationId,
        eventType: event.type,
        channel: 'email',
        isActive: true
      }
    })

    if (customTemplate) {
      return this.renderTemplate(customTemplate, event.data)
    }

    // Use default template
    const defaultTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        organizationId: null,
        eventType: event.type,
        channel: 'email',
        isDefault: true,
        isActive: true
      }
    })

    if (defaultTemplate) {
      return this.renderTemplate(defaultTemplate, event.data)
    }

    // Fallback to basic template
    return this.getDefaultTemplate(event)
  }

  private renderTemplate(template: any, data: Record<string, any>): { subject: string; html: string; text: string } {
    // Simple template rendering - replace {{variable}} with data values
    let subject = template.subject || ''
    let body = template.body || ''

    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(regex, String(value))
      body = body.replace(regex, String(value))
    })

    // Convert to HTML and text versions
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PodcastFlow Pro</h1>
            </div>
            <div class="content">
              ${body}
            </div>
          </div>
        </body>
      </html>
    `

    const text = body.replace(/<[^>]*>/g, '') // Strip HTML tags for text version

    return { subject, html, text }
  }

  private getDefaultTemplate(event: NotificationEvent): { subject: string; html: string; text: string } {
    const templates: Record<NotificationEventType, { subject: string; body: string }> = {
      campaign_created: {
        subject: 'New Campaign Created: {{campaignName}}',
        body: '<h2>New Campaign Created</h2><p>A new campaign "{{campaignName}}" has been created by {{createdBy}}.</p><p>Status: {{status}}</p><p><a href="{{viewUrl}}">View Campaign</a></p>'
      },
      campaign_status_changed: {
        subject: 'Campaign Status Update: {{campaignName}}',
        body: '<h2>Campaign Status Changed</h2><p>Campaign "{{campaignName}}" status changed from {{oldStatus}} to {{newStatus}}.</p><p><a href="{{viewUrl}}">View Campaign</a></p>'
      },
      campaign_approval_requested: {
        subject: 'Approval Required: {{campaignName}}',
        body: '<h2>Campaign Approval Required</h2><p>Campaign "{{campaignName}}" requires your approval.</p><p>Requested by: {{requestedBy}}</p><p><a href="{{approveUrl}}">Review and Approve</a></p>'
      },
      campaign_approved: {
        subject: 'Campaign Approved: {{campaignName}}',
        body: '<h2>Campaign Approved</h2><p>Campaign "{{campaignName}}" has been approved by {{approvedBy}}.</p><p><a href="{{viewUrl}}">View Campaign</a></p>'
      },
      campaign_rejected: {
        subject: 'Campaign Rejected: {{campaignName}}',
        body: '<h2>Campaign Rejected</h2><p>Campaign "{{campaignName}}" has been rejected by {{rejectedBy}}.</p><p>Reason: {{reason}}</p><p><a href="{{viewUrl}}">View Campaign</a></p>'
      },
      schedule_saved: {
        subject: 'Schedule Saved: {{campaignName}}',
        body: '<h2>Schedule Saved</h2><p>Schedule for campaign "{{campaignName}}" has been saved.</p><p>{{spotCount}} spots scheduled.</p>'
      },
      schedule_committed: {
        subject: 'Schedule Committed: {{campaignName}}',
        body: '<h2>Schedule Committed</h2><p>Schedule for campaign "{{campaignName}}" has been committed to inventory.</p><p>{{spotCount}} spots reserved.</p>'
      },
      schedule_commit_failed: {
        subject: 'Schedule Commit Failed: {{campaignName}}',
        body: '<h2>Schedule Commit Failed</h2><p>Failed to commit schedule for campaign "{{campaignName}}".</p><p>Error: {{error}}</p>'
      },
      inventory_reserved: {
        subject: 'Inventory Reserved: {{showName}}',
        body: '<h2>Inventory Reserved</h2><p>{{spotCount}} spots reserved for show "{{showName}}".</p><p>Date range: {{startDate}} - {{endDate}}</p>'
      },
      inventory_released: {
        subject: 'Inventory Released: {{showName}}',
        body: '<h2>Inventory Released</h2><p>{{spotCount}} spots released for show "{{showName}}".</p>'
      },
      inventory_conflict_detected: {
        subject: 'Inventory Conflict: {{showName}}',
        body: '<h2>Inventory Conflict Detected</h2><p>Conflict detected for show "{{showName}}" on {{date}}.</p><p>{{conflictDetails}}</p>'
      },
      talent_approval_requested: {
        subject: 'Talent Approval Required: {{campaignName}}',
        body: '<h2>Talent Approval Required</h2><p>Your approval is required for campaign "{{campaignName}}".</p><p><a href="{{approveUrl}}">Review and Approve</a></p>'
      },
      talent_approval_granted: {
        subject: 'Talent Approved: {{campaignName}}',
        body: '<h2>Talent Approval Granted</h2><p>Talent has approved campaign "{{campaignName}}".</p>'
      },
      talent_approval_denied: {
        subject: 'Talent Denied: {{campaignName}}',
        body: '<h2>Talent Approval Denied</h2><p>Talent has denied campaign "{{campaignName}}".</p><p>Reason: {{reason}}</p>'
      },
      producer_approval_requested: {
        subject: 'Producer Approval Required: {{campaignName}}',
        body: '<h2>Producer Approval Required</h2><p>Your approval is required for campaign "{{campaignName}}".</p><p><a href="{{approveUrl}}">Review and Approve</a></p>'
      },
      producer_approval_granted: {
        subject: 'Producer Approved: {{campaignName}}',
        body: '<h2>Producer Approval Granted</h2><p>Producer has approved campaign "{{campaignName}}".</p>'
      },
      producer_approval_denied: {
        subject: 'Producer Denied: {{campaignName}}',
        body: '<h2>Producer Approval Denied</h2><p>Producer has denied campaign "{{campaignName}}".</p><p>Reason: {{reason}}</p>'
      },
      invoice_generated: {
        subject: 'Invoice Generated: {{invoiceNumber}}',
        body: '<h2>Invoice Generated</h2><p>Invoice {{invoiceNumber}} for {{amount}} has been generated.</p><p>Due date: {{dueDate}}</p><p><a href="{{viewUrl}}">View Invoice</a></p>'
      },
      prebill_generated: {
        subject: 'Pre-bill Generated: {{prebillNumber}}',
        body: '<h2>Pre-bill Generated</h2><p>Pre-bill {{prebillNumber}} for {{amount}} has been generated.</p><p><a href="{{viewUrl}}">View Pre-bill</a></p>'
      },
      payment_received: {
        subject: 'Payment Received: {{invoiceNumber}}',
        body: '<h2>Payment Received</h2><p>Payment of {{amount}} received for invoice {{invoiceNumber}}.</p>'
      },
      payment_overdue: {
        subject: 'Payment Overdue: {{invoiceNumber}}',
        body: '<h2>Payment Overdue</h2><p>Payment for invoice {{invoiceNumber}} ({{amount}}) is overdue.</p><p>Days overdue: {{daysOverdue}}</p>'
      },
      youtube_quota_threshold_reached: {
        subject: 'YouTube API Quota Warning',
        body: '<h2>YouTube Quota Threshold Reached</h2><p>YouTube API quota has reached {{percentage}}% of daily limit.</p><p>Current usage: {{current}} / {{limit}}</p>'
      },
      youtube_quota_reset: {
        subject: 'YouTube API Quota Reset',
        body: '<h2>YouTube Quota Reset</h2><p>YouTube API quota has been reset for the new day.</p><p>New limit: {{limit}}</p>'
      },
      megaphone_sync_failed: {
        subject: 'Megaphone Sync Failed',
        body: '<h2>Megaphone Sync Failed</h2><p>Failed to sync with Megaphone.</p><p>Error: {{error}}</p>'
      },
      megaphone_sync_recovered: {
        subject: 'Megaphone Sync Recovered',
        body: '<h2>Megaphone Sync Recovered</h2><p>Megaphone sync has been restored.</p>'
      },
      test_email: {
        subject: 'Test Email from PodcastFlow Pro',
        body: '<h2>Test Email</h2><p>This is a test email from PodcastFlow Pro.</p>'
      }
    }

    const template = templates[event.type]
    return this.renderTemplate(
      {
        subject: template.subject,
        body: template.body
      },
      event.data
    )
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
    event: NotificationEvent
  ): Promise<string | null> {
    if (!this.sesProvider) {
      console.error('SES provider not initialized')
      return null
    }

    try {
      const result = await this.sesProvider.sendEmail({
        from: this.sesProvider['config']?.fromEmail || 'notifications@app.podcastflow.pro',
        to,
        subject,
        html,
        text,
        replyTo: this.sesProvider['config']?.replyTo,
        tags: {
          organizationId: event.organizationId,
          eventType: event.type
        }
      })

      // Log email
      await prisma.emailLog.create({
        data: {
          organizationId: event.organizationId,
          toEmail: to,
          fromEmail: this.sesProvider['config']?.fromEmail || 'notifications@app.podcastflow.pro',
          recipient: to, // deprecated field
          subject,
          templateKey: event.type,
          status: 'sent',
          messageId: result.messageId,
          metadata: event.data,
          sentAt: new Date()
        }
      })

      return result.messageId
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error)
      return null
    }
  }
}

// Export singleton instance
export const notificationDispatcher = new NotificationDispatcher()