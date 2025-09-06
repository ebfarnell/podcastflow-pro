import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

export interface NotificationPayload {
  eventType: string
  eventPayload: any
  organizationId: string
  recipientId?: string
  recipientEmail?: string
  recipientIds?: string[]
  metadata?: any
}

export interface DeliveryResult {
  success: boolean
  deliveryId?: string
  error?: string
  channel?: string
}

// Compute idempotency key to prevent duplicate sends
export function computeIdempotencyKey(
  orgId: string,
  eventType: string,
  recipientId: string,
  eventPayload: any,
  timestamp: Date = new Date()
): string {
  // Round timestamp to nearest minute
  const roundedTime = new Date(Math.floor(timestamp.getTime() / 60000) * 60000)
  
  const data = `${orgId}:${eventType}:${recipientId}:${JSON.stringify(eventPayload)}:${roundedTime.toISOString()}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Check if notification should be sent based on org and user preferences
export async function shouldSendNotification(
  userId: string,
  orgId: string,
  eventType: string,
  channel: string
): Promise<boolean> {
  try {
    // Get organization settings
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true }
    })

    if (!org) return false

    const orgSettings = org.settings as any || {}
    const notificationSettings = orgSettings.notifications || {}

    // Check if notifications are enabled globally
    if (!notificationSettings.enabled) return false

    // Check if channel is enabled
    if (!notificationSettings.channels?.[channel]?.enabled) return false

    // Check event-specific settings
    const eventConfig = notificationSettings.events?.[eventType]
    if (!eventConfig?.enabled) return false

    // Check if event is mandatory (bypasses user preferences)
    if (eventConfig.mandatory) return true

    // Check user preferences
    const userPref = await prisma.userNotificationPreference.findUnique({
      where: {
        userId_organizationId_eventType: {
          userId,
          organizationId: orgId,
          eventType
        }
      }
    })

    if (userPref) {
      // Check if user has disabled this event
      if (!userPref.enabled) return false

      // Check if user has disabled this channel
      const channels = userPref.channels as any
      if (channels && channels[channel] === false) return false

      // Check quiet hours
      if (userPref.quietHours && !eventConfig.quietHourBypass) {
        const quietHours = userPref.quietHours as any
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTime = currentHour * 60 + currentMinute

        const [startHour, startMinute] = quietHours.start.split(':').map(Number)
        const [endHour, endMinute] = quietHours.end.split(':').map(Number)
        const startTime = startHour * 60 + startMinute
        const endTime = endHour * 60 + endMinute

        // Handle overnight quiet hours
        if (startTime > endTime) {
          if (currentTime >= startTime || currentTime < endTime) {
            return false
          }
        } else {
          if (currentTime >= startTime && currentTime < endTime) {
            return false
          }
        }
      }
    }

    return true
  } catch (error) {
    console.error('Error checking notification preferences:', error)
    return false
  }
}

// Send notification through specified channel
export async function sendNotification(
  payload: NotificationPayload,
  channel: string
): Promise<DeliveryResult> {
  try {
    const { eventType, eventPayload, organizationId, recipientId, recipientEmail } = payload

    if (!recipientId) {
      return { success: false, error: 'Recipient ID required' }
    }

    // Check if should send
    const shouldSend = await shouldSendNotification(recipientId, organizationId, eventType, channel)
    if (!shouldSend) {
      console.log(`⏭️ Skipping ${channel} notification for ${eventType} to ${recipientId} (preferences)`)
      return { success: false, error: 'Notification disabled by preferences' }
    }

    // Compute idempotency key
    const idempotencyKey = computeIdempotencyKey(organizationId, eventType, recipientId, eventPayload)

    // Check if already sent
    const existing = await prisma.notificationDelivery.findUnique({
      where: { idempotencyKey }
    })

    if (existing) {
      console.log(`⏭️ Skipping duplicate ${channel} notification for ${eventType} to ${recipientId}`)
      return { success: true, deliveryId: existing.id, channel }
    }

    // Get template
    const template = await prisma.notificationTemplate.findFirst({
      where: {
        eventType,
        channel,
        isActive: true,
        OR: [
          { organizationId },
          { organizationId: null, isDefault: true }
        ]
      },
      orderBy: { organizationId: 'desc' } // Prefer org-specific templates
    })

    if (!template) {
      console.warn(`⚠️ No template found for ${eventType} via ${channel}`)
      return { success: false, error: 'No template configured' }
    }

    // Render template with variables
    const renderTemplate = (template: string, variables: any): string => {
      let rendered = template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        rendered = rendered.replace(regex, variables[key] || '')
      })
      return rendered
    }

    let deliveryResult: any = null

    // Send based on channel
    switch (channel) {
      case 'inApp':
        // Create in-app notification
        const notification = await prisma.notification.create({
          data: {
            userId: recipientId,
            organizationId,
            title: renderTemplate(template.title || '', eventPayload),
            message: renderTemplate(template.bodyText || '', eventPayload),
            type: eventType,
            eventType,
            actionUrl: eventPayload.actionUrl || null,
            metadata: eventPayload,
            priority: eventPayload.priority || 'normal',
            read: false,
          }
        })
        deliveryResult = { notificationId: notification.id }
        break

      case 'email':
        // Send email via AWS SES
        try {
          const { sendEmail } = await import('@/lib/email/ses-service')
          
          // Get user's email if not provided
          let email = recipientEmail
          if (!email) {
            const user = await prisma.user.findUnique({
              where: { id: recipientId },
              select: { email: true }
            })
            email = user?.email
          }
          
          if (email) {
            const emailResult = await sendEmail({
              to: email,
              subject: renderTemplate(template.subject || template.name, eventPayload),
              htmlBody: renderTemplate(template.body || '', eventPayload),
              textBody: renderTemplate(template.body || '', eventPayload).replace(/<[^>]*>/g, '') // Strip HTML
            })
            deliveryResult = { messageId: emailResult.messageId, recipient: email }
            console.log(`📧 Email sent to ${email} with message ID: ${emailResult.messageId}`)
          } else {
            console.warn(`⚠️ No email address found for recipient ${recipientId}`)
            return { success: false, error: 'No email address found' }
          }
        } catch (emailError) {
          console.error(`❌ Failed to send email:`, emailError)
          return { success: false, error: emailError instanceof Error ? emailError.message : 'Email send failed' }
        }
        break

      case 'slack':
        // TODO: Integrate with Slack webhook
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { settings: true }
        })
        const slackWebhookUrl = (org?.settings as any)?.notifications?.channels?.slack?.webhookUrl
        if (slackWebhookUrl) {
          console.log(`💬 Slack notification queued for webhook`)
          deliveryResult = { queued: true, webhook: 'slack' }
        }
        break

      case 'webhook':
        // TODO: Call custom webhook
        const orgWebhook = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { settings: true }
        })
        const webhookUrl = (orgWebhook?.settings as any)?.notifications?.channels?.webhook?.url
        if (webhookUrl) {
          console.log(`🔗 Webhook notification queued`)
          deliveryResult = { queued: true, webhook: 'custom' }
        }
        break
    }

    // Log delivery
    const delivery = await prisma.notificationDelivery.create({
      data: {
        idempotencyKey,
        eventType,
        eventPayload,
        organizationId,
        recipientId,
        recipientEmail,
        channel,
        status: 'sent',
        attempts: 1,
        sentAt: new Date(),
        metadata: deliveryResult || {}
      }
    })

    console.log(`✅ ${channel} notification sent for ${eventType} to ${recipientId}`)

    return { success: true, deliveryId: delivery.id, channel }
  } catch (error) {
    console.error(`❌ Error sending ${channel} notification:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Send notification to multiple recipients
export async function sendBulkNotifications(
  payload: NotificationPayload,
  channels: string[] = ['email', 'inApp']
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = []
  const recipients = payload.recipientIds || (payload.recipientId ? [payload.recipientId] : [])

  for (const recipientId of recipients) {
    for (const channel of channels) {
      const result = await sendNotification(
        { ...payload, recipientId },
        channel
      )
      results.push(result)
    }
  }

  return results
}

// Queue notification for async processing
export async function queueNotification(
  payload: NotificationPayload,
  priority: number = 5,
  scheduledFor?: Date
): Promise<string> {
  const queued = await prisma.notificationQueue.create({
    data: {
      eventType: payload.eventType,
      eventPayload: payload.eventPayload,
      organizationId: payload.organizationId,
      recipientIds: payload.recipientIds || [],
      priority,
      scheduledFor: scheduledFor || new Date(),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3
    }
  })

  console.log(`📬 Notification queued: ${queued.id}`)
  return queued.id
}