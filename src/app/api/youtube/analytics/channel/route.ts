import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { YouTubeService } from '@/lib/youtube/youtube-service'

/**
 * PRIVATE YouTube Channel Analytics API
 * GET /api/youtube/analytics/channel?channelId={channelId}&startDate={date}&endDate={date}
 * 
 * Fetches private analytics data for connected YouTube channels.
 * Requires OAuth authentication for the specific channel.
 */

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get parameters
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date required' }, { status: 400 })
    }

    // Validate date format
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (startDateObj > endDateObj) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // Maximum date range of 90 days
    const daysDiff = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 90) {
      return NextResponse.json({ error: 'Date range cannot exceed 90 days' }, { status: 400 })
    }

    // Fetch analytics data
    const analyticsData = await YouTubeService.getChannelAnalytics(
      user.organizationId,
      channelId,
      startDateObj,
      endDateObj
    )

    return NextResponse.json({
      success: true,
      data: {
        channelId,
        startDate,
        endDate,
        analytics: analyticsData
      }
    })
  } catch (error: any) {
    console.error('Error fetching YouTube channel analytics:', error)
    
    if (error.message === 'YouTube channel not connected') {
      return NextResponse.json(
        { error: 'YouTube channel not connected. Please connect the channel first.' },
        { status: 403 }
      )
    }

    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'YouTube Analytics API access denied. Please reconnect the channel.' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch channel analytics' },
      { status: 500 }
    )
  }
}
