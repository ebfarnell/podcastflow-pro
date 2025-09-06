import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { WorkflowSettingsService } from '@/lib/workflow/workflow-settings-service'
import { safeQuerySchema } from '@/lib/db/schema-db'

// PUT /api/settings/workflow/triggers/:id - Update custom trigger
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const updates = await request.json()

    // Update trigger
    const result = await WorkflowSettingsService.updateTrigger(
      orgSlug,
      params.id,
      updates,
      session.userId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update trigger' },
        { status: 400 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `INSERT INTO "Activity" (id, type, action, details, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'workflow_trigger', 'update', $1, $2, NOW())`,
      [{ triggerId: params.id, updates }, session.userId]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Update workflow trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow trigger' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/workflow/triggers/:id - Delete (disable) custom trigger
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Delete (disable) trigger
    const result = await WorkflowSettingsService.deleteTrigger(
      orgSlug,
      params.id,
      session.userId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete trigger' },
        { status: 400 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `INSERT INTO "Activity" (id, type, action, details, "userId", "createdAt")
       VALUES (gen_random_uuid()::text, 'workflow_trigger', 'delete', $1, $2, NOW())`,
      [{ triggerId: params.id }, session.userId]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Delete workflow trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to delete workflow trigger' },
      { status: 500 }
    )
  }
}