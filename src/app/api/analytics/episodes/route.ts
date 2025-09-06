import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const limit = parseInt(url.searchParams.get('limit') || '10')

    console.log('📊 Analytics Episodes API: Fetching episode analytics', { timeRange, organizationId })

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case 'mtd': // Month to date
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'qtd': // Quarter to date
        const currentQuarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
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
        '/api/analytics/episodes',
        request
      )
    }

    // Fetch episode analytics data using schema-aware query
    const episodeAnalyticsQuery = `
      SELECT 
        ea.*,
        e.id as episode_id, e.title as episode_title,
        s.id as show_id, s.name as show_name
      FROM "EpisodeAnalytics" ea
      INNER JOIN "Episode" e ON e.id = ea."episodeId"
      INNER JOIN "Show" s ON s.id = e."showId"
      WHERE ea.date >= $1 AND ea.date <= $2
      ORDER BY ea.downloads DESC
      LIMIT $3
    `
    const episodeAnalyticsRaw = await querySchema<any>(orgSlug, episodeAnalyticsQuery, [startDate, now, limit])
    
    // Transform to match expected format
    const episodeAnalytics = episodeAnalyticsRaw.map(analytics => ({
      ...analytics,
      episode: {
        id: analytics.episode_id,
        title: analytics.episode_title,
        show: {
          name: analytics.show_name
        }
      }
    }))

    // Aggregate data by episode
    const episodeMap = new Map()
    
    episodeAnalytics.forEach(analytics => {
      const episodeId = analytics.episodeId
      const episodeTitle = analytics.episode_title || analytics.episode.title
      const showName = analytics.show_name || analytics.episode.show.name
      
      if (!episodeMap.has(episodeId)) {
        episodeMap.set(episodeId, {
          episodeId,
          title: episodeTitle,
          showName: showName,
          totalDownloads: 0,
          totalListeners: 0,
          totalCompletions: 0,
          avgListenTime: 0,
          adRevenue: 0,
          shares: 0,
          likes: 0,
          comments: 0,
          dataPoints: 0
        })
      }
      
      const episode = episodeMap.get(episodeId)
      episode.totalDownloads += analytics.downloads
      episode.totalListeners += analytics.uniqueListeners
      episode.totalCompletions += analytics.completions
      episode.avgListenTime += analytics.avgListenTime
      episode.adRevenue += analytics.adRevenue
      episode.shares += analytics.shares
      episode.likes += analytics.likes
      episode.comments += analytics.comments
      episode.dataPoints += 1
    })

    // Calculate averages and format data
    const episodeData = Array.from(episodeMap.values()).map(episode => ({
      ...episode,
      avgListenTime: episode.dataPoints > 0 ? episode.avgListenTime / episode.dataPoints : 0,
      completionRate: episode.totalListeners > 0 ? (episode.totalCompletions / episode.totalListeners) * 100 : 0,
      engagementScore: episode.shares + episode.likes + episode.comments
    })).sort((a, b) => b.totalDownloads - a.totalDownloads)

    console.log(`✅ Analytics Episodes API: Returning ${episodeData.length} episodes`)

    return NextResponse.json({
      data: episodeData,
      total: episodeData.length,
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Analytics Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}