import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

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

    console.log('📊 Analytics Shows API: Fetching show analytics', { timeRange, organizationId })

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

    // Get user's organization
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch show analytics data using schema-aware query
    const analyticsQuery = `
      SELECT 
        sa.*,
        s.name as show_name,
        s.description as show_description,
        s."isActive" as show_is_active
      FROM "ShowAnalytics" sa
      LEFT JOIN "Show" s ON s.id = sa."showId"
      WHERE sa.date >= $1 AND sa.date <= $2
      ORDER BY sa."totalDownloads" DESC
      LIMIT $3
    `
    
    const { data: showAnalytics, error } = await safeQuerySchema<any>(
      orgSlug, 
      analyticsQuery, 
      [startDate, now, limit]
    )
    
    if (error) {
      console.error('Failed to fetch show analytics:', error)
      // Return empty data instead of 500 error
      return NextResponse.json({
        data: [],
        total: 0,
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString()
        }
      })
    }

    // Aggregate data by show
    const showMap = new Map()
    
    showAnalytics.forEach(analytics => {
      const showId = analytics.showId
      
      if (!showMap.has(showId)) {
        showMap.set(showId, {
          showId,
          name: analytics.show_name,
          description: analytics.show_description,
          isActive: analytics.show_is_active,
          totalDownloads: 0,
          totalListeners: 0,
          avgDownloadsPerEpisode: 0,
          avgRating: 0,
          totalRatings: 0,
          totalRevenue: 0,
          adRevenue: 0,
          sponsorRevenue: 0,
          newSubscribers: 0,
          lostSubscribers: 0,
          netSubscribers: 0,
          dataPoints: 0
        })
      }
      
      const show = showMap.get(showId)
      show.totalDownloads += analytics.totalDownloads
      show.totalListeners += analytics.totalListeners
      show.avgDownloadsPerEpisode += analytics.avgDownloadsPerEpisode
      show.avgRating += analytics.avgRating
      show.totalRatings += analytics.totalRatings
      show.totalRevenue += analytics.totalRevenue
      show.adRevenue += analytics.adRevenue
      show.sponsorRevenue += analytics.sponsorRevenue
      show.newSubscribers += analytics.newSubscribers
      show.lostSubscribers += analytics.lostSubscribers
      show.netSubscribers += analytics.netSubscribers
      show.dataPoints += 1
    })

    // Calculate averages and format data
    const showData = Array.from(showMap.values()).map(show => ({
      ...show,
      avgDownloadsPerEpisode: show.dataPoints > 0 ? show.avgDownloadsPerEpisode / show.dataPoints : 0,
      avgRating: show.dataPoints > 0 ? show.avgRating / show.dataPoints : 0,
      subscriberGrowthRate: show.newSubscribers + show.lostSubscribers > 0 
        ? (show.netSubscribers / (show.newSubscribers + show.lostSubscribers)) * 100 
        : 0,
      revenuePerListener: show.totalListeners > 0 ? show.totalRevenue / show.totalListeners : 0
    })).sort((a, b) => b.totalDownloads - a.totalDownloads)

    console.log(`✅ Analytics Shows API: Returning ${showData.length} shows`)

    return NextResponse.json({
      data: showData,
      total: showData.length,
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Analytics Shows API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}