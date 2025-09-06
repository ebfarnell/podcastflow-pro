// Organization email settings API endpoints

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { OrganizationEmailSettings, OrganizationEmailBranding } from '@/lib/email/types'

// GET /api/organization/email-settings
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can access organization settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId! },
      select: {
        id: true,
        name: true,
        settings: true
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const settings = organization.settings as any || {}
    const emailSettings = settings.emailSettings as OrganizationEmailSettings | null
    const emailBranding = settings.emailBranding as OrganizationEmailBranding | null

    if (!emailSettings?.configured) {
      return NextResponse.json({
        configured: false,
        organizationName: organization.name,
        settings: {
          configured: false,
          replyToAddress: null,
          supportEmail: null,
          emailFooter: null,
          notifications: {
            userInvitations: true,
            taskAssignments: true,
            campaignUpdates: true,
            paymentReminders: true,
            reportReady: true,
            deadlineReminders: true,
            approvalRequests: true,
            adCopyUpdates: true
          },
          sendingRules: {
            dailyLimitPerUser: 100,
            allowedDomains: [],
            requireApproval: false,
            ccOnCertainEmails: false,
            ccAddress: null
          }
        },
        branding: {
          enabled: false,
          logoUrl: null,
          primaryColor: '#2196F3',
          secondaryColor: '#4CAF50',
          customCSS: null
        },
        message: 'Organization email settings not configured'
      })
    }

    return NextResponse.json({
      configured: true,
      organizationName: organization.name,
      settings: emailSettings,
      branding: emailBranding || {
        enabled: false,
        logoUrl: null,
        primaryColor: '#2196F3',
        secondaryColor: '#4CAF50',
        customCSS: null
      }
    })
  } catch (error) {
    console.error('Failed to get organization email settings:', error)
    return NextResponse.json(
      { error: 'Failed to get organization email settings' },
      { status: 500 }
    )
  }
}

// PUT /api/organization/email-settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update organization settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { settings: emailSettings, branding } = await request.json()

    // Get current organization settings
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId! },
      select: { settings: true }
    })

    const currentSettings = (org?.settings as any) || {}

    // Update organization settings
    const organization = await prisma.organization.update({
      where: { id: session.organizationId! },
      data: {
        settings: {
          ...currentSettings,
          emailSettings: {
            ...emailSettings,
            configured: true
          },
          emailBranding: branding
        }
      }
    })

    const updatedSettings = organization.settings as any || {}

    return NextResponse.json({
      success: true,
      settings: updatedSettings.emailSettings,
      branding: updatedSettings.emailBranding
    })
  } catch (error) {
    console.error('Failed to update organization email settings:', error)
    return NextResponse.json(
      { error: 'Failed to update organization email settings' },
      { status: 500 }
    )
  }
}