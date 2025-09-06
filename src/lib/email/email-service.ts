// Main email service that handles all email operations

import prisma from '@/lib/db/prisma'
import { 
  EmailOptions, 
  EmailResult, 
  EmailProvider,
  PlatformEmailSettingsData,
  EmailLogEntry 
} from './types'

export class EmailService {
  private static instance: EmailService
  private provider: EmailProvider | null = null
  private settings: PlatformEmailSettingsData | null = null
  private initialized = false

  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  async initialize(): Promise<void> {
    try {
      // Get platform email settings
      const settings = await prisma.platformEmailSettings.findFirst()
      
      if (!settings || !settings.isConfigured) {
        console.warn('Email system not configured')
        this.settings = settings as any
        return
      }

      this.settings = settings as any

      // Initialize provider based on settings
      if (settings.provider === 'ses') {
        // TODO: Initialize SES provider in Phase 4
        console.log('SES provider will be initialized in Phase 4')
      } else if (settings.provider === 'smtp') {
        // TODO: Initialize SMTP provider in Phase 4
        console.log('SMTP provider will be initialized in Phase 4')
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      throw error
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    // Create email log entry
    const logEntry = await this.createEmailLog(options, 'pending')

    try {
      // Check if system is configured
      if (!this.settings?.isConfigured || !this.provider) {
        await this.updateEmailLog(logEntry.id, {
          status: 'failed',
          errorMessage: 'Email system not configured'
        })

        return {
          success: false,
          error: 'Email system not configured',
          messageId: null
        }
      }

      // Check suppression list
      const recipients = Array.isArray(options.to) ? options.to : [options.to]
      const suppressed = await this.checkSuppressionList(recipients)
      if (suppressed.length > 0) {
        await this.updateEmailLog(logEntry.id, {
          status: 'failed',
          errorMessage: `Recipients suppressed: ${suppressed.join(', ')}`
        })

        return {
          success: false,
          error: 'One or more recipients are on the suppression list',
          details: { suppressed }
        }
      }

      // Queue email for sending (Phase 4 will implement actual sending)
      await this.queueEmail(options, logEntry.id)
      
      await this.updateEmailLog(logEntry.id, {
        status: 'queued'
      })

      return {
        success: true,
        messageId: logEntry.id,
        error: undefined
      }
    } catch (error: any) {
      await this.updateEmailLog(logEntry.id, {
        status: 'failed',
        errorMessage: error.message
      })

      return {
        success: false,
        error: error.message,
        messageId: null
      }
    }
  }

  private async createEmailLog(
    options: EmailOptions, 
    status: EmailLogEntry['status']
  ): Promise<EmailLogEntry> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to]
    
    // For now, create a log for the first recipient
    // In production, we might create separate logs for each recipient
    const log = await prisma.emailLog.create({
      data: {
        organizationId: options.organizationId || 'system',
        userId: options.userId,
        toEmail: recipients[0],  // Use toEmail as defined in Prisma schema
        fromEmail: 'notifications@app.podcastflow.pro',
        recipient: recipients[0], // Keep for backward compatibility
        subject: options.subject,
        templateKey: options.templateKey,
        status,
        metadata: options.metadata || {}
      }
    })

    return log as any
  }

  private async updateEmailLog(
    id: string, 
    updates: Partial<EmailLogEntry>
  ): Promise<void> {
    await prisma.emailLog.update({
      where: { id },
      data: updates as any
    })
  }

  private async checkSuppressionList(emails: string[]): Promise<string[]> {
    const suppressed = await prisma.emailSuppressionList.findMany({
      where: {
        email: {
          in: emails
        }
      }
    })

    return suppressed.map(s => s.email)
  }

  private async queueEmail(options: EmailOptions, emailLogId: string): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to]
    
    await prisma.emailQueue.create({
      data: {
        organizationId: options.organizationId || 'system',
        userId: options.userId,
        recipient: recipients[0],
        templateKey: options.templateKey || 'custom',
        templateData: options.templateData || {},
        emailLogId,
        priority: 5,
        status: 'pending'
      }
    })
  }

  async getSettings(): Promise<PlatformEmailSettingsData | null> {
    if (!this.initialized) {
      await this.initialize()
    }
    return this.settings
  }

  async isConfigured(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize()
    }
    return this.settings?.isConfigured || false
  }

  async testConnection(): Promise<boolean> {
    if (!this.provider) {
      return false
    }
    return await this.provider.verifyConnection()
  }

  async getQuota(): Promise<any> {
    if (!this.provider) {
      return {
        dailyQuota: 0,
        sendRate: 0,
        sentToday: 0,
        remainingToday: 0
      }
    }
    return await this.provider.getQuota()
  }

  // Legacy methods for backward compatibility
  async sendAdApprovalAssignment(
    recipientEmail: string,
    userName: string,
    approval: any
  ): Promise<EmailResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: `🎙️ New Ad Production Assignment - ${approval.campaignName}`,
      templateKey: 'ad_approval_assigned',
      templateData: {
        userName,
        campaignName: approval.campaignName,
        advertiserName: approval.advertiserName,
        showName: approval.showName,
        type: approval.type,
        duration: approval.duration,
        priority: approval.priority,
        deadline: new Date(approval.deadline).toLocaleDateString(),
      },
      organizationId: approval.organizationId,
      metadata: {
        campaignId: approval.campaignId,
        campaignName: approval.campaignName,
        advertiserId: approval.advertiserId,
        advertiserName: approval.advertiserName,
        agencyId: approval.agencyId,
        agencyName: approval.agencyName,
        showId: approval.showId,
        showName: approval.showName,
        approvalId: approval.id,
        type: 'ad_approval_assignment'
      }
    })
  }

  async sendUserInvitation(
    recipientEmail: string,
    userName: string,
    userRole: string,
    organizationName: string,
    invitedBy: string,
    inviterEmail?: string,
    invitationToken?: string,
    organizationId?: string,
    inviterId?: string
  ): Promise<EmailResult> {
    const baseUrl = 'https://app.podcastflow.pro'
    const invitationUrl = invitationToken 
      ? `${baseUrl}/accept-invitation?token=${invitationToken}`
      : `${baseUrl}/login`

    return this.sendEmail({
      to: recipientEmail,
      cc: inviterEmail ? [inviterEmail] : undefined,
      bcc: ['michael@unfy.com'],
      subject: `🎙️ You're invited to join ${organizationName} on PodcastFlow Pro`,
      templateKey: 'user_invitation',
      templateData: {
        userName,
        userEmail: recipientEmail,
        userRole,
        organizationName,
        invitedBy,
        inviteLink: invitationUrl,
        supportEmail: 'support@podcastflow.pro'
      },
      organizationId,
      metadata: {
        invitationType: 'user_invitation',
        userRole,
        organizationName,
        invitedBy,
        inviterEmail,
        inviterId,
        invitationToken
      }
    })
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance()