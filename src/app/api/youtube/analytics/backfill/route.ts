import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { createYouTubeAnalyticsService } from '@/services/youtube-analytics'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for long-running backfill

// POST /api/youtube/analytics/backfill - Backfill historical YouTube analytics
export async function POST(request: NextRequest) {
  const correlationId = uuidv4()
  
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    // Only admin and master can trigger backfill
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { code: 'E_PERM', message: 'Insufficient permissions', correlationId },
        { status: 403 }
      )
    }

    console.log(`[${correlationId}] Starting YouTube analytics backfill for user ${user.id}`)

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const daysBack = body.daysBack || 90
    const channelId = body.channelId

    // Validate daysBack
    if (daysBack < 1 || daysBack > 365) {
      return NextResponse.json(
        { 
          code: 'E_INPUT', 
          message: 'Days back must be between 1 and 365', 
          correlationId 
        },
        { status: 400 }
      )
    }

    // Create YouTube Analytics service
    const service = await createYouTubeAnalyticsService(user.id)
    if (!service) {
      return NextResponse.json(
        {
          code: 'E_CONFIG',
          message: 'YouTube API not configured. Please configure API credentials.',
          correlationId
        },
        { status: 503 }
      )
    }

    // Start backfill process
    console.log(`[${correlationId}] Backfilling ${daysBack} days of data`)
    const result = await service.backfillHistoricalData(daysBack, channelId)

    console.log(`[${correlationId}] Backfill completed:`, result)

    return NextResponse.json({
      success: true,
      result: {
        videosProcessed: result.success,
        errors: result.errors,
        daysBack,
        message: `Successfully backfilled analytics for ${result.success} videos over ${daysBack} days`
      },
      correlationId
    })

  } catch (error) {
    console.error(`[${correlationId}] YouTube analytics backfill error:`, error)
    
    let errorMessage = 'Failed to backfill YouTube analytics'
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        errorMessage = 'YouTube API quota exceeded. Please try again later.'
      } else if (error.message.includes('credentials')) {
        errorMessage = 'Invalid YouTube API credentials'
      } else if (error.message.includes('permission')) {
        errorMessage = 'Insufficient YouTube API permissions'
      }
    }

    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: errorMessage,
        correlationId 
      },
      { status: 500 }
    )
  }
}

// GET /api/youtube/analytics/backfill - Get backfill status
export async function GET(request: NextRequest) {
  const correlationId = uuidv4()
  
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    // Create service to check data availability
    const service = await createYouTubeAnalyticsService(user.id)
    if (!service) {
      return NextResponse.json(
        {
          hasData: false,
          message: 'YouTube API not configured',
          correlationId
        }
      )
    }

    // Check if we have any analytics data
    const recentData = await service.getStoredAnalytics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 7 days
    )

    return NextResponse.json({
      hasData: recentData.length > 0,
      dataPoints: recentData.length,
      earliestDate: recentData.length > 0 ? Math.min(...recentData.map(d => new Date(d.date).getTime())) : null,
      latestDate: recentData.length > 0 ? Math.max(...recentData.map(d => new Date(d.date).getTime())) : null,
      message: recentData.length > 0 
        ? `Found ${recentData.length} recent analytics data points`
        : 'No analytics data found. Consider running backfill.',
      correlationId
    })

  } catch (error) {
    console.error(`[${correlationId}] YouTube analytics status error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get analytics status',
        correlationId 
      },
      { status: 500 }
    )
  }
}