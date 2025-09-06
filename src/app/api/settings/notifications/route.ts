import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// Force dynamic
export const dynamic = 'force-dynamic'

// Notification channel configuration schema
const channelConfigSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().url().optional().nullable(),
  url: z.string().url().optional().nullable(),
  secret: z.string().optional().nullable(),
})

// Event configuration schema
const eventConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(['email', 'inApp', 'slack', 'webhook'])),
  mandatory: z.boolean(),
  severity: z.enum(['low', 'normal', 'high', 'urgent']),
  quietHourBypass: z.boolean().optional(),
  digestable: z.boolean().optional(),
})

// Complete notification settings schema
const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  channels: z.object({
    email: channelConfigSchema,
    inApp: channelConfigSchema,
    slack: channelConfigSchema,
    webhook: channelConfigSchema,
  }),
  quietHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string(),
  }).optional().nullable(),
  events: z.record(z.string(), eventConfigSchema),
})

// GET /api/settings/notifications - Get notification settings
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log(`📬 Getting notification settings for org ${session.organizationId}`)

    // Get organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        settings: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Extract notification settings from org settings
    const orgSettings = organization.settings as any || {}
    const notificationSettings = orgSettings.notifications || {
      enabled: true,
      channels: {
        email: { enabled: true },
        inApp: { enabled: true },
        slack: { enabled: false, webhookUrl: null },
        webhook: { enabled: false, url: null, secret: null }
      },
      quietHours: null,
      events: {
        // Pre-Sale Workflow
        campaign_created: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'normal' },
        schedule_built: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'normal' },
        talent_approval_requested: { enabled: true, channels: ['email', 'inApp'], mandatory: true, severity: 'high' },
        admin_approval_requested: { enabled: true, channels: ['email', 'inApp'], mandatory: true, severity: 'high' },
        campaign_approved: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'normal' },
        campaign_rejected: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'high' },
        
        // Inventory
        inventory_conflict: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'high' },
        inventory_released: { enabled: true, channels: ['inApp'], mandatory: false, severity: 'normal' },
        bulk_placement_failed: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'high' },
        rate_card_updated: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        
        // Post-Sale / Billing
        order_created: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        contract_generated: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        contract_signed: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        invoice_generated: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        payment_received: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
        invoice_overdue: { enabled: true, channels: ['email'], mandatory: false, severity: 'high' },
        
        // Content/Show Ops
        ad_request_created: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'high' },
        category_conflict: { enabled: true, channels: ['email', 'inApp'], mandatory: false, severity: 'high' },
        
        // Integrations & Data
        youtube_quota_reached: { enabled: true, channels: ['email'], mandatory: true, severity: 'high' },
        integration_sync_failed: { enabled: true, channels: ['email'], mandatory: false, severity: 'high' },
        backup_completed: { enabled: true, channels: ['email'], mandatory: false, severity: 'low' },
        backup_failed: { enabled: true, channels: ['email'], mandatory: true, severity: 'urgent' },
        
        // Security
        security_policy_changed: { enabled: true, channels: ['email'], mandatory: true, severity: 'high' },
        api_key_rotated: { enabled: true, channels: ['email'], mandatory: false, severity: 'normal' },
      }
    }

    // Get user-specific preferences for current user
    const userPreferences = await prisma.userNotificationPreference.findMany({
      where: {
        userId: session.userId,
        organizationId: session.organizationId
      }
    })

    // Get notification templates
    const templates = await prisma.notificationTemplate.findMany({
      where: {
        OR: [
          { organizationId: session.organizationId },
          { organizationId: null, isDefault: true }
        ],
        isActive: true
      },
      select: {
        id: true,
        eventType: true,
        channel: true,
        name: true,
        subject: true,
        body: true,
        variables: true,
        isDefault: true,
      }
    })

    // Get delivery statistics for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const deliveryStats = await prisma.notificationDelivery.groupBy({
      by: ['status', 'channel'],
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: sevenDaysAgo }
      },
      _count: true
    })

    // Format delivery stats
    const formattedStats = {
      total: deliveryStats.reduce((sum, stat) => sum + stat._count, 0),
      byStatus: {} as Record<string, number>,
      byChannel: {} as Record<string, number>,
    }
    
    deliveryStats.forEach(stat => {
      formattedStats.byStatus[stat.status] = (formattedStats.byStatus[stat.status] || 0) + stat._count
      formattedStats.byChannel[stat.channel] = (formattedStats.byChannel[stat.channel] || 0) + stat._count
    })

    return NextResponse.json({
      settings: notificationSettings,
      userPreferences: userPreferences.reduce((acc, pref) => {
        acc[pref.eventType] = {
          enabled: pref.enabled,
          channels: pref.channels,
          quietHours: pref.quietHours,
          digest: pref.digest,
        }
        return acc
      }, {} as Record<string, any>),
      templates: templates.reduce((acc, template) => {
        const key = `${template.eventType}_${template.channel}`
        if (!acc[key] || !template.isDefault) {
          acc[key] = template
        }
        return acc
      }, {} as Record<string, any>),
      deliveryStats: formattedStats,
      organization: {
        id: organization.id,
        name: organization.name,
      }
    })
  } catch (error) {
    console.error('❌ Error fetching notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/notifications - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate the settings
    const validatedSettings = notificationSettingsSchema.parse(body)
    
    console.log(`📬 Updating notification settings for org ${session.organizationId}`)

    // Get current organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        settings: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const currentSettings = organization.settings as any || {}
    const oldNotificationSettings = currentSettings.notifications || {}

    // Update organization settings
    const updatedSettings = {
      ...currentSettings,
      notifications: validatedSettings
    }

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { settings: updatedSettings }
    })

    // Create audit log entry
    await prisma.notificationAuditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: 'settings_updated',
        entityType: 'org_settings',
        entityId: session.organizationId,
        oldValue: oldNotificationSettings,
        newValue: validatedSettings,
        metadata: {
          changedBy: session.role,
          changedAt: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    console.log(`✅ Notification settings updated for org ${session.organizationId}`)

    return NextResponse.json({
      success: true,
      message: 'Notification settings updated successfully',
      settings: validatedSettings
    })
  } catch (error) {
    console.error('❌ Error updating notification settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid settings format', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    )
  }
}

// PATCH /api/settings/notifications - Partial update for specific fields
export async function PATCH(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { field, value } = body

    console.log(`📬 Patching notification settings field ${field} for org ${session.organizationId}`)

    // Get current organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        settings: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const currentSettings = organization.settings as any || {}
    const notificationSettings = currentSettings.notifications || {}

    // Update specific field using dot notation
    const fieldPath = field.split('.')
    let target = notificationSettings
    for (let i = 0; i < fieldPath.length - 1; i++) {
      if (!target[fieldPath[i]]) {
        target[fieldPath[i]] = {}
      }
      target = target[fieldPath[i]]
    }
    
    const oldValue = target[fieldPath[fieldPath.length - 1]]
    target[fieldPath[fieldPath.length - 1]] = value

    // Update organization settings
    const updatedSettings = {
      ...currentSettings,
      notifications: notificationSettings
    }

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { settings: updatedSettings }
    })

    // Create audit log entry
    await prisma.notificationAuditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: 'settings_updated',
        entityType: 'org_settings',
        entityId: session.organizationId,
        oldValue: { [field]: oldValue },
        newValue: { [field]: value },
        metadata: {
          field,
          changedBy: session.role,
          changedAt: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    console.log(`✅ Notification setting ${field} updated for org ${session.organizationId}`)

    return NextResponse.json({
      success: true,
      message: `Setting ${field} updated successfully`,
      field,
      value
    })
  } catch (error) {
    console.error('❌ Error patching notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to update notification setting' },
      { status: 500 }
    )
  }
}