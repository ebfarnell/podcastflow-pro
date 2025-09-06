/**
 * YouTube OAuth Callback Handler
 * GET /api/youtube/auth/callback
 * 
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * and stores the channel connection in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { YouTubeService } from '@/lib/youtube/youtube-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('YouTube OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_${error}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_invalid_callback`
      )
    }

    // Handle the OAuth callback
    const channel = await YouTubeService.handleOAuthCallback(code, state)

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?youtube_connected=${channel.channelId}`
    )
  } catch (error: any) {
    console.error('Error handling YouTube OAuth callback:', error)
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=youtube_connection_failed`
    )
  }
}