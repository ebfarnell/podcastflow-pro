import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user preferences from database
    const userWithPreferences = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        preferences: true
      }
    })

    // FIX: Always return the actual preferences from database if they exist
    // This ensures account-specific sidebar configs are loaded properly
    if (userWithPreferences?.preferences) {
      // Return whatever is in the database, including sidebarCustomization
      return NextResponse.json(userWithPreferences.preferences)
    }

    // Only return defaults if no preferences exist in database
    const defaultPreferences = {
      email: {
        marketing: true,
        updates: true,
        weekly_digest: false,
        campaign_alerts: true,
        performance_reports: true
      },
      push: {
        campaign_status: true,
        budget_alerts: true,
        new_messages: true,
        system_updates: false
      },
      sms: {
        critical_alerts: false,
        campaign_completion: false,
        budget_threshold: false
      },
      notification_schedule: {
        quiet_hours_enabled: false,
        quiet_start: '22:00',
        quiet_end: '08:00',
        timezone: 'America/New_York'
      },
      alert_preferences: {
        budget_threshold_percent: 80,
        performance_drop_percent: 20,
        low_engagement_threshold: 5
      }
    }

    return NextResponse.json(defaultPreferences)
  } catch (error) {
    console.error('Failed to get user preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()

    // Get current preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        preferences: true
      }
    })

    const currentPreferences = currentUser?.preferences || {}

    // Merge updates with current preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...updates
    }
    
    // If sidebar customization is being updated, ensure version is set
    if (updates.sidebarCustomization) {
      updatedPreferences.sidebarCustomizationVersion = updates.sidebarCustomizationVersion || 2
    }

    // Update user preferences in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: updatedPreferences
      }
    })

    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: updatedPreferences
    })
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}