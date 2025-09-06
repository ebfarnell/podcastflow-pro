// User email preferences API endpoints

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { UserEmailPreferences } from '@/lib/email/types'

// GET /api/user/email-preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailPreferences: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const preferences = user.emailPreferences as UserEmailPreferences | null

    if (!preferences?.configured) {
      return NextResponse.json({
        configured: false,
        userEmail: user.email,
        userName: user.name,
        preferences: {
          configured: false,
          enabled: true,
          frequency: 'immediate',
          format: 'html',
          categories: {
            taskAssignments: false,
            taskComments: false,
            taskDeadlines: false,
            campaignStatusChanges: false,
            campaignComments: false,
            mentions: false,
            approvalRequests: false,
            approvalDecisions: false,
            reportCompletion: false,
            systemAnnouncements: false
          },
          digestSettings: {
            dailyDigestTime: '09:00',
            weeklyDigestDay: 1,
            includeTaskSummary: true,
            includeCampaignSummary: true,
            includeUpcomingDeadlines: true
          }
        },
        message: 'Email preferences not set. Using defaults.'
      })
    }

    return NextResponse.json({
      configured: true,
      userEmail: user.email,
      userName: user.name,
      preferences
    })
  } catch (error) {
    console.error('Failed to get email preferences:', error)
    return NextResponse.json(
      { error: 'Failed to get email preferences' },
      { status: 500 }
    )
  }
}

// PUT /api/user/email-preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await request.json()

    // Update user preferences
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        emailPreferences: {
          ...preferences,
          configured: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      preferences: user.emailPreferences
    })
  } catch (error) {
    console.error('Failed to update email preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update email preferences' },
      { status: 500 }
    )
  }
}

// GET /api/user/email-preferences/history
export async function GET_HISTORY(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email history
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        userId: session.userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50,
      select: {
        id: true,
        recipient: true,
        subject: true,
        templateKey: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        createdAt: true
      }
    })

    if (emailLogs.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'No email history',
        emails: []
      })
    }

    return NextResponse.json({
      hasData: true,
      emails: emailLogs
    })
  } catch (error) {
    console.error('Failed to get email history:', error)
    return NextResponse.json(
      { error: 'Failed to get email history' },
      { status: 500 }
    )
  }
}