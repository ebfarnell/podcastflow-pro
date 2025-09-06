import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// Force dynamic
export const dynamic = 'force-dynamic'

// GET /api/settings/notifications/templates - Get notification templates
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

    const url = new URL(request.url)
    const eventType = url.searchParams.get('eventType')
    const channel = url.searchParams.get('channel')

    console.log(`📝 Getting notification templates for org ${session.organizationId}`)

    // Build query conditions
    const where: any = {
      OR: [
        { organizationId: session.organizationId },
        { organizationId: null, isDefault: true }
      ],
      isActive: true
    }

    if (eventType) {
      where.eventType = eventType
    }

    if (channel) {
      where.channel = channel
    }

    // Get templates
    const templates = await prisma.notificationTemplate.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        eventType: true,
        channel: true,
        name: true,
        subject: true,
        title: true,
        bodyHtml: true,
        bodyText: true,
        bodyJson: true,
        variables: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isDefault: 'asc' },
        { organizationId: 'desc' },
        { eventType: 'asc' },
        { channel: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group templates by event type and channel for easier UI consumption
    const groupedTemplates = templates.reduce((acc, template) => {
      const key = template.eventType
      if (!acc[key]) {
        acc[key] = {}
      }
      if (!acc[key][template.channel]) {
        acc[key][template.channel] = []
      }
      
      // Redact sensitive fields for non-org templates if not master
      if (session.role !== 'master' && template.organizationId !== session.organizationId) {
        template.bodyHtml = template.bodyHtml ? '[TEMPLATE CONTENT]' : null
        template.bodyText = template.bodyText ? '[TEMPLATE CONTENT]' : null
        template.bodyJson = template.bodyJson ? {} : null
      }
      
      acc[key][template.channel].push(template)
      return acc
    }, {} as Record<string, Record<string, any[]>>)

    // Get available event types (from our defined list)
    const availableEventTypes = [
      // Pre-Sale Workflow
      'campaign_created',
      'schedule_built',
      'talent_approval_requested',
      'admin_approval_requested',
      'campaign_approved',
      'campaign_rejected',
      
      // Inventory
      'inventory_conflict',
      'inventory_released',
      'bulk_placement_failed',
      'rate_card_updated',
      
      // Post-Sale / Billing
      'order_created',
      'contract_generated',
      'contract_signed',
      'invoice_generated',
      'payment_received',
      'invoice_overdue',
      
      // Content/Show Ops
      'ad_request_created',
      'category_conflict',
      
      // Integrations & Data
      'youtube_quota_reached',
      'integration_sync_failed',
      'backup_completed',
      'backup_failed',
      
      // Security
      'security_policy_changed',
      'api_key_rotated',
    ]

    return NextResponse.json({
      templates,
      groupedTemplates,
      availableEventTypes,
      availableChannels: ['email', 'inApp', 'slack', 'webhook']
    })
  } catch (error) {
    console.error('❌ Error fetching notification templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification templates' },
      { status: 500 }
    )
  }
}