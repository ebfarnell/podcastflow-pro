/**
 * YouTube Service Layer with Quota Management
 * 
 * Provides unified access to YouTube Data API and Analytics API with:
 * - Organization-scoped credentials
 * - Quota tracking and enforcement
 * - Caching for expensive operations
 * - Error handling and retry logic
 * - Multi-tenant isolation
 */

import { google, youtube_v3, youtubeAnalytics_v2 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { YouTubeQuotaManager, YouTubeEndpoint } from '@/lib/youtube/quota-manager'
import { v4 as uuidv4 } from 'uuid'
import { addHours, subDays, format } from 'date-fns'

// Cache durations
const CACHE_DURATIONS = {
  CHANNEL_STATS: 12 * 60 * 60 * 1000,  // 12 hours
  PLAYLIST_INFO: 12 * 60 * 60 * 1000,  // 12 hours  
  VIDEO_STATS: 30 * 60 * 1000,         // 30 minutes
  ANALYTICS: 10 * 60 * 1000,           // 10 minutes
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  initialDelay: 1000,
  maxDelay: 5000,
  jitterFactor: 0.3,
}

export interface YouTubeCredentials {
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
}

export interface ChannelStats {
  channelId: string
  title: string
  description?: string
  subscriberCount: number
  viewCount: number
  videoCount: number
  customUrl?: string
  thumbnailUrl?: string
  country?: string
  fetchedAt: Date
}

export interface VideoStats {
  videoId: string
  title: string
  description?: string
  publishedAt: Date
  duration: string // ISO 8601 duration
  viewCount: number
  likeCount: number
  dislikeCount?: number // Deprecated by YouTube
  commentCount: number
  favoriteCount: number
  thumbnailUrl?: string
  tags?: string[]
  categoryId?: string
  fetchedAt: Date
}

export interface PlaylistItem {
  videoId: string
  position: number
  title: string
  description?: string
  publishedAt: Date
  thumbnailUrl?: string
}

export interface AnalyticsTimeseries {
  date: string
  views: number
  estimatedMinutesWatched?: number
  averageViewDuration?: number
  averageViewPercentage?: number
  likes?: number
  dislikes?: number
  comments?: number
  shares?: number
  subscribersGained?: number
  subscribersLost?: number
}

export interface AnalyticsMetrics {
  totalViews: number
  totalEstimatedMinutesWatched: number
  averageViewDuration: number
  averageViewPercentage: number
  totalLikes: number
  totalComments: number
  totalShares: number
  subscribersGained: number
  subscribersLost: number
  timeseries: AnalyticsTimeseries[]
}

export class YouTubeService {
  private orgId: string
  private orgSlug: string
  private quotaManager: YouTubeQuotaManager
  private youtubeClient?: youtube_v3.Youtube
  private analyticsClient?: youtubeAnalytics_v2.Youtubeanalytics
  private oauthClient?: OAuth2Client
  private credentials?: YouTubeCredentials
  private cache: Map<string, { data: any; expiresAt: number }> = new Map()

  constructor(orgId: string, orgSlug: string) {
    this.orgId = orgId
    this.orgSlug = orgSlug
    this.quotaManager = new YouTubeQuotaManager(orgSlug)
  }

  /**
   * Initialize the service with organization credentials
   */
  async initialize(): Promise<void> {
    // Fetch organization YouTube credentials
    const credQuery = `
      SELECT 
        "youtubeApiKey",
        "youtubeAccessToken",
        "youtubeRefreshToken",
        "googleClientId",
        "googleClientSecret"
      FROM "Organization"
      WHERE id = $1
    `
    
    const { data: credResult } = await safeQuerySchema(
      this.orgSlug,
      credQuery,
      [this.orgId]
    )

    if (!credResult?.[0]) {
      throw new Error('Organization credentials not found')
    }

    const creds = credResult[0]
    this.credentials = {
      apiKey: creds.youtubeApiKey,
      accessToken: creds.youtubeAccessToken,
      refreshToken: creds.youtubeRefreshToken,
      clientId: creds.googleClientId,
      clientSecret: creds.googleClientSecret,
    }

    // Initialize YouTube Data API client (works with API key)
    if (this.credentials.apiKey) {
      this.youtubeClient = google.youtube({
        version: 'v3',
        auth: this.credentials.apiKey,
      })
    }

    // Initialize OAuth client for Analytics API
    if (this.credentials.clientId && this.credentials.clientSecret) {
      this.oauthClient = new OAuth2Client(
        this.credentials.clientId,
        this.credentials.clientSecret
      )

      if (this.credentials.refreshToken) {
        this.oauthClient.setCredentials({
          refresh_token: this.credentials.refreshToken,
          access_token: this.credentials.accessToken,
        })

        // Also create Analytics client
        this.analyticsClient = google.youtubeAnalytics({
          version: 'v2',
          auth: this.oauthClient,
        })

        // Create OAuth-authenticated YouTube client for private data
        this.youtubeClient = google.youtube({
          version: 'v3',
          auth: this.oauthClient,
        })
      }
    }
  }

  /**
   * Get channel statistics with caching
   */
  async getChannelStats(channelId: string): Promise<ChannelStats | null> {
    const cacheKey = `channel:${channelId}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!this.youtubeClient) {
      throw new Error('YouTube client not initialized')
    }

    // Check quota before making request
    const quotaCheck = await this.quotaManager.checkQuota('channels.list', 2) // snippet + statistics
    if (!quotaCheck.allowed) {
      throw new Error(`YouTube quota exceeded: ${quotaCheck.message}`)
    }

    try {
      const response = await this.retryWithJitter(async () => {
        return this.youtubeClient!.channels.list({
          part: ['snippet', 'statistics'],
          id: [channelId],
        })
      })

      // Record quota usage
      await this.quotaManager.recordUsage('channels.list', 2)

      if (!response.data.items?.length) {
        return null
      }

      const channel = response.data.items[0]
      const stats: ChannelStats = {
        channelId: channel.id!,
        title: channel.snippet?.title || '',
        description: channel.snippet?.description,
        subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
        viewCount: parseInt(channel.statistics?.viewCount || '0'),
        videoCount: parseInt(channel.statistics?.videoCount || '0'),
        customUrl: channel.snippet?.customUrl,
        thumbnailUrl: channel.snippet?.thumbnails?.high?.url,
        country: channel.snippet?.country,
        fetchedAt: new Date(),
      }

      this.setCache(cacheKey, stats, CACHE_DURATIONS.CHANNEL_STATS)
      return stats
    } catch (error) {
      console.error('Failed to fetch channel stats:', error)
      throw error
    }
  }

  /**
   * Get playlist items with pagination support
   */
  async getPlaylistItems(
    playlistId: string, 
    options?: { pageToken?: string; maxResults?: number }
  ): Promise<{ items: PlaylistItem[]; nextPageToken?: string }> {
    if (!this.youtubeClient) {
      throw new Error('YouTube client not initialized')
    }

    // Check quota
    const quotaCheck = await this.quotaManager.checkQuota('playlistItems.list', 1)
    if (!quotaCheck.allowed) {
      throw new Error(`YouTube quota exceeded: ${quotaCheck.message}`)
    }

    try {
      const response = await this.retryWithJitter(async () => {
        return this.youtubeClient!.playlistItems.list({
          part: ['snippet'],
          playlistId,
          maxResults: options?.maxResults || 50,
          pageToken: options?.pageToken,
        })
      })

      await this.quotaManager.recordUsage('playlistItems.list', 1)

      const items: PlaylistItem[] = (response.data.items || []).map(item => ({
        videoId: item.snippet?.resourceId?.videoId || '',
        position: item.snippet?.position || 0,
        title: item.snippet?.title || '',
        description: item.snippet?.description,
        publishedAt: new Date(item.snippet?.publishedAt || Date.now()),
        thumbnailUrl: item.snippet?.thumbnails?.high?.url,
      }))

      return {
        items,
        nextPageToken: response.data.nextPageToken || undefined,
      }
    } catch (error) {
      console.error('Failed to fetch playlist items:', error)
      throw error
    }
  }

  /**
   * Get video statistics for multiple videos
   */
  async getVideosStats(videoIds: string[]): Promise<VideoStats[]> {
    if (!this.youtubeClient || videoIds.length === 0) {
      return []
    }

    // Check cache first
    const uncachedIds: string[] = []
    const cachedStats: VideoStats[] = []

    for (const videoId of videoIds) {
      const cached = this.getFromCache(`video:${videoId}`)
      if (cached) {
        cachedStats.push(cached)
      } else {
        uncachedIds.push(videoId)
      }
    }

    if (uncachedIds.length === 0) {
      return cachedStats
    }

    // YouTube allows up to 50 video IDs per request
    const chunks = []
    for (let i = 0; i < uncachedIds.length; i += 50) {
      chunks.push(uncachedIds.slice(i, i + 50))
    }

    const allStats: VideoStats[] = [...cachedStats]

    for (const chunk of chunks) {
      // 3 parts: snippet, statistics, contentDetails
      const quotaCheck = await this.quotaManager.checkQuota('videos.list', 3)
      if (!quotaCheck.allowed) {
        console.warn(`Quota limit reached, returning partial results. ${quotaCheck.message}`)
        break
      }

      try {
        const response = await this.retryWithJitter(async () => {
          return this.youtubeClient!.videos.list({
            part: ['snippet', 'statistics', 'contentDetails'],
            id: chunk,
          })
        })

        await this.quotaManager.recordUsage('videos.list', 3)

        for (const video of response.data.items || []) {
          const stats: VideoStats = {
            videoId: video.id!,
            title: video.snippet?.title || '',
            description: video.snippet?.description,
            publishedAt: new Date(video.snippet?.publishedAt || Date.now()),
            duration: video.contentDetails?.duration || 'PT0S',
            viewCount: parseInt(video.statistics?.viewCount || '0'),
            likeCount: parseInt(video.statistics?.likeCount || '0'),
            dislikeCount: video.statistics?.dislikeCount ? 
              parseInt(video.statistics.dislikeCount) : undefined,
            commentCount: parseInt(video.statistics?.commentCount || '0'),
            favoriteCount: parseInt(video.statistics?.favoriteCount || '0'),
            thumbnailUrl: video.snippet?.thumbnails?.high?.url,
            tags: video.snippet?.tags,
            categoryId: video.snippet?.categoryId,
            fetchedAt: new Date(),
          }

          allStats.push(stats)
          this.setCache(`video:${stats.videoId}`, stats, CACHE_DURATIONS.VIDEO_STATS)
        }
      } catch (error) {
        console.error('Failed to fetch video stats for chunk:', error)
        // Continue with other chunks
      }
    }

    return allStats
  }

  /**
   * Get analytics timeseries data (requires OAuth)
   */
  async getAnalyticsTimeseries(
    channelId: string,
    startDate: string,
    endDate: string,
    metrics: string[] = ['views', 'estimatedMinutesWatched', 'averageViewDuration', 'likes', 'comments']
  ): Promise<AnalyticsMetrics | null> {
    if (!this.analyticsClient || !this.oauthClient) {
      console.warn('Analytics API not available - OAuth not configured')
      return null
    }

    const cacheKey = `analytics:${channelId}:${startDate}:${endDate}:${metrics.join(',')}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    // Check quota
    const quotaCheck = await this.quotaManager.checkQuota('reports.query', 1)
    if (!quotaCheck.allowed) {
      throw new Error(`YouTube quota exceeded: ${quotaCheck.message}`)
    }

    try {
      // Refresh token if needed
      const tokens = await this.oauthClient.getAccessToken()
      if (tokens.token) {
        this.oauthClient.setCredentials({ access_token: tokens.token })
      }

      const response = await this.retryWithJitter(async () => {
        return this.analyticsClient!.reports.query({
          ids: `channel==${channelId}`,
          startDate,
          endDate,
          metrics: metrics.join(','),
          dimensions: 'day',
          sort: 'day',
        })
      })

      await this.quotaManager.recordUsage('reports.query', 1)

      if (!response.data.rows) {
        return null
      }

      // Parse the response
      const timeseries: AnalyticsTimeseries[] = response.data.rows.map((row: any) => {
        const result: AnalyticsTimeseries = {
          date: row[0], // First column is always the dimension (day)
          views: 0,
        }

        // Map metrics to result based on column headers
        response.data.columnHeaders?.forEach((header: any, index: number) => {
          if (index === 0) return // Skip dimension column
          
          const value = row[index]
          switch (header.name) {
            case 'views':
              result.views = value
              break
            case 'estimatedMinutesWatched':
              result.estimatedMinutesWatched = value
              break
            case 'averageViewDuration':
              result.averageViewDuration = value
              break
            case 'averageViewPercentage':
              result.averageViewPercentage = value
              break
            case 'likes':
              result.likes = value
              break
            case 'dislikes':
              result.dislikes = value
              break
            case 'comments':
              result.comments = value
              break
            case 'shares':
              result.shares = value
              break
            case 'subscribersGained':
              result.subscribersGained = value
              break
            case 'subscribersLost':
              result.subscribersLost = value
              break
          }
        })

        return result
      })

      // Calculate totals
      const analyticsData: AnalyticsMetrics = {
        totalViews: timeseries.reduce((sum, d) => sum + d.views, 0),
        totalEstimatedMinutesWatched: timeseries.reduce((sum, d) => sum + (d.estimatedMinutesWatched || 0), 0),
        averageViewDuration: timeseries.reduce((sum, d) => sum + (d.averageViewDuration || 0), 0) / timeseries.length,
        averageViewPercentage: timeseries.reduce((sum, d) => sum + (d.averageViewPercentage || 0), 0) / timeseries.length,
        totalLikes: timeseries.reduce((sum, d) => sum + (d.likes || 0), 0),
        totalComments: timeseries.reduce((sum, d) => sum + (d.comments || 0), 0),
        totalShares: timeseries.reduce((sum, d) => sum + (d.shares || 0), 0),
        subscribersGained: timeseries.reduce((sum, d) => sum + (d.subscribersGained || 0), 0),
        subscribersLost: timeseries.reduce((sum, d) => sum + (d.subscribersLost || 0), 0),
        timeseries,
      }

      this.setCache(cacheKey, analyticsData, CACHE_DURATIONS.ANALYTICS)
      return analyticsData
    } catch (error: any) {
      if (error.code === 401 || error.code === 403) {
        console.error('OAuth token expired or invalid:', error.message)
        // Clear OAuth tokens in database
        await this.clearOAuthTokens()
        return null
      }
      console.error('Failed to fetch analytics:', error)
      throw error
    }
  }

  /**
   * Clear OAuth tokens when they expire
   */
  private async clearOAuthTokens(): Promise<void> {
    const updateQuery = `
      UPDATE "Organization"
      SET 
        "youtubeAccessToken" = NULL,
        "youtubeRefreshToken" = NULL,
        "updatedAt" = NOW()
      WHERE id = $1
    `
    
    await safeQuerySchema(this.orgSlug, updateQuery, [this.orgId])
  }

  /**
   * Helper: Retry with exponential backoff and jitter
   */
  private async retryWithJitter<T>(
    fn: () => Promise<T>,
    retries = RETRY_CONFIG.maxRetries
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Don't retry on quota errors or auth errors
        if (error.code === 403 || error.code === 401) {
          throw error
        }
        
        // Retry on 429 (rate limit) or 5xx errors
        if (i < retries && (error.code === 429 || error.code >= 500)) {
          const baseDelay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, i),
            RETRY_CONFIG.maxDelay
          )
          const jitter = baseDelay * RETRY_CONFIG.jitterFactor * Math.random()
          const delay = baseDelay + jitter
          
          console.log(`Retrying after ${delay}ms (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          throw error
        }
      }
    }
    
    throw lastError
  }

  /**
   * Cache helpers
   */
  private getFromCache(key: string): any {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  private setCache(key: string, data: any, duration: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + duration,
    })
  }

  /**
   * Check if YouTube is connected (has valid credentials)
   */
  isConnected(): boolean {
    return !!(this.credentials?.apiKey || this.credentials?.refreshToken)
  }

  /**
   * Check if OAuth is configured (for private metrics)
   */
  hasOAuth(): boolean {
    return !!(this.credentials?.refreshToken && this.oauthClient)
  }
}