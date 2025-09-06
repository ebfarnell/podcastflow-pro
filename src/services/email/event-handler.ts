import { EmailService } from './email-service'
import { EmailTemplateService } from './template-service'
import prisma from '@/lib/db/prisma'

export type EmailEventType = 
  | 'task_assignment'
  | 'task_completion' 
  | 'campaign_status_update'
  | 'spot_submitted'
  | 'spot_approved'
  | 'spot_rejected'
  | 'revision_requested'
  | 'payment_reminder'
  | 'payment_received'
  | 'report_ready'
  | 'system_maintenance'
  | 'user_invitation'
  | 'deadline_reminder'
  | 'campaign_launch'
  | 'budget_alert'
  | 'performance_alert'
  | 'approval_request'
  | 'daily_digest'

interface EmailEventData {
  type: EmailEventType
  recipients: string[]
  organizationId?: string
  data: Record<string, any>
  priority?: number
  scheduledFor?: Date
}

export class EmailEventHandler {
  private emailService: EmailService
  private templateService: EmailTemplateService

  constructor() {
    this.emailService = EmailService.getInstance()
    this.templateService = new EmailTemplateService()
  }

  /**
   * Handle email events and send appropriate notifications
   */
  async handleEvent(eventData: EmailEventData): Promise<boolean> {
    try {
      const templateKey = this.getTemplateKeyForEvent(eventData.type)
      
      // Get template (will use org-specific or fall back to system)
      const template = await this.templateService.getTemplate(
        templateKey,
        eventData.organizationId
      )

      if (!template) {
        console.error(`No template found for event type: ${eventData.type}`)
        return false
      }

      // Prepare template data with common fields
      const templateData = {
        ...eventData.data,
        supportEmail: 'support@podcastflow.pro',
        currentYear: new Date().getFullYear(),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'
      }

      // Send to each recipient
      const results = await Promise.allSettled(
        eventData.recipients.map(recipient => 
          this.emailService.sendTemplateEmail(
            templateKey,
            recipient,
            templateData,
            eventData.organizationId
          )
        )
      )

      // Count successes
      const successCount = results.filter(r => r.status === 'fulfilled').length

      return successCount > 0
    } catch (error) {
      console.error('Email event handler error:', error)
      return false
    }
  }

  /**
   * Queue an email event for later processing
   */
  async queueEvent(eventData: EmailEventData): Promise<string[]> {
    const queueIds: string[] = []

    for (const recipient of eventData.recipients) {
      const queueId = await this.emailService.queueEmail(
        {
          to: recipient,
          subject: 'Notification', // Will be replaced by template
          html: '', // Will be replaced by template
          text: '', // Will be replaced by template
          tags: {
            type: eventData.type,
            organizationId: eventData.organizationId
          }
        },
        eventData.organizationId,
        eventData.scheduledFor
      )

      // Update queue item with template info
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          templateKey: this.getTemplateKeyForEvent(eventData.type),
          templateData: eventData.data,
          priority: eventData.priority || 5
        }
      })

      queueIds.push(queueId)
    }

    return queueIds
  }

  /**
   * Handle specific event types with custom logic
   */
  
  async handleTaskAssignment(
    assigneeEmail: string,
    task: any,
    assignedBy: string,
    organizationId: string
  ): Promise<boolean> {
    return this.handleEvent({
      type: 'task_assignment',
      recipients: [assigneeEmail],
      organizationId,
      data: {
        taskTitle: task.title,
        taskDescription: task.description,
        assigneeName: task.assigneeName,
        assignerName: assignedBy,
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        priority: task.priority || 'Medium',
        taskLink: `${process.env.NEXT_PUBLIC_APP_URL}/tasks/${task.id}`
      }
    })
  }

  async handleCampaignStatusUpdate(
    recipientEmails: string[],
    campaign: any,
    previousStatus: string,
    newStatus: string,
    changedBy: string,
    organizationId: string
  ): Promise<boolean> {
    return this.handleEvent({
      type: 'campaign_status_update',
      recipients: recipientEmails,
      organizationId,
      data: {
        campaignName: campaign.name,
        previousStatus,
        newStatus,
        changedBy,
        changeDate: new Date().toLocaleDateString(),
        campaignLink: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaign.id}`
      }
    })
  }

  async handleApprovalRequest(
    approverEmail: string,
    approval: any,
    requester: string,
    organizationId: string
  ): Promise<boolean> {
    return this.handleEvent({
      type: 'approval_request',
      recipients: [approverEmail],
      organizationId,
      data: {
        approverName: approval.approverName,
        requesterName: requester,
        itemTitle: approval.title || approval.campaignName,
        itemDescription: approval.description || `${approval.type} - ${approval.duration}s`,
        itemType: approval.type || 'Ad Copy',
        requestDate: new Date().toLocaleDateString(),
        approvalLink: `${process.env.NEXT_PUBLIC_APP_URL}/ad-approvals/${approval.id}`
      }
    })
  }

  async handlePaymentReminder(
    recipientEmail: string,
    invoice: any,
    organizationId: string
  ): Promise<boolean> {
    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    return this.handleEvent({
      type: 'payment_reminder',
      recipients: [recipientEmail],
      organizationId,
      data: {
        invoiceNumber: invoice.number,
        amountDue: invoice.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
        isOverdue: daysOverdue > 0,
        paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}/pay`
      }
    })
  }

  async handleReportReady(
    recipientEmail: string,
    report: any,
    organizationId: string
  ): Promise<boolean> {
    return this.handleEvent({
      type: 'report_ready',
      recipients: [recipientEmail],
      organizationId,
      data: {
        reportName: report.name,
        reportType: report.type,
        reportPeriod: report.period,
        generatedDate: new Date().toLocaleDateString(),
        downloadLink: `${process.env.NEXT_PUBLIC_APP_URL}/reports/${report.id}/download`,
        expiresIn: '7 days'
      }
    })
  }

  async handleDailyDigest(
    recipientEmail: string,
    digestData: any,
    organizationId: string
  ): Promise<boolean> {
    return this.handleEvent({
      type: 'daily_digest',
      recipients: [recipientEmail],
      organizationId,
      data: {
        date: new Date().toLocaleDateString(),
        ...digestData
      },
      scheduledFor: new Date() // Can be scheduled for specific time
    })
  }

  /**
   * Map event types to template keys
   */
  private getTemplateKeyForEvent(eventType: EmailEventType): string {
    const mapping: Record<EmailEventType, string> = {
      'task_assignment': 'task-assignment',
      'task_completion': 'task-completion',
      'campaign_status_update': 'campaign-status-update',
      'spot_submitted': 'ad-submitted',
      'spot_approved': 'ad-approved',
      'spot_rejected': 'ad-rejected',
      'revision_requested': 'revision-requested',
      'payment_reminder': 'payment-reminder',
      'payment_received': 'payment-received',
      'report_ready': 'report-ready',
      'system_maintenance': 'system-announcement',
      'user_invitation': 'user-invitation',
      'deadline_reminder': 'deadline-reminder',
      'campaign_launch': 'campaign-launch',
      'budget_alert': 'budget-alert',
      'performance_alert': 'performance-alert',
      'approval_request': 'approval-request',
      'daily_digest': 'daily-digest'
    }

    return mapping[eventType] || 'system-announcement'
  }

  /**
   * Get recipients based on event type and context
   */
  async getEventRecipients(
    eventType: EmailEventType,
    organizationId: string,
    context: Record<string, any>
  ): Promise<string[]> {
    const recipients: string[] = []

    switch (eventType) {
      case 'campaign_status_update':
        // Get campaign team members
        if (context.campaignId) {
          // In production, query campaign team members
          // For now, return empty array
        }
        break

      case 'budget_alert':
        // Get finance team and campaign managers
        const financeUsers = await prisma.user.findMany({
          where: {
            organizationId,
            role: { in: ['admin', 'master'] },
            isActive: true
          },
          select: { email: true }
        })
        recipients.push(...financeUsers.map(u => u.email))
        break

      case 'system_maintenance':
        // Get all active users
        const allUsers = await prisma.user.findMany({
          where: {
            organizationId,
            isActive: true
          },
          select: { email: true }
        })
        recipients.push(...allUsers.map(u => u.email))
        break
    }

    return recipients
  }
}

// Export singleton instance
export const emailEventHandler = new EmailEventHandler()