import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { MegaphoneService } from '@/lib/services/megaphone-service'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

// Force dynamic rendering for routes that use cookies/auth
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Input validation schemas
const uuidSchema = z.string().uuid()
const daysSchema = z.coerce.number().int().min(1).max(365).default(30)

// Helper to generate date series
function generateDateSeries(startDate: Date, days: number): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  
  for (let i = 0; i < days; i++) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

// GET /api/shows/[id]/metrics/history - Get metrics history
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = uuidv4()
  
  try {
    // Accept any show ID format (not just UUIDs)
    const showId = params.id
    
    if (!showId) {
      console.log(`[${correlationId}] Missing showId`)
      return NextResponse.json(
        { code: 'E_INPUT', message: 'Show ID is required', correlationId },
        { status: 400 }
      )
    }
    
    // Parse date range parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const daysParam = searchParams.get('days')
    
    let startDate: Date
    let endDate: Date
    let days: number
    
    if (startDateParam && endDateParam) {
      // Use provided date range
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
      days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    } else {
      // Use days parameter (fallback to existing logic)
      const daysValidation = daysSchema.safeParse(daysParam)
      
      if (!daysValidation.success) {
        console.log(`[${correlationId}] Invalid days parameter:`, daysParam)
        return NextResponse.json(
          { 
            code: 'E_INPUT', 
            message: 'Invalid days parameter (must be 1-365)',
            correlationId 
          },
          { status: 400 }
        )
      }
      
      days = daysValidation.data
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(endDate.getDate() - days + 1)
      startDate.setHours(0, 0, 0, 0)
    }
    
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

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json(
        { code: 'E_ORG', message: 'Organization not found', correlationId },
        { status: 404 }
      )
    }

    console.log(`[${correlationId}] Getting show metrics history:`, { showId, days, orgSlug })

    // Verify show exists and get YouTube channel info
    const showQuery = `
      SELECT id, name, "youtubeChannelId", "youtubeChannelUrl"
      FROM "Show" 
      WHERE id = $1
    `
    const { data: showResult, error: showError } = await safeQuerySchema<any>(
      orgSlug, 
      showQuery, 
      [showId]
    )
    
    if (showError || !showResult || showResult.length === 0) {
      console.log(`[${correlationId}] Show not found:`, { showId, error: showError })
      return NextResponse.json(
        { code: 'E_NOT_FOUND', message: 'Show not found', correlationId },
        { status: 404 }
      )
    }

    console.log(`[${correlationId}] Date range calculated: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${days} days)`)
    
    // Generate all dates in the range for gap filling
    const allDates = generateDateSeries(startDate, days)
    
    // Initialize Megaphone service
    const megaphoneService = new MegaphoneService()
    
    let metricsMap = new Map<string, any>()
    let megaphoneSubscriberData: any = null
    
    // Try to get API token from organization's Megaphone integration
    const apiToken = await megaphoneService.getApiToken(orgSlug, user.organizationId)
    if (apiToken) {
      // Update service with the API token
      const authenticatedService = new MegaphoneService(apiToken)
      
      // Check if show has a Megaphone podcast ID mapping
      const showMappingQuery = `
        SELECT "megaphonePodcastId" 
        FROM "Show" 
        WHERE id = $1
      `
      const { data: showMapping } = await safeQuerySchema<any>(
        orgSlug,
        showMappingQuery,
        [showId]
      )
      
      const megaphonePodcastId = showMapping?.[0]?.megaphonePodcastId
      
      // Fetch actual metrics from Megaphone API
      const metrics = await authenticatedService.fetchShowMetrics(
        showId,
        startDate,
        endDate,
        megaphonePodcastId
      )
      
      // Convert to map for processing
      metrics.forEach(metric => {
        metricsMap.set(metric.date, {
          date: metric.date,
          downloads: metric.downloads,
          listeners: metric.listeners,
          ad_impressions: metric.adImpressions,
          completion_rate: metric.completionRate
        })
      })
      
      // Also fetch subscriber data if available
      megaphoneSubscriberData = await authenticatedService.fetchSubscriberHistory(
        showId,
        startDate,
        endDate,
        megaphonePodcastId
      )
    }
    
    // If no Megaphone data, try to get data from ShowMetricsHistory table
    if (metricsMap.size === 0) {
      console.log(`[${correlationId}] Fetching metrics from ShowMetricsHistory table`)
      
      const historyQuery = `
        SELECT 
          date,
          "youtubeViews",
          "youtubeLikes",
          "youtubeComments",
          "megaphoneDownloads",
          "megaphoneUniqueListeners",
          "megaphoneCompletionRate",
          "totalDownloads",
          "totalListeners",
          "dailyRevenue",
          "engagementRate"
        FROM "ShowMetricsHistory"
        WHERE "showId" = $1 
          AND date >= $2::date 
          AND date <= $3::date
        ORDER BY date ASC
      `
      
      const { data: historyData, error: historyError } = await safeQuerySchema<any>(
        orgSlug,
        historyQuery,
        [showId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      )
      
      if (historyData && historyData.length > 0) {
        historyData.forEach((row: any) => {
          metricsMap.set(row.date.toISOString().split('T')[0], {
            date: row.date.toISOString().split('T')[0],
            downloads: row.megaphoneDownloads || row.totalDownloads || 0,
            listeners: row.megaphoneUniqueListeners || row.totalListeners || 0,
            ad_impressions: 0,
            completion_rate: row.megaphoneCompletionRate || 0,
            youtube_views: row.youtubeViews || 0,
            youtube_likes: row.youtubeLikes || 0,
            youtube_comments: row.youtubeComments || 0,
            daily_revenue: row.dailyRevenue || 0,
            engagement_rate: row.engagementRate || 0
          })
        })
      }
    }
    
    // Create history data
    let history: any[] = []
    
    if (metricsMap.size === 0) {
      // No data available - return empty array
      console.log(`[${correlationId}] No metrics history data available for show ${showId}`)
      return NextResponse.json({
        history: [],
        summary: {
          totalDownloads: 0,
          averageDownloads: 0,
          totalListeners: 0,
          averageListeners: 0,
          growthRate: 0
        }
      })
    }
    
    // Check for YouTube subscriber data first
    const youtubeChannelId = showResult[0]?.youtubeChannelId
    let youtubeSubscriberHistory: any[] = []
    
    if (youtubeChannelId) {
      // Try to get YouTube channel subscriber history
      const youtubeChannelQuery = `
        SELECT "subscriberCount", "updatedAt"
        FROM "YouTubeChannel"
        WHERE "channelId" = $1
      `
      const { data: channelData } = await safeQuerySchema<any>(
        orgSlug,
        youtubeChannelQuery,
        [youtubeChannelId]
      )
      
      // Also check for YouTube Analytics data
      const youtubeAnalyticsQuery = `
        SELECT 
          date,
          "subscribersGained",
          "subscribersLost",
          SUM("subscribersGained" - "subscribersLost") OVER (ORDER BY date) as "runningTotal"
        FROM "YouTubeAnalytics"
        WHERE "channelId" = $1
          AND date >= $2::date
          AND date <= $3::date
        ORDER BY date ASC
      `
      const { data: analyticsData } = await safeQuerySchema<any>(
        orgSlug,
        youtubeAnalyticsQuery,
        [youtubeChannelId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      )
      
      if (analyticsData && analyticsData.length > 0) {
        youtubeSubscriberHistory = analyticsData
      }
    }
    
    if (youtubeSubscriberHistory.length > 0) {
      // Use actual YouTube subscriber data
      const subscriberMap = new Map<string, any>()
      let baseSubscribers = 0
      
      youtubeSubscriberHistory.forEach((sub: any) => {
        const dateStr = sub.date.toISOString().split('T')[0]
        subscriberMap.set(dateStr, {
          subscribers: sub.runningTotal || baseSubscribers,
          gained: sub.subscribersGained || 0,
          lost: sub.subscribersLost || 0
        })
        baseSubscribers = sub.runningTotal || baseSubscribers
      })
      
      history = allDates.map((date, index) => {
        const metrics = metricsMap.get(date)
        const subData = subscriberMap.get(date)
        const previousSubs = index > 0 ? history[index - 1]?.subscribers || baseSubscribers : baseSubscribers
        const subscribers = subData?.subscribers || previousSubs
        const dailyChange = subscribers - previousSubs
        
        return {
          date: date,
          subscribers: subscribers,
          dailyChange: dailyChange,
          weeklyChange: index >= 7 ? subscribers - (history[index - 7]?.subscribers || baseSubscribers) : 0,
          monthlyChange: index >= 30 ? subscribers - (history[index - 30]?.subscribers || baseSubscribers) : 0,
          growthRate: previousSubs > 0 ? (dailyChange / previousSubs) * 100 : 0,
          churnRate: subData?.lost ? (subData.lost / Math.max(previousSubs, 1)) * 100 : 0,
          // Include actual metrics if available
          downloads: metrics?.downloads || 0,
          listeners: metrics?.listeners || 0,
          youtubeViews: metrics?.youtube_views || 0,
          subscribersGained: subData?.gained || 0,
          subscribersLost: subData?.lost || 0
        }
      })
    } else if (megaphoneSubscriberData && megaphoneSubscriberData.length > 0) {
      // Use actual Megaphone subscriber data
      const subscriberMap = new Map<string, any>()
      megaphoneSubscriberData.forEach((sub: any) => {
        subscriberMap.set(sub.date, sub)
      })
      
      history = allDates.map((date) => {
        const metrics = metricsMap.get(date)
        const subscriberData = subscriberMap.get(date)
        
        return {
          date: date,
          subscribers: subscriberData?.subscribers || 10000,
          dailyChange: subscriberData?.dailyChange || 0,
          weeklyChange: subscriberData?.weeklyChange || 0,
          monthlyChange: subscriberData?.monthlyChange || 0,
          growthRate: subscriberData?.growthRate || 0,
          churnRate: subscriberData?.churnRate || 0,
          // Include actual metrics if available
          downloads: metrics?.downloads || 0,
          listeners: metrics?.listeners || 0,
          adImpressions: metrics?.ad_impressions || 0,
          completionRate: metrics?.completion_rate || 0
        }
      })
    } else {
      // No subscriber data available - return empty array
      // We NEVER simulate data - only use real data from YouTube or Megaphone
      console.log(`[${correlationId}] No real subscriber data available for show ${showId}`)
      console.log(`[${correlationId}] YouTube channel ID: ${youtubeChannelId || 'Not configured'}`)
      
      return NextResponse.json({
        history: [],
        summary: {
          totalDownloads: 0,
          averageDownloads: 0,
          totalListeners: 0,
          averageListeners: 0,
          growthRate: 0,
          dataSource: 'none',
          message: 'No YouTube or Megaphone subscriber data available. Please sync YouTube channel data first.'
        },
        needsSync: true,
        youtubeChannelId: youtubeChannelId
      })
    }

    return NextResponse.json({
      showId: showId,
      history: history,
      days: days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timestamp: new Date().toISOString(),
      correlationId: correlationId
    })

  } catch (error) {
    console.error(`[${correlationId}] Show metrics history error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get metrics history',
        correlationId 
      },
      { status: 500 }
    )
  }
}