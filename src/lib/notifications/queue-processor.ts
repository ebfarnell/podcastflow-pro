import prisma from '@/lib/db/prisma'
import { sendNotification } from './delivery-service'

interface ProcessorConfig {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
}

export class NotificationQueueProcessor {
  private isProcessing = false
  private config: Required<ProcessorConfig>
  
  constructor(config: ProcessorConfig = {}) {
    this.config = {
      batchSize: config.batchSize || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000 // 5 seconds
    }
  }
  
  async start() {
    if (this.isProcessing) {
      console.log('⚠️ Queue processor already running')
      return
    }
    
    this.isProcessing = true
    console.log('🚀 Notification queue processor started')
    
    while (this.isProcessing) {
      await this.processBatch()
      await this.sleep(1000) // Check every second
    }
  }
  
  stop() {
    console.log('🛑 Stopping notification queue processor')
    this.isProcessing = false
  }
  
  private async processBatch() {
    try {
      // Get pending notifications that are scheduled for now or past
      const notifications = await prisma.notificationQueue.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: new Date()
          }
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ],
        take: this.config.batchSize
      })
      
      if (notifications.length === 0) {
        return // Nothing to process
      }
      
      console.log(`📬 Processing ${notifications.length} queued notifications`)
      
      for (const notification of notifications) {
        await this.processNotification(notification)
      }
    } catch (error) {
      console.error('❌ Error processing notification batch:', error)
    }
  }
  
  private async processNotification(notification: any) {
    try {
      // Mark as processing
      await prisma.notificationQueue.update({
        where: { id: notification.id },
        data: {
          status: 'processing',
          attempts: notification.attempts + 1
        }
      })
      
      const { eventType, eventPayload, recipientIds, metadata } = notification
      const channels = metadata?.channels || ['email', 'inApp']
      
      // Get organization settings
      const org = await prisma.organization.findUnique({
        where: { id: notification.organizationId },
        select: { settings: true }
      })
      
      const orgSettings = org?.settings as any || {}
      const notificationSettings = orgSettings.notifications || {}
      const eventConfig = notificationSettings.events?.[eventType]
      
      if (!eventConfig?.enabled) {
        // Event is disabled, mark as skipped
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'skipped',
            processedAt: new Date(),
            metadata: { ...metadata, reason: 'Event disabled' }
          }
        })
        return
      }
      
      // Process for each recipient
      const recipientList = recipientIds as string[] || []
      const deliveryResults = []
      
      for (const recipientId of recipientList) {
        // Get recipient details
        const recipient = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { id: true, email: true, name: true }
        })
        
        if (!recipient) {
          console.warn(`⚠️ Recipient ${recipientId} not found`)
          continue
        }
        
        // Send through each enabled channel
        for (const channel of channels) {
          if (eventConfig.channels?.includes(channel)) {
            const result = await sendNotification(
              {
                eventType,
                eventPayload,
                organizationId: notification.organizationId,
                recipientId: recipient.id,
                recipientEmail: recipient.email
              },
              channel
            )
            deliveryResults.push(result)
          }
        }
      }
      
      // Mark as completed
      await prisma.notificationQueue.update({
        where: { id: notification.id },
        data: {
          status: 'completed',
          processedAt: new Date(),
          metadata: {
            ...metadata,
            deliveryResults
          }
        }
      })
      
      console.log(`✅ Notification ${notification.id} processed successfully`)
    } catch (error) {
      console.error(`❌ Error processing notification ${notification.id}:`, error)
      
      // Check if we should retry
      if (notification.attempts >= notification.maxAttempts) {
        // Max retries reached, mark as failed
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'failed',
            processedAt: new Date(),
            lastError: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      } else {
        // Schedule for retry
        const nextRetry = new Date(Date.now() + this.config.retryDelay * notification.attempts)
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'pending',
            scheduledFor: nextRetry,
            lastError: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
let processor: NotificationQueueProcessor | null = null

export function getQueueProcessor(): NotificationQueueProcessor {
  if (!processor) {
    processor = new NotificationQueueProcessor()
  }
  return processor
}

export async function startQueueProcessor() {
  const queueProcessor = getQueueProcessor()
  await queueProcessor.start()
}

export function stopQueueProcessor() {
  const queueProcessor = getQueueProcessor()
  queueProcessor.stop()
}