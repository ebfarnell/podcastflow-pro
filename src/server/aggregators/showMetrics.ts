/**
 * Show Metrics Aggregator
 * 
 * Combines and normalizes data from YouTube and Megaphone database tables
 * into a unified response format for the View Details page
 */

import { safeQuerySchema } from '@/lib/db/schema-db'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

export interface ShowMetricsRequest {
  orgId: string
  orgSlug: string
  showId: string
  window: '30d' | '90d' | 'custom'
  startDate?: string
  endDate?: string
}

export interface ShowMetricsResponse {
  show: {
    id: string
    name: string
    externalIds: {
      youtubeChannelId?: string
      youtubePlaylistId?: string
      megaphoneShowId?: string
    }
  }
  totals: {
    youtubeViews: number | null
    megaphoneDownloads: number | null
    likes: number | null
    comments: number | null
    avgViewDurationSec: number | null
    uniqueViewers: number | null
    uniqueListeners: number | null
    subscriberCount: number | null
  }
  timeseries: {
    daily: Array<{
      date: string
      youtubeViews?: number
      megaphoneDownloads?: number
      likes?: number
      comments?: number
      uniqueListeners?: number
    }>
  }
  engagement: {
    likeRate: number | null // likes/views percentage
    commentRate: number | null // comments/views percentage
    viewThroughRate: number | null // average view percentage
    listenThroughRate: number | null // average listen percentage
  }
  freshness: {
    youtubeUpdatedAt?: string
    megaphoneUpdatedAt?: string
  }
  status: {
    youtubeConnected: boolean
    megaphoneConnected: boolean
    youtubeOAuthRequired: boolean
    partialData: boolean
    errors: string[]
  }
}

export class ShowMetricsAggregator {
  private orgId: string
  private orgSlug: string
  
  constructor(orgId: string, orgSlug: string) {
    this.orgId = orgId
    this.orgSlug = orgSlug
  }

  /**
   * Aggregate metrics from database sources
   */
  async getShowMetrics(request: ShowMetricsRequest): Promise<ShowMetricsResponse> {
    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(request)

    // Fetch show information with external IDs
    const showInfo = await this.fetchShowInfo(request.orgSlug, request.showId)

    // Initialize response
    const response: ShowMetricsResponse = {
      show: showInfo,
      totals: {
        youtubeViews: null,
        megaphoneDownloads: null,
        likes: null,
        comments: null,
        avgViewDurationSec: null,
        uniqueViewers: null,
        uniqueListeners: null,
        subscriberCount: null,
      },
      timeseries: { daily: [] },
      engagement: {
        likeRate: null,
        commentRate: null,
        viewThroughRate: null,
        listenThroughRate: null,
      },
      freshness: {},
      status: {
        youtubeConnected: false, // Will be set based on data availability
        megaphoneConnected: false, // Will be set based on data availability
        youtubeOAuthRequired: false,
        partialData: false,
        errors: [],
      }
    }

    // Check if we have YouTube data in the database
    const hasYouTubeData = await this.checkYouTubeDataAvailability(request.showId)
    response.status.youtubeConnected = hasYouTubeData
    
    // Fetch YouTube metrics from database
    if (hasYouTubeData) {
      try {
        const youtubeData = await this.fetchYouTubeMetrics(
          request.showId,
          startDate,
          endDate
        )
        
        // Merge YouTube data into response
        response.totals.youtubeViews = youtubeData.totalViews
        response.totals.likes = youtubeData.totalLikes
        response.totals.comments = youtubeData.totalComments
        response.totals.avgViewDurationSec = youtubeData.avgViewDurationSec
        response.totals.subscriberCount = youtubeData.subscriberCount
        
        // Calculate engagement rates
        if (youtubeData.totalViews > 0) {
          response.engagement.likeRate = (youtubeData.totalLikes / youtubeData.totalViews) * 100
          response.engagement.commentRate = (youtubeData.totalComments / youtubeData.totalViews) * 100
        }
        response.engagement.viewThroughRate = youtubeData.viewThroughRate
        
        response.freshness.youtubeUpdatedAt = new Date().toISOString()
        
        // Add to timeseries
        youtubeData.dailyStats.forEach(day => {
          const existing = response.timeseries.daily.find(d => d.date === day.date)
          if (existing) {
            existing.youtubeViews = day.views
            existing.likes = day.likes
            existing.comments = day.comments
          } else {
            response.timeseries.daily.push({
              date: day.date,
              youtubeViews: day.views,
              likes: day.likes,
              comments: day.comments,
            })
          }
        })
      } catch (error: any) {
        console.error('YouTube metrics fetch failed:', error)
        response.status.errors.push(`YouTube: ${error.message}`)
        response.status.partialData = true
      }
    }

    // Check if we have Megaphone data in the database
    const hasMegaphoneData = await this.checkMegaphoneDataAvailability(request.showId)
    response.status.megaphoneConnected = hasMegaphoneData
    
    // Fetch Megaphone metrics from database
    if (hasMegaphoneData) {
      try {
        const megaphoneData = await this.fetchMegaphoneMetrics(
          request.showId,
          startDate,
          endDate
        )
        
        // Merge Megaphone data into response
        response.totals.megaphoneDownloads = megaphoneData.totalDownloads
        response.totals.uniqueListeners = megaphoneData.uniqueListeners
        response.engagement.listenThroughRate = megaphoneData.listenThroughRate
        
        response.freshness.megaphoneUpdatedAt = new Date().toISOString()
        
        // Add to timeseries
        megaphoneData.dailyStats.forEach(day => {
          const existing = response.timeseries.daily.find(d => d.date === day.date)
          if (existing) {
            existing.megaphoneDownloads = day.downloads
            existing.uniqueListeners = day.uniqueListeners
          } else {
            response.timeseries.daily.push({
              date: day.date,
              megaphoneDownloads: day.downloads,
              uniqueListeners: day.uniqueListeners,
            })
          }
        })
      } catch (error: any) {
        console.error('Megaphone metrics fetch failed:', error)
        response.status.errors.push(`Megaphone: ${error.message}`)
        response.status.partialData = true
      }
    }

    // Sort timeseries by date
    response.timeseries.daily.sort((a, b) => a.date.localeCompare(b.date))

    // Fill gaps in timeseries with nulls
    response.timeseries.daily = this.fillTimeseriesGaps(
      response.timeseries.daily,
      startDate,
      endDate
    )

    // Set partial data flag if one source is missing
    if ((response.status.youtubeConnected && !response.totals.youtubeViews) ||
        (response.status.megaphoneConnected && !response.totals.megaphoneDownloads)) {
      response.status.partialData = true
    }

    return response
  }

  /**
   * Fetch show information from database
   */
  private async fetchShowInfo(orgSlug: string, showId: string): Promise<ShowMetricsResponse['show']> {
    const query = `
      SELECT 
        id,
        name,
        "youtubeChannelId",
        "youtubePlaylistId",
        "megaphonePodcastId"
      FROM "Show"
      WHERE id = $1
    `
    
    const { data: showResult } = await safeQuerySchema(orgSlug, query, [showId])
    
    if (!showResult?.[0]) {
      throw new Error('Show not found')
    }
    
    const show = showResult[0]
    
    return {
      id: show.id,
      name: show.name,
      externalIds: {
        youtubeChannelId: show.youtubeChannelId,
        youtubePlaylistId: show.youtubePlaylistId,
        megaphoneShowId: show.megaphonePodcastId,
      }
    }
  }

  /**
   * Fetch YouTube metrics from database
   */
  private async fetchYouTubeMetrics(
    showId: string,
    startDate: string,
    endDate: string
  ) {
    // Check if we have YouTubeAnalytics data
    const analyticsQuery = `
      SELECT 
        SUM(ya.views) as total_views,
        SUM(ya.likes) as total_likes,
        SUM(ya.comments) as total_comments,
        AVG(ya."averageViewDuration") as avg_view_duration,
        AVG(ya."averageViewPercentage") as avg_view_percentage,
        COUNT(DISTINCT ya."videoId") as video_count
      FROM "YouTubeAnalytics" ya
      JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
      WHERE e."showId" = $1 
        AND ya.date >= $2::date 
        AND ya.date <= $3::date
    `
    
    const { data: analyticsResult } = await safeQuerySchema(
      this.orgSlug,
      analyticsQuery,
      [showId, startDate, endDate]
    )
    
    const analytics = analyticsResult?.[0]
    
    // Get daily timeseries data
    const timeseriesQuery = `
      SELECT 
        ya.date::text as date,
        SUM(ya.views) as views,
        SUM(ya.likes) as likes,
        SUM(ya.comments) as comments
      FROM "YouTubeAnalytics" ya
      JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
      WHERE e."showId" = $1 
        AND ya.date >= $2::date 
        AND ya.date <= $3::date
      GROUP BY ya.date
      ORDER BY ya.date
    `
    
    const { data: timeseriesResult } = await safeQuerySchema(
      this.orgSlug,
      timeseriesQuery,
      [showId, startDate, endDate]
    )
    
    // If no analytics data, fall back to Episode snapshots
    if (!analytics?.total_views) {
      const episodeQuery = `
        SELECT 
          SUM(e."youtubeViewCount") as total_views,
          SUM(e."youtubeLikeCount") as total_likes,
          SUM(e."youtubeCommentCount") as total_comments,
          COUNT(DISTINCT e.id) as video_count
        FROM "Episode" e
        WHERE e."showId" = $1 
          AND e.status = 'published'
          AND e."airDate" >= $2::date 
          AND e."airDate" <= $3::date
      `
      
      const { data: episodeResult } = await safeQuerySchema(
        this.orgSlug,
        episodeQuery,
        [showId, startDate, endDate]
      )
      
      const episodeData = episodeResult?.[0]
      
      return {
        totalViews: parseInt(episodeData?.total_views || '0'),
        totalLikes: parseInt(episodeData?.total_likes || '0'),
        totalComments: parseInt(episodeData?.total_comments || '0'),
        avgViewDurationSec: 0,
        viewThroughRate: null,
        subscriberCount: null,
        dailyStats: timeseriesResult || []
      }
    }
    
    return {
      totalViews: parseInt(analytics.total_views || '0'),
      totalLikes: parseInt(analytics.total_likes || '0'),
      totalComments: parseInt(analytics.total_comments || '0'),
      avgViewDurationSec: Math.round(analytics.avg_view_duration || 0),
      viewThroughRate: analytics.avg_view_percentage || null,
      subscriberCount: null, // Would need channel data
      dailyStats: timeseriesResult?.map(row => ({
        date: row.date,
        views: parseInt(row.views || '0'),
        likes: parseInt(row.likes || '0'),
        comments: parseInt(row.comments || '0')
      })) || []
    }
  }

  /**
   * Fetch Megaphone metrics from database
   */
  private async fetchMegaphoneMetrics(
    showId: string,
    startDate: string,
    endDate: string
  ) {
    // Get aggregated episode downloads
    const episodeQuery = `
      SELECT 
        SUM(e."megaphoneDownloads") as total_downloads,
        AVG(e."megaphoneDownloads") as avg_downloads,
        MAX(e."megaphoneUniqueListeners") as unique_listeners,
        AVG(e."megaphoneCompletionRate") as avg_completion_rate,
        COUNT(DISTINCT e.id) as episode_count
      FROM "Episode" e
      WHERE e."showId" = $1 
        AND e.status = 'published'
        AND e."airDate" >= $2::date 
        AND e."airDate" <= $3::date
        AND e."megaphoneDownloads" IS NOT NULL
    `
    
    const { data: episodeResult } = await safeQuerySchema(
      this.orgSlug,
      episodeQuery,
      [showId, startDate, endDate]
    )
    
    const episodeData = episodeResult?.[0]
    
    // Get daily metrics if available
    const dailyQuery = `
      SELECT 
        date::text as date,
        downloads,
        listeners as unique_listeners
      FROM "ShowMetricsDaily"
      WHERE "showId" = $1
        AND date >= $2::date
        AND date <= $3::date
      ORDER BY date
    `
    
    const { data: dailyResult } = await safeQuerySchema(
      this.orgSlug,
      dailyQuery,
      [showId, startDate, endDate]
    )
    
    return {
      totalDownloads: parseInt(episodeData?.total_downloads || '0'),
      uniqueListeners: parseInt(episodeData?.unique_listeners || '0'),
      listenThroughRate: parseFloat(episodeData?.avg_completion_rate || '0') || null,
      dailyStats: dailyResult?.map(row => ({
        date: row.date,
        downloads: parseInt(row.downloads || '0'),
        uniqueListeners: parseInt(row.unique_listeners || '0')
      })) || []
    }
  }

  /**
   * Check if YouTube data is available for this show
   */
  private async checkYouTubeDataAvailability(showId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM "Episode" e
      WHERE e."showId" = $1
        AND (e."youtubeViewCount" IS NOT NULL 
          OR e."youtubeVideoId" IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM "YouTubeAnalytics" ya 
            WHERE ya."videoId" = e."youtubeVideoId"
          ))
      LIMIT 1
    `
    
    const { data } = await safeQuerySchema(this.orgSlug, query, [showId])
    return (data?.[0]?.count || 0) > 0
  }

  /**
   * Check if Megaphone data is available for this show
   */
  private async checkMegaphoneDataAvailability(showId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM "Episode" e
      WHERE e."showId" = $1
        AND e."megaphoneDownloads" IS NOT NULL
      LIMIT 1
    `
    
    const { data } = await safeQuerySchema(this.orgSlug, query, [showId])
    return (data?.[0]?.count || 0) > 0
  }

  /**
   * Calculate date range based on window
   */
  private calculateDateRange(request: ShowMetricsRequest): { startDate: string; endDate: string } {
    const now = new Date()
    let startDate: Date
    let endDate: Date = endOfDay(now)
    
    switch (request.window) {
      case '30d':
        startDate = startOfDay(subDays(now, 30))
        break
      case '90d':
        startDate = startOfDay(subDays(now, 90))
        break
      case 'custom':
        if (!request.startDate || !request.endDate) {
          throw new Error('Custom date range requires startDate and endDate')
        }
        startDate = new Date(request.startDate)
        endDate = new Date(request.endDate)
        break
      default:
        startDate = startOfDay(subDays(now, 30))
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    }
  }

  /**
   * Fill gaps in timeseries data
   */
  private fillTimeseriesGaps(
    data: Array<{ date: string; [key: string]: any }>,
    startDate: string,
    endDate: string
  ): Array<{ date: string; [key: string]: any }> {
    const filled: Array<{ date: string; [key: string]: any }> = []
    const dataMap = new Map(data.map(d => [d.date, d]))
    
    const current = new Date(startDate)
    const end = new Date(endDate)
    
    while (current <= end) {
      const dateStr = format(current, 'yyyy-MM-dd')
      const existing = dataMap.get(dateStr)
      
      if (existing) {
        filled.push(existing)
      } else {
        // Add empty entry for missing date
        filled.push({ date: dateStr })
      }
      
      current.setDate(current.getDate() + 1)
    }
    
    return filled
  }
}