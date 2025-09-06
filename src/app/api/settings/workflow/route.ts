import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { WorkflowSettingsService } from '@/lib/workflow/workflow-settings-service'
import { safeQuerySchema } from '@/lib/db/schema-db'

// GET /api/settings/workflow - Get workflow settings
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

    // Get specific keys if requested
    const url = new URL(request.url)
    const keys = url.searchParams.get('keys')?.split(',').filter(Boolean)

    // Fetch settings
    const settings = await WorkflowSettingsService.getSettings(orgSlug, keys)

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `INSERT INTO "Activity" (id, type, action, details, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'settings', 'view', $1, $2, NOW())`,
      [{ keys: keys || 'all' }, session.userId]
    )

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('[API] Get workflow settings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/workflow - Update workflow settings (admin only)
export async function PUT(request: NextRequest) {
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
    const settings = await request.json()

    // Validate that settings is an object
    if (typeof settings !== 'object' || settings === null) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 })
    }

    // Update settings
    const result = await WorkflowSettingsService.updateSettings(
      orgSlug,
      settings,
      session.userId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update settings' },
        { status: 400 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `INSERT INTO "Activity" (id, type, action, details, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'settings', 'update', $1, $2, NOW())`,
      [{ keys: Object.keys(settings) }, session.userId]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Update workflow settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow settings' },
      { status: 500 }
    )
  }
}