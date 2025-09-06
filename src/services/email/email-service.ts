import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { EmailProvider, EmailOptions, EmailResult, EmailProviderError } from './providers/types'
import { EmailProviderFactory } from './providers/factory'
import { EmailQueueService } from './queue-service'
import { EmailTemplateService } from './template-service'
import { EmailTracker } from './tracking'

export class EmailService {
  private static instance: EmailService | null = null
  private provider: EmailProvider | null = null
  private initialized: boolean = false
  private queueService: EmailQueueService
  private templateService: EmailTemplateService

  private constructor() {
    this.queueService = new EmailQueueService()
    this.templateService = new EmailTemplateService()
  }

  static getInstance(): EmailService {
    if (!this.instance) {
      this.instance = new EmailService()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Get platform email settings
      const settings = await prisma.platformEmailSettings.findFirst()
      
      if (!settings || !settings.provider) {
        return
      }

      // Create provider configuration
      const config: any = {
        provider: settings.provider
      }

      if (settings.provider === 'ses') {
        config.sesConfig = {
          region: settings.sesConfig?.region || 'us-east-1',
          useIAMRole: settings.sesConfig?.useIAMRole || false,
          accessKeyId: settings.sesConfig?.accessKeyId,
          secretAccessKey: settings.sesConfig?.secretAccessKey
        }
      } else if (settings.provider === 'smtp') {
        config.smtpConfig = {
          host: settings.smtpConfig?.host,
          port: settings.smtpConfig?.port || 587,
          secure: settings.smtpConfig?.secure || false,
          auth: settings.smtpConfig?.auth
        }
      }

      // Create and initialize provider
      this.provider = await EmailProviderFactory.create(config)
      this.initialized = true
      
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      throw error
    }
  }

  async sendEmail(options: EmailOptions, organizationId?: string): Promise<EmailResult> {
    // Ensure service is initialized
    await this.initialize()
    
    if (!this.provider) {
      throw new EmailProviderError('Email provider not configured')
    }

    // Get platform settings for from address and other defaults
    const settings = await prisma.platformEmailSettings.findFirst()
    if (!settings) {
      throw new EmailProviderError('Email settings not configured')
    }

    // Apply organization-specific settings if provided
    if (organizationId) {
      const orgSettings = await safeQuerySchema(
        organizationId,
        async (db) => db.organizationEmailSettings.findFirst(),
        {}
      )

      if (orgSettings.data) {
        // Apply reply-to if not already set
        if (!options.replyTo && orgSettings.data.replyToAddress) {
          options.replyTo = orgSettings.data.replyToAddress
        }

        // Add footer if configured
        if (orgSettings.data.emailFooter) {
          if (options.html) {
            options.html += `<br><br><p style="font-size: 12px; color: #666;">${orgSettings.data.emailFooter}</p>`
          }
          if (options.text) {
            options.text += `\n\n${orgSettings.data.emailFooter}`
          }
        }
      }
    }

    // Set default from address if not provided
    if (!options.from) {
      options.from = process.env.EMAIL_FROM_ADDRESS || 'noreply@podcastflow.pro'
    }

    try {
      // Create email record in database
      const emailRecord = await prisma.email.create({
        data: {
          messageId: options.messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from: options.from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : null,
          bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : null,
          subject: options.subject,
          html: options.html,
          text: options.text,
          status: 'pending',
          organizationId: organizationId,
          metadata: options.tags ? options.tags : null
        }
      })

      // Check suppression list
      const recipients = [
        ...(Array.isArray(options.to) ? options.to : [options.to]),
        ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
        ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [])
      ]

      const suppressed = await prisma.emailSuppressionList.findMany({
        where: {
          email: { in: recipients }
        }
      })

      if (suppressed.length > 0) {
        const suppressedEmails = suppressed.map(s => s.email)
        const remainingRecipients = recipients.filter(r => !suppressedEmails.includes(r))
        
        if (remainingRecipients.length === 0) {
          // All recipients are suppressed
          await prisma.email.update({
            where: { id: emailRecord.id },
            data: { 
              status: 'suppressed',
              errorMessage: 'All recipients are in suppression list'
            }
          })
          
          throw new EmailProviderError(
            'All recipients are in suppression list',
            'ALL_SUPPRESSED',
            400
          )
        }

        // Update options to exclude suppressed recipients
        options.to = Array.isArray(options.to) 
          ? options.to.filter(e => !suppressedEmails.includes(e))
          : suppressedEmails.includes(options.to) ? [] : options.to
          
        if (options.cc) {
          options.cc = Array.isArray(options.cc)
            ? options.cc.filter(e => !suppressedEmails.includes(e))
            : suppressedEmails.includes(options.cc) ? undefined : options.cc
        }
        
        if (options.bcc) {
          options.bcc = Array.isArray(options.bcc)
            ? options.bcc.filter(e => !suppressedEmails.includes(e))
            : suppressedEmails.includes(options.bcc) ? undefined : options.bcc
        }
      }

      // Create email logs for tracking
      const allRecipients = [
        ...(Array.isArray(options.to) ? options.to : [options.to]),
        ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
        ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [])
      ].filter(Boolean)

      const emailLogs = await Promise.all(
        allRecipients.map(recipient => 
          prisma.emailLog.create({
            data: {
              emailId: emailRecord.id,
              toEmail: recipient,
              fromEmail: options.from!,
              subject: options.subject,
              status: 'pending',
              organizationId
            }
          })
        )
      )

      // Inject tracking for each recipient
      const enhancedOptions = { ...options }
      
      // For HTML emails, inject tracking
      if (enhancedOptions.html && emailLogs.length > 0) {
        // Use the first email log for now (in production, you'd want per-recipient tracking)
        const trackingData = {
          emailLogId: emailLogs[0].id,
          recipientEmail: emailLogs[0].toEmail,
          emailType: options.tags?.type || 'transactional'
        }
        
        // Inject open tracking pixel
        enhancedOptions.html = EmailTracker.injectOpenTracking(enhancedOptions.html, trackingData)
        
        // Inject click tracking
        enhancedOptions.html = EmailTracker.injectClickTracking(enhancedOptions.html, trackingData)
      }

      // Send email
      const result = await this.provider.sendEmail(enhancedOptions)

      // Update email record with result
      await prisma.email.update({
        where: { id: emailRecord.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          providerMessageId: result.messageId,
          response: result.response
        }
      })

      // Update email logs
      await Promise.all(
        emailLogs.map(log =>
          prisma.emailLog.update({
            where: { id: log.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
              messageId: result.messageId
            }
          })
        )
      )

      // Track metrics
      await this.trackMetrics('sent', organizationId)

      return result
    } catch (error: any) {
      console.error('Email send error:', error)
      
      // Track error metrics
      await this.trackMetrics('failed', organizationId)
      
      // Re-throw the error
      throw error
    }
  }

  async sendTemplateEmail(
    templateKey: string,
    to: string | string[],
    data: Record<string, any>,
    organizationId?: string
  ): Promise<EmailResult> {
    // Get the template
    const template = await this.templateService.getTemplate(templateKey, organizationId)
    if (!template) {
      throw new EmailProviderError(`Template not found: ${templateKey}`)
    }

    // Render the template
    const rendered = await this.templateService.renderTemplate(template, data)

    // Send the email
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    }, organizationId)
  }

  async queueEmail(options: EmailOptions, organizationId?: string, scheduledFor?: Date): Promise<string> {
    return this.queueService.queueEmail(options, organizationId, scheduledFor)
  }

  async processQueue(): Promise<void> {
    await this.queueService.processQueue(this)
  }

  async getQuota() {
    await this.initialize()
    
    if (!this.provider || !this.provider.getQuota) {
      return null
    }

    return this.provider.getQuota()
  }

  async getStatistics() {
    await this.initialize()
    
    if (!this.provider || !this.provider.getSendStatistics) {
      return null
    }

    return this.provider.getSendStatistics()
  }

  private async trackMetrics(status: 'sent' | 'failed', organizationId?: string) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      await prisma.emailMetrics.upsert({
        where: {
          date_organizationId: {
            date: today,
            organizationId: organizationId || 'platform'
          }
        },
        update: {
          [status]: { increment: 1 }
        },
        create: {
          date: today,
          organizationId: organizationId || 'platform',
          sent: status === 'sent' ? 1 : 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
          failed: status === 'failed' ? 1 : 0
        }
      })
    } catch (error) {
      console.error('Failed to track email metrics:', error)
    }
  }

  // Singleton cleanup
  static reset() {
    if (this.instance) {
      this.instance.provider = null
      this.instance.initialized = false
      this.instance = null
    }
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance()