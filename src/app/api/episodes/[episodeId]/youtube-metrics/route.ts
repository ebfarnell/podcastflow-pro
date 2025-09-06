import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { YouTubeDataService } from '@/services/youtube-data'
import { YouTubeAnalyticsService } from '@/services/youtube-analytics'

export async function GET(
  request: NextRequest,
  { params }: { params: { episodeId: string } }
) {
  try {
    // Check authentication
    const session = await getSessionFromCookie(request)
    if (!session?.userId) {
      // For YouTube episodes, return mock data if not authenticated
      const episodeIdLower = params.episodeId?.toLowerCase() || ''
      if (episodeIdLower.includes('youtube')) {
        return NextResponse.json({
          videoId: null,
          isYouTubeEpisode: true,
          hasApiKey: false,
          metrics: {
            viewCount: 0,
            likeCount: 0,
            commentCount: 0,
            favoriteCount: 0,
            watchTimeMinutes: 0,
            averageViewDuration: 0,
            averageViewPercentage: 0,
            subscribersGained: 0,
            impressions: 0,
            clickThroughRate: 0
          },
          message: 'YouTube metrics require authentication'
        })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { episodeId } = params
    
    // Get organization slug for the user
    const orgSlug = session.organizationSlug || await getUserOrgSlug(session.userId)
    
    console.log('YouTube metrics API - Session:', { userId: session.userId, orgSlug })
    
    if (!orgSlug) {
      console.error('YouTube metrics API - No organization found for user:', session.userId)
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get episode details to extract YouTube video ID
    const { data: episode, error: episodeError } = await safeQuerySchema(
      orgSlug,
      async (db) => {
        return db.episode.findUnique({
          where: { id: episodeId },
          include: {
            Show: {
              select: {
                name: true,
                youtubeChannelId: true,
                youtubeApiKey: true
              }
            }
          }
        })
      },
      { id: episodeId }
    )

    if (episodeError || !episode) {
      console.error('YouTube metrics API - Episode not found:', { episodeId, orgSlug, error: episodeError })
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Check if this is a YouTube episode
    const isYouTubeEpisode = episode.publishUrl && 
      (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be'))

    if (!isYouTubeEpisode) {
      return NextResponse.json({ 
        error: 'Not a YouTube episode',
        isYouTubeEpisode: false 
      }, { status: 400 })
    }

    // Extract video ID from YouTube URL
    let videoId = null
    if (episode.publishUrl.includes('youtube.com/watch?v=')) {
      videoId = episode.publishUrl.split('v=')[1]?.split('&')[0]
    } else if (episode.publishUrl.includes('youtu.be/')) {
      videoId = episode.publishUrl.split('youtu.be/')[1]?.split('?')[0]
    }

    if (!videoId) {
      return NextResponse.json({ 
        error: 'Could not extract YouTube video ID',
        url: episode.publishUrl 
      }, { status: 400 })
    }

    // Use API key from show settings or environment variable
    const apiKey = episode.Show?.youtubeApiKey || process.env.YOUTUBE_API_KEY
    
    if (!apiKey) {
      // Return mock data if no API key is configured
      console.log('No YouTube API key configured, returning mock data')
      return NextResponse.json({
        videoId,
        isYouTubeEpisode: true,
        hasApiKey: false,
        metrics: {
          // Basic metrics from YouTube Data API
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          favoriteCount: 0,
          
          // Additional metrics (would require YouTube Analytics API)
          watchTimeMinutes: 0,
          averageViewDuration: 0,
          averageViewPercentage: 0,
          subscribersGained: 0,
          impressions: 0,
          clickThroughRate: 0,
          
          // Metadata
          title: episode.title,
          publishedAt: episode.releaseDate,
          duration: episode.duration,
          thumbnailUrl: episode.thumbnailUrl
        },
        message: 'YouTube API key not configured. Please add YOUTUBE_API_KEY to environment variables or configure in show settings.'
      })
    }

    try {
      // Initialize YouTube Data Service
      const youtubeService = new YouTubeDataService(apiKey, orgSlug)
      
      // Get basic video statistics
      const videoStats = await youtubeService.getVideoStatistics([videoId])
      
      if (videoStats.length === 0) {
        return NextResponse.json({
          videoId,
          isYouTubeEpisode: true,
          hasApiKey: true,
          metrics: null,
          error: 'Video not found on YouTube'
        }, { status: 404 })
      }

      const stats = videoStats[0]

      // Get time range for analytics
      const searchParams = request.nextUrl.searchParams
      const period = searchParams.get('period') || '30d'
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(startDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(startDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        default:
          startDate.setDate(startDate.getDate() - 30)
      }

      // Format dates for YouTube Analytics API
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      // Try to get detailed analytics if we have OAuth credentials
      let analyticsData = null
      if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
        try {
          const analyticsService = new YouTubeAnalyticsService({
            clientId: process.env.YOUTUBE_CLIENT_ID,
            clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
            accessToken: session.youtubeAccessToken, // If stored in session
            refreshToken: session.youtubeRefreshToken
          }, orgSlug)

          analyticsData = await analyticsService.getVideoAnalytics(
            videoId,
            startDateStr,
            endDateStr,
            episode.Show?.youtubeChannelId
          )
        } catch (analyticsError) {
          console.log('Could not fetch YouTube Analytics data:', analyticsError)
          // Continue without analytics data
        }
      }

      // Combine data from both APIs
      const metrics = {
        // Basic metrics from YouTube Data API
        viewCount: stats.viewCount,
        likeCount: stats.likeCount,
        commentCount: stats.commentCount,
        favoriteCount: stats.favoriteCount,
        
        // Additional metrics from Analytics API (if available)
        watchTimeMinutes: analyticsData?.[0]?.watchTimeMinutes || 0,
        averageViewDuration: analyticsData?.[0]?.averageViewDuration || 0,
        averageViewPercentage: analyticsData?.[0]?.averageViewPercentage || 0,
        subscribersGained: analyticsData?.[0]?.subscribersGained || 0,
        impressions: analyticsData?.[0]?.impressions || 0,
        clickThroughRate: analyticsData?.[0]?.clickThroughRate || 0,
        
        // Metadata from Data API
        title: stats.title || episode.title,
        description: stats.description || episode.description,
        publishedAt: stats.publishedAt || episode.releaseDate,
        duration: stats.duration || episode.duration,
        thumbnailUrl: stats.thumbnailUrl || episode.thumbnailUrl,
        
        // Engagement metrics
        engagementRate: stats.viewCount > 0 
          ? ((stats.likeCount + stats.commentCount) / stats.viewCount * 100).toFixed(2)
          : 0,
        likeRatio: stats.viewCount > 0
          ? (stats.likeCount / stats.viewCount * 100).toFixed(2)
          : 0
      }

      // Store the metrics in database for caching (optional - skip if fails)
      try {
        await safeQuerySchema(
          orgSlug,
          async (db) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            return db.episodeAnalytics.upsert({
              where: {
                episodeId_date: {
                  episodeId,
                  date: today
                }
              },
              update: {
                downloads: metrics.viewCount,
                uniqueListeners: Math.floor(metrics.viewCount * 0.85), // Estimate unique viewers
                completions: Math.floor(metrics.viewCount * (metrics.averageViewPercentage / 100)),
                avgListenTime: metrics.averageViewDuration,
                shares: 0, // YouTube doesn't provide share count
                likes: metrics.likeCount,
                comments: metrics.commentCount,
                adRevenue: 0, // Would need YouTube Partner data
                updatedAt: new Date()
              },
              create: {
                id: `analytics_${episodeId}_${Date.now()}`,
                episodeId,
                organizationId: session.organizationId || '',
                date: today,
                downloads: metrics.viewCount,
                uniqueListeners: Math.floor(metrics.viewCount * 0.85),
                completions: Math.floor(metrics.viewCount * (metrics.averageViewPercentage / 100)),
                avgListenTime: metrics.averageViewDuration,
                shares: 0,
                likes: metrics.likeCount,
                comments: metrics.commentCount,
                adRevenue: 0
              }
            })
          },
          { episodeId }
        )
      } catch (cacheError) {
        // Ignore cache errors - metrics are still returned
        console.log('Could not cache YouTube metrics:', cacheError)
      }

      return NextResponse.json({
        videoId,
        isYouTubeEpisode: true,
        hasApiKey: true,
        metrics,
        period,
        dateRange: {
          start: startDateStr,
          end: endDateStr
        }
      })

    } catch (apiError: any) {
      console.error('YouTube API error:', apiError)
      
      // Check for quota exceeded error
      if (apiError.code === 403 && apiError.message?.includes('quota')) {
        return NextResponse.json({
          error: 'YouTube API quota exceeded. Please try again later.',
          isQuotaError: true
        }, { status: 429 })
      }

      return NextResponse.json({
        error: 'Failed to fetch YouTube metrics',
        details: apiError.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in YouTube metrics endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}