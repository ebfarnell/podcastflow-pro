import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const isActive = searchParams.get('active') !== 'false'

    // Get organization ID
    const { data: org } = await safeQuerySchema(orgSlug, async (db) => {
      return db.advertiser.findFirst({
        select: { organizationId: true }
      })
    })

    if (!org) {
      return NextResponse.json({ templates: [] })
    }

    // Get templates
    const { data: templates, error } = await safeQuerySchema(orgSlug, async (db) => {
      return db.contractTemplate.findMany({
        where: {
          organizationId: org.organizationId,
          ...(isActive ? { isActive: true } : {})
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      })
    })

    if (error) {
      console.error('Error fetching contract templates:', error)
      return NextResponse.json({ templates: [] })
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error('Error in GET /api/contracts/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can create templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, templateType, htmlTemplate, variables, isDefault } = body

    if (!name || !htmlTemplate || !templateType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get organization ID
    const { data: org } = await safeQuerySchema(orgSlug, async (db) => {
      return db.advertiser.findFirst({
        select: { organizationId: true }
      })
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await safeQuerySchema(orgSlug, async (db) => {
        await db.contractTemplate.updateMany({
          where: {
            organizationId: org.organizationId,
            templateType
          },
          data: { isDefault: false }
        })
      })
    }

    // Create template
    const { data: template, error } = await safeQuerySchema(orgSlug, async (db) => {
      return db.contractTemplate.create({
        data: {
          organizationId: org.organizationId,
          name,
          description,
          templateType,
          htmlTemplate,
          variables: variables || [],
          isDefault: isDefault || false,
          createdById: session.userId,
          updatedById: session.userId
        }
      })
    })

    if (error) {
      console.error('Error creating contract template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      templateId: template?.id
    })
  } catch (error) {
    console.error('Error in POST /api/contracts/templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}