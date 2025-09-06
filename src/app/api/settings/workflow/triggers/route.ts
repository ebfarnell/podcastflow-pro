import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { WorkflowSettingsService } from '@/lib/workflow/workflow-settings-service'
import { safeQuerySchema } from '@/lib/db/schema-db'

// GET /api/settings/workflow/triggers - List custom triggers
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org slug from session
    const { data: orgData } = await safeQuerySchema<any>(
      'public',
      `SELECT slug FROM "Organization" WHERE id = $1`,
      [session.organizationId]
    )

    if (!orgData || orgData.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgSlug = orgData[0].slug

    // Get filter options
    const url = new URL(request.url)
    const event = url.searchParams.get('event') || undefined
    const isEnabled = url.searchParams.get('isEnabled')
    
    const options: any = { event }
    if (isEnabled !== null) {
      options.isEnabled = isEnabled === 'true'
    }

    // Fetch triggers
    const triggers = await WorkflowSettingsService.getTriggers(orgSlug, options)

    return NextResponse.json(triggers)
  } catch (error: any) {
    console.error('[API] Get workflow triggers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow triggers' },
      { status: 500 }
    )
  }
}

// POST /api/settings/workflow/triggers - Create custom trigger (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permission
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get org slug from session
    const { data: orgData } = await safeQuerySchema<any>(
      'public',
      `SELECT slug FROM "Organization" WHERE id = $1`,
      [session.organizationId]
    )

    if (!orgData || orgData.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgSlug = orgData[0].slug
    const trigger = await request.json()

    // Create trigger
    const result = await WorkflowSettingsService.createTrigger(
      orgSlug,
      trigger,
      session.userId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create trigger' },
        { status: 400 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `INSERT INTO "Activity" (id, type, action, details, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'workflow_trigger', 'create', $1, $2, NOW())`,
      [{ triggerId: result.id, name: trigger.name, event: trigger.event }, session.userId]
    )

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('[API] Create workflow trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow trigger' },
      { status: 500 }
    )
  }
}