// Organization email templates API endpoints

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { EmailTemplateService } from '@/services/email/template-service'

const templateService = new EmailTemplateService()

// GET /api/organization/email-templates
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can access templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all templates for the organization
    const templates = await templateService.getAllTemplates(session.organizationId!)

    return NextResponse.json({
      templates,
      canCustomize: true,
      message: templates.length === 0 ? 'No templates found. System defaults will be used.' : undefined
    })
  } catch (error) {
    console.error('Failed to get email templates:', error)
    return NextResponse.json(
      { error: 'Failed to get email templates' },
      { status: 500 }
    )
  }
}

// POST /api/organization/email-templates
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can create/update templates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const template = await request.json()

    // Validate required fields
    if (!template.key || !template.name || !template.subject || 
        !template.htmlContent || !template.textContent) {
      return NextResponse.json(
        { error: 'Missing required template fields' },
        { status: 400 }
      )
    }

    // Save or update template
    const savedTemplate = await templateService.createOrUpdateOrgTemplate(
      session.organizationId!,
      template
    )

    return NextResponse.json({
      success: true,
      template: savedTemplate
    })
  } catch (error: any) {
    console.error('Failed to save email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save email template' },
      { status: 500 }
    )
  }
}