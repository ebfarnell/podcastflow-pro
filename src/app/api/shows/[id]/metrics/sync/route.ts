import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { createYouTubeAnalyticsService } from '@/services/youtube-analytics'
import crypto from 'crypto'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Decryption function for API keys
const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c'

function decrypt(text: string): string {
  try {
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
  } catch (error) {
    console.error('Failed to decrypt API key:', error)
    throw new Error('Failed to decrypt API key')
  }
}

// POST /api/shows/[id]/metrics/sync - Sync YouTube Analytics data for a show
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master', 'producer'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get request options
    const body = await request.json().catch(() => ({}))
    const daysBack = body.daysBack || 30
    
    // Get show's YouTube channel ID and episodes with YouTube video IDs
    const showQuery = `
      SELECT 
        s.id,
        s.name,
        s."youtubeChannelId",
        s."youtubeChannelUrl"
      FROM "Show" s
      WHERE s.id = $1
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

    const show = showData[0]
    const channelId = show.youtubeChannelId

    if (!channelId) {
      return NextResponse.json(
        { error: 'Show does not have a YouTube channel configured' },
        { status: 400 }
      )
    }

    // Get episodes with YouTube video IDs
    const episodesQuery = `
      SELECT 
        e.id,
        e.title,
        e."youtubeVideoId",
        e."youtubeViewCount"
      FROM "Episode" e
      WHERE e."showId" = $1 
        AND e."youtubeVideoId" IS NOT NULL
      ORDER BY e."airDate" DESC
      LIMIT 100
    `
    const { data: episodes } = await safeQuerySchema<any>(
      orgSlug,
      episodesQuery,
      [showId]
    )

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({
        message: 'No episodes with YouTube video IDs found',
        showName: show.name,
        channelId
      })
    }

    // Get YouTube API configuration from database
    const prisma = await import('@/lib/db/prisma').then(m => m.default)
    const youtubeConfig = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId }
    })
    
    if (!youtubeConfig || !youtubeConfig.apiKey) {
      return NextResponse.json(
        { error: 'YouTube API not configured. Please go to Settings > Integrations and configure your YouTube API key.' },
        { status: 400 }
      )
    }

    // Check quota limits
    if (youtubeConfig.quotaLimit && youtubeConfig.quotaUsed >= youtubeConfig.quotaLimit) {
      const resetAt = youtubeConfig.quotaResetAt
      const resetTime = resetAt ? new Date(resetAt).toLocaleString() : 'unknown'
      
      return NextResponse.json(
        { 
          error: 'YouTube API quota exceeded',
          details: {
            quotaUsed: youtubeConfig.quotaUsed,
            quotaLimit: youtubeConfig.quotaLimit,
            resetAt: resetTime
          }
        },
        { status: 429 }
      )
    }

    // Decrypt the API key before using it
    let decryptedApiKey: string
    try {
      decryptedApiKey = decrypt(youtubeConfig.apiKey)
      console.log('Successfully decrypted YouTube API key')
    } catch (error) {
      console.error('Failed to decrypt YouTube API key:', error)
      return NextResponse.json(
        { error: 'Failed to decrypt YouTube API key. Please reconfigure in Settings > Integrations.' },
        { status: 500 }
      )
    }

    // Create YouTube Data service with decrypted API key
    // Data API v3 supports API keys and provides view counts, likes, comments
    const { YouTubeDataService } = await import('@/services/youtube-data')
    const youtubeDataService = new YouTubeDataService(decryptedApiKey, orgSlug)
    
    // Also check if we have OAuth2 credentials for Analytics API
    // Analytics API provides VTR (averageViewPercentage) and detailed metrics
    let youtubeAnalyticsService = null
    let hasOAuth2 = false
    
    if (youtubeConfig.accessToken && youtubeConfig.refreshToken) {
      try {
        const { YouTubeAnalyticsService } = await import('@/services/youtube-analytics')
        youtubeAnalyticsService = new YouTubeAnalyticsService(
          { 
            clientId: youtubeConfig.clientId,
            clientSecret: youtubeConfig.clientSecret,
            accessToken: youtubeConfig.accessToken,
            refreshToken: youtubeConfig.refreshToken
          },
          orgSlug
        )
        hasOAuth2 = true
        console.log('OAuth2 credentials available - will fetch VTR data')
      } catch (error) {
        console.log('OAuth2 not configured - will use Data API only')
      }
    }

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    console.log(`Syncing YouTube Data for ${show.name}`)
    console.log(`Found ${episodes.length} episodes with YouTube video IDs`)
    console.log(`Using: Data API (view counts) ${hasOAuth2 ? '+ Analytics API (VTR)' : ''}`)

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    let vtrData: Map<string, number> = new Map()
    
    try {
      // Collect all video IDs
      const videoIds = episodes.map(ep => ep.youtubeVideoId).filter(Boolean)
      
      // STEP 1: Get basic statistics using Data API v3 (works with API key)
      console.log(`Fetching view counts for ${videoIds.length} videos...`)
      const videoStats = await youtubeDataService.getVideoStatistics(videoIds)
      
      if (videoStats && videoStats.length > 0) {
        // Store the basic statistics in the database
        await youtubeDataService.storeVideoStatistics(videoStats, showId)
        successCount = videoStats.length
        console.log(`✓ Successfully synced view counts for ${successCount} videos`)
      }
      
      // STEP 2: If OAuth2 is available, get VTR data from Analytics API
      if (hasOAuth2 && youtubeAnalyticsService) {
        console.log('Fetching VTR (view-through rate) data using Analytics API...')
        
        for (const videoId of videoIds.slice(0, 10)) { // Limit to 10 videos for now to avoid quota
          try {
            const analyticsData = await youtubeAnalyticsService.getVideoAnalytics(
              videoId,
              startDate,
              endDate,
              channelId
            )
            
            if (analyticsData && analyticsData.length > 0) {
              // Get the latest VTR value
              const latestVtr = analyticsData[analyticsData.length - 1].averageViewPercentage
              if (latestVtr) {
                vtrData.set(videoId, latestVtr)
              }
            }
            
            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.log(`Could not fetch VTR for video ${videoId}:`, error)
          }
        }
        
        // Update episodes with VTR data
        if (vtrData.size > 0) {
          console.log(`Updating VTR for ${vtrData.size} videos...`)
          for (const [videoId, vtr] of vtrData.entries()) {
            const updateVtrQuery = `
              UPDATE "Episode"
              SET 
                "youtubeVtr" = $1,
                "updatedAt" = NOW()
              WHERE "youtubeVideoId" = $2 AND "showId" = $3
            `
            await safeQuerySchema(orgSlug, updateVtrQuery, [vtr, videoId, showId])
          }
          console.log(`✓ Updated VTR data for ${vtrData.size} videos`)
        }
      }
      
      // STEP 3: Get channel statistics if we have a channel ID
      if (channelId) {
        console.log(`Fetching channel statistics for ${channelId}...`)
        const channelStats = await youtubeDataService.getChannelStatistics(channelId)
        
        if (channelStats) {
          // Update show with channel statistics
          const updateShowChannelQuery = `
            UPDATE "Show"
            SET 
              "youtubeSubscriberCount" = $1,
              "youtubeChannelViewCount" = $2,
              "youtubeVideoCount" = $3,
              "youtubeLastSyncAt" = NOW(),
              "updatedAt" = NOW()
            WHERE id = $4
          `
          await safeQuerySchema(
            orgSlug,
            updateShowChannelQuery,
            [channelStats.subscriberCount, channelStats.viewCount, channelStats.videoCount, showId]
          )
          console.log(`✓ Updated channel statistics`)
        }
      }
      
    } catch (error) {
      console.error('Error syncing YouTube data:', error)
      errors.push(error instanceof Error ? error.message : 'Unknown error')
      errorCount++
    }

    // Update show's last sync time
    const updateShowQuery = `
      UPDATE "Show"
      SET 
        "youtubeLastSyncAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
    `
    await safeQuerySchema(orgSlug, updateShowQuery, [showId])

    // Update quota usage
    const quotaUsed = successCount * 3 // Approximate quota cost per video
    await prisma.youTubeApiConfig.update({
      where: { id: youtubeConfig.id },
      data: {
        quotaUsed: {
          increment: quotaUsed
        }
      }
    })

    // Calculate summary metrics from synced data
    const summaryQuery = `
      WITH video_stats AS (
        SELECT 
          ya."videoId",
          MAX(ya.views) as total_views,
          MAX(ya.likes) as total_likes,
          MAX(ya.comments) as total_comments,
          AVG(ya."averageViewPercentage") as avg_vtr,
          AVG(ya."averageViewDuration") as avg_duration,
          MAX(ya."subscribersGained") - MAX(ya."subscribersLost") as net_subscribers
        FROM "YouTubeAnalytics" ya
        JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
        WHERE e."showId" = $1
          AND ya.date >= $2::date
        GROUP BY ya."videoId"
      )
      SELECT 
        COUNT(DISTINCT "videoId") as videos_synced,
        COALESCE(SUM(total_views), 0) as total_views,
        COALESCE(AVG(total_views), 0) as avg_views,
        COALESCE(AVG(avg_vtr), 0) as avg_vtr,
        COALESCE(SUM(total_likes), 0) as total_likes,
        COALESCE(SUM(total_comments), 0) as total_comments,
        COALESCE(SUM(net_subscribers), 0) as net_subscribers
      FROM video_stats
    `
    const { data: summaryData } = await safeQuerySchema<any>(
      orgSlug,
      summaryQuery,
      [showId, startDate]
    )

    const summary = summaryData?.[0] || {}

    return NextResponse.json({
      success: true,
      message: hasOAuth2 
        ? 'YouTube sync completed with full metrics' 
        : 'YouTube sync completed (view counts only - OAuth2 required for VTR)',
      showName: show.name,
      channelId,
      dateRange: {
        start: startDate,
        end: endDate
      },
      dataSource: {
        viewCounts: true,
        vtrData: hasOAuth2,
        vtrVideosProcessed: vtrData.size,
        oauth2Status: hasOAuth2 ? 'configured' : 'not_configured',
        oauth2Message: !hasOAuth2 
          ? 'Configure OAuth2 in Settings > Integrations > YouTube to sync VTR data'
          : undefined
      },
      results: {
        episodesProcessed: episodes.length,
        successfulSyncs: successCount,
        failedSyncs: errorCount,
        errors: errors.length > 0 ? errors : undefined
      },
      metrics: {
        videosSynced: successCount,
        totalViews: summary.total_views || 0,
        avgViewsPerVideo: Math.round(summary.avg_views || 0),
        avgViewPercentage: vtrData.size > 0 
          ? (Array.from(vtrData.values()).reduce((a, b) => a + b, 0) / vtrData.size).toFixed(1)
          : null,
        totalLikes: summary.total_likes || 0,
        totalComments: summary.total_comments || 0,
        netSubscribers: summary.net_subscribers || 0
      }
    })

  } catch (error) {
    console.error('YouTube sync error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync YouTube Analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/shows/[id]/metrics/sync - Get last sync status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get show's last sync info and current metrics
    const query = `
      WITH show_info AS (
        SELECT 
          s.name,
          s."youtubeChannelId",
          s."youtubeLastSyncAt"
        FROM "Show" s
        WHERE s.id = $1
      ),
      latest_metrics AS (
        SELECT 
          COUNT(DISTINCT ya."videoId") as synced_videos,
          MAX(ya."updatedAt") as last_data_update,
          SUM(ya.views) as total_views,
          AVG(ya."averageViewPercentage") as avg_vtr
        FROM "YouTubeAnalytics" ya
        JOIN "Episode" e ON e."youtubeVideoId" = ya."videoId"
        WHERE e."showId" = $1
      )
      SELECT 
        si.name,
        si."youtubeChannelId",
        si."youtubeLastSyncAt",
        lm.synced_videos,
        lm.last_data_update,
        lm.total_views,
        lm.avg_vtr
      FROM show_info si
      CROSS JOIN latest_metrics lm
    `
    
    const { data } = await safeQuerySchema<any>(orgSlug, query, [showId])
    
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    const info = data[0]

    return NextResponse.json({
      showName: info.name,
      channelId: info.youtubeChannelId,
      lastSyncAt: info.youtubeLastSyncAt,
      lastDataUpdate: info.last_data_update,
      metrics: {
        syncedVideos: info.synced_videos || 0,
        totalViews: info.total_views || 0,
        avgViewPercentage: parseFloat(info.avg_vtr || 0).toFixed(1)
      }
    })

  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}