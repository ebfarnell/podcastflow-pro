import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Only admin/master users can view backup schedules
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get organization settings to check for backup schedule
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true }
    })

    const settings = org?.settings as any || {}
    const backupSchedule = settings.backupSchedule || {
      enabled: false,
      frequency: 'weekly',
      time: '02:00',
      dayOfWeek: 0, // Sunday
      dayOfMonth: 1,
      retention: 30,
      includesData: ['database'],
      lastRun: null,
      nextRun: null
    }

    return NextResponse.json(backupSchedule)

  } catch (error) {
    console.error('❌ Backup Schedule GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch backup schedule' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Only admin/master users can update backup schedules
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const scheduleData = await request.json()

    // Update organization settings with backup schedule
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true }
    })

    const currentSettings = org?.settings as any || {}
    
    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        settings: {
          ...currentSettings,
          backupSchedule: {
            ...scheduleData,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
          }
        }
      }
    })

    console.log('✅ Backup schedule updated for organization:', user.organizationId)

    // In production, this would trigger a cron job update
    // For now, we'll just save the schedule
    if (scheduleData.enabled) {
      console.log('Backup schedule enabled:', {
        frequency: scheduleData.frequency,
        time: scheduleData.time,
        retention: scheduleData.retention
      })
    }

    return NextResponse.json({
      success: true,
      schedule: scheduleData,
      message: scheduleData.enabled 
        ? 'Backup schedule enabled successfully' 
        : 'Backup schedule disabled'
    })

  } catch (error) {
    console.error('❌ Backup Schedule PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update backup schedule' },
      { status: 500 }
    )
  }
}