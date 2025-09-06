// Email template preview endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { EmailTemplateService } from '@/services/email/template-service'

const templateService = new EmailTemplateService()

// POST /api/organization/email-templates/preview
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { templateKey, templateData, customTemplate } = await request.json()

    // Get template
    let template
    if (customTemplate) {
      // Use provided custom template for preview
      template = {
        ...customTemplate,
        id: 'preview',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } else if (templateKey) {
      // Get existing template
      template = await templateService.getTemplate(
        templateKey,
        session.organizationId!
      )
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Template key or custom template required' },
        { status: 400 }
      )
    }

    // Generate sample data if not provided
    const sampleData = {
      userName: session.name || 'John Doe',
      organizationName: session.organizationName || 'Sample Organization',
      userRole: 'Admin',
      inviteLink: 'https://app.podcastflow.pro/accept-invitation?token=sample',
      supportEmail: 'support@podcastflow.pro',
      resetLink: 'https://app.podcastflow.pro/reset-password?token=sample',
      taskTitle: 'Sample Task',
      taskDescription: 'This is a sample task description for preview purposes.',
      assigneeName: session.name || 'John Doe',
      assignerName: 'Jane Smith',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      priority: 'High',
      taskLink: 'https://app.podcastflow.pro/tasks/sample',
      campaignName: 'Summer Campaign 2025',
      previousStatus: 'Draft',
      newStatus: 'Active',
      changedBy: 'Jane Smith',
      changeDate: new Date().toLocaleDateString(),
      campaignLink: 'https://app.podcastflow.pro/campaigns/sample',
      approverName: session.name || 'John Doe',
      requesterName: 'Jane Smith',
      itemTitle: 'Campaign Budget Approval',
      itemDescription: 'Approval needed for $50,000 campaign budget',
      itemType: 'Budget',
      requestDate: new Date().toLocaleDateString(),
      approvalLink: 'https://app.podcastflow.pro/approvals/sample',
      advertiserName: 'Sample Advertiser',
      showName: 'The Sample Show',
      type: 'Pre-roll',
      duration: '30',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      ...templateData
    }

    // Render template
    const rendered = await templateService.renderTemplate(template, sampleData)

    return NextResponse.json({
      success: true,
      preview: {
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent
      },
      template: {
        key: template.key,
        name: template.name,
        variables: template.variables
      }
    })
  } catch (error: any) {
    console.error('Failed to preview email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview email template' },
      { status: 500 }
    )
  }
}