import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shows/[id]/youtube-analytics - Get comprehensive YouTube analytics for a show
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const showId = params.id
    const orgSlug = await getUserOrgSlug(session.userId)
    
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get organization ID
    const orgQuery = `SELECT id FROM "Organization" WHERE slug = $1`
    const { data: orgData } = await safeQuerySchema<any>('public', orgQuery, [orgSlug])
    const organizationId = orgData?.[0]?.id

    // Get all YouTube episodes for the show with analytics data directly from Episode table
    const episodesQuery = `
      SELECT 
        e.id,
        e.title,
        e."episodeNumber",
        e."airDate",
        e."youtubeVideoId",
        e."youtubeViewCount",
        e."youtubeLikeCount",
        e."youtubeCommentCount",
        e."youtubeShares",
        e."youtubeDislikeCount",
        e."youtubeSubscribersGained",
        e."youtubeSubscribersLost",
        e."youtubeAvgViewDuration",
        e."youtubeAvgViewPercentage",
        e."youtubeWatchTimeHours",
        e."youtubeImpressions",
        e."youtubeCTR",
        e."youtubeEstimatedMinutesWatched",
        e."youtubeRetentionRate",
        e."youtubeUrl"
      FROM "Episode" e
      WHERE e."showId" = $1 
        AND e."youtubeVideoId" IS NOT NULL
      ORDER BY e."airDate" DESC
    `
    const { data: episodes } = await safeQuerySchema<any>(orgSlug, episodesQuery, [showId])
    
    if (!episodes || episodes.length === 0) {
      return NextResponse.json({
        totalMetrics: {
          totalViews: 0,
          totalWatchTimeHours: 0,
          totalLikes: 0,
          totalComments: 0,
          avgViewDuration: 0,
          avgViewPercentage: 0,
          totalImpressions: 0,
          avgCTR: 0,
          subscribersGained: 0,
          subscribersLost: 0,
          netSubscribers: 0
        },
        episodes: [],
        topVideos: [],
        trafficSources: [],
        demographics: null,
        retentionData: null,
        realTimeData: null
      })
    }

    // Calculate aggregated analytics from Episode data
    const analytics = episodes.reduce((acc: any, episode: any) => {
      acc.totalViews = (acc.totalViews || 0) + (episode.youtubeViewCount ? Number(episode.youtubeViewCount) : 0)
      acc.totalLikes = (acc.totalLikes || 0) + (episode.youtubeLikeCount ? Number(episode.youtubeLikeCount) : 0)
      acc.totalComments = (acc.totalComments || 0) + (episode.youtubeCommentCount ? Number(episode.youtubeCommentCount) : 0)
      acc.totalShares = (acc.totalShares || 0) + (episode.youtubeShares ? Number(episode.youtubeShares) : 0)
      acc.subscribersGained = (acc.subscribersGained || 0) + (episode.youtubeSubscribersGained ? Number(episode.youtubeSubscribersGained) : 0)
      acc.subscribersLost = (acc.subscribersLost || 0) + (episode.youtubeSubscribersLost ? Number(episode.youtubeSubscribersLost) : 0)
      acc.totalWatchTimeHours = (acc.totalWatchTimeHours || 0) + (episode.youtubeWatchTimeHours ? Number(episode.youtubeWatchTimeHours) : 0)
      acc.totalImpressions = (acc.totalImpressions || 0) + (episode.youtubeImpressions ? Number(episode.youtubeImpressions) : 0)
      acc.totalEstimatedMinutesWatched = (acc.totalEstimatedMinutesWatched || 0) + (episode.youtubeEstimatedMinutesWatched ? Number(episode.youtubeEstimatedMinutesWatched) : 0)
      
      // For averages, we'll sum and divide later
      acc.sumViewDuration = (acc.sumViewDuration || 0) + (episode.youtubeAvgViewDuration ? Number(episode.youtubeAvgViewDuration) : 0)
      acc.sumViewPercentage = (acc.sumViewPercentage || 0) + (episode.youtubeAvgViewPercentage ? Number(episode.youtubeAvgViewPercentage) : 0)
      acc.sumCTR = (acc.sumCTR || 0) + (episode.youtubeCTR ? Number(episode.youtubeCTR) : 0)
      acc.sumRetentionRate = (acc.sumRetentionRate || 0) + (episode.youtubeRetentionRate ? Number(episode.youtubeRetentionRate) : 0)
      acc.count = (acc.count || 0) + 1
      
      return acc
    }, {})

    // Calculate averages
    const episodeCount = analytics.count || 1
    analytics.avgViewDuration = analytics.sumViewDuration / episodeCount
    analytics.avgViewPercentage = analytics.sumViewPercentage / episodeCount
    analytics.avgCTR = analytics.sumCTR / episodeCount
    analytics.avgRetentionRate = analytics.sumRetentionRate / episodeCount

    const videoIds = episodes.map((e: any) => e.youtubeVideoId).filter(Boolean)

    // Get top performing videos directly from Episode table - REAL DATA ONLY
    const topVideos = episodes
      .filter((e: any) => e.youtubeViewCount && Number(e.youtubeViewCount) > 0)
      .sort((a: any, b: any) => Number(b.youtubeViewCount) - Number(a.youtubeViewCount))
      .slice(0, 5)
      .map((e: any) => ({
        id: e.id,
        title: e.title,
        videoId: e.youtubeVideoId,
        views: Number(e.youtubeViewCount) || 0,
        likes: Number(e.youtubeLikeCount) || 0,
        comments: Number(e.youtubeCommentCount) || 0,
        watchTime: Number(e.youtubeWatchTimeHours) * 60 || 0, // Convert to minutes
        ctr: Number(e.youtubeCTR) || 0,
        url: e.youtubeUrl
      }))

    // Traffic sources - will be populated when YouTube API integration is complete
    // For now, return empty array (NO MOCK DATA)
    const trafficSources = []

    // Create time series data from episodes for the last 30 days - REAL DATA
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentEpisodes = episodes.filter((e: any) => 
      e.airDate && new Date(e.airDate) >= thirtyDaysAgo
    )

    // Group by day for time series data
    const dailyData: { [key: string]: any } = {}
    recentEpisodes.forEach((e: any) => {
      if (e.airDate) {
        const dateKey = new Date(e.airDate).toISOString().split('T')[0]
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            views: 0,
            likes: 0,
            comments: 0
          }
        }
        dailyData[dateKey].views += Number(e.youtubeViewCount) || 0
        dailyData[dateKey].likes += Number(e.youtubeLikeCount) || 0
        dailyData[dateKey].comments += Number(e.youtubeCommentCount) || 0
      }
    })

    const timeSeriesData = {
      last30Days: Object.values(dailyData).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    }

    // Demographics - will be populated when YouTube API integration is complete
    // For now, return null (NO MOCK DATA)
    const demographics = null

    // Retention data - will be populated when YouTube API integration is complete
    // For now, return null (NO MOCK DATA)
    const retention = null

    // Build response with REAL DATA ONLY
    const response = {
      totalMetrics: {
        totalViews: analytics.totalViews || 0,
        totalWatchTimeHours: Math.round(analytics.totalWatchTimeHours) || 0,
        totalLikes: analytics.totalLikes || 0,
        totalComments: analytics.totalComments || 0,
        avgViewDuration: Math.round(analytics.avgViewDuration) || 0,
        avgViewPercentage: Math.round(analytics.avgViewPercentage * 100) / 100 || 0,
        totalImpressions: analytics.totalImpressions || 0,
        avgCTR: Math.round(analytics.avgCTR * 100) / 100 || 0,
        subscribersGained: analytics.subscribersGained || 0,
        subscribersLost: analytics.subscribersLost || 0,
        netSubscribers: (analytics.subscribersGained - analytics.subscribersLost) || 0,
        totalEstimatedMinutesWatched: analytics.totalEstimatedMinutesWatched || 0,
        avgRetentionRate: Math.round(analytics.avgRetentionRate * 100) / 100 || 0,
        totalShares: analytics.totalShares || 0
      },
      retentionData: retention,
      trafficSources,
      timeSeriesData,
      topVideos,
      demographics,
      episodes: episodes.slice(0, 10).map((e: any) => ({
        id: e.id,
        title: e.title,
        episodeNumber: e.episodeNumber,
        airDate: e.airDate,
        views: Number(e.youtubeViewCount) || 0,
        likes: Number(e.youtubeLikeCount) || 0,
        comments: Number(e.youtubeCommentCount) || 0,
        url: e.youtubeUrl
      }))
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching YouTube analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch YouTube analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}