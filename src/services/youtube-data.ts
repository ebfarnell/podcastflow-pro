import { google } from 'googleapis'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

const youtube = google.youtube('v3')

interface YouTubeVideoStats {
  videoId: string
  viewCount: number
  likeCount: number
  commentCount: number
  favoriteCount: number
  title?: string
  description?: string
  publishedAt?: string
  duration?: string
  thumbnailUrl?: string
}

export class YouTubeDataService {
  private apiKey: string
  private orgSlug: string

  constructor(apiKey: string, orgSlug: string) {
    this.apiKey = apiKey
    this.orgSlug = orgSlug
  }

  /**
   * Get video statistics from YouTube Data API v3
   * This works with API keys and provides view counts, likes, comments
   */
  async getVideoStatistics(videoIds: string[]): Promise<YouTubeVideoStats[]> {
    try {
      if (videoIds.length === 0) return []

      // YouTube API allows up to 50 video IDs per request
      const chunks = []
      for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50))
      }

      const allStats: YouTubeVideoStats[] = []

      for (const chunk of chunks) {
        const response = await youtube.videos.list({
          key: this.apiKey,
          part: ['statistics', 'snippet', 'contentDetails'],
          id: chunk
        })

        if (response.data.items) {
          for (const item of response.data.items) {
            if (item.id && item.statistics) {
              allStats.push({
                videoId: item.id,
                viewCount: parseInt(item.statistics.viewCount || '0'),
                likeCount: parseInt(item.statistics.likeCount || '0'),
                commentCount: parseInt(item.statistics.commentCount || '0'),
                favoriteCount: parseInt(item.statistics.favoriteCount || '0'),
                title: item.snippet?.title,
                description: item.snippet?.description,
                publishedAt: item.snippet?.publishedAt,
                duration: item.contentDetails?.duration,
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url
              })
            }
          }
        }
      }

      return allStats
    } catch (error) {
      console.error('Error fetching video statistics:', error)
      throw error
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelStatistics(channelId: string) {
    try {
      const response = await youtube.channels.list({
        key: this.apiKey,
        part: ['statistics', 'snippet'],
        id: [channelId]
      })

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0]
        return {
          channelId: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
          viewCount: parseInt(channel.statistics?.viewCount || '0'),
          videoCount: parseInt(channel.statistics?.videoCount || '0')
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching channel statistics:', error)
      throw error
    }
  }

  /**
   * Store video statistics in the database
   */
  async storeVideoStatistics(stats: YouTubeVideoStats[], showId: string): Promise<void> {
    if (stats.length === 0) return

    try {
      // Update episodes with the latest view counts
      for (const stat of stats) {
        const updateQuery = `
          UPDATE "Episode"
          SET 
            "youtubeViewCount" = $1,
            "youtubeLikeCount" = $2,
            "youtubeCommentCount" = $3,
            "youtubeLastSyncAt" = NOW(),
            "updatedAt" = NOW()
          WHERE "youtubeVideoId" = $4 AND "showId" = $5
        `
        
        await safeQuerySchema(
          this.orgSlug,
          updateQuery,
          [stat.viewCount, stat.likeCount, stat.commentCount, stat.videoId, showId]
        )
      }

      // Store historical data in YouTubeMetrics table
      const metricsQuery = `
        INSERT INTO "YouTubeMetrics" (
          id, "videoId", "date", "viewCount", "likeCount", "commentCount", 
          "favoriteCount", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT ("videoId", "date") DO UPDATE SET
          "viewCount" = EXCLUDED."viewCount",
          "likeCount" = EXCLUDED."likeCount",
          "commentCount" = EXCLUDED."commentCount",
          "favoriteCount" = EXCLUDED."favoriteCount",
          "updatedAt" = NOW()
      `

      const today = new Date().toISOString().split('T')[0]
      
      for (const stat of stats) {
        await safeQuerySchema(
          this.orgSlug,
          metricsQuery,
          [
            uuidv4(),
            stat.videoId,
            today,
            stat.viewCount,
            stat.likeCount,
            stat.commentCount,
            stat.favoriteCount
          ]
        )
      }
    } catch (error) {
      console.error('Error storing video statistics:', error)
      throw error
    }
  }
}