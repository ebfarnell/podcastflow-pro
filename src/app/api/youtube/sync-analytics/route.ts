import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/youtube/sync-analytics - Sync YouTube Analytics data for a show
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { showId } = await request.json()
    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get show's YouTube channel ID
    const showQuery = `
      SELECT "youtubeChannelId", name
      FROM "Show"
      WHERE id = $1
    `
    const { data: showData } = await safeQuerySchema<any>(
      orgSlug,
      showQuery,
      [showId]
    )

    if (!showData || showData.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    const channelId = showData[0].youtubeChannelId
    if (!channelId) {
      return NextResponse.json(
        { error: 'Show does not have a YouTube channel configured' },
        { status: 400 }
      )
    }

    // NOTE: In a real implementation, this would:
    // 1. Call YouTube Analytics API with OAuth tokens
    // 2. Fetch metrics for the channel's videos
    // 3. Store in YouTubeAnalytics table
    // 
    // Example YouTube API call structure:
    // const youtube = google.youtube({ version: 'v3', auth })
    // const analytics = google.youtubeAnalytics({ version: 'v2', auth })
    // 
    // const videos = await youtube.search.list({
    //   channelId,
    //   part: 'id',
    //   type: 'video',
    //   maxResults: 50
    // })
    //
    // for (const video of videos.data.items) {
    //   const metrics = await analytics.reports.query({
    //     ids: `channel==${channelId}`,
    //     startDate: '2025-01-01',
    //     endDate: '2025-08-20',
    //     metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares',
    //     dimensions: 'day',
    //     filters: `video==${video.id.videoId}`
    //   })
    //   // Store metrics in database
    // }

    return NextResponse.json({
      message: 'YouTube Analytics sync would be triggered here',
      channelId,
      showName: showData[0].name,
      note: 'Real implementation requires YouTube API credentials and OAuth setup'
    })

  } catch (error) {
    console.error('YouTube sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync YouTube Analytics' },
      { status: 500 }
    )
  }
}