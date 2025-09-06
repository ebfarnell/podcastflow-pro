import prisma from '@/lib/db/prisma'
import { emailEventHandler, EmailEventType } from '@/services/email/event-handler'

export type NotificationType = EmailEventType

interface NotificationData {
  title: string
  message: string
  type: NotificationType
  userId: string
  actionUrl?: string
  sendEmail?: boolean
  emailData?: Record<string, any>
}

interface BulkNotificationData {
  title: string
  message: string
  type: NotificationType
  userIds: string[]
  actionUrl?: string
  sendEmail?: boolean
  emailData?: Record<string, any>
}

class NotificationService {
  /**
   * Send a notification to a single user
   */
  async sendNotification(data: NotificationData): Promise<boolean> {
    try {

      // Get user details for email
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        include: { organization: true }
      })

      if (!user) {
        console.error(`❌ User not found: ${data.userId}`)
        return false
      }

      // Create in-app notification
      const notification = await prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: data.type,
          userId: data.userId,
          actionUrl: data.actionUrl,
        }
      })


      // Send email notification if requested and user has email notifications enabled
      if (data.sendEmail && data.emailData && user.email) {
        try {
          // Check user email preferences
          const preferences = await this.getUserNotificationPreferences(data.userId)
          
          if (preferences.email) {
            // Prepare email data with user info
            const emailData = {
              ...data.emailData,
              userName: user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.email.split('@')[0],
              userEmail: user.email,
              organizationName: user.organization?.name || 'PodcastFlow Pro'
            }

            // Send via email event handler
            const emailSent = await emailEventHandler.handleEvent({
              type: data.type,
              recipients: [user.email],
              organizationId: user.organizationId,
              data: emailData
            })
            
            if (emailSent) {
            } else {
              console.warn(`⚠️ Email notification failed for ${user.email}`)
            }
          } else {
          }
        } catch (emailError) {
          console.error(`❌ Email notification error:`, emailError)
          // Don't fail the entire notification if email fails
        }
      }

      return true
    } catch (error) {
      console.error('❌ Notification service error:', error)
      return false
    }
  }

  /**
   * Send notifications to multiple users
   */
  async sendBulkNotification(data: BulkNotificationData): Promise<number> {
    let successCount = 0

    // Get users with their email preferences
    const users = await prisma.user.findMany({
      where: {
        id: { in: data.userIds },
        isActive: true
      },
      include: { organization: true }
    })

    // Create in-app notifications for all users
    const notifications = await prisma.notification.createMany({
      data: users.map(user => ({
        title: data.title,
        message: data.message,
        type: data.type,
        userId: user.id,
        actionUrl: data.actionUrl
      }))
    })

    successCount = notifications.count

    // Send email notifications if requested
    if (data.sendEmail && data.emailData) {
      const emailRecipients = users
        .filter(user => user.email)
        .map(user => user.email)

      if (emailRecipients.length > 0) {
        const organizationId = users[0]?.organizationId

        await emailEventHandler.handleEvent({
          type: data.type,
          recipients: emailRecipients,
          organizationId,
          data: data.emailData
        })
      }
    }

    return successCount
  }

  /**
   * Specialized notification methods for common scenarios
   */
  
  async notifyTaskAssignment(
    assigneeId: string,
    task: any,
    assignedBy: string,
    sendEmail: boolean = true
  ) {
    const user = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { email: true, firstName: true, lastName: true, organizationId: true }
    })

    if (!user) return false

    const assignerUser = await prisma.user.findUnique({
      where: { id: assignedBy },
      select: { firstName: true, lastName: true }
    })

    return this.sendNotification({
      title: `New Task Assignment: ${task.title}`,
      message: `You have been assigned a new ${task.priority || 'normal'} priority task: ${task.title}`,
      type: 'task_assignment',
      userId: assigneeId,
      actionUrl: `/tasks/${task.id}`,
      sendEmail,
      emailData: {
        taskTitle: task.title,
        taskDescription: task.description,
        assigneeName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email,
        assignerName: assignerUser?.firstName && assignerUser?.lastName
          ? `${assignerUser.firstName} ${assignerUser.lastName}`
          : 'System',
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
        priority: task.priority || 'Normal',
        taskLink: `${process.env.NEXT_PUBLIC_APP_URL}/tasks/${task.id}`
      }
    })
  }

  async notifyCampaignStatusChange(
    userIds: string[],
    campaign: any,
    previousStatus: string,
    newStatus: string,
    updatedBy: string,
    notes?: string,
    sendEmail: boolean = true
  ) {
    const updater = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { firstName: true, lastName: true }
    })

    return this.sendBulkNotification({
      title: `Campaign Status Update: ${campaign.name}`,
      message: `Campaign "${campaign.name}" status changed from ${previousStatus} to ${newStatus}`,
      type: 'campaign_status_update',
      userIds,
      actionUrl: `/campaigns/${campaign.id}`,
      sendEmail,
      emailData: {
        campaignName: campaign.name,
        previousStatus,
        newStatus,
        changedBy: updater?.firstName && updater?.lastName
          ? `${updater.firstName} ${updater.lastName}`
          : 'System',
        changeDate: new Date().toLocaleDateString(),
        notes,
        campaignLink: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaign.id}`
      }
    })
  }

  async notifyApprovalRequest(
    reviewerIds: string[],
    approval: any,
    submittedBy: string,
    sendEmail: boolean = true
  ) {
    const submitter = await prisma.user.findUnique({
      where: { id: submittedBy },
      select: { firstName: true, lastName: true }
    })

    return this.sendBulkNotification({
      title: `New Ad for Review: ${approval.campaignName}`,
      message: `A new ad has been submitted for review`,
      type: 'approval_request',
      userIds: reviewerIds,
      actionUrl: `/ad-approvals/${approval.id}`,
      sendEmail,
      emailData: {
        campaignName: approval.campaignName,
        advertiserName: approval.advertiserName,
        showName: approval.showName,
        adType: approval.type,
        duration: approval.duration,
        submittedBy: submitter?.firstName && submitter?.lastName
          ? `${submitter.firstName} ${submitter.lastName}`
          : 'Producer',
        priority: approval.priority || 'Normal',
        reviewLink: `${process.env.NEXT_PUBLIC_APP_URL}/ad-approvals/${approval.id}`
      }
    })
  }

  async notifyPaymentDue(
    userId: string,
    invoice: any,
    sendEmail: boolean = true
  ) {
    const dueDate = new Date(invoice.dueDate)
    const today = new Date()
    const isOverdue = dueDate < today
    
    return this.sendNotification({
      title: `Payment ${isOverdue ? 'Overdue' : 'Due'}: Invoice ${invoice.number}`,
      message: `Invoice ${invoice.number} for $${invoice.amount ? invoice.amount.toLocaleString() : '0'} is ${isOverdue ? 'overdue' : 'due on ' + dueDate.toLocaleDateString()}`,
      type: 'payment_reminder',
      userId,
      actionUrl: `/invoices/${invoice.id}`,
      sendEmail,
      emailData: {
        invoiceNumber: invoice.number,
        amountDue: invoice.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        dueDate: dueDate.toLocaleDateString(),
        daysOverdue: Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))),
        isOverdue,
        paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}/pay`
      }
    })
  }

  async notifyReportReady(
    userId: string,
    report: any,
    sendEmail: boolean = true
  ) {
    return this.sendNotification({
      title: `Report Ready: ${report.name}`,
      message: `Your requested report "${report.name}" has been generated and is ready for download`,
      type: 'report_ready',
      userId,
      actionUrl: `/reports/${report.id}`,
      sendEmail,
      emailData: {
        reportName: report.name,
        reportType: report.type,
        reportPeriod: report.period,
        generatedDate: new Date().toLocaleDateString(),
        downloadLink: `${process.env.NEXT_PUBLIC_APP_URL}/reports/${report.id}/download`,
        expiresIn: '7 days'
      }
    })
  }

  async notifyDeadlineReminder(
    userIds: string[],
    item: any,
    itemType: 'task' | 'campaign' | 'approval',
    hoursUntilDeadline: number,
    sendEmail: boolean = true
  ) {
    const urgencyText = hoursUntilDeadline <= 2 ? 'URGENT: ' : 
                      hoursUntilDeadline <= 24 ? 'Reminder: ' : ''
    
    const timeRemaining = hoursUntilDeadline < 24 
      ? `${hoursUntilDeadline} hours`
      : `${Math.floor(hoursUntilDeadline / 24)} days`
    
    return this.sendBulkNotification({
      title: `${urgencyText}Deadline Approaching: ${item.name || item.title}`,
      message: `${itemType} "${item.name || item.title}" is due in ${timeRemaining}`,
      type: 'deadline_reminder',
      userIds,
      actionUrl: `/${itemType}s/${item.id}`,
      sendEmail: hoursUntilDeadline <= 24, // Only send email for urgent deadlines
      emailData: {
        urgency: urgencyText.replace(':', ''),
        itemTitle: item.name || item.title,
        itemType: itemType.charAt(0).toUpperCase() + itemType.slice(1),
        deadline: new Date(item.deadline || item.dueDate).toLocaleString(),
        timeRemaining,
        description: item.description,
        itemLink: `${process.env.NEXT_PUBLIC_APP_URL}/${itemType}s/${item.id}`
      }
    })
  }

  async notifyBudgetAlert(
    userIds: string[],
    campaign: any,
    percentageUsed: number,
    sendEmail: boolean = true
  ) {
    const alertLevel = percentageUsed >= 90 ? 'CRITICAL' : 
                     percentageUsed >= 75 ? 'WARNING' : 'INFO'
    
    const budget = campaign.budget || 0
    const used = (budget * percentageUsed) / 100
    const remaining = budget - used
    
    return this.sendBulkNotification({
      title: `${alertLevel}: Budget Alert for ${campaign.name}`,
      message: `Campaign "${campaign.name}" has used ${percentageUsed}% of its budget`,
      type: 'budget_alert',
      userIds,
      actionUrl: `/campaigns/${campaign.id}`,
      sendEmail: percentageUsed >= 75, // Only send email for high usage
      emailData: {
        alertLevel,
        campaignName: campaign.name,
        budgetUsed: used.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        percentageUsed,
        budgetRemaining: remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        daysRemaining: campaign.daysRemaining || 'Unknown',
        projectedOverage: campaign.projectedOverage || '$0',
        isCritical: percentageUsed >= 90,
        campaignLink: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaign.id}`
      }
    })
  }

  /**
   * Contract and Billing Workflow Notifications
   */
  
  async notifyContractApprovalRequired(
    approverIds: string[],
    contract: any,
    requesterName: string,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: `Contract Approval Required: ${contract.title || contract.name}`,
      message: `A new contract for ${contract.advertiserName || 'advertiser'} requires your approval`,
      type: 'approval_request',
      userIds: approverIds,
      actionUrl: `/contracts/${contract.id}`,
      sendEmail,
      emailData: {
        contractTitle: contract.title || contract.name,
        advertiserName: contract.advertiserName,
        campaignName: contract.campaignName,
        contractValue: contract.totalValue?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        requesterName,
        dueDate: contract.approvalDeadline ? new Date(contract.approvalDeadline).toLocaleDateString() : 'No deadline',
        priority: contract.priority || 'Normal',
        reviewLink: `${process.env.NEXT_PUBLIC_APP_URL}/contracts/${contract.id}`
      }
    })
  }

  async notifyContractStatusChange(
    userIds: string[],
    contract: any,
    previousStatus: string,
    newStatus: string,
    updatedBy: string,
    notes?: string,
    sendEmail: boolean = true
  ) {
    const updater = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { firstName: true, lastName: true }
    })

    const isApproval = newStatus === 'approved'
    const isRejection = newStatus === 'rejected'
    const isSigned = newStatus === 'signed'

    return this.sendBulkNotification({
      title: `Contract ${isApproval ? 'Approved' : isRejection ? 'Rejected' : isSigned ? 'Signed' : 'Updated'}: ${contract.title || contract.name}`,
      message: `Contract status changed from ${previousStatus} to ${newStatus}`,
      type: isApproval || isSigned ? 'approval_granted' : isRejection ? 'approval_denied' : 'contract_status_update',
      userIds,
      actionUrl: `/contracts/${contract.id}`,
      sendEmail: sendEmail && (isApproval || isRejection || isSigned),
      emailData: {
        contractTitle: contract.title || contract.name,
        advertiserName: contract.advertiserName,
        previousStatus,
        newStatus,
        changedBy: updater?.firstName && updater?.lastName
          ? `${updater.firstName} ${updater.lastName}`
          : 'System',
        changeDate: new Date().toLocaleDateString(),
        notes,
        contractValue: contract.totalValue?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        contractLink: `${process.env.NEXT_PUBLIC_APP_URL}/contracts/${contract.id}`
      }
    })
  }

  async notifyInvoiceGenerated(
    userId: string,
    invoice: any,
    isAutomated: boolean = false,
    sendEmail: boolean = true
  ) {
    return this.sendNotification({
      title: `${isAutomated ? 'Auto-Generated' : 'New'} Invoice: ${invoice.number}`,
      message: `Invoice ${invoice.number} for $${invoice.amount?.toLocaleString() || '0'} has been generated`,
      type: 'invoice_generated',
      userId,
      actionUrl: `/invoices/${invoice.id}`,
      sendEmail,
      emailData: {
        invoiceNumber: invoice.number,
        amountDue: invoice.amount?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        advertiserName: invoice.advertiserName,
        campaignName: invoice.campaignName,
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        paymentTerms: invoice.paymentTerms || 'Net 30',
        isAutomated,
        invoiceLink: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}`,
        paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}/pay`
      }
    })
  }

  async notifyPreBillApprovalRequired(
    approverIds: string[],
    advertiser: any,
    billingAmount: number,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: `Pre-Bill Approval Required: ${advertiser.name}`,
      message: `Pre-billing for ${advertiser.name} exceeds threshold ($${billingAmount.toLocaleString()}) and requires approval`,
      type: 'approval_request',
      userIds: approverIds,
      actionUrl: `/admin/pre-bill-approvals`,
      sendEmail,
      emailData: {
        advertiserName: advertiser.name,
        billingAmount: billingAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        threshold: '$10,000', // Could be dynamic based on settings
        campaignCount: advertiser.activeCampaigns || 1,
        approvalDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString(), // 48 hours
        approvalLink: `${process.env.NEXT_PUBLIC_APP_URL}/admin/pre-bill-approvals?advertiser=${advertiser.id}`
      }
    })
  }

  async notifyBillingCycleComplete(
    userIds: string[],
    cycle: any,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: `Billing Cycle Complete: ${cycle.period}`,
      message: `Billing cycle for ${cycle.period} has completed. ${cycle.invoiceCount} invoices generated, totaling $${cycle.totalAmount?.toLocaleString()}`,
      type: 'billing_complete',
      userIds,
      actionUrl: `/billing/cycles/${cycle.id}`,
      sendEmail,
      emailData: {
        billingPeriod: cycle.period,
        invoiceCount: cycle.invoiceCount,
        totalAmount: cycle.totalAmount?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        successfulInvoices: cycle.successfulInvoices,
        failedInvoices: cycle.failedInvoices,
        cycleDate: new Date().toLocaleDateString(),
        reportLink: `${process.env.NEXT_PUBLIC_APP_URL}/billing/cycles/${cycle.id}/report`
      }
    })
  }

  async notifyContractExpirationWarning(
    userIds: string[],
    contract: any,
    daysUntilExpiration: number,
    sendEmail: boolean = true
  ) {
    const urgencyText = daysUntilExpiration <= 7 ? 'URGENT: ' : 
                      daysUntilExpiration <= 30 ? 'Reminder: ' : ''
    
    return this.sendBulkNotification({
      title: `${urgencyText}Contract Expiring: ${contract.title || contract.name}`,
      message: `Contract with ${contract.advertiserName} expires in ${daysUntilExpiration} days`,
      type: 'deadline_reminder',
      userIds,
      actionUrl: `/contracts/${contract.id}`,
      sendEmail: sendEmail && daysUntilExpiration <= 30,
      emailData: {
        urgency: urgencyText.replace(':', ''),
        contractTitle: contract.title || contract.name,
        advertiserName: contract.advertiserName,
        expirationDate: new Date(contract.endDate).toLocaleDateString(),
        daysUntilExpiration,
        contractValue: contract.totalValue?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        autoRenewal: contract.autoRenewal ? 'Yes' : 'No',
        contractLink: `${process.env.NEXT_PUBLIC_APP_URL}/contracts/${contract.id}`,
        renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/contracts/${contract.id}/renew`
      }
    })
  }

  async notifyPaymentReceived(
    userIds: string[],
    payment: any,
    invoice: any,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: `Payment Received: ${invoice.number}`,
      message: `Payment of $${payment.amount?.toLocaleString()} received for invoice ${invoice.number}`,
      type: 'payment_received',
      userIds,
      actionUrl: `/invoices/${invoice.id}`,
      sendEmail,
      emailData: {
        paymentAmount: payment.amount?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        invoiceNumber: invoice.number,
        advertiserName: invoice.advertiserName,
        paymentDate: new Date().toLocaleDateString(),
        paymentMethod: payment.method || 'Unknown',
        remainingBalance: invoice.remainingBalance?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0',
        isFullPayment: payment.amount >= invoice.amount,
        invoiceLink: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}`
      }
    })
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string) {
    // Check if user has preferences stored
    // For now, return default preferences
    return {
      email: true,
      inApp: true,
      taskAssignments: true,
      campaignUpdates: true,
      paymentReminders: true,
      deadlineReminders: true,
      systemMaintenance: true,
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: userId,
        },
        data: {
          read: true,
        }
      })
      return true
    } catch (error) {
      console.error('❌ Error marking notification as read:', error)
      return false
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      await prisma.notification.updateMany({
        where: {
          userId: userId,
          read: false,
        },
        data: {
          read: true,
        }
      })
      return true
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error)
      return false
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId: userId,
          read: false,
        }
      })
    } catch (error) {
      console.error('❌ Error getting unread count:', error)
      return 0
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()

// Export types
export type { NotificationData, BulkNotificationData }