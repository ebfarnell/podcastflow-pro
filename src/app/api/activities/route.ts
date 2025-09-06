import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { activityService } from '@/lib/activities/activity-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/activities - Get activities with filters
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const type = url.searchParams.get('type')
    const action = url.searchParams.get('action')
    const targetType = url.searchParams.get('targetType')
    const targetId = url.searchParams.get('targetId')
    const days = parseInt(url.searchParams.get('days') || '0')

    console.log('🔍 Activities API: Fetching activities', { limit, offset, type, action })

    // Build filter
    const filter: any = {
      organizationId: user.role === 'master' ? undefined : user.organizationId
    }

    if (type) filter.type = type
    if (action) filter.action = action
    if (targetType) filter.targetType = targetType
    if (targetId) filter.targetId = targetId

    if (days > 0) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      filter.startDate = startDate
    }

    // Get activities from database - use defensive handling since Activity table may not exist
    let activities = []
    let total = 0
    
    try {
      const result = await activityService.getActivities(filter, limit, offset)
      activities = result.activities
      total = result.total
    } catch (dbError) {
      console.warn('⚠️ Activities table not found, returning empty result:', dbError)
      // Return empty data instead of failing
    }

    // Transform activities for API response
    const transformedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      action: activity.action,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      actor: {
        id: activity.actorId,
        name: activity.actorName,
        email: activity.actorEmail,
        role: activity.actorRole,
        avatar: `/api/images/avatar?name=${encodeURIComponent(activity.actorName)}`
      },
      target: {
        type: activity.targetType,
        id: activity.targetId,
        name: activity.targetName
      },
      metadata: activity.metadata || {},
      campaign: activity.campaign ? {
        id: activity.campaign.id,
        name: activity.campaign.name
      } : undefined,
      show: activity.show ? {
        id: activity.show.id,
        name: activity.show.name
      } : undefined,
      episode: activity.episode ? {
        id: activity.episode.id,
        title: activity.episode.title,
        showName: activity.episode.show?.name
      } : undefined
    }))

    // Get summary if requested
    let summary = null
    if (url.searchParams.get('includeSummary') === 'true') {
      try {
        summary = await activityService.getActivitySummary(
          user.organizationId!,
          days || 7
        )
      } catch (dbError) {
        console.warn('⚠️ Could not fetch activity summary:', dbError)
        summary = {
          summary: {},
          totalActivities: 0,
          recentActivity: null,
          periodDays: days || 7,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        }
      }
    }

    console.log(`✅ Activities API: Returning ${transformedActivities.length} activities`)

    return NextResponse.json({
      activities: transformedActivities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      summary
    })

  } catch (error) {
    console.error('❌ Activities API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST /api/activities - Create a new activity (for manual logging)
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, action, title, description, target, metadata } = body

    console.log('➕ Activities API: Creating activity', { type, action, title })

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create activity
    const activity = await activityService.logActivity({
      type,
      action,
      title,
      description,
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: target?.type || 'system',
      targetId: target?.id,
      targetName: target?.name,
      organizationId: user.organizationId!,
      metadata: metadata || {},
      ipAddress,
      userAgent
    })

    if (!activity) {
      throw new Error('Failed to create activity')
    }

    console.log(`✅ Activities API: Created activity ${activity.id}`)

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      action: activity.action,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      actor: {
        name: activity.actorName,
        email: activity.actorEmail,
        avatar: `/api/images/avatar?name=${encodeURIComponent(activity.actorName)}`
      },
      target: {
        type: activity.targetType,
        id: activity.targetId,
        name: activity.targetName
      },
      metadata: activity.metadata
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Activities API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}

// DELETE /api/activities/cleanup - Clean up old activities (admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can cleanup activities
    if (user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const url = new URL(request.url)
    const retentionDays = parseInt(url.searchParams.get('retentionDays') || '90')

    if (retentionDays < 30) {
      return NextResponse.json(
        { error: 'Retention period must be at least 30 days' },
        { status: 400 }
      )
    }

    console.log('🗑️ Activities API: Cleaning up old activities', { retentionDays })

    const deletedCount = await activityService.cleanupOldActivities(retentionDays)

    // Log the cleanup activity
    await activityService.logActivity({
      type: 'system',
      action: 'cleanup',
      title: 'Activity Cleanup',
      description: `Cleaned up ${deletedCount} activities older than ${retentionDays} days`,
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'system',
      targetName: 'Activity Logs',
      organizationId: user.organizationId!,
      metadata: {
        retentionDays,
        deletedCount
      }
    })

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays
    })

  } catch (error) {
    console.error('❌ Activities cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup activities' },
      { status: 500 }
    )
  }
}
