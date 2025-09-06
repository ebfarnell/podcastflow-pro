import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { createYouTubeAnalyticsService } from '@/services/youtube-analytics'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Input validation schema
const analyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  videoIds: z.array(z.string()).optional(),
  aggregation: z.enum(['daily', 'weekly', 'monthly', 'total']).default('daily'),
  showId: z.string().optional()
})

// GET /api/youtube/analytics - Get YouTube analytics data
export async function GET(request: NextRequest) {
  const correlationId = uuidv4()
  
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    console.log(`[${correlationId}] Getting YouTube analytics for user ${user.id}`)

    // Parse and validate query parameters
    const url = new URL(request.url)
    const params = {
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
      videoIds: url.searchParams.get('videoIds')?.split(',').filter(Boolean),
      aggregation: url.searchParams.get('aggregation') || 'daily',
      showId: url.searchParams.get('showId')
    }

    const validation = analyticsQuerySchema.safeParse(params)
    if (!validation.success) {
      console.log(`[${correlationId}] Invalid query parameters:`, validation.error.format())
      return NextResponse.json(
        { 
          code: 'E_INPUT',
          message: 'Invalid query parameters',
          errors: validation.error.format(),
          correlationId 
        },
        { status: 400 }
      )
    }

    const query = validation.data

    // Create YouTube Analytics service
    const service = await createYouTubeAnalyticsService(user.id)
    if (!service) {
      return NextResponse.json(
        {
          code: 'E_CONFIG',
          message: 'YouTube API not configured',
          correlationId
        },
        { status: 503 }
      )
    }

    // If showId is provided, get video IDs for that show
    let videoIds = query.videoIds
    if (query.showId && !videoIds) {
      const { getUserOrgSlug, safeQuerySchema } = await import('@/lib/db/schema-db')
      const orgSlug = await getUserOrgSlug(user.id)
      
      if (orgSlug) {
        const { data: episodes } = await safeQuerySchema(
          orgSlug,
          'SELECT DISTINCT "youtubeVideoId" FROM "Episode" WHERE "showId" = $1 AND "youtubeVideoId" IS NOT NULL',
          [query.showId]
        )
        videoIds = episodes?.map((ep: any) => ep.youtubeVideoId) || []
      }
    }

    // Get analytics data
    const analyticsData = await service.getStoredAnalytics(
      query.startDate,
      query.endDate,
      videoIds
    )

    console.log(`[${correlationId}] Found ${analyticsData.length} analytics data points`)

    // Aggregate data based on requested aggregation
    const aggregatedData = aggregateAnalyticsData(analyticsData, query.aggregation)

    // Calculate summary statistics
    const summary = calculateSummaryStats(analyticsData)

    return NextResponse.json({
      data: aggregatedData,
      summary,
      query: {
        startDate: query.startDate,
        endDate: query.endDate,
        aggregation: query.aggregation,
        videoCount: videoIds?.length || 0,
        showId: query.showId
      },
      correlationId
    })

  } catch (error) {
    console.error(`[${correlationId}] YouTube analytics error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get YouTube analytics',
        correlationId 
      },
      { status: 500 }
    )
  }
}

function aggregateAnalyticsData(data: any[], aggregation: string) {
  if (aggregation === 'total') {
    return data.reduce((acc, item) => {
      acc.views = (acc.views || 0) + parseInt(item.views || 0)
      acc.likes = (acc.likes || 0) + parseInt(item.likes || 0)
      acc.comments = (acc.comments || 0) + parseInt(item.comments || 0)
      acc.shares = (acc.shares || 0) + parseInt(item.shares || 0)
      acc.subscribersGained = (acc.subscribersGained || 0) + parseInt(item.subscribersGained || 0)
      acc.subscribersLost = (acc.subscribersLost || 0) + parseInt(item.subscribersLost || 0)
      acc.watchTimeMinutes = (acc.watchTimeMinutes || 0) + parseInt(item.watchTimeMinutes || 0)
      acc.impressions = (acc.impressions || 0) + parseInt(item.impressions || 0)
      return acc
    }, {})
  }

  if (aggregation === 'daily') {
    return data // Already daily from the database
  }

  // For weekly/monthly aggregation, group by period
  const grouped: { [key: string]: any } = {}
  
  data.forEach(item => {
    const date = new Date(item.date)
    let key: string
    
    if (aggregation === 'weekly') {
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
      key = weekStart.toISOString().split('T')[0]
    } else if (aggregation === 'monthly') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    } else {
      key = item.date
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        subscribersGained: 0,
        subscribersLost: 0,
        watchTimeMinutes: 0,
        impressions: 0,
        averageViewDuration: 0,
        averageViewPercentage: 0,
        clickThroughRate: 0,
        count: 0
      }
    }

    grouped[key].views += parseInt(item.views || 0)
    grouped[key].likes += parseInt(item.likes || 0)
    grouped[key].comments += parseInt(item.comments || 0)
    grouped[key].shares += parseInt(item.shares || 0)
    grouped[key].subscribersGained += parseInt(item.subscribersGained || 0)
    grouped[key].subscribersLost += parseInt(item.subscribersLost || 0)
    grouped[key].watchTimeMinutes += parseInt(item.watchTimeMinutes || 0)
    grouped[key].impressions += parseInt(item.impressions || 0)
    grouped[key].averageViewDuration += parseFloat(item.averageViewDuration || 0)
    grouped[key].averageViewPercentage += parseFloat(item.averageViewPercentage || 0)
    grouped[key].clickThroughRate += parseFloat(item.clickThroughRate || 0)
    grouped[key].count += 1
  })

  // Calculate averages for applicable metrics
  return Object.values(grouped).map((item: any) => ({
    ...item,
    averageViewDuration: item.count > 0 ? Math.round(item.averageViewDuration / item.count) : 0,
    averageViewPercentage: item.count > 0 ? (item.averageViewPercentage / item.count).toFixed(2) : 0,
    clickThroughRate: item.count > 0 ? (item.clickThroughRate / item.count).toFixed(4) : 0
  })).sort((a, b) => a.date.localeCompare(b.date))
}

function calculateSummaryStats(data: any[]) {
  if (data.length === 0) {
    return {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalWatchTimeMinutes: 0,
      averageViewsPerDay: 0,
      engagementRate: 0,
      dataPoints: 0,
      dateRange: null
    }
  }

  const totalViews = data.reduce((sum, item) => sum + parseInt(item.views || 0), 0)
  const totalLikes = data.reduce((sum, item) => sum + parseInt(item.likes || 0), 0)
  const totalComments = data.reduce((sum, item) => sum + parseInt(item.comments || 0), 0)
  const totalShares = data.reduce((sum, item) => sum + parseInt(item.shares || 0), 0)
  const totalWatchTime = data.reduce((sum, item) => sum + parseInt(item.watchTimeMinutes || 0), 0)

  const dates = data.map(item => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime())
  const daysDiff = dates.length > 1 
    ? Math.ceil((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 1

  return {
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalWatchTimeMinutes: totalWatchTime,
    averageViewsPerDay: Math.round(totalViews / daysDiff),
    engagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0,
    dataPoints: data.length,
    dateRange: {
      start: dates[0]?.toISOString().split('T')[0],
      end: dates[dates.length - 1]?.toISOString().split('T')[0],
      days: daysDiff
    }
  }
}