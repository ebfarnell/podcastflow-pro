import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
import { detectOutliers } from '@/lib/analytics/metrics-helpers'

// Force dynamic rendering for routes that use cookies/auth
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shows/[id]/metrics/daily-trend - Get daily views/listens trend
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

    console.log(`[${correlationId}] Getting daily trend data:`, { showId, orgSlug, userId: user.id })

    // Calculate date range
    const currentDate = new Date().toISOString().split('T')[0]
    let endDate = endDateParam || currentDate
    let startDate = startDateParam || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    console.log(`[${correlationId}] Initial date range: start=${startDate}, end=${endDate}`)
    
    // If start date is before 2001 (indicating "All Time"), find the actual earliest data point
    if (startDate <= '2001-01-01') {
      console.log(`[${correlationId}] Detected "All Time" request, finding earliest data point...`)
      // Query to find the earliest episode with data for this show
      // Simplified to just find the earliest episode date
      const earliestDataQuery = `
        SELECT MIN(e."airDate") as earliest_date
        FROM "Episode" e
        WHERE e."showId" = $1
          AND e."airDate" IS NOT NULL
      `
      
      const { data: earliestResult } = await safeQuerySchema<any>(
        orgSlug,
        earliestDataQuery,
        [showId]
      )
      
      console.log(`[${correlationId}] Earliest date query result:`, earliestResult)
      
      if (earliestResult && earliestResult[0]?.earliest_date) {
        const earliestDate = earliestResult[0].earliest_date
        // Convert to string format if it's a Date object
        startDate = earliestDate instanceof Date 
          ? earliestDate.toISOString().split('T')[0]
          : typeof earliestDate === 'string'
            ? earliestDate.split('T')[0]
            : startDate // Fall back to original if we can't parse
        
        console.log(`[${correlationId}] Adjusted start date for "All Time" from 2000-01-01 to ${startDate}`)
      } else {
        console.log(`[${correlationId}] No earliest date found, using default range`)
      }
    }
    
    // Get daily views from YouTube Analytics OR Episode table
    // First try YouTubeAnalytics (if OAuth2 is configured), then fall back to Episode data
    const viewsQuery = `
      WITH youtube_analytics_views AS (
        -- Data from YouTube Analytics API (requires OAuth2)
        SELECT 
          ya.date,
          SUM(ya.views) as total_views,
          COUNT(DISTINCT ya."videoId") as video_count
        FROM "YouTubeAnalytics" ya
        JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
        WHERE e."showId" = $1 
          AND ya.date >= $2::date 
          AND ya.date <= $3::date
        GROUP BY ya.date
      ),
      episode_views AS (
        -- Data from Episode table (from YouTube Data API v3)
        SELECT 
          e."airDate" as date,
          SUM(COALESCE(e."youtubeViewCount", 0)) as total_views,
          COUNT(*) as video_count
        FROM "Episode" e
        WHERE e."showId" = $1 
          AND e."youtubeVideoId" IS NOT NULL
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
        GROUP BY e."airDate"
      ),
      combined_views AS (
        -- Prefer Analytics data if available, otherwise use Episode data
        SELECT 
          COALESCE(ya.date, ev.date) as date,
          COALESCE(ya.total_views, ev.total_views) as total_views,
          COALESCE(ya.video_count, ev.video_count) as video_count
        FROM youtube_analytics_views ya
        FULL OUTER JOIN episode_views ev ON ya.date = ev.date
      )
      SELECT 
        date,
        total_views,
        video_count,
        CASE 
          WHEN video_count > 0 THEN total_views::float / video_count::float
          ELSE 0
        END as avg_views_per_video
      FROM combined_views
      ORDER BY date
    `
    
    const { data: viewsResult } = await safeQuerySchema<any>(
      orgSlug, 
      viewsQuery, 
      [showId, startDate, endDate]
    )
    
    // Get daily listens/downloads from multiple sources
    const listensQuery = `
      WITH daily_listens AS (
        SELECT 
          e."airDate" as date,
          SUM(COALESCE(e."megaphoneDownloads", 0)) as megaphone,
          SUM(COALESCE(e."spotifyStreams", 0)) as spotify,
          SUM(COALESCE(e."appleStreams", 0)) as apple,
          SUM(COALESCE(e."googleStreams", 0)) as google,
          SUM(COALESCE(e."otherStreams", 0)) as other,
          COUNT(*) as episode_count
        FROM "Episode" e
        WHERE e."showId" = $1 
          AND e.status = 'published'
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
        GROUP BY e."airDate"
      ),
      metrics_daily AS (
        SELECT 
          date,
          SUM(downloads) as daily_downloads,
          SUM(listeners) as daily_listeners
        FROM "ShowMetricsDaily"
        WHERE "showId" = $1
          AND date >= $2::date
          AND date <= $3::date
        GROUP BY date
      )
      SELECT 
        COALESCE(dl.date, md.date) as date,
        COALESCE(dl.megaphone + dl.spotify + dl.apple + dl.google + dl.other, 0) as episode_listens,
        COALESCE(md.daily_downloads, 0) as metrics_downloads,
        COALESCE(md.daily_listeners, 0) as metrics_listeners,
        COALESCE(dl.episode_count, 0) as episode_count
      FROM daily_listens dl
      FULL OUTER JOIN metrics_daily md ON dl.date = md.date
      ORDER BY date
    `
    
    const { data: listensResult } = await safeQuerySchema<any>(
      orgSlug,
      listensQuery,
      [showId, startDate, endDate]
    )
    
    // Create a complete date range to ensure all dates are represented
    const dateMap = new Map<string, { avgViews: number | null; avgListens: number | null }>()
    
    // Initialize all dates in range
    const start = new Date(startDate)
    const end = new Date(endDate)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dateMap.set(dateStr, { avgViews: null, avgListens: null })
    }
    
    // Fill in views data
    viewsResult?.forEach((row: any) => {
      // Handle both Date objects and strings
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : typeof row.date === 'string' 
          ? row.date.split('T')[0]
          : null
          
      if (dateStr && dateMap.has(dateStr)) {
        const entry = dateMap.get(dateStr)!
        entry.avgViews = parseFloat(row.avg_views_per_video || '0')
      }
    })
    
    // Fill in listens data (use the larger of episode_listens or metrics_downloads)
    listensResult?.forEach((row: any) => {
      // Handle both Date objects and strings
      const dateStr = row.date instanceof Date 
        ? row.date.toISOString().split('T')[0]
        : typeof row.date === 'string' 
          ? row.date.split('T')[0]
          : null
          
      if (dateStr && dateMap.has(dateStr)) {
        const entry = dateMap.get(dateStr)!
        const episodeListens = parseInt(row.episode_listens || '0')
        const metricsDownloads = parseInt(row.metrics_downloads || '0')
        const totalListens = Math.max(episodeListens, metricsDownloads)
        const episodeCount = parseInt(row.episode_count || '1')
        
        // Calculate average per episode for the day
        entry.avgListens = episodeCount > 0 ? totalListens / episodeCount : totalListens
      }
    })
    
    // Convert map to array
    const days = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      avgViews: data.avgViews,
      avgListens: data.avgListens
    }))
    
    // Detect outliers for views and listens
    const viewsSeries = days
      .filter(d => d.avgViews !== null && d.avgViews > 0)
      .map(d => ({ date: d.date, value: d.avgViews! }))
    
    const listensSeries = days
      .filter(d => d.avgListens !== null && d.avgListens > 0)
      .map(d => ({ date: d.date, value: d.avgListens! }))
    
    const viewsOutliers = detectOutliers(viewsSeries, 2.0)
    const listensOutliers = detectOutliers(listensSeries, 2.0)
    
    // Build response
    const response = {
      days,
      outliers: {
        views: viewsOutliers.slice(0, 5), // Top 5 outliers
        listens: listensOutliers.slice(0, 5)
      },
      summary: {
        totalDays: days.length,
        daysWithViews: viewsSeries.length,
        daysWithListens: listensSeries.length,
        avgDailyViews: viewsSeries.length > 0 
          ? viewsSeries.reduce((sum, d) => sum + d.value, 0) / viewsSeries.length 
          : 0,
        avgDailyListens: listensSeries.length > 0
          ? listensSeries.reduce((sum, d) => sum + d.value, 0) / listensSeries.length
          : 0
      },
      metadata: {
        dateRange: { start: startDate, end: endDate },
        lastUpdated: new Date().toISOString(),
        correlationId
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error(`[${correlationId}] Daily trend error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get daily trend data',
        correlationId 
      },
      { status: 500 }
    )
  }
}