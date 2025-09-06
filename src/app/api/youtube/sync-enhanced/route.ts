import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { YouTubeAnalyticsEnhanced } from '@/lib/youtube/youtube-analytics-enhanced'
import { google } from 'googleapis'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/youtube/sync-enhanced - Enhanced YouTube sync with retention and real-time data
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { showId, videoId, syncType = 'all' } = await request.json()
    
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get organization ID
    const orgQuery = `SELECT id FROM "Organization" WHERE slug = $1`
    const { data: orgData } = await safeQuerySchema<any>('public', orgQuery, [orgSlug])
    const organizationId = orgData?.[0]?.id

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // If videoId provided, sync single video
    if (videoId) {
      const result = await syncSingleVideo(orgSlug, organizationId, videoId, syncType)
      return NextResponse.json(result)
    }

    // If showId provided, sync all videos for the show
    if (showId) {
      const result = await syncShowVideos(orgSlug, organizationId, showId, syncType)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Either videoId or showId is required' }, { status: 400 })

  } catch (error) {
    console.error('Enhanced sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync YouTube data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function syncSingleVideo(orgSlug: string, organizationId: string, videoId: string, syncType: string) {
  try {
    // Check if we have OAuth credentials for this org
    const credQuery = `
      SELECT * FROM "YouTubeChannel"
      WHERE "organizationId" = $1 
        AND "isActive" = true
      LIMIT 1
    `
    const { data: channelData } = await safeQuerySchema<any>(orgSlug, credQuery, [organizationId])
    
    if (!channelData || channelData.length === 0) {
      // Use API key for basic data only
      return await syncWithApiKey(orgSlug, organizationId, videoId)
    }

    // Use OAuth for full analytics
    const channel = channelData[0]
    const auth = new google.auth.OAuth2()
    
    // Decrypt tokens (assuming they're encrypted)
    const accessToken = channel.accessToken // In production, decrypt this
    const refreshToken = channel.refreshToken // In production, decrypt this
    
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    const analytics = new YouTubeAnalyticsEnhanced(auth, orgSlug, organizationId)
    
    // Perform comprehensive sync based on type
    let result: any = {}
    
    if (syncType === 'all' || syncType === 'retention') {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      result.retention = await analytics.fetchRetentionData(videoId, startDate, endDate)
    }
    
    if (syncType === 'all' || syncType === 'realtime') {
      result.realTime = await analytics.fetchRealTimeMetrics(videoId)
    }
    
    if (syncType === 'all' || syncType === 'traffic') {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      result.traffic = await analytics.fetchTrafficSources(videoId, startDate, endDate)
    }
    
    if (syncType === 'all' || syncType === 'cards') {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      result.cards = await analytics.fetchCardMetrics(videoId, startDate, endDate)
    }

    // Log sync completion
    const logQuery = `
      INSERT INTO "YouTubeSyncLog" 
      ("organizationId", "channelId", "syncType", status, "itemsSynced", message, "createdAt")
      VALUES ($1, $2, $3, 'completed', 1, $4, NOW())
    `
    await safeQuerySchema(orgSlug, logQuery, [
      organizationId,
      channel.channelId,
      `enhanced-${syncType}`,
      `Successfully synced ${syncType} metrics for video ${videoId}`
    ])

    return {
      success: true,
      videoId,
      syncType,
      data: result,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('Error syncing single video:', error)
    throw error
  }
}

async function syncShowVideos(orgSlug: string, organizationId: string, showId: string, syncType: string) {
  try {
    // Get all YouTube episodes for the show
    const episodesQuery = `
      SELECT e.id, e."youtubeVideoId", e.title
      FROM "Episode" e
      WHERE e."showId" = $1 
        AND e."youtubeVideoId" IS NOT NULL
      ORDER BY e."airDate" DESC
      LIMIT 50
    `
    const { data: episodes } = await safeQuerySchema<any>(orgSlug, episodesQuery, [showId])
    
    if (!episodes || episodes.length === 0) {
      return {
        success: false,
        message: 'No YouTube episodes found for this show'
      }
    }

    const results = []
    const errors = []
    
    // Sync each video (limit concurrency to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize)
      const promises = batch.map((episode: any) => 
        syncSingleVideo(orgSlug, organizationId, episode.youtubeVideoId, syncType)
          .catch(err => {
            errors.push({ videoId: episode.youtubeVideoId, error: err.message })
            return null
          })
      )
      
      const batchResults = await Promise.all(promises)
      results.push(...batchResults.filter(Boolean))
      
      // Add delay to avoid rate limits
      if (i + batchSize < episodes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return {
      success: true,
      showId,
      syncType,
      videosProcessed: results.length,
      totalVideos: episodes.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('Error syncing show videos:', error)
    throw error
  }
}

async function syncWithApiKey(orgSlug: string, organizationId: string, videoId: string) {
  try {
    // Get API key from config
    const configQuery = `
      SELECT "apiKey" FROM "YouTubeApiConfig"
      WHERE "organizationId" = $1
    `
    const { data: configData } = await safeQuerySchema<any>('public', configQuery, [organizationId])
    
    if (!configData || !configData[0]?.apiKey) {
      return {
        success: false,
        message: 'YouTube API not configured. Please connect a YouTube channel for full analytics.'
      }
    }

    // With API key, we can only get basic public data
    const youtube = google.youtube('v3')
    const response = await youtube.videos.list({
      key: configData[0].apiKey, // In production, decrypt this
      part: ['statistics', 'snippet', 'contentDetails'],
      id: [videoId]
    })

    if (!response.data.items || response.data.items.length === 0) {
      return {
        success: false,
        message: 'Video not found'
      }
    }

    const video = response.data.items[0]
    
    // Update basic metrics in Episode table
    const updateQuery = `
      UPDATE "Episode"
      SET 
        "youtubeViewCount" = $1,
        "youtubeLikeCount" = $2,
        "youtubeCommentCount" = $3,
        "updatedAt" = NOW()
      WHERE "youtubeVideoId" = $4
    `
    
    await safeQuerySchema(orgSlug, updateQuery, [
      video.statistics?.viewCount || '0',
      video.statistics?.likeCount || '0',
      video.statistics?.commentCount || '0',
      videoId
    ])

    return {
      success: true,
      videoId,
      syncType: 'basic',
      data: {
        views: video.statistics?.viewCount,
        likes: video.statistics?.likeCount,
        comments: video.statistics?.commentCount,
        title: video.snippet?.title,
        publishedAt: video.snippet?.publishedAt
      },
      message: 'Basic metrics synced. Connect YouTube channel for full analytics including retention and traffic data.',
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('Error with API key sync:', error)
    throw error
  }
}