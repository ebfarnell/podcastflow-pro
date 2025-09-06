import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: template, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM "ContractTemplate" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (error || !template?.[0]) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(template[0])
  } catch (error) {
    console.error('❌ Contract template fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, templateType, htmlTemplate, variables, isDefault, isActive } = body

    // Get current template for comparison
    const { data: currentTemplate } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM "ContractTemplate" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (!currentTemplate?.[0]) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults first
    if (isDefault && !currentTemplate[0].isDefault) {
      await safeQuerySchema(
        session.organizationSlug,
        `UPDATE "ContractTemplate" SET "isDefault" = false WHERE "organizationId" = $1 AND "templateType" = $2`,
        [session.organizationId, templateType || currentTemplate[0].templateType]
      )
    }

    const { data: template, error } = await safeQuerySchema(
      session.organizationSlug,
      `UPDATE "ContractTemplate" SET 
        "name" = COALESCE($1, name),
        "description" = COALESCE($2, description),
        "templateType" = COALESCE($3, "templateType"),
        "htmlTemplate" = COALESCE($4, "htmlTemplate"),
        "variables" = COALESCE($5, variables),
        "isDefault" = COALESCE($6, "isDefault"),
        "isActive" = COALESCE($7, "isActive"),
        "updatedAt" = CURRENT_TIMESTAMP,
        "updatedById" = $8,
        "version" = version + 1
      WHERE id = $9 AND "organizationId" = $10 
      RETURNING *`,
      [
        name,
        description,
        templateType,
        htmlTemplate,
        variables ? JSON.stringify(variables) : null,
        isDefault,
        isActive,
        session.userId,
        params.id,
        session.organizationId
      ]
    )

    if (error || !template?.[0]) {
      console.error('❌ Contract template update failed:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    // Send notification about template update
    const { data: adminUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" WHERE "organizationId" = $1 AND role IN ('admin', 'master') AND id != $2`,
      [session.organizationId, session.userId]
    )

    if (adminUsers?.length > 0) {
      const wasDeactivated = currentTemplate[0].isActive && isActive === false
      const wasActivated = !currentTemplate[0].isActive && isActive === true
      const wasSetAsDefault = !currentTemplate[0].isDefault && isDefault === true

      let notificationMessage = `Contract template "${template[0].name}" has been updated`
      
      if (wasDeactivated) {
        notificationMessage = `Contract template "${template[0].name}" has been deactivated`
      } else if (wasActivated) {
        notificationMessage = `Contract template "${template[0].name}" has been activated`
      } else if (wasSetAsDefault) {
        notificationMessage = `Contract template "${template[0].name}" has been set as the default template`
      }

      await notificationService.sendBulkNotification({
        title: `Contract Template Updated: ${template[0].name}`,
        message: notificationMessage,
        type: 'system_update',
        userIds: adminUsers.map((u: any) => u.id),
        actionUrl: '/admin/settings?tab=contracts',
        sendEmail: wasDeactivated || wasSetAsDefault // Send email for important changes
      })
    }

    return NextResponse.json(template[0])
  } catch (error) {
    console.error('❌ Contract template update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get template details before deletion
    const { data: template } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM "ContractTemplate" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (!template?.[0]) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if template is in use
    const { data: contractsUsingTemplate } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT COUNT(*) as count FROM "Contract" WHERE "templateId" = $1`,
      [params.id]
    )

    if (contractsUsingTemplate?.[0]?.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete template that is currently in use by contracts' 
      }, { status: 400 })
    }

    const { error } = await safeQuerySchema(
      session.organizationSlug,
      `DELETE FROM "ContractTemplate" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (error) {
      console.error('❌ Contract template deletion failed:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    // Send notification about template deletion
    const { data: adminUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" WHERE "organizationId" = $1 AND role IN ('admin', 'master') AND id != $2`,
      [session.organizationId, session.userId]
    )

    if (adminUsers?.length > 0) {
      await notificationService.sendBulkNotification({
        title: `Contract Template Deleted: ${template[0].name}`,
        message: `Contract template "${template[0].name}" has been permanently deleted`,
        type: 'system_update',
        userIds: adminUsers.map((u: any) => u.id),
        actionUrl: '/admin/settings?tab=contracts',
        sendEmail: template[0].isDefault // Send email if deleting default template
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Contract template deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}