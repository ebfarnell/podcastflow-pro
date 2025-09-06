import prisma from '@/lib/db/prisma'
import { sendBulkNotifications, queueNotification } from './delivery-service'
import type { NotificationEvent } from './event-types'

// Emit notification event
export async function emitNotificationEvent(
  event: NotificationEvent,
  organizationId: string
): Promise<void> {
  try {
    console.log(`📢 Emitting ${event.eventType} for org ${organizationId}`)

    // Get organization settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { 
        id: true,
        name: true,
        settings: true 
      }
    })

    if (!org) {
      console.error(`Organization ${organizationId} not found`)
      return
    }

    const orgSettings = org.settings as any || {}
    const notificationSettings = orgSettings.notifications || {}

    // Check if event is enabled
    const eventConfig = notificationSettings.events?.[event.eventType]
    if (!eventConfig?.enabled) {
      console.log(`⏭️ Event ${event.eventType} is disabled for org ${organizationId}`)
      return
    }

    // Determine recipients based on event type
    const recipients = await determineRecipients(event, organizationId)
    
    if (recipients.length === 0) {
      console.log(`⚠️ No recipients found for ${event.eventType}`)
      return
    }

    // Determine channels to use
    const channels = eventConfig.channels || ['email', 'inApp']
    
    // Add organization context to event payload
    const enrichedPayload = {
      ...event,
      organizationId,
      organizationName: org.name,
      timestamp: new Date().toISOString()
    }

    // Queue or send immediately based on priority
    const priority = getPriorityForEvent(event.eventType, eventConfig.severity)
    
    if (priority <= 3) {
      // High priority - send immediately
      await sendBulkNotifications({
        eventType: event.eventType,
        eventPayload: enrichedPayload,
        organizationId,
        recipientIds: recipients.map(r => r.id),
        metadata: { immediate: true }
      }, channels)
    } else {
      // Queue for async processing with all recipients
      await queueNotification({
        eventType: event.eventType,
        eventPayload: enrichedPayload,
        organizationId,
        recipientIds: recipients.map(r => r.id),
        metadata: { 
          recipients: recipients.map(r => ({ id: r.id, email: r.email })),
          channels 
        }
      }, priority)
    }

    console.log(`✅ Event ${event.eventType} processed for ${recipients.length} recipients`)
  } catch (error) {
    console.error(`❌ Error emitting notification event:`, error)
  }
}

// Determine recipients based on event type and configuration
async function determineRecipients(
  event: NotificationEvent,
  organizationId: string
): Promise<Array<{ id: string; email: string; role: string }>> {
  const recipients: Array<{ id: string; email: string; role: string }> = []

  switch (event.eventType) {
    case 'campaign_created':
    case 'campaign_approved':
    case 'campaign_rejected':
    case 'inventory_released':
    case 'bulk_placement_failed':
      // Notify assigned seller
      if ('sellerId' in event && event.sellerId) {
        const seller = await prisma.user.findUnique({
          where: { id: event.sellerId },
          select: { id: true, email: true, role: true }
        })
        if (seller) recipients.push(seller)
      }
      break

    case 'schedule_built':
      // Notify campaign owner and admin
      if ('sellerId' in event && event.sellerId) {
        const seller = await prisma.user.findUnique({
          where: { id: event.sellerId },
          select: { id: true, email: true, role: true }
        })
        if (seller) recipients.push(seller)
      }
      
      // Also notify admins
      const adminsForSchedule = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['admin', 'master'] }
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...adminsForSchedule)
      break

    case 'talent_approval_requested':
      // Notify talent/producer for the show
      if ('talentId' in event && event.talentId) {
        const talent = await prisma.user.findUnique({
          where: { id: event.talentId },
          select: { id: true, email: true, role: true }
        })
        if (talent) recipients.push(talent)
      }
      
      // Also notify producers
      const producers = await prisma.user.findMany({
        where: {
          organizationId,
          role: 'producer'
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...producers)
      break

    case 'admin_approval_requested':
      // Notify all admins
      const admins = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['admin', 'master'] }
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...admins)
      break

    case 'ad_request_created':
      // Notify producers and talent
      if ('producerId' in event && event.producerId) {
        const producer = await prisma.user.findUnique({
          where: { id: event.producerId },
          select: { id: true, email: true, role: true }
        })
        if (producer) recipients.push(producer)
      }
      if ('talentId' in event && event.talentId) {
        const talent = await prisma.user.findUnique({
          where: { id: event.talentId },
          select: { id: true, email: true, role: true }
        })
        if (talent) recipients.push(talent)
      }
      break

    case 'order_created':
    case 'invoice_generated':
    case 'payment_received':
    case 'invoice_overdue':
      // Notify finance team (admins) and seller
      const financeAdmins = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['admin', 'master'] }
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...financeAdmins)
      break

    case 'youtube_quota_reached':
    case 'integration_sync_failed':
    case 'backup_completed':
    case 'backup_failed':
    case 'security_policy_changed':
    case 'api_key_rotated':
      // System events - notify admins only
      const systemAdmins = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['admin', 'master'] }
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...systemAdmins)
      break

    case 'inventory_conflict':
    case 'category_conflict':
      // Notify seller and admins
      if ('sellerId' in event && event.sellerId) {
        const seller = await prisma.user.findUnique({
          where: { id: event.sellerId },
          select: { id: true, email: true, role: true }
        })
        if (seller) recipients.push(seller)
      }
      
      const conflictAdmins = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ['admin', 'master'] }
        },
        select: { id: true, email: true, role: true }
      })
      recipients.push(...conflictAdmins)
      break
  }

  // Remove duplicates
  const uniqueRecipients = Array.from(
    new Map(recipients.map(r => [r.id, r])).values()
  )

  return uniqueRecipients
}

// Get priority for event based on severity
function getPriorityForEvent(eventType: string, severity?: string): number {
  const severityMap: Record<string, number> = {
    urgent: 1,
    high: 3,
    normal: 5,
    low: 7
  }

  return severityMap[severity || 'normal'] || 5
}

// Helper functions to emit specific events

export async function notifyCampaignCreated(
  campaignId: string,
  campaignName: string,
  advertiserName: string,
  status: string,
  sellerId: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'campaign_created',
    campaignId,
    campaignName,
    advertiserName,
    status,
    sellerId,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignId}`
  }, organizationId)
}

export async function notifyScheduleBuilt(
  campaignId: string,
  campaignName: string,
  showCount: number,
  spotCount: number,
  totalValue: number,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'schedule_built',
    campaignId,
    campaignName,
    showCount,
    spotCount,
    totalValue,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignId}/schedule`
  }, organizationId)
}

export async function notifyAdminApprovalRequested(
  campaignId: string,
  campaignName: string,
  advertiserName: string,
  budget: number,
  variance: number,
  rateCardDelta: number,
  sellerId: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'admin_approval_requested',
    campaignId,
    campaignName,
    advertiserName,
    budget,
    variance,
    rateCardDelta,
    sellerId,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/approvals`
  }, organizationId)
}

export async function notifyCampaignApproved(
  campaignId: string,
  campaignName: string,
  approverName: string,
  approverId: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'campaign_approved',
    campaignId,
    campaignName,
    approverName,
    approverId,
    nextSteps: 'Your campaign has been approved and will move to Post-Sale as an Order.',
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignId}`
  }, organizationId)
}

export async function notifyCampaignRejected(
  campaignId: string,
  campaignName: string,
  rejectorName: string,
  rejectorId: string,
  reason: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'campaign_rejected',
    campaignId,
    campaignName,
    rejectorName,
    rejectorId,
    reason,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignId}`
  }, organizationId)
}

export async function notifyInventoryReleased(
  campaignId: string,
  campaignName: string,
  reason: string,
  spotCount: number,
  showIds: string[],
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'inventory_released',
    campaignId,
    campaignName,
    reason,
    spotCount,
    showIds
  }, organizationId)
}

export async function notifyBulkPlacementFailed(
  campaignId: string,
  campaignName: string,
  requested: number,
  placed: number,
  issue: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'bulk_placement_failed',
    campaignId,
    campaignName,
    requested,
    placed,
    issue,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${campaignId}/schedule`
  }, organizationId)
}

export async function notifyYouTubeQuotaReached(
  usage: number,
  limit: number,
  resetTime: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'youtube_quota_reached',
    usage,
    limit,
    resetTime,
    syncPaused: true
  }, organizationId)
}

export async function notifyBackupCompleted(
  backupId: string,
  size: string,
  duration: string,
  location: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'backup_completed',
    backupId,
    size,
    duration,
    location
  }, organizationId)
}

export async function notifyBackupFailed(
  error: string,
  organizationId: string
) {
  await emitNotificationEvent({
    eventType: 'backup_failed',
    error,
    time: new Date().toISOString(),
    nextRetry: new Date(Date.now() + 3600000).toISOString() // 1 hour later
  }, organizationId)
}