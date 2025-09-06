import { google } from 'googleapis'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

const youtube = google.youtube('v3')
const youtubeAnalytics = google.youtubeAnalytics('v2')

interface YouTubeCredentials {
  apiKey?: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
}

interface YouTubeAnalyticsData {
  videoId: string
  date: string
  views: number
  likes: number
  comments: number
  shares?: number
  subscribersGained?: number
  subscribersLost?: number
  watchTimeMinutes?: number
  averageViewDuration?: number
  averageViewPercentage?: number
  estimatedRevenue?: number
  impressions?: number
  clickThroughRate?: number
}

export class YouTubeAnalyticsService {
  private auth: any
  private orgSlug: string

  constructor(credentials: YouTubeCredentials, orgSlug: string) {
    this.orgSlug = orgSlug
    
    if (credentials.apiKey) {
      // API Key only (limited functionality)
      this.auth = credentials.apiKey
    } else if (credentials.clientId && credentials.clientSecret) {
      // OAuth2 (full functionality)
      this.auth = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret,
        process.env.NEXT_PUBLIC_APP_URL + '/api/youtube/callback'
      )
      
      if (credentials.accessToken) {
        this.auth.setCredentials({
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken
        })
      }
    }
  }

  /**
   * Get video analytics data from YouTube Analytics API
   */
  async getVideoAnalytics(
    videoId: string, 
    startDate: string, 
    endDate: string,
    channelId?: string
  ): Promise<YouTubeAnalyticsData[]> {
    try {
      console.log(`Getting analytics for video ${videoId} from ${startDate} to ${endDate}`)
      
      const response = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: channelId ? `channel==${channelId}` : 'channel==MINE',
        startDate,
        endDate,
        metrics: [
          'views',
          'likes',
          'comments',
          'shares',
          'subscribersGained',
          'subscribersLost',
          'estimatedWatchTime',
          'averageViewDuration',
          'averageViewPercentage',
          'impressions',
          'impressionClickThroughRate'
        ].join(','),
        dimensions: 'day,video',
        filters: `video==${videoId}`,
        sort: 'day'
      })

      if (!response.data.rows) {
        return []
      }

      return response.data.rows.map((row: any[]) => ({
        videoId,
        date: row[0], // day
        views: parseInt(row[2]) || 0,
        likes: parseInt(row[3]) || 0,
        comments: parseInt(row[4]) || 0,
        shares: parseInt(row[5]) || 0,
        subscribersGained: parseInt(row[6]) || 0,
        subscribersLost: parseInt(row[7]) || 0,
        watchTimeMinutes: Math.round((parseInt(row[8]) || 0) / 60), // Convert seconds to minutes
        averageViewDuration: parseInt(row[9]) || 0,
        averageViewPercentage: parseFloat(row[10]) || 0,
        impressions: parseInt(row[11]) || 0,
        clickThroughRate: parseFloat(row[12]) || 0
      }))
    } catch (error) {
      console.error(`Error getting analytics for video ${videoId}:`, error)
      return []
    }
  }

  /**
   * Get all videos for a channel
   */
  async getChannelVideos(channelId: string, maxResults = 50): Promise<string[]> {
    try {
      const response = await youtube.search.list({
        auth: this.auth,
        part: ['id'],
        channelId,
        type: 'video',
        maxResults,
        order: 'date'
      })

      return response.data.items?.map(item => item.id?.videoId).filter(Boolean) || []
    } catch (error) {
      console.error(`Error getting videos for channel ${channelId}:`, error)
      return []
    }
  }

  /**
   * Store analytics data in the database
   */
  async storeAnalyticsData(
    analyticsData: YouTubeAnalyticsData[],
    channelId?: string
  ): Promise<void> {
    if (analyticsData.length === 0) return

    const batchSize = 100
    for (let i = 0; i < analyticsData.length; i += batchSize) {
      const batch = analyticsData.slice(i, i + batchSize)
      
      const values = batch.map(data => `(
        '${uuidv4()}',
        '${this.orgSlug.replace(/[^a-zA-Z0-9]/g, '_')}',
        ${channelId ? `'${channelId}'` : 'NULL'},
        '${data.videoId}',
        '${data.date}',
        'day',
        ${data.views},
        ${data.impressions || 0},
        ${data.clickThroughRate || 0},
        ${data.likes},
        0, -- dislikes (deprecated by YouTube)
        ${data.comments},
        ${data.shares || 0},
        ${data.subscribersGained || 0},
        ${data.subscribersLost || 0},
        ${data.watchTimeMinutes || 0},
        ${data.averageViewDuration || 0},
        ${data.averageViewPercentage || 0},
        0, -- estimatedRevenue (requires monetization access)
        0, -- adImpressions (requires monetization access)
        0, -- cpm (requires monetization access)
        0, -- rpm (requires monetization access)
        '{}', -- trafficSources
        '{}', -- deviceTypes
        '{}', -- geography
        '{}', -- demographics
        NOW(),
        NOW()
      )`).join(',')

      const query = `
        INSERT INTO "YouTubeAnalytics" (
          id, "organizationId", "channelId", "videoId", date, period,
          views, impressions, "clickThroughRate", likes, dislikes, comments,
          shares, "subscribersGained", "subscribersLost", "watchTimeMinutes",
          "averageViewDuration", "averageViewPercentage", "estimatedRevenue",
          "adImpressions", cpm, rpm, "trafficSources", "deviceTypes",
          geography, demographics, "createdAt", "updatedAt"
        ) VALUES ${values}
        ON CONFLICT ("organizationId", "channelId", "videoId", date, period)
        DO UPDATE SET
          views = EXCLUDED.views,
          impressions = EXCLUDED.impressions,
          "clickThroughRate" = EXCLUDED."clickThroughRate",
          likes = EXCLUDED.likes,
          comments = EXCLUDED.comments,
          shares = EXCLUDED.shares,
          "subscribersGained" = EXCLUDED."subscribersGained",
          "subscribersLost" = EXCLUDED."subscribersLost",
          "watchTimeMinutes" = EXCLUDED."watchTimeMinutes",
          "averageViewDuration" = EXCLUDED."averageViewDuration",
          "averageViewPercentage" = EXCLUDED."averageViewPercentage",
          "updatedAt" = NOW()
      `

      const { error } = await safeQuerySchema(this.orgSlug, query, [])
      if (error) {
        console.error('Error storing analytics data:', error)
        throw error
      }
    }
  }

  /**
   * Backfill historical data for all videos
   */
  async backfillHistoricalData(
    daysBack: number = 90,
    channelId?: string
  ): Promise<{ success: number; errors: number }> {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    console.log(`Backfilling YouTube analytics from ${startDate} to ${endDate}`)

    // Get all YouTube videos from Episodes table
    const { data: episodes, error } = await safeQuerySchema(
      this.orgSlug,
      `SELECT DISTINCT "youtubeVideoId" 
       FROM "Episode" 
       WHERE "youtubeVideoId" IS NOT NULL 
         AND "youtubeViewCount" > 0`,
      []
    )

    if (error) {
      console.error('Error getting episodes:', error)
      throw error
    }

    const videoIds = episodes.map((ep: any) => ep.youtubeVideoId)
    console.log(`Found ${videoIds.length} videos to backfill`)

    let successCount = 0
    let errorCount = 0

    // Process videos in smaller batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize)
      
      for (const videoId of batch) {
        try {
          const analyticsData = await this.getVideoAnalytics(
            videoId,
            startDate,
            endDate,
            channelId
          )
          
          if (analyticsData.length > 0) {
            await this.storeAnalyticsData(analyticsData, channelId)
            successCount++
            console.log(`✓ Processed ${videoId}: ${analyticsData.length} data points`)
          }
          
          // Rate limiting: YouTube allows 100 requests per 100 seconds
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`Error processing video ${videoId}:`, error)
          errorCount++
        }
      }
    }

    console.log(`Backfill complete: ${successCount} successful, ${errorCount} errors`)
    return { success: successCount, errors: errorCount }
  }

  /**
   * Get analytics data from database with date filtering
   */
  async getStoredAnalytics(
    startDate?: string,
    endDate?: string,
    videoIds?: string[]
  ): Promise<any[]> {
    let whereClause = '1=1'
    const params: string[] = []
    let paramIndex = 1

    if (startDate) {
      whereClause += ` AND date >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }
    
    if (endDate) {
      whereClause += ` AND date <= $${paramIndex}`
      params.push(endDate)
      paramIndex++
    }
    
    if (videoIds && videoIds.length > 0) {
      const videoIdParams = videoIds.map((_, i) => `$${paramIndex + i}`).join(',')
      whereClause += ` AND "videoId" IN (${videoIdParams})`
      params.push(...videoIds)
    }

    const query = `
      SELECT 
        "videoId",
        date,
        SUM(views) as views,
        SUM(likes) as likes,
        SUM(comments) as comments,
        SUM(shares) as shares,
        SUM("subscribersGained") as "subscribersGained",
        SUM("subscribersLost") as "subscribersLost",
        SUM("watchTimeMinutes") as "watchTimeMinutes",
        AVG("averageViewDuration") as "averageViewDuration",
        AVG("averageViewPercentage") as "averageViewPercentage",
        SUM(impressions) as impressions,
        AVG("clickThroughRate") as "clickThroughRate"
      FROM "YouTubeAnalytics"
      WHERE ${whereClause}
      GROUP BY "videoId", date
      ORDER BY date DESC, "videoId"
    `

    const { data, error } = await safeQuerySchema(this.orgSlug, query, params)
    if (error) {
      console.error('Error getting stored analytics:', error)
      return []
    }

    return data || []
  }
}

/**
 * Factory function to create YouTube Analytics service
 */
export async function createYouTubeAnalyticsService(
  userId: string
): Promise<YouTubeAnalyticsService | null> {
  try {
    const orgSlug = await getUserOrgSlug(userId)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }

    // Get YouTube credentials from environment or database
    const credentials: YouTubeCredentials = {
      apiKey: process.env.YOUTUBE_API_KEY,
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET
    }

    if (!credentials.apiKey && !credentials.clientId) {
      console.warn('No YouTube API credentials configured')
      return null
    }

    return new YouTubeAnalyticsService(credentials, orgSlug)
  } catch (error) {
    console.error('Error creating YouTube Analytics service:', error)
    return null
  }
}