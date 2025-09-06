import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
import { calculateSourceComposition } from '@/lib/analytics/metrics-helpers'

// Force dynamic rendering for routes that use cookies/auth
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shows/[id]/metrics/summary - Get enhanced show metrics summary
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = uuidv4()
  
  try {
    const showId = params.id
    
    // Parse date range parameters
    const url = new URL(request.url)
    const startDateParam = url.searchParams.get('start')
    const endDateParam = url.searchParams.get('end')
    
    if (!showId) {
      return NextResponse.json(
        { code: 'E_INPUT', message: 'Show ID is required', correlationId },
        { status: 400 }
      )
    }
    
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

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json(
        { code: 'E_ORG', message: 'Organization not found', correlationId },
        { status: 404 }
      )
    }

    console.log(`[${correlationId}] Getting enhanced show summary:`, { showId, orgSlug, userId: user.id })

    // Calculate date range
    const currentDate = new Date().toISOString().split('T')[0]
    const endDate = endDateParam || currentDate
    const startDate = startDateParam || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // Get total downloads from multiple sources
    const downloadsQuery = `
      WITH episode_data AS (
        SELECT 
          e.id,
          e."showId",
          e."airDate",
          e."youtubeVideoId",
          COALESCE(e."megaphoneDownloads", 0) as megaphone_downloads,
          COALESCE(e."spotifyStreams", 0) as spotify_streams,
          COALESCE(e."appleStreams", 0) as apple_streams,
          COALESCE(e."googleStreams", 0) as google_streams,
          COALESCE(e."otherStreams", 0) as other_streams
        FROM "Episode" e
        WHERE e."showId" = $1 
          AND e.status = 'published'
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
      )
      SELECT 
        SUM(megaphone_downloads) as megaphone_total,
        SUM(spotify_streams) as spotify_total,
        SUM(apple_streams) as apple_total,
        SUM(google_streams) as google_total,
        SUM(other_streams) as other_total,
        SUM(megaphone_downloads + spotify_streams + apple_streams + google_streams + other_streams) as total_downloads
      FROM episode_data
    `
    
    const { data: downloadsResult, error: downloadsError } = await safeQuerySchema<any>(
      orgSlug, 
      downloadsQuery, 
      [showId, startDate, endDate]
    )
    
    const downloads = downloadsResult?.[0] || {
      megaphone_total: 0,
      spotify_total: 0,
      apple_total: 0,
      google_total: 0,
      other_total: 0,
      total_downloads: 0
    }
    
    // Get VTR and unique viewers from YouTube Analytics
    const vtrQuery = `
      WITH youtube_data AS (
        SELECT 
          ya."videoId",
          ya."averageViewPercentage",
          ya."averageViewDuration",
          ya.views,
          ya."estimatedMinutesWatched",
          ya."subscribersGained"
        FROM "YouTubeAnalytics" ya
        JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
        WHERE e."showId" = $1 
          AND ya.date >= $2::date 
          AND ya.date <= $3::date
      ),
      unique_viewers_estimate AS (
        -- Estimate unique viewers from views and watch patterns
        SELECT 
          SUM(views) as total_views,
          COUNT(DISTINCT "videoId") as unique_videos,
          -- Estimate unique viewers as 60-70% of total views for a typical channel
          ROUND(SUM(views) * 0.65) as estimated_unique_viewers
        FROM youtube_data
      )
      SELECT 
        AVG(NULLIF("averageViewPercentage", 0)) as avg_vtr,
        COUNT(DISTINCT "videoId") as videos_with_vtr,
        SUM(views) as total_views_for_vtr,
        MAX(uv.estimated_unique_viewers) as unique_viewers
      FROM youtube_data
      CROSS JOIN unique_viewers_estimate uv
    `
    
    const { data: vtrResult } = await safeQuerySchema<any>(
      orgSlug,
      vtrQuery,
      [showId, startDate, endDate]
    )
    
    const vtrData = vtrResult?.[0] || {
      avg_vtr: null,
      videos_with_vtr: 0,
      total_views_for_vtr: 0,
      unique_viewers: 0
    }
    
    // Get LTR from Megaphone completion rate field
    const ltrQuery = `
      SELECT 
        COUNT(DISTINCT id) as episodes_with_audio,
        AVG("megaphoneCompletionRate") as avg_ltr,
        SUM("megaphoneUniqueListeners") as total_unique_listeners,
        AVG("megaphoneAvgListenTime") as avg_listen_time_seconds
      FROM "Episode"
      WHERE "showId" = $1 
        AND status = 'published'
        AND "airDate" >= $2::date 
        AND "airDate" <= $3::date
        AND "megaphoneDownloads" > 0
    `
    
    const { data: ltrResult } = await safeQuerySchema<any>(
      orgSlug,
      ltrQuery,
      [showId, startDate, endDate]
    )
    
    const ltrData = ltrResult?.[0] || {
      episodes_with_audio: 0,
      avg_ltr: null,
      total_unique_listeners: 0,
      avg_listen_time_seconds: 0
    }
    
    // Get total episodes count for coverage calculation
    const episodesCountQuery = `
      SELECT COUNT(*) as total_episodes
      FROM "Episode"
      WHERE "showId" = $1 
        AND status = 'published'
        AND "airDate" >= $2::date 
        AND "airDate" <= $3::date
    `
    
    const { data: episodesCount } = await safeQuerySchema<any>(
      orgSlug,
      episodesCountQuery,
      [showId, startDate, endDate]
    )
    
    const totalEpisodes = parseInt(episodesCount?.[0]?.total_episodes || '0')
    
    // Calculate source composition
    const downloadsBySource = {
      megaphone: parseInt(downloads.megaphone_total || '0'),
      spotify: parseInt(downloads.spotify_total || '0'),
      apple: parseInt(downloads.apple_total || '0'),
      google: parseInt(downloads.google_total || '0'),
      other: parseInt(downloads.other_total || '0')
    }
    
    // Get existing totals from the main metrics endpoint
    const existingMetricsQuery = `
      SELECT 
        COALESCE(SUM(ya.views), 0) as total_views,
        COALESCE(SUM(ya.likes), 0) as total_likes,
        COALESCE(SUM(ya.comments), 0) as total_comments,
        COALESCE(AVG(ya."subscribersGained") - AVG(ya."subscribersLost"), 0) as net_subscriber_change
      FROM "YouTubeAnalytics" ya
      JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
      WHERE e."showId" = $1 
        AND ya.date >= $2::date 
        AND ya.date <= $3::date
    `
    
    const { data: existingMetrics } = await safeQuerySchema<any>(
      orgSlug,
      existingMetricsQuery,
      [showId, startDate, endDate]
    )
    
    const metrics = existingMetrics?.[0] || {
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      net_subscriber_change: 0
    }
    
    // Build response
    const response = {
      totals: {
        totalDownloads: parseInt(downloads.total_downloads || '0'),
        totalViews: parseInt(metrics.total_views || '0'),
        totalLikes: parseInt(metrics.total_likes || '0'),
        totalComments: parseInt(metrics.total_comments || '0'),
        subscriberChange: parseFloat(metrics.net_subscriber_change || '0')
      },
      rates: {
        vtr: {
          value: parseFloat(vtrData.avg_vtr || '0'),
          coveragePct: totalEpisodes > 0 ? (parseInt(vtrData.videos_with_vtr || '0') / totalEpisodes) * 100 : 0,
          episodesCount: parseInt(vtrData.videos_with_vtr || '0')
        },
        ltr: {
          value: parseFloat(ltrData.avg_ltr || '0'), // Use actual Megaphone completion rate, no default
          coveragePct: totalEpisodes > 0 ? (parseInt(ltrData.episodes_with_audio || '0') / totalEpisodes) * 100 : 0,
          episodesCount: parseInt(ltrData.episodes_with_audio || '0')
        }
      },
      composition: {
        downloadsBySource: calculateSourceComposition(downloadsBySource),
        sourcesUnavailable: Object.entries(downloadsBySource)
          .filter(([_, value]) => value === 0)
          .map(([key]) => key)
      },
      megaphone: {
        uniqueListeners: parseInt(ltrData.total_unique_listeners || '0'),
        avgListenTime: parseInt(ltrData.avg_listen_time_seconds || '0'),
        hasData: parseInt(ltrData.episodes_with_audio || '0') > 0
      },
      youtube: {
        uniqueViewers: parseInt(vtrData.unique_viewers || '0'),
        hasData: parseInt(vtrData.videos_with_vtr || '0') > 0
      },
      metadata: {
        dateRange: { start: startDate, end: endDate },
        totalEpisodes,
        lastUpdated: new Date().toISOString(),
        correlationId
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`[${correlationId}] Show metrics summary error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get show metrics summary',
        correlationId 
      },
      { status: 500 }
    )
  }
}