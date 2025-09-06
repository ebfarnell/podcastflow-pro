import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { episodeId: string } }
) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session?.userId) {
      // Special handling for YouTube episodes - check if this is a YouTube episode first
      // This prevents 401 errors in the console for YouTube episodes
      const episodeIdLower = episodeId?.toLowerCase() || ''
      if (episodeIdLower.includes('youtube')) {
        return NextResponse.json({
          totalDownloads: 0,
          totalListeners: 0,
          totalCompletions: 0,
          avgCompletionRate: 0,
          totalRevenue: 0,
          platformBreakdown: {
            spotify: 0,
            apple: 0,
            google: 0,
            other: 0,
            youtube: 0
          },
          engagement: {
            totalShares: 0,
            totalLikes: 0,
            totalComments: 0,
            avgListenTime: 0
          },
          trends: {
            downloadsChange: 0,
            listenersChange: 0,
            revenueChange: 0
          },
          isYouTubeEpisode: true,
          message: 'Analytics not available for YouTube episodes'
        })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = {
      id: session.userId,
      role: session.role,
      organizationId: session.organizationId
    }

    const { episodeId } = params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/analytics/episodes/${episodeId}`,
        request
      )
    }

    // Verify episode exists and user has access
    const episodeQuery = `SELECT id, "publishUrl" FROM "Episode" WHERE id = $1`
    const episodes = await querySchema<any>(orgSlug, episodeQuery, [episodeId])
    
    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }
    
    // Check if this is a YouTube episode (has YouTube URL)
    const episode = episodes[0]
    const isYouTubeEpisode = episode.publishUrl && 
      (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be'))
    
    // For YouTube episodes, return empty analytics (they don't have traditional analytics)
    if (isYouTubeEpisode) {
      return NextResponse.json({
        totalDownloads: 0,
        totalListeners: 0,
        totalCompletions: 0,
        avgCompletionRate: 0,
        totalRevenue: 0,
        platformBreakdown: {
          spotify: 0,
          apple: 0,
          google: 0,
          other: 0,
          youtube: 0
        },
        engagement: {
          totalShares: 0,
          totalLikes: 0,
          totalComments: 0,
          avgListenTime: 0
        },
        trends: {
          downloadsChange: 0,
          listenersChange: 0,
          revenueChange: 0
        },
        isYouTubeEpisode: true,
        message: 'Analytics not available for YouTube episodes'
      })
    }

    // Calculate date range
    const now = new Date()
    let fromDate: Date
    let toDate = endDate ? new Date(endDate) : now

    if (startDate) {
      fromDate = new Date(startDate)
    } else {
      switch (period) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
    }

    // Fetch analytics data
    const analyticsQuery = `
      SELECT * FROM "EpisodeAnalytics"
      WHERE "episodeId" = $1 AND date >= $2 AND date <= $3
      ORDER BY date ASC
    `
    const analyticsData = await querySchema<any>(orgSlug, analyticsQuery, [episodeId, fromDate, toDate])

    // Calculate aggregated metrics
    const totalDownloads = analyticsData.reduce((sum, record) => sum + record.downloads, 0)
    const totalListeners = analyticsData.reduce((sum, record) => sum + record.uniqueListeners, 0)
    const totalCompletions = analyticsData.reduce((sum, record) => sum + record.completions, 0)
    const totalRevenue = analyticsData.reduce((sum, record) => sum + record.adRevenue, 0)
    const totalShares = analyticsData.reduce((sum, record) => sum + record.shares, 0)
    const totalLikes = analyticsData.reduce((sum, record) => sum + record.likes, 0)
    const totalComments = analyticsData.reduce((sum, record) => sum + record.comments, 0)
    
    // Platform breakdown
    const spotifyListens = analyticsData.reduce((sum, record) => sum + record.spotifyListens, 0)
    const appleListens = analyticsData.reduce((sum, record) => sum + record.appleListens, 0)
    const googleListens = analyticsData.reduce((sum, record) => sum + record.googleListens, 0)
    const otherListens = analyticsData.reduce((sum, record) => sum + record.otherListens, 0)

    // Calculate average metrics
    const avgCompletionRate = totalListeners > 0 ? (totalCompletions / totalListeners) * 100 : 0
    const avgListenTime = analyticsData.length > 0 
      ? analyticsData.reduce((sum, record) => sum + record.avgListenTime, 0) / analyticsData.length 
      : 0

    // Calculate trends (compare current period to previous period)
    const previousFromDate = new Date(fromDate.getTime() - (toDate.getTime() - fromDate.getTime()))
    const previousToDate = fromDate

    const previousAnalyticsQuery = `
      SELECT * FROM "EpisodeAnalytics"
      WHERE "episodeId" = $1 AND date >= $2 AND date < $3
    `
    const previousAnalytics = await querySchema<any>(orgSlug, previousAnalyticsQuery, [episodeId, previousFromDate, previousToDate])

    const previousDownloads = previousAnalytics.reduce((sum, record) => sum + record.downloads, 0)
    const previousListeners = previousAnalytics.reduce((sum, record) => sum + record.uniqueListeners, 0)
    const previousRevenue = previousAnalytics.reduce((sum, record) => sum + record.adRevenue, 0)

    // Calculate percentage changes
    const downloadsChange = previousDownloads > 0 
      ? ((totalDownloads - previousDownloads) / previousDownloads) * 100 
      : totalDownloads > 0 ? 100 : 0
    
    const listenersChange = previousListeners > 0 
      ? ((totalListeners - previousListeners) / previousListeners) * 100 
      : totalListeners > 0 ? 100 : 0
    
    const revenueChange = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0

    // Build response
    const analyticsResponse = {
      totalDownloads,
      totalListeners,
      totalCompletions,
      avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      platformBreakdown: {
        spotify: spotifyListens,
        apple: appleListens,
        google: googleListens,
        other: otherListens
      },
      engagement: {
        totalShares,
        totalLikes,
        totalComments,
        avgListenTime: Math.round(avgListenTime)
      },
      trends: {
        downloadsChange: Math.round(downloadsChange * 100) / 100,
        listenersChange: Math.round(listenersChange * 100) / 100,
        revenueChange: Math.round(revenueChange * 100) / 100
      }
    }

    return NextResponse.json(analyticsResponse)

  } catch (error) {
    console.error('Episode analytics API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch episode analytics',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}