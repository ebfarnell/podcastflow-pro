import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/master users can access contract templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: templates, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM "ContractTemplate" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
      [session.organizationId]
    )

    if (error) {
      console.error('❌ Contract templates query failed:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(templates || [])
  } catch (error) {
    console.error('❌ Contract templates API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, templateType, htmlTemplate, variables, isDefault } = body

    if (!name || !htmlTemplate) {
      return NextResponse.json({ error: 'Name and template content are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await safeQuerySchema(
        session.organizationSlug,
        `UPDATE "ContractTemplate" SET "isDefault" = false WHERE "organizationId" = $1 AND "templateType" = $2`,
        [session.organizationId, templateType || 'insertion_order']
      )
    }

    const { data: template, error } = await safeQuerySchema(
      session.organizationSlug,
      `INSERT INTO "ContractTemplate" (
        "organizationId", "name", "description", "templateType", "htmlTemplate", 
        "variables", "isDefault", "createdById", "updatedById"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        session.organizationId,
        name,
        description || '',
        templateType || 'insertion_order',
        htmlTemplate,
        JSON.stringify(variables || []),
        isDefault || false,
        session.userId,
        session.userId
      ]
    )

    if (error) {
      console.error('❌ Contract template creation failed:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    // Send notification to admin users about new template
    const { data: adminUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" WHERE "organizationId" = $1 AND role IN ('admin', 'master') AND id != $2`,
      [session.organizationId, session.userId]
    )

    if (adminUsers?.length > 0) {
      await notificationService.sendBulkNotification({
        title: `New Contract Template Created: ${name}`,
        message: `A new ${templateType || 'insertion order'} template "${name}" has been created and is ready for use`,
        type: 'system_update',
        userIds: adminUsers.map((u: any) => u.id),
        actionUrl: '/admin/settings?tab=contracts',
        sendEmail: false
      })
    }

    return NextResponse.json(template?.[0])
  } catch (error) {
    console.error('❌ Contract template creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}