import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { YouTubeService } from '@/lib/youtube/youtube-service'

/**
 * PUBLIC YouTube Channel Data API
 * GET /api/youtube/public/channel?channelId={channelId}
 * 
 * Fetches public information about any YouTube channel using API key authentication.
 * No OAuth required - uses organization's configured API key.
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

    // Get channel ID from query params
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Validate channel ID format (starts with UC and is 24 chars)
    const channelIdRegex = /^UC[a-zA-Z0-9_-]{22}$/
    if (!channelIdRegex.test(channelId)) {
      return NextResponse.json({ error: 'Invalid channel ID format' }, { status: 400 })
    }

    // Fetch public channel data
    const channelData = await YouTubeService.getPublicChannelInfo(
      user.organizationId,
      channelId
    )

    return NextResponse.json({
      success: true,
      data: channelData
    })
  } catch (error: any) {
    console.error('Error fetching YouTube channel:', error)
    
    if (error.message.includes('API not configured')) {
      return NextResponse.json(
        { error: 'YouTube API not configured for your organization' },
        { status: 403 }
      )
    }
    
    if (error.message === 'Channel not found') {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'YouTube API quota exceeded' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch channel data' },
      { status: 500 }
    )
  }
}
