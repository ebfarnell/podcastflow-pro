// Email unsubscribe endpoint

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

// POST /api/user/unsubscribe/[token]
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      )
    }

    // Find user by unsubscribe token
    // In a real implementation, we'd store tokens more securely
    const users = await prisma.user.findMany({
      where: {
        unsubscribeTokens: {
          path: ['tokens'],
          array_contains: token
        }
      }
    })

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe token' },
        { status: 404 }
      )
    }

    const user = users[0]
    const { category } = await request.json()

    // Update user preferences
    const currentPrefs = user.emailPreferences as any || {}
    const updatedPrefs = {
      ...currentPrefs,
      configured: true
    }

    if (category === 'all') {
      // Unsubscribe from all emails
      updatedPrefs.enabled = false
    } else if (category && currentPrefs.categories) {
      // Unsubscribe from specific category
      updatedPrefs.categories[category] = false
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailPreferences: updatedPrefs
      }
    })

    // Add to suppression list if unsubscribing from all
    if (category === 'all') {
      await prisma.emailSuppressionList.create({
        data: {
          email: user.email,
          reason: 'unsubscribe',
          source: 'user_unsubscribe',
          metadata: {
            userId: user.id,
            timestamp: new Date().toISOString()
          }
        }
      }).catch(() => {
        // Ignore if already exists
      })
    }

    return NextResponse.json({
      success: true,
      message: category === 'all' 
        ? 'You have been unsubscribed from all emails'
        : `You have been unsubscribed from ${category} emails`
    })
  } catch (error) {
    console.error('Failed to process unsubscribe:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}

// GET /api/user/unsubscribe/[token] - Get unsubscribe options
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      )
    }

    // Find user by unsubscribe token
    const users = await prisma.user.findMany({
      where: {
        unsubscribeTokens: {
          path: ['tokens'],
          array_contains: token
        }
      }
    })

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe token' },
        { status: 404 }
      )
    }

    const user = users[0]
    const preferences = user.emailPreferences as any || {}

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name
      },
      preferences: {
        enabled: preferences.enabled !== false,
        categories: preferences.categories || {}
      },
      options: [
        { value: 'all', label: 'Unsubscribe from all emails' },
        { value: 'taskAssignments', label: 'Task assignments' },
        { value: 'taskComments', label: 'Task comments' },
        { value: 'campaignStatusChanges', label: 'Campaign status changes' },
        { value: 'approvalRequests', label: 'Approval requests' },
        { value: 'reportCompletion', label: 'Report completion' },
        { value: 'systemAnnouncements', label: 'System announcements' }
      ]
    })
  } catch (error) {
    console.error('Failed to get unsubscribe options:', error)
    return NextResponse.json(
      { error: 'Failed to get unsubscribe options' },
      { status: 500 }
    )
  }
}