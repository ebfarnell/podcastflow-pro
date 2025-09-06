import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { YouTubeService } from '@/lib/youtube/youtube-service'

/**
 * YouTube OAuth Connection Initiation
 * GET /api/youtube/auth/connect
 * 
 * Starts the OAuth flow to connect a YouTube channel to the organization.
 * Redirects user to Google OAuth consent screen.
 */

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get connection name from query params
    const searchParams = request.nextUrl.searchParams
    const connectionName = searchParams.get('connectionName') || 'YouTube Connection'

    // Authenticate user
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user permissions - only admin, master, or sales can connect channels
    if (!['admin', 'master', 'sales'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to connect YouTube channels' },
        { status: 403 }
      )
    }

    try {
      // Get OAuth URL with connection name in state
      const authUrl = await YouTubeService.getOAuthUrl(
        user.organizationId,
        user.id,
        connectionName
      )

      // Redirect directly to OAuth URL
      return NextResponse.redirect(authUrl)
    } catch (serviceError: any) {
      if (serviceError.message.includes('OAuth not configured')) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_oauth_not_configured`
        )
      }
      throw serviceError
    }
  } catch (error: any) {
    console.error('Error initiating YouTube OAuth:', error)
    
    if (error.message.includes('OAuth not configured')) {
      // Redirect to settings page with error
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_oauth_not_configured`
      )
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_connection_failed`
    )
  }
}
