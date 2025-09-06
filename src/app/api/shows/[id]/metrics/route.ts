import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

// Force dynamic rendering for routes that use cookies/auth
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// UUID validation schema
const uuidSchema = z.string().uuid()

// Input validation for metrics update
const updateMetricsSchema = z.object({
  avgEpisodeDownloads: z.number().min(0).optional(),
  totalSubscribers: z.number().min(0).optional(),
  monthlyDownloads: z.number().min(0).optional(),
  averageListeners: z.number().min(0).optional(),
  averageCompletion: z.number().min(0).max(100).optional()
})

// GET /api/shows/[id]/metrics - Get show metrics
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = uuidv4()
  
  try {
    // Accept any show ID format (not just UUIDs)
    const showId = params.id
    
    // Parse date range parameters
    const url = new URL(request.url)
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    
    if (!showId) {
      console.log(`[${correlationId}] Missing showId`)
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

    console.log(`[${correlationId}] Getting show metrics:`, { showId, orgSlug, userId: user.id })

    // Get show data to ensure it exists (removed organizationId filter)
    const showQuery = `
      SELECT 
        id, 
        name,
        "estimatedEpisodeValue",
        "isActive"
      FROM "Show" 
      WHERE id = $1
    `
    console.log(`[${correlationId}] Running show query with params:`, { orgSlug, showId })
    const { data: showResult, error: showError } = await safeQuerySchema<any>(
      orgSlug, 
      showQuery, 
      [showId]
    )
    
    console.log(`[${correlationId}] Show query result:`, { 
      hasData: !!showResult, 
      dataLength: showResult?.length, 
      error: showError,
      firstRow: showResult?.[0]
    })
    
    if (showError || !showResult || showResult.length === 0) {
      console.log(`[${correlationId}] Show not found:`, { showId, error: showError })
      return NextResponse.json(
        { code: 'E_NOT_FOUND', message: 'Show not found', correlationId },
        { status: 404 }
      )
    }

    const show = showResult[0]
    
    // Calculate date range (use provided dates or default to last 30 days)
    const currentDate = new Date().toISOString().split('T')[0]
    const endDate = endDateParam || currentDate
    // For "All Time", the frontend will send a very early startDate (2020-01-01)
    const startDate = startDateParam || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    console.log(`[${correlationId}] Date range requested:`, { 
      startDate, 
      endDate, 
      startDateParam, 
      endDateParam,
      thirtyDaysAgo,
      sevenDaysAgo 
    })
    
    // Check if we have YouTube Analytics data (more accurate than Episode snapshots)
    const hasAnalyticsQuery = `
      SELECT COUNT(*) as analytics_count
      FROM "YouTubeAnalytics" ya
      JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
      WHERE e."showId" = $1 AND ya.date >= $2::date AND ya.date <= $3::date
    `
    
    const { data: analyticsCheck } = await safeQuerySchema<any>(
      orgSlug,
      hasAnalyticsQuery,
      [showId, startDate, endDate]
    )
    
    const hasAnalyticsData = analyticsCheck?.[0]?.analytics_count > 0

    let analyticsQuery: string
    if (hasAnalyticsData) {
      // Use YouTubeAnalytics table for more accurate historical data
      analyticsQuery = `
        SELECT 
          COUNT(DISTINCT e.id) as published_episodes,
          COALESCE(SUM(ya.views), 0) as total_youtube_views,
          COALESCE(SUM(ya.likes), 0) as total_youtube_likes,
          COALESCE(SUM(ya.comments), 0) as total_youtube_comments,
          COALESCE(AVG(ya.views), 0) as avg_youtube_views,
          COALESCE(AVG(ya.likes), 0) as avg_youtube_likes,
          COALESCE(AVG(ya.comments), 0) as avg_youtube_comments,
          COALESCE(SUM(e."megaphoneDownloads"), 0) as total_audio_downloads,
          COALESCE(AVG(e."megaphoneDownloads"), 0) as avg_audio_downloads,
          COUNT(DISTINCT e.id) FILTER (WHERE e."airDate" >= $2::date AND e."airDate" <= $3::date) as recent_episodes,
          COUNT(DISTINCT ya."videoId") as episodes_with_youtube_data,
          COUNT(DISTINCT e.id) FILTER (WHERE e."megaphoneDownloads" IS NOT NULL) as episodes_with_audio_data,
          SUM(ya."watchTimeMinutes") as total_watch_time,
          AVG(ya."averageViewDuration") as avg_view_duration,
          AVG(ya."averageViewPercentage") as avg_view_percentage
        FROM "Episode" e
        LEFT JOIN "YouTubeAnalytics" ya ON e."youtubeVideoId" = ya."videoId" 
          AND ya.date >= $2::date AND ya.date <= $3::date
        WHERE e."showId" = $1 
          AND e.status = 'published'
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
      `
    } else {
      // Fall back to Episode table snapshots - filter by airDate within date range
      analyticsQuery = `
        SELECT 
          COUNT(DISTINCT e.id) as published_episodes,
          COALESCE(SUM(e."youtubeViewCount"), 0) as total_youtube_views,
          COALESCE(SUM(e."youtubeLikeCount"), 0) as total_youtube_likes,
          COALESCE(SUM(e."youtubeCommentCount"), 0) as total_youtube_comments,
          COALESCE(AVG(e."youtubeViewCount"), 0) as avg_youtube_views,
          COALESCE(AVG(e."youtubeLikeCount"), 0) as avg_youtube_likes,
          COALESCE(AVG(e."youtubeCommentCount"), 0) as avg_youtube_comments,
          COALESCE(SUM(e."megaphoneDownloads"), 0) as total_audio_downloads,
          COALESCE(AVG(e."megaphoneDownloads"), 0) as avg_audio_downloads,
          COUNT(DISTINCT e.id) FILTER (WHERE e."airDate" >= $2::date AND e."airDate" <= $3::date) as recent_episodes,
          COUNT(DISTINCT e.id) FILTER (WHERE e."youtubeViewCount" IS NOT NULL) as episodes_with_youtube_data,
          COUNT(DISTINCT e.id) FILTER (WHERE e."megaphoneDownloads" IS NOT NULL) as episodes_with_audio_data,
          0 as total_watch_time,
          0 as avg_view_duration,
          0 as avg_view_percentage
        FROM "Episode" e
        WHERE e."showId" = $1 
          AND e.status = 'published'
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
      `
    }
    
    console.log(`[${correlationId}] Running analytics query for YouTube data`)
    const { data: analyticsResult, error: analyticsError } = await safeQuerySchema<any>(
      orgSlug, 
      analyticsQuery, 
      [showId, startDate, endDate]
    )
    
    console.log(`[${correlationId}] Analytics query result:`, {
      hasData: !!analyticsResult,
      dataLength: analyticsResult?.length,
      error: analyticsError,
      firstRow: analyticsResult?.[0]
    })
    
    const analytics = analyticsResult?.[0] || { 
      published_episodes: 0, 
      total_youtube_views: 0,
      total_youtube_likes: 0,
      total_youtube_comments: 0,
      avg_youtube_views: 0,
      avg_youtube_likes: 0,
      avg_youtube_comments: 0,
      total_audio_downloads: 0, 
      avg_audio_downloads: 0,
      recent_episodes: 0,
      episodes_with_youtube_data: 0,
      episodes_with_audio_data: 0,
      total_watch_time: 0,
      avg_view_duration: 0,
      avg_view_percentage: 0
    }
    
    // Get metrics from ShowMetricsDaily if it exists (filter by date range)
    const metricsQuery = `
      SELECT 
        COALESCE(SUM(downloads), 0) as total_downloads,
        COALESCE(SUM(downloads) FILTER (WHERE date >= $2::date), 0) as monthly_downloads,
        COALESCE(SUM(downloads) FILTER (WHERE date >= $3::date), 0) as weekly_downloads,
        COALESCE(AVG(listeners), 0) as avg_listeners,
        COALESCE(AVG("adImpressions"), 0) as avg_impressions,
        COUNT(DISTINCT date) as days_with_data
      FROM "ShowMetricsDaily"
      WHERE "showId" = $1
        AND date >= $4::date
        AND date <= $5::date
    `
    
    const { data: metricsResult } = await safeQuerySchema<any>(
      orgSlug,
      metricsQuery,
      [showId, thirtyDaysAgo, sevenDaysAgo, startDate, endDate]
    )
    const dailyMetrics = metricsResult?.[0] || {
      total_downloads: 0,
      monthly_downloads: 0,
      weekly_downloads: 0,
      avg_listeners: 0,
      avg_impressions: 0,
      days_with_data: 0
    }
    
    // Calculate growth metrics (safe division)
    const prevMonthQuery = `
      SELECT 
        COALESCE(SUM(downloads), 0) as prev_month_downloads
      FROM "ShowMetricsDaily"
      WHERE "showId" = $1 
        AND date >= $2::date - interval '30 days'
        AND date < $2::date
    `
    
    const { data: prevMonthResult } = await safeQuerySchema<any>(
      orgSlug,
      prevMonthQuery,
      [showId, thirtyDaysAgo]
    )
    const prevMonthDownloads = prevMonthResult?.[0]?.prev_month_downloads || 0
    
    // Calculate growth rate
    let growthRate = 0
    if (prevMonthDownloads > 0) {
      growthRate = ((parseInt(dailyMetrics.monthly_downloads) - prevMonthDownloads) / prevMonthDownloads) * 100
    }
    
    // Use YouTube and Megaphone data for metrics
    const avgEpisodeViews = Math.round(parseFloat(analytics.avg_youtube_views))
    const avgEpisodeDownloads = Math.round(parseFloat(analytics.avg_audio_downloads)) || 
      (show.estimatedEpisodeValue ? Math.round(show.estimatedEpisodeValue * 100) : 0)

    // Build response matching expected format with real YouTube data
    const response = {
      id: showId,
      showId: showId,
      showName: show.name,
      
      // Core metrics (using YouTube as proxy for subscribers)
      totalSubscribers: 0, // Would need YouTube channel subscribers API
      newSubscribers: 0,
      lostSubscribers: 0,
      subscriberGrowth: growthRate,
      
      // YouTube metrics (video delivery)
      totalYoutubeViews: parseInt(analytics.total_youtube_views) || 0,
      totalYoutubeLikes: parseInt(analytics.total_youtube_likes) || 0,
      totalYoutubeComments: parseInt(analytics.total_youtube_comments) || 0,
      avgYoutubeViews: avgEpisodeViews,
      avgYoutubeLikes: Math.round(parseFloat(analytics.avg_youtube_likes)),
      avgYoutubeComments: Math.round(parseFloat(analytics.avg_youtube_comments)),
      episodesWithYoutubeData: parseInt(analytics.episodes_with_youtube_data) || 0,
      
      // YouTube Analytics (detailed metrics)
      totalWatchTimeMinutes: parseInt(analytics.total_watch_time) || 0,
      averageViewDuration: Math.round(parseFloat(analytics.avg_view_duration)) || 0,
      averageViewPercentage: parseFloat(analytics.avg_view_percentage) || 0,
      hasAnalyticsData: hasAnalyticsData,
      
      // Download metrics (audio delivery)
      totalDownloads: parseInt(analytics.total_audio_downloads) || parseInt(dailyMetrics.total_downloads) || 0,
      monthlyDownloads: parseInt(dailyMetrics.monthly_downloads) || 0,
      weeklyDownloads: parseInt(dailyMetrics.weekly_downloads) || 0,
      avgEpisodeDownloads: avgEpisodeDownloads,
      
      // Listener metrics
      averageListeners: avgEpisodeViews || Math.round(parseFloat(dailyMetrics.avg_listeners)) || 0,
      averageCompletion: 75, // Default value, not tracked
      
      // Episode metrics
      totalEpisodes: parseInt(analytics.published_episodes) || 0,
      publishedEpisodes: parseInt(analytics.published_episodes) || 0,
      recentEpisodes: parseInt(analytics.recent_episodes) || 0,
      averageEpisodeLength: 30, // Default 30 minutes
      
      // Revenue metrics (to be implemented)
      totalRevenue: 0,
      monthlyRevenue: 0,
      averageCPM: 0,
      
      // Social metrics (placeholders)
      socialShares: 0,
      socialMentions: 0,
      sentimentScore: 0,
      
      // Platform breakdown (using YouTube data we actually have)
      youtubeListeners: parseInt(analytics.total_youtube_views) || 0,
      spotifyListeners: 0,
      appleListeners: 0,
      googleListeners: 0,
      otherListeners: 0,
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      correlationId: correlationId
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`[${correlationId}] Show metrics error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get show metrics',
        correlationId 
      },
      { status: 500 }
    )
  }
}

// PUT /api/shows/[id]/metrics - Update show metrics
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = uuidv4()
  
  try {
    // Accept any show ID format (not just UUIDs)
    const showId = params.id
    
    if (!showId) {
      console.log(`[${correlationId}] Missing showId`)
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

    // Only admin and master can update metrics
    if (user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json(
        { code: 'E_PERM', message: 'Insufficient permissions', correlationId },
        { status: 403 }
      )
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json(
        { code: 'E_ORG', message: 'Organization not found', correlationId },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = updateMetricsSchema.safeParse(body)
    
    if (!validation.success) {
      console.log(`[${correlationId}] Invalid update data:`, validation.error.format())
      return NextResponse.json(
        { 
          code: 'E_INPUT',
          message: 'Invalid update data',
          errors: validation.error.format(),
          correlationId 
        },
        { status: 400 }
      )
    }
    
    console.log(`[${correlationId}] Updating show metrics:`, { showId, updates: Object.keys(validation.data) })

    // Update estimatedEpisodeValue if avgEpisodeDownloads is provided (convert to monetary value)
    if (validation.data.avgEpisodeDownloads !== undefined) {
      const updateQuery = `
        UPDATE "Show" 
        SET "estimatedEpisodeValue" = $1, "updatedAt" = NOW()
        WHERE id = $2
        RETURNING id
      `
      
      // Convert downloads to estimated value (e.g., $0.01 per download as a proxy)
      const estimatedValue = validation.data.avgEpisodeDownloads / 100
      
      const { data: updateResult, error: updateError } = await safeQuerySchema(
        orgSlug, 
        updateQuery, 
        [estimatedValue, showId]
      )
      
      if (updateError || !updateResult || updateResult.length === 0) {
        console.log(`[${correlationId}] Failed to update show:`, updateError)
        return NextResponse.json(
          { code: 'E_UPDATE', message: 'Failed to update show metrics', correlationId },
          { status: 500 }
        )
      }
    }
    
    // If we have metrics to store in ShowMetricsDaily, add them
    if (validation.data.monthlyDownloads !== undefined || 
        validation.data.averageListeners !== undefined) {
      
      const today = new Date().toISOString().split('T')[0]
      
      // Insert or update today's metrics
      const metricsUpsertQuery = `
        INSERT INTO "ShowMetricsDaily" (
          "showId", date, downloads, listeners, "createdAt", "updatedAt"
        ) VALUES ($1, $2::date, $3, $4, NOW(), NOW())
        ON CONFLICT ("showId", date) 
        DO UPDATE SET 
          downloads = COALESCE(EXCLUDED.downloads, "ShowMetricsDaily".downloads),
          listeners = COALESCE(EXCLUDED.listeners, "ShowMetricsDaily".listeners),
          "updatedAt" = NOW()
        RETURNING date
      `
      
      const { error: metricsError } = await safeQuerySchema(
        orgSlug,
        metricsUpsertQuery,
        [
          showId,
          today,
          validation.data.monthlyDownloads || null,
          validation.data.averageListeners || null
        ]
      )
      
      if (metricsError) {
        console.log(`[${correlationId}] Note: ShowMetricsDaily table may not exist:`, metricsError)
        // Continue anyway - this is optional
      }
    }

    // Return updated metrics
    return GET(request, { params })

  } catch (error) {
    console.error(`[${correlationId}] Update show metrics error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to update show metrics',
        correlationId 
      },
      { status: 500 }
    )
  }
}