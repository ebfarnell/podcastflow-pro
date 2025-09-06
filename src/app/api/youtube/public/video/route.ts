import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { YouTubeService } from '@/lib/youtube/youtube-service'

/**
 * PUBLIC YouTube Video Data API
 * GET /api/youtube/public/video?videoId={videoId}
 * 
 * Fetches public information about any YouTube video using API key authentication.
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

    // Get video ID from query params
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 })
    }

    // Validate video ID format
    const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/
    if (!videoIdRegex.test(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID format' }, { status: 400 })
    }

    // Fetch public video data
    const videoData = await YouTubeService.getPublicVideoInfo(
      user.organizationId,
      videoId
    )

    return NextResponse.json({
      success: true,
      data: videoData
    })
  } catch (error: any) {
    console.error('Error fetching YouTube video:', error)
    
    if (error.message.includes('API not configured')) {
      return NextResponse.json(
        { error: 'YouTube API not configured for your organization' },
        { status: 403 }
      )
    }
    
    if (error.message === 'Video not found') {
      return NextResponse.json(
        { error: 'Video not found' },
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
      { error: 'Failed to fetch video data' },
      { status: 500 }
    )
  }
}
