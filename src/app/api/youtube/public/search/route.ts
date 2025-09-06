import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { YouTubeService } from '@/lib/youtube/youtube-service'

/**
 * PUBLIC YouTube Search API
 * GET /api/youtube/public/search?q={query}&maxResults={number}
 * 
 * Search for YouTube videos using API key authentication.
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

    // Get search parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const maxResults = parseInt(searchParams.get('maxResults') || '10')
    
    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 })
    }

    if (query.length > 100) {
      return NextResponse.json({ error: 'Search query too long (max 100 characters)' }, { status: 400 })
    }

    if (maxResults < 1 || maxResults > 50) {
      return NextResponse.json({ error: 'maxResults must be between 1 and 50' }, { status: 400 })
    }

    // Perform search
    const searchResults = await YouTubeService.searchVideos(
      user.organizationId,
      query,
      maxResults
    )

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: searchResults,
        count: searchResults.length
      }
    })
  } catch (error: any) {
    console.error('Error searching YouTube:', error)
    
    if (error.message.includes('API not configured')) {
      return NextResponse.json(
        { error: 'YouTube API not configured for your organization' },
        { status: 403 }
      )
    }

    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'YouTube API quota exceeded' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to search videos' },
      { status: 500 }
    )
  }
}
