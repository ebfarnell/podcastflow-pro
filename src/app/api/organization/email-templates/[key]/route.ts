// Individual email template operations

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { EmailTemplateService } from '@/services/email/template-service'
import prisma from '@/lib/db/prisma'

const templateService = new EmailTemplateService()

// GET /api/organization/email-templates/[key] - Get specific template
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await templateService.getTemplate(params.key, session.organizationId!)
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Failed to get email template:', error)
    return NextResponse.json(
      { error: 'Failed to get email template' },
      { status: 500 }
    )
  }
}

// PUT /api/organization/email-templates/[key] - Update specific template
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates = await request.json()
    
    // Ensure key matches
    if (updates.key && updates.key !== params.key) {
      return NextResponse.json(
        { error: 'Template key cannot be changed' },
        { status: 400 }
      )
    }

    const template = await templateService.createOrUpdateOrgTemplate(
      session.organizationId!,
      {
        ...updates,
        key: params.key
      }
    )

    return NextResponse.json({
      success: true,
      template
    })
  } catch (error: any) {
    console.error('Failed to update email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update email template' },
      { status: 500 }
    )
  }
}

// DELETE /api/organization/email-templates/[key] - Delete org template (revert to system)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find org-specific template
    const template = await prisma.emailTemplate.findFirst({
      where: {
        key: params.key,
        organizationId: session.organizationId!
      }
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Organization template not found' },
        { status: 404 }
      )
    }

    // Delete the template
    await prisma.emailTemplate.delete({
      where: { id: template.id }
    })

    // Clear template cache
    templateService.clearCache()

    return NextResponse.json({
      success: true,
      message: 'Template deleted. System default will be used.'
    })
  } catch (error) {
    console.error('Failed to delete email template:', error)
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    )
  }
}