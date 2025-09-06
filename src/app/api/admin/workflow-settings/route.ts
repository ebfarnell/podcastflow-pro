import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

// GET /api/admin/workflow-settings - Get workflow settings for organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master users can manage workflow settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const workflowType = searchParams.get('type') || 'campaign_approval'

    // Get organization schema name
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { schemaName: true }
    })

    if (!org?.schemaName) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get workflow settings from org schema
    const { data: settings, error } = await safeQuerySchema(
      org.schemaName,
      'SELECT * FROM workflow_settings LIMIT 1',
      []
    )

    if (error || !settings || settings.length === 0) {
      // Return default settings if none exist or error occurred
      return NextResponse.json({
        workflowType: 'campaign_approval',
        stages: [
          {
            key: 'planning',
            label: 'Planning',
            threshold: 65
          },
          {
            key: 'reservation',
            label: 'Reservation',
            threshold: 90
          },
          {
            key: 'order',
            label: 'Order',
            threshold: 100
          }
        ],
        thresholds: {
          approval_trigger: 90,
          auto_win: 100,
          rejection_fallback: 65,
          reservation_threshold: 80
        },
        notifications: {
          enabled: true,
          notify_on_trigger: true,
          notify_on_approval: true,
          notify_on_rejection: true,
          recipient_roles: ['admin', 'master']
        },
        isActive: true
      })
    }

    // Transform the database row to API response format
    const dbSettings = settings[0]
    return NextResponse.json({
      workflowType: 'campaign_approval',
      stages: dbSettings.stages || [
        { key: 'planning', label: 'Planning', threshold: 65 },
        { key: 'reservation', label: 'Reservation', threshold: 90 },
        { key: 'order', label: 'Order', threshold: 100 }
      ],
      thresholds: {
        approval_trigger: dbSettings.approval_threshold || 90,
        auto_win: 100,
        rejection_fallback: dbSettings.rejection_fallback || 65,
        reservation_threshold: 80
      },
      notifications: {
        enabled: dbSettings.notify_on_status_change !== false,
        notify_on_trigger: dbSettings.require_admin_approval_at_90 !== false,
        notify_on_approval: true,
        notify_on_rejection: true,
        recipient_roles: ['admin', 'master']
      },
      isActive: true
    })
  } catch (error) {
    console.error('Error fetching workflow settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow settings' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/workflow-settings - Update workflow settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master users can manage workflow settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { workflowType = 'campaign_approval', stages, thresholds, notifications } = body

    // Validate stages have required fields
    if (stages) {
      for (const stage of stages) {
        if (!stage.key || !stage.label || typeof stage.threshold !== 'number') {
          return NextResponse.json(
            { error: 'Invalid stage configuration. Each stage must have key, label, and threshold.' },
            { status: 400 }
          )
        }
      }
    }

    // Get organization schema name
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { schemaName: true }
    })

    if (!org?.schemaName) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Update workflow settings in org schema
    const updateQuery = `
      UPDATE workflow_settings 
      SET 
        stages = $1::jsonb,
        approval_threshold = $2,
        rejection_fallback = $3,
        auto_reserve_at_90 = $4,
        require_admin_approval_at_90 = $5,
        auto_create_order_on_approval = $6,
        notify_on_status_change = $7,
        updated_by = $8,
        updated_at = NOW()
      WHERE id = (SELECT id FROM workflow_settings LIMIT 1)
      RETURNING *
    `

    const params = [
      JSON.stringify(stages || [
        { key: 'planning', label: 'Planning', threshold: 65 },
        { key: 'reservation', label: 'Reservation', threshold: 90 },
        { key: 'order', label: 'Order', threshold: 100 }
      ]),
      thresholds?.approval_trigger || 90,
      thresholds?.rejection_fallback || 65,
      thresholds?.auto_reserve !== false,
      thresholds?.require_approval !== false,
      thresholds?.auto_create_order !== false,
      notifications?.enabled !== false,
      session.userId
    ]

    const { data: settings, error } = await safeQuerySchema(
      org.schemaName,
      updateQuery,
      params
    )

    if (error) {
      console.error('Error updating workflow settings:', error)
      return NextResponse.json(
        { error: 'Failed to update workflow settings' },
        { status: 500 }
      )
    }

    // Log the change to org-specific activity table
    try {
      const activityQuery = `
        INSERT INTO "Activity" (
          id, type, action, title, description, 
          "actorId", "actorName", "actorEmail", "actorRole",
          "targetType", "targetId", "organizationId", metadata, "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        )
      `

      const changeDetails = {
        workflowType,
        thresholds: thresholds || {},
        notifications: notifications || {},
        stageCount: stages?.length || 3
      }

      await safeQuerySchema(
        org.schemaName,
        activityQuery,
        [
          `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          'workflow',
          'settings_updated',
          'Workflow Settings Updated',
          `Workflow settings updated by ${session.user?.name || session.user?.email}`,
          session.userId,
          session.user?.name || 'Unknown',
          session.user?.email || 'unknown@example.com',
          session.role,
          'workflow_settings',
          settings?.[0]?.id || 'unknown',
          session.organizationId,
          JSON.stringify(changeDetails)
        ]
      )

      console.log('Workflow settings change logged to org activity timeline')
    } catch (logError) {
      // Activity logging is optional - don't fail if it doesn't work
      console.error('Could not log workflow settings change to timeline:', logError)
    }

    // Return the updated settings in API format
    const dbSettings = settings?.[0]
    return NextResponse.json({
      workflowType: 'campaign_approval',
      stages: dbSettings?.stages || stages,
      thresholds: {
        approval_trigger: dbSettings?.approval_threshold || thresholds?.approval_trigger || 90,
        auto_win: 100,
        rejection_fallback: dbSettings?.rejection_fallback || thresholds?.rejection_fallback || 65,
        reservation_threshold: 80
      },
      notifications: {
        enabled: dbSettings?.notify_on_status_change !== false,
        notify_on_trigger: dbSettings?.require_admin_approval_at_90 !== false,
        notify_on_approval: true,
        notify_on_rejection: true,
        recipient_roles: ['admin', 'master']
      },
      isActive: true
    })
  } catch (error) {
    console.error('Error updating workflow settings:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow settings' },
      { status: 500 }
    )
  }
}