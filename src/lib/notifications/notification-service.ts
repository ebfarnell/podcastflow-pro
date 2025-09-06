import prisma from '@/lib/db/prisma'
import { emailService } from '@/lib/email/email-service'

export type NotificationType = 
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
  | 'approval'
  | 'rejection'
  | 'status_update'

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
   * Create a notification (alias for sendNotification for backward compatibility)
   */
  async createNotification(data: NotificationData): Promise<boolean> {
    return this.sendNotification(data)
  }

  /**
   * Send a notification to a single user
   */
  async sendNotification(data: NotificationData): Promise<boolean> {
    try {
      console.log(`📋 Sending notification to user ${data.userId}:`)
      console.log(`   - Type: ${data.type}`)
      console.log(`   - Title: ${data.title}`)
      console.log(`   - Send Email: ${data.sendEmail}`)

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

      console.log(`✅ In-app notification created: ${notification.id}`)

      // Send email notification if requested
      if (data.sendEmail && data.emailData) {
        try {
          const emailSent = await this.sendEmailNotification(
            user,
            data.type,
            data.emailData
          )
          
          if (emailSent) {
            console.log(`✅ Email notification sent to ${user.email}`)
          } else {
            console.warn(`⚠️ Email notification failed for ${user.email}`)
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

    for (const userId of data.userIds) {
      const success = await this.sendNotification({
        ...data,
        userId,
      })
      
      if (success) {
        successCount++
      }
    }

    console.log(`✅ Bulk notification sent to ${successCount}/${data.userIds.length} users`)
    return successCount
  }

  /**
   * Send email notification based on type
   */
  private async sendEmailNotification(
    user: any,
    type: NotificationType,
    emailData: Record<string, any>
  ): Promise<boolean> {
    try {
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.email

      switch (type) {
        case 'user_invitation':
          return await emailService.sendUserInvitation(
            user.email,
            userName,
            emailData.userRole,
            emailData.organizationName,
            emailData.invitedBy
          )

        case 'task_assignment':
          return await emailService.sendTaskAssignment(
            user.email,
            userName,
            emailData.task,
            emailData.assignedBy
          )

        case 'campaign_status_update':
          return await emailService.sendCampaignStatusUpdate(
            user.email,
            userName,
            emailData.campaign,
            emailData.previousStatus,
            emailData.newStatus,
            emailData.updatedBy,
            emailData.notes
          )

        case 'spot_submitted':
          return await emailService.sendSpotSubmittedNotification(
            user.email,
            userName,
            emailData.approval,
            emailData.submittedBy
          )

        case 'spot_approved':
          return await emailService.sendApprovalNotification(
            user.email,
            userName,
            emailData.approval,
            emailData.approvedBy
          )

        case 'spot_rejected':
          return await emailService.sendRejectionNotification(
            user.email,
            userName,
            emailData.approval,
            emailData.rejectedBy,
            emailData.reason
          )

        case 'revision_requested':
          return await emailService.sendRevisionRequestNotification(
            user.email,
            userName,
            emailData.approval,
            emailData.requestedBy,
            emailData.feedback
          )

        case 'payment_reminder':
          return await emailService.sendPaymentReminder(
            user.email,
            userName,
            emailData.invoice
          )

        case 'report_ready':
          return await emailService.sendReportReady(
            user.email,
            userName,
            emailData.report
          )

        case 'system_maintenance':
          return await emailService.sendSystemMaintenance(
            user.email,
            userName,
            emailData.maintenance
          )

        default:
          console.warn(`⚠️ No email handler for notification type: ${type}`)
          return false
      }
    } catch (error) {
      console.error('❌ Email notification error:', error)
      return false
    }
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
    return this.sendNotification({
      title: `New Task Assignment: ${task.title}`,
      message: `You have been assigned a new ${task.priority} priority task: ${task.title}`,
      type: 'task_assignment',
      userId: assigneeId,
      actionUrl: `/tasks/${task.id}`,
      sendEmail,
      emailData: { task, assignedBy }
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
    return this.sendBulkNotification({
      title: `Campaign Status Update: ${campaign.name}`,
      message: `Campaign "${campaign.name}" status changed from ${previousStatus} to ${newStatus}`,
      type: 'campaign_status_update',
      userIds,
      actionUrl: `/campaigns/${campaign.id}`,
      sendEmail,
      emailData: { campaign, previousStatus, newStatus, updatedBy, notes }
    })
  }

  async notifySpotSubmission(
    reviewerIds: string[],
    approval: any,
    submittedBy: string,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: `Spot Submitted for Review: ${approval.campaignName}`,
      message: `A new spot has been submitted for review by ${submittedBy}`,
      type: 'spot_submitted',
      userIds: reviewerIds,
      actionUrl: `/ad-approvals`,
      sendEmail,
      emailData: { approval, submittedBy }
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
      actionUrl: `/billing/pay/${invoice.id}`,
      sendEmail,
      emailData: { invoice }
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
      actionUrl: `/reports/download/${report.id}`,
      sendEmail,
      emailData: { report }
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
    
    return this.sendBulkNotification({
      title: `${urgencyText}Deadline Approaching: ${item.name || item.title}`,
      message: `${itemType} "${item.name || item.title}" is due in ${hoursUntilDeadline} hours`,
      type: 'deadline_reminder',
      userIds,
      actionUrl: `/${itemType}s/${item.id}`,
      sendEmail: hoursUntilDeadline <= 24, // Only send email for urgent deadlines
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
    
    return this.sendBulkNotification({
      title: `${alertLevel}: Budget Alert for ${campaign.name}`,
      message: `Campaign "${campaign.name}" has used ${percentageUsed}% of its budget`,
      type: 'budget_alert',
      userIds,
      actionUrl: `/campaigns/${campaign.id}`,
      sendEmail: percentageUsed >= 75, // Only send email for high usage
    })
  }

  async notifySystemMaintenance(
    userIds: string[],
    maintenance: any,
    sendEmail: boolean = true
  ) {
    return this.sendBulkNotification({
      title: 'Scheduled System Maintenance',
      message: `System maintenance is scheduled from ${new Date(maintenance.startTime).toLocaleString()} to ${new Date(maintenance.endTime).toLocaleString()}`,
      type: 'system_maintenance',
      userIds,
      sendEmail,
      emailData: { maintenance }
    })
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string) {
    // This would be expanded to read from user preferences
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
   * Update user notification preferences
   */
  async updateUserNotificationPreferences(userId: string, preferences: Record<string, boolean>) {
    // This would update user preferences in the database
    console.log(`📋 Updated notification preferences for user ${userId}:`, preferences)
    return true
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