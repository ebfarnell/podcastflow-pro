import prisma from '@/lib/db/prisma'
import { EmailOptions } from './providers/types'
import type { EmailService } from './email-service'
import { EmailTemplateService } from './template-service'

export class EmailQueueService {
  async queueEmail(
    options: EmailOptions, 
    organizationId?: string, 
    scheduledFor?: Date
  ): Promise<string> {
    const queueItem = await prisma.emailQueue.create({
      data: {
        to: Array.isArray(options.to) ? options.to : [options.to],
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : null,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : null,
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.from,
        replyTo: options.replyTo,
        metadata: options.tags ? options.tags : null,
        status: 'pending',
        scheduledFor: scheduledFor || new Date(),
        organizationId: organizationId,
        attempts: 0
      }
    })

    return queueItem.id
  }

  async processQueue(emailService: EmailService): Promise<void> {
    // Get pending emails that are scheduled for now or earlier
    const pendingEmails = await prisma.emailQueue.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
        attempts: { lt: 3 } // Max 3 attempts
      },
      take: 50, // Process 50 at a time
      orderBy: [
        { priority: 'desc' },
        { scheduledFor: 'asc' }
      ]
    })

    for (const queueItem of pendingEmails) {
      try {
        // Update status to processing
        await prisma.emailQueue.update({
          where: { id: queueItem.id },
          data: { 
            status: 'processing',
            attempts: { increment: 1 }
          }
        })

        // Prepare email options
        let emailOptions: EmailOptions
        
        // Check if this is a template-based email
        if (queueItem.templateKey) {
          // Process template
          const templateService = new EmailTemplateService()
          const template = await templateService.getTemplate(
            queueItem.templateKey,
            queueItem.organizationId
          )
          
          if (!template) {
            throw new Error(`Email template '${queueItem.templateKey}' not found`)
          }
          
          const processed = await templateService.renderTemplate(
            template,
            queueItem.templateData as Record<string, any>
          )
          
          emailOptions = {
            to: queueItem.recipient,
            subject: processed.subject,
            html: processed.html,
            text: processed.text,
            tags: queueItem.templateData?.tags as Record<string, string> | undefined
          }
        } else {
          // Direct email (legacy support)
          emailOptions = {
            from: queueItem.from || undefined,
            to: queueItem.recipient,
            cc: queueItem.cc || undefined,
            bcc: queueItem.bcc || undefined,
            subject: queueItem.subject || 'No Subject',
            html: queueItem.html || undefined,
            text: queueItem.text || undefined,
            replyTo: queueItem.replyTo || undefined,
            tags: queueItem.metadata as Record<string, string> | undefined
          }
        }
        
        // Send the email
        const result = await emailService.sendEmail(emailOptions, queueItem.organizationId || undefined)

        // Update status to sent
        await prisma.emailQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'sent',
            lastAttemptAt: new Date()
          }
        })
        
        // Create email log entry
        if (result.messageId) {
          await prisma.emailLog.create({
            data: {
              organizationId: queueItem.organizationId,
              userId: queueItem.userId,
              recipient: queueItem.recipient,
              subject: emailOptions.subject,
              templateKey: queueItem.templateKey,
              status: 'sent',
              providerMessageId: result.messageId,
              sentAt: new Date(),
              metadata: {
                queueId: queueItem.id,
                ...queueItem.templateData
              }
            }
          })
        }
      } catch (error: any) {
        console.error(`Failed to send queued email ${queueItem.id}:`, error)

        // Update status to failed if max attempts reached
        const isFinalAttempt = queueItem.attempts >= 2 // Since we already incremented
        
        await prisma.emailQueue.update({
          where: { id: queueItem.id },
          data: {
            status: isFinalAttempt ? 'failed' : 'pending',
            lastError: error.message,
            lastAttemptAt: new Date()
          }
        })
      }
    }
  }

  async getQueueStatus(): Promise<{
    pending: number
    processing: number
    sent: number
    failed: number
  }> {
    const [pending, processing, sent, failed] = await Promise.all([
      prisma.emailQueue.count({ where: { status: 'pending' } }),
      prisma.emailQueue.count({ where: { status: 'processing' } }),
      prisma.emailQueue.count({ where: { status: 'sent' } }),
      prisma.emailQueue.count({ where: { status: 'failed' } })
    ])

    return { pending, processing, sent, failed }
  }

  async cleanupOldEntries(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await prisma.emailQueue.deleteMany({
      where: {
        OR: [
          { status: 'sent', sentAt: { lt: cutoffDate } },
          { status: 'failed', updatedAt: { lt: cutoffDate } }
        ]
      }
    })

    return result.count
  }
}