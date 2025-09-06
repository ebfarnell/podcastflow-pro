/**
 * YouTube Data API v3 Service
 * 
 * This service handles both public (API key) and private (OAuth) access to YouTube data.
 * It supports multi-tenant architecture with isolated data per organization and multiple
 * YouTube channel connections per organization.
 * 
 * Public Access: Uses API key for read-only access to public video/channel/playlist data
 * Private Access: Uses OAuth 2.0 for accessing private analytics and channel management
 */

import { google } from 'googleapis'
import crypto from 'crypto'
import prisma from '@/lib/db/prisma'
import { querySchema } from '@/lib/db/schema-db'

const youtube = google.youtube('v3')
const oauth2Client = new google.auth.OAuth2()

// Encryption for sensitive data
const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c'
const IV_LENGTH = 16

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

export class YouTubeService {
  /**
   * Get or create API configuration for an organization
   */
  static async getApiConfig(organizationId: string) {
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId }
    })

    if (!config || !config.apiKey) {
      throw new Error('YouTube API not configured for this organization')
    }

    // Check and reset quota if needed
    const now = new Date()
    if (!config.quotaResetAt || config.quotaResetAt < now) {
      await prisma.youTubeApiConfig.update({
        where: { id: config.id },
        data: {
          quotaUsed: 0,
          quotaResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
        }
      })
    }

    return {
      ...config,
      apiKey: decrypt(config.apiKey),
      clientSecret: config.clientSecret ? decrypt(config.clientSecret) : null
    }
  }

  /**
   * PUBLIC DATA ACCESS - No authentication required
   * Get public information about a YouTube video
   */
  static async getPublicVideoInfo(organizationId: string, videoId: string) {
    const config = await this.getApiConfig(organizationId)
    
    try {
      const response = await youtube.videos.list({
        key: config.apiKey,
        part: ['snippet', 'statistics', 'contentDetails'],
        id: [videoId]
      })

      // Update quota usage
      await this.updateQuotaUsage(config.id, 5) // Videos.list costs ~5 units

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found')
      }

      const video = response.data.items[0]
      
      // Cache the video data in the organization's schema
      const orgSlug = await this.getOrgSlug(organizationId)
      const cacheQuery = `
        INSERT INTO "YouTubeVideo" 
        ("videoId", "organizationId", "title", "description", "thumbnailUrl", 
         "publishedAt", "duration", "viewCount", "likeCount", "commentCount", 
         "tags", "categoryId", "privacyStatus", "metadata", "lastFetched")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT ("videoId") DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          "viewCount" = EXCLUDED."viewCount",
          "likeCount" = EXCLUDED."likeCount",
          "commentCount" = EXCLUDED."commentCount",
          "lastFetched" = NOW()
        RETURNING *
      `
      
      await querySchema(orgSlug, cacheQuery, [
        videoId,
        organizationId,
        video.snippet?.title,
        video.snippet?.description,
        video.snippet?.thumbnails?.high?.url,
        video.snippet?.publishedAt,
        video.contentDetails?.duration,
        parseInt(video.statistics?.viewCount || '0'),
        parseInt(video.statistics?.likeCount || '0'),
        parseInt(video.statistics?.commentCount || '0'),
        video.snippet?.tags || [],
        video.snippet?.categoryId,
        video.status?.privacyStatus,
        JSON.stringify(video)
      ])

      return {
        id: videoId,
        title: video.snippet?.title,
        description: video.snippet?.description,
        thumbnail: video.snippet?.thumbnails?.high?.url,
        publishedAt: video.snippet?.publishedAt,
        duration: video.contentDetails?.duration,
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        commentCount: parseInt(video.statistics?.commentCount || '0'),
        tags: video.snippet?.tags || [],
        channelId: video.snippet?.channelId,
        channelTitle: video.snippet?.channelTitle,
        categoryId: video.snippet?.categoryId,
        privacyStatus: video.status?.privacyStatus
      }
    } catch (error) {
      console.error('Error fetching video info:', error)
      throw error
    }
  }

  /**
   * PUBLIC DATA ACCESS
   * Get public channel information
   */
  static async getPublicChannelInfo(organizationId: string, channelId: string) {
    const config = await this.getApiConfig(organizationId)
    
    try {
      const response = await youtube.channels.list({
        key: config.apiKey,
        part: ['snippet', 'statistics', 'contentDetails'],
        id: [channelId]
      })

      await this.updateQuotaUsage(config.id, 5)

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Channel not found')
      }

      const channel = response.data.items[0]

      return {
        id: channelId,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        thumbnail: channel.snippet?.thumbnails?.high?.url,
        customUrl: channel.snippet?.customUrl,
        publishedAt: channel.snippet?.publishedAt,
        viewCount: parseInt(channel.statistics?.viewCount || '0'),
        subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
        videoCount: parseInt(channel.statistics?.videoCount || '0'),
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads
      }
    } catch (error) {
      console.error('Error fetching channel info:', error)
      throw error
    }
  }

  /**
   * PUBLIC DATA ACCESS
   * Search for videos
   */
  static async searchVideos(organizationId: string, query: string, maxResults = 10) {
    const config = await this.getApiConfig(organizationId)
    
    try {
      const response = await youtube.search.list({
        key: config.apiKey,
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults
      })

      await this.updateQuotaUsage(config.id, 100) // Search is expensive

      return response.data.items?.map(item => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.high?.url,
        channelId: item.snippet?.channelId,
        channelTitle: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt
      })) || []
    } catch (error) {
      console.error('Error searching videos:', error)
      throw error
    }
  }

  /**
   * PRIVATE DATA ACCESS - OAuth Required
   * Get OAuth URL for connecting a YouTube channel
   */
  static async getOAuthUrl(organizationId: string, userId: string, connectionName?: string) {
    const config = await this.getApiConfig(organizationId)
    
    if (!config.clientId || !config.clientSecret) {
      throw new Error('OAuth not configured for this organization')
    }

    oauth2Client.setCredentials({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
    })

    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
      'https://www.googleapis.com/auth/userinfo.email' // Add email scope to get account info
    ]

    // Include state to track organization, user, and connection name
    const state = Buffer.from(JSON.stringify({
      organizationId,
      userId,
      connectionName: connectionName || 'YouTube Connection',
      timestamp: Date.now()
    })).toString('base64')

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent' // Force consent to ensure refresh token
    })
  }

  /**
   * PRIVATE DATA ACCESS
   * Handle OAuth callback and store tokens
   */
  static async handleOAuthCallback(code: string, state: string) {
    const { organizationId, userId, connectionName } = JSON.parse(Buffer.from(state, 'base64').toString())
    const config = await this.getApiConfig(organizationId)

    oauth2Client.setCredentials({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
    })

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get channel info
    const channelResponse = await youtube.channels.list({
      auth: oauth2Client,
      part: ['snippet'],
      mine: true
    })

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      throw new Error('No YouTube channel found for authenticated user')
    }

    const channel = channelResponse.data.items[0]
    const orgSlug = await this.getOrgSlug(organizationId)

    // Store channel connection with encrypted tokens
    const insertQuery = `
      INSERT INTO "YouTubeChannel" 
      ("organizationId", "channelId", "channelTitle", "channelDescription", 
       "channelThumbnail", "connectedBy", "accessToken", "refreshToken", 
       "tokenExpiry", "scope", "isActive")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT ("channelId", "organizationId") DO UPDATE SET
        "accessToken" = EXCLUDED."accessToken",
        "refreshToken" = EXCLUDED."refreshToken",
        "tokenExpiry" = EXCLUDED."tokenExpiry",
        "isActive" = true,
        "updatedAt" = NOW()
      RETURNING *
    `

    const result = await querySchema(orgSlug, insertQuery, [
      organizationId,
      channel.id,
      channel.snippet?.title,
      channel.snippet?.description,
      channel.snippet?.thumbnails?.high?.url,
      userId,
      encrypt(tokens.access_token!),
      encrypt(tokens.refresh_token!),
      new Date(tokens.expiry_date!),
      tokens.scope?.split(' ') || []
    ])

    return result[0]
  }

  /**
   * PRIVATE DATA ACCESS
   * Get authenticated channel analytics
   */
  static async getChannelAnalytics(
    organizationId: string, 
    channelId: string, 
    startDate: Date, 
    endDate: Date
  ) {
    const orgSlug = await this.getOrgSlug(organizationId)
    
    // Get channel OAuth tokens
    const channelQuery = `
      SELECT * FROM "YouTubeChannel" 
      WHERE "channelId" = $1 AND "organizationId" = $2 AND "isActive" = true
    `
    const channels = await querySchema<any>(orgSlug, channelQuery, [channelId, organizationId])
    
    if (channels.length === 0) {
      throw new Error('YouTube channel not connected')
    }

    const channel = channels[0]
    
    // Check token expiry and refresh if needed
    if (new Date(channel.tokenExpiry) < new Date()) {
      await this.refreshChannelToken(orgSlug, channel)
    }

    // Set up OAuth client with channel's tokens
    oauth2Client.setCredentials({
      access_token: decrypt(channel.accessToken),
      refresh_token: decrypt(channel.refreshToken)
    })

    // Get analytics using YouTube Analytics API
    const analyticsResponse = await google.youtubeAnalytics('v2').reports.query({
      auth: oauth2Client,
      ids: `channel==${channelId}`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,dislikes,comments,shares,subscribersGained,subscribersLost,estimatedRevenue',
      dimensions: 'day'
    })

    // Store analytics data
    if (analyticsResponse.data.rows) {
      for (const row of analyticsResponse.data.rows) {
        const [date, ...metrics] = row
        const insertAnalyticsQuery = `
          INSERT INTO "YouTubeAnalytics"
          ("channelId", "organizationId", "date", "views", "estimatedMinutesWatched",
           "averageViewDuration", "likes", "dislikes", "comments", "shares",
           "subscribersGained", "subscribersLost", "estimatedRevenue")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT ("channelId", "videoId", "date") DO UPDATE SET
            views = EXCLUDED.views,
            "estimatedMinutesWatched" = EXCLUDED."estimatedMinutesWatched",
            "averageViewDuration" = EXCLUDED."averageViewDuration",
            likes = EXCLUDED.likes,
            dislikes = EXCLUDED.dislikes,
            comments = EXCLUDED.comments,
            shares = EXCLUDED.shares,
            "subscribersGained" = EXCLUDED."subscribersGained",
            "subscribersLost" = EXCLUDED."subscribersLost",
            "estimatedRevenue" = EXCLUDED."estimatedRevenue"
        `
        
        await querySchema(orgSlug, insertAnalyticsQuery, [
          channelId, organizationId, date, ...metrics
        ])
      }
    }

    return analyticsResponse.data
  }

  /**
   * PRIVATE DATA ACCESS
   * Get video analytics for authenticated channel
   */
  static async getVideoAnalytics(
    organizationId: string,
    channelId: string,
    videoId: string,
    startDate: Date,
    endDate: Date
  ) {
    const orgSlug = await this.getOrgSlug(organizationId)
    
    // Verify channel connection and get tokens
    const channelQuery = `
      SELECT * FROM "YouTubeChannel" 
      WHERE "channelId" = $1 AND "organizationId" = $2 AND "isActive" = true
    `
    const channels = await querySchema<any>(orgSlug, channelQuery, [channelId, organizationId])
    
    if (channels.length === 0) {
      throw new Error('YouTube channel not connected')
    }

    const channel = channels[0]
    
    // Refresh token if needed
    if (new Date(channel.tokenExpiry) < new Date()) {
      await this.refreshChannelToken(orgSlug, channel)
    }

    oauth2Client.setCredentials({
      access_token: decrypt(channel.accessToken),
      refresh_token: decrypt(channel.refreshToken)
    })

    // Get video-specific analytics
    const analyticsResponse = await google.youtubeAnalytics('v2').reports.query({
      auth: oauth2Client,
      ids: `channel==${channelId}`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,estimatedRevenue',
      dimensions: 'day',
      filters: `video==${videoId}`
    })

    return analyticsResponse.data
  }

  /**
   * Get all connected YouTube channels for an organization
   */
  static async getConnectedChannels(organizationId: string) {
    const orgSlug = await this.getOrgSlug(organizationId)
    
    const query = `
      SELECT id, "channelId", title, description, 
             "thumbnailUrl", "subscriberCount", "videoCount", 
             "viewCount", "isActive", "createdAt", "updatedAt"
      FROM "YouTubeChannel"
      WHERE "isActive" = true
      ORDER BY "createdAt" DESC
    `
    
    return querySchema(orgSlug, query, [])
  }

  /**
   * Disconnect a YouTube channel
   */
  static async disconnectChannel(organizationId: string, channelId: string) {
    const orgSlug = await this.getOrgSlug(organizationId)
    
    const query = `
      UPDATE "YouTubeChannel"
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "channelId" = $1
    `
    
    await querySchema(orgSlug, query, [channelId])
  }

  /**
   * Helper: Refresh OAuth token for a channel
   */
  private static async refreshChannelToken(orgSlug: string, channel: any) {
    const config = await this.getApiConfig(channel.organizationId)
    
    oauth2Client.setCredentials({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decrypt(channel.refreshToken)
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    
    // Update stored tokens
    const updateQuery = `
      UPDATE "YouTubeChannel"
      SET "accessToken" = $1, "tokenExpiry" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `
    
    await querySchema(orgSlug, updateQuery, [
      encrypt(credentials.access_token!),
      new Date(credentials.expiry_date!),
      channel.id
    ])

    return credentials
  }

  /**
   * Helper: Get organization slug
   */
  private static async getOrgSlug(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true }
    })
    
    if (!org) throw new Error('Organization not found')
    return org.slug
  }

  /**
   * Helper: Update API quota usage
   */
  private static async updateQuotaUsage(configId: string, units: number) {
    await prisma.youTubeApiConfig.update({
      where: { id: configId },
      data: {
        quotaUsed: { increment: units }
      }
    })
  }
}