import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { SchemaModels, getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
// import { CampaignStatus } from '@prisma/client' // Use string literals instead
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const dateRange = url.searchParams.get('dateRange') || 'thisMonth'

    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const organizationId = user.organizationId

    console.log('🔍 Dashboard API: Fetching data for org:', organizationId)

    // Get organization slug for schema queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    console.log('🔍 Dashboard API: Using schema for org:', orgSlug)

    // Get date range based on parameter
    const now = new Date()
    let startDate: Date
    let endDate: Date
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = new Date(yesterday)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(yesterday)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'thisWeek':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'lastWeek':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay() - 7)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'thisMonth':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'lastMonth':
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
      case 'last30Days':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'last90Days':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 90)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
        break
      default:
        // Default to this month
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
    }

    // Fetch real campaigns data from organization schema
    const campaignsRaw = await SchemaModels.campaign.findMany(orgSlug, {
      organizationId
    })

    // Convert date strings to Date objects
    const campaigns = campaignsRaw.map(c => ({
      ...c,
      startDate: new Date(c.startDate),
      endDate: new Date(c.endDate),
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt)
    }))

    console.log('📊 Dashboard API: Found campaigns:', campaigns.length)
    console.log('📊 Dashboard API: First campaign:', campaigns[0])
    console.log('📊 Dashboard API: Campaign status distribution:', {
      active: campaigns.filter(c => c.status === 'active').length,
      pending: campaigns.filter(c => c.status === 'pending').length,
      scheduled: campaigns.filter(c => c.status === 'scheduled').length,
      draft: campaigns.filter(c => c.status === 'draft').length
    })

    // Filter campaigns by date range - only count campaigns that were active during the selected period
    const activeCampaigns = campaigns.filter(c => 
      c.status === 'active' && 
      c.startDate <= endDate && 
      c.endDate >= startDate
    ).length
    
    const pendingCampaigns = campaigns.filter(c => 
      c.status === 'pending' && 
      c.startDate <= endDate && 
      c.endDate >= startDate
    ).length
    
    const scheduledCampaigns = campaigns.filter(c => 
      c.status === 'scheduled' && 
      c.startDate <= endDate && 
      c.endDate >= startDate
    ).length

    // Calculate revenue from actual campaign analytics data in the selected date range
    const analyticsQuery = `
      SELECT COALESCE(SUM(spent), 0) as total_spent
      FROM "CampaignAnalytics"
      WHERE date >= $1 AND date <= $2
    `
    const { data: analyticsResult } = await safeQuerySchema<{ total_spent: number }>(
      orgSlug,
      analyticsQuery,
      [startDate, endDate]
    )
    const monthlyRevenue = parseFloat(analyticsResult[0]?.total_spent || '0')

    // Calculate revenue growth (compare to previous period)
    let comparisonStart: Date
    let comparisonEnd: Date
    
    // Calculate the comparison period based on the selected range
    const rangeLength = endDate.getTime() - startDate.getTime()
    comparisonStart = new Date(startDate.getTime() - rangeLength)
    comparisonEnd = new Date(endDate.getTime() - rangeLength)
    
    const comparisonQuery = `
      SELECT COALESCE(SUM(spent), 0) as total_spent
      FROM "CampaignAnalytics"
      WHERE date >= $1 AND date <= $2
    `
    const { data: comparisonResult } = await safeQuerySchema<{ total_spent: number }>(
      orgSlug,
      comparisonQuery,
      [comparisonStart, comparisonEnd]
    )
    const previousRevenue = parseFloat(comparisonResult[0]?.total_spent || '0')

    const revenueGrowth = previousRevenue > 0 ? ((monthlyRevenue - previousRevenue) / previousRevenue) * 100 : 0

    // Get revenue data based on the selected date range
    const revenueByMonth = []
    
    // Get show projections for target revenue calculation
    const showProjectionsQuery = `
      SELECT 
        COALESCE(SUM("selloutProjection" * "estimatedEpisodeValue" / 100), 0) as projected_revenue_per_episode,
        COUNT(*) as show_count
      FROM "Show"
      WHERE "organizationId" = $1 
        AND "isActive" = true
        AND "selloutProjection" IS NOT NULL
        AND "estimatedEpisodeValue" IS NOT NULL
    `
    const { data: projectionResult } = await safeQuerySchema<{ projected_revenue_per_episode: number, show_count: number }>(
      orgSlug,
      showProjectionsQuery,
      [organizationId]
    )
    const projectedRevenuePerEpisode = parseFloat(projectionResult[0]?.projected_revenue_per_episode || '0')
    const activeShowsWithProjections = projectionResult[0]?.show_count || 0
    
    // Helper function to calculate target revenue based on time period
    const calculateTarget = (periodDays: number = 30) => {
      // Assume 4 episodes per month per show as default
      const episodesPerMonth = 4
      const daysInMonth = 30
      const episodesInPeriod = (episodesPerMonth * activeShowsWithProjections * periodDays) / daysInMonth
      return Math.round(projectedRevenuePerEpisode * episodesInPeriod)
    }
    
    // Determine the appropriate granularity based on date range
    if (dateRange === 'today' || dateRange === 'yesterday') {
      // Show hourly data for single day views
      const targetDate = dateRange === 'today' ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const hourlyQuery = `
        SELECT 
          EXTRACT(HOUR FROM date) as hour,
          COALESCE(SUM(spent), 0) as hour_spent
        FROM "CampaignAnalytics"
        WHERE DATE(date) = DATE($1)
        GROUP BY EXTRACT(HOUR FROM date)
        ORDER BY hour
      `
      const { data: hourlyResult } = await safeQuerySchema<{ hour: number, hour_spent: number }>(
        orgSlug,
        hourlyQuery,
        [targetDate]
      )
      
      // For today/yesterday, if we have very little hourly data, show daily summary instead
      if (hourlyResult.length <= 2) {
        // Just show the total for the day as a single point
        const totalSpent = hourlyResult.reduce((sum, r) => sum + parseFloat(r.hour_spent || '0'), 0)
        revenueByMonth.push({
          month: format(targetDate, 'MMM d'),
          year: targetDate.getFullYear(),
          revenue: totalSpent,
          target: calculateTarget(1) // 1 day target
        })
      } else {
        // Fill in all 24 hours
        for (let h = 0; h < 24; h++) {
          const hourData = hourlyResult.find(r => r.hour === h)
          revenueByMonth.push({
            month: `${h}:00`,
            year: targetDate.getFullYear(),
            revenue: parseFloat(hourData?.hour_spent || '0'),
            target: calculateTarget(1) / 24 // Hourly target
          })
        }
      }
    } else if (dateRange === 'thisWeek' || dateRange === 'lastWeek') {
      // Show daily data for week views - FIXED: Single query instead of N+1
      const weeklyQuery = `
        SELECT 
          DATE(date) as day,
          COALESCE(SUM(spent), 0) as day_spent
        FROM "CampaignAnalytics"
        WHERE date >= $1 AND date <= $2
        GROUP BY DATE(date)
        ORDER BY day
      `
      const { data: weeklyResults } = await safeQuerySchema<{ day: string, day_spent: number }>(
        orgSlug,
        weeklyQuery,
        [startDate, endDate]
      )
      
      // Create a map for quick lookup
      const revenueMap = new Map(weeklyResults.map(r => [r.day, parseFloat(r.day_spent.toString())]))
      
      // Generate all 7 days of the week with data or 0
      const weekStart = new Date(startDate)
      for (let d = 0; d < 7; d++) {
        const dayStart = new Date(weekStart)
        dayStart.setDate(weekStart.getDate() + d)
        const dayKey = dayStart.toISOString().split('T')[0] // YYYY-MM-DD format
        
        revenueByMonth.push({
          month: format(dayStart, 'EEE'), // Mon, Tue, etc.
          year: dayStart.getFullYear(),
          revenue: revenueMap.get(dayKey) || 0,
          target: calculateTarget(1) // Daily target
        })
      }
    } else if (dateRange === 'thisMonth' || dateRange === 'lastMonth' || dateRange === 'last30Days') {
      // Show daily data for month views
      const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      const dailyQuery = `
        SELECT 
          DATE(date) as day,
          COALESCE(SUM(spent), 0) as day_spent
        FROM "CampaignAnalytics"
        WHERE date >= $1 AND date <= $2
        GROUP BY DATE(date)
        ORDER BY day
      `
      const { data: dailyResult } = await safeQuerySchema<{ day: Date, day_spent: number }>(
        orgSlug,
        dailyQuery,
        [startDate, endDate]
      )
      
      // Create a map for quick lookup
      const dailyMap = new Map(
        dailyResult.map(r => [format(new Date(r.day), 'yyyy-MM-dd'), parseFloat(r.day_spent)])
      )
      
      // Fill in all days
      for (let d = 0; d < dayCount && d < 31; d++) {
        const currentDay = new Date(startDate)
        currentDay.setDate(startDate.getDate() + d)
        const dayKey = format(currentDay, 'yyyy-MM-dd')
        
        revenueByMonth.push({
          month: format(currentDay, 'MMM d'),
          year: currentDay.getFullYear(),
          revenue: dailyMap.get(dayKey) || 0,
          target: calculateTarget(1) // Daily target
        })
      }
    } else if (dateRange === 'last90Days') {
      // Show weekly data for 90 days
      const weekCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      for (let w = 0; w < weekCount; w++) {
        const weekStart = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(Math.min(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000, endDate.getTime()))
        
        const weeklyQuery = `
          SELECT COALESCE(SUM(spent), 0) as week_spent
          FROM "CampaignAnalytics"
          WHERE date >= $1 AND date <= $2
        `
        const { data: weeklyResult } = await safeQuerySchema<{ week_spent: number }>(
          orgSlug,
          weeklyQuery,
          [weekStart, weekEnd]
        )
        
        revenueByMonth.push({
          month: `Week ${w + 1}`,
          year: weekStart.getFullYear(),
          revenue: parseFloat(weeklyResult[0]?.week_spent || '0'),
          target: calculateTarget(7) // Weekly target
        })
      }
    } else {
      // Default: Show monthly data for year views or custom ranges
      const monthCount = Math.min(12, Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)))
      for (let i = monthCount - 1; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(endDate, i))
        const monthEnd = endOfMonth(subMonths(endDate, i))
        
        // Only include months within our date range
        if (monthStart <= endDate && monthEnd >= startDate) {
          const monthAnalyticsQuery = `
            SELECT COALESCE(SUM(spent), 0) as month_spent
            FROM "CampaignAnalytics"
            WHERE date >= $1 AND date <= $2
          `
          const { data: monthResult } = await safeQuerySchema<{ month_spent: number }>(
            orgSlug,
            monthAnalyticsQuery,
            [monthStart > startDate ? monthStart : startDate, monthEnd < endDate ? monthEnd : endDate]
          )
          
          revenueByMonth.push({
            month: format(monthStart, 'MMM'),
            year: monthStart.getFullYear(),
            revenue: parseFloat(monthResult[0]?.month_spent || '0'),
            target: calculateTarget(30) // Monthly target (approximate 30 days)
          })
        }
      }
    }

    // Get campaign status distribution for campaigns in the date range
    const dateFilteredCampaigns = campaigns.filter(c => 
      c.startDate <= endDate && c.endDate >= startDate
    )
    
    const statusCounts: Record<string, number> = {}
    dateFilteredCampaigns.forEach(campaign => {
      statusCounts[campaign.status] = (statusCounts[campaign.status] || 0) + 1
    })

    const totalCampaigns = dateFilteredCampaigns.length
    const campaignStatusData = Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: totalCampaigns > 0 ? Math.round((count / totalCampaigns) * 100) : 0
    }))

    // Get top performing shows with revenue from campaigns in the date range
    const shows = await SchemaModels.show?.findMany?.(orgSlug, {
      organizationId
    }) || []

    // Get revenue per show from campaign analytics in the date range
    // Note: Since Episodes don't have direct campaignId, we'll just show the shows with their basic info
    // In the future, you might want to add a many-to-many relationship between campaigns and shows/episodes
    const showRevenueQuery = `
      SELECT 
        s.id as show_id,
        0 as revenue,
        0 as impressions
      FROM org_${orgSlug.replace(/-/g, '_')}."Show" s
      WHERE s."organizationId" = $1
      ORDER BY s."createdAt" DESC
      LIMIT 5
    `
    
    const { data: showRevenueResult } = await safeQuerySchema<{ show_id: string, revenue: number, impressions: number }>(
      orgSlug,
      showRevenueQuery,
      [organizationId]
    )
    
    // Map shows with their revenue data
    const topShows = showRevenueResult.map(result => {
      const show = shows.find(s => s.id === result.show_id)
      if (!show) return null
      
      return {
        id: show.id,
        name: show.name,
        host: show.host || 'Unknown Host',
        category: show.category || 'General',
        revenue: result.revenue,
        impressions: result.impressions.toString(),
        trend: 'stable' as const,
        change: 0
      }
    }).filter(Boolean)

    // Since we don't have activity model, return empty activities
    const activities: any[] = []

    // Get upcoming campaign deadlines from organization schema
    const allCampaigns = await SchemaModels.campaign.findMany(orgSlug, {
      organizationId
    })
    
    // Filter for upcoming campaigns (Next 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const upcomingCampaigns = allCampaigns
      .filter(c => c.endDate >= now && c.endDate <= thirtyDaysFromNow)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
      .slice(0, 5)

    const deadlines = upcomingCampaigns.map(campaign => {
      const daysUntilDue = Math.ceil((campaign.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      return {
        id: campaign.id,
        title: `Campaign Ends: ${campaign.name}`,
        description: 'Campaign deadline approaching',
        dueDate: campaign.endDate.toISOString(),
        daysUntilDue,
        priority: daysUntilDue <= 3 ? 'high' : daysUntilDue <= 7 ? 'medium' : 'low',
        type: 'campaign',
        status: campaign.status
      }
    })

    // Get real counts for quick stats from organization schema
    const allShows = await SchemaModels.show?.findMany?.(orgSlug, { organizationId }) || []
    const allAdvertisers = await SchemaModels.advertiser?.findMany?.(orgSlug, { organizationId }) || []
    const allEpisodesRaw = await SchemaModels.episode?.findMany?.(orgSlug) || []
    
    // Convert episode dates
    const allEpisodes = allEpisodesRaw.map(e => ({
      ...e,
      createdAt: new Date(e.createdAt)
    }))
    
    const totalShowsCount = allShows.length
    const activeShowsCount = allShows.filter(s => s.isActive).length
    const oneMonthAgo = subMonths(now, 1)
    const recentEpisodesCount = allEpisodes.filter(e => 
      e.createdAt >= oneMonthAgo
    ).length
    const totalAdvertisersCount = allAdvertisers.length
    
    // For active advertisers, we need to check which have campaigns in the date range
    const activeAdvertiserIds = new Set(
      dateFilteredCampaigns
        .filter(c => c.status === 'active')
        .map(c => c.advertiserId)
    )
    const activeAdvertisersCount = activeAdvertiserIds.size

    const avgBudget = campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + (c.budget || 0), 0) / campaigns.length
      : 0

    // Get analytics metrics from CampaignAnalytics for the selected date range
    const metricsQuery = `
      SELECT 
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(conversions), 0) as total_conversions
      FROM "CampaignAnalytics"
      WHERE date >= $1 AND date <= $2
    `
    const { data: metricsResult } = await safeQuerySchema<{ 
      total_impressions: string, 
      total_clicks: string, 
      total_conversions: string 
    }>(
      orgSlug,
      metricsQuery,
      [startDate, endDate]
    )
    
    const totalImpressions = parseInt(metricsResult[0]?.total_impressions || '0')
    const totalClicks = parseInt(metricsResult[0]?.total_clicks || '0')
    const totalConversions = parseInt(metricsResult[0]?.total_conversions || '0')
    const conversionRate = totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 100) : 0
    const utilizationRate = 0 // Still need to calculate from inventory

    // Return real data
    const dashboardData = {
      dateRange,
      // Key metrics
      activeCampaigns,
      pendingCampaigns,
      scheduledCampaigns,
      monthlyRevenue,
      totalRevenue: monthlyRevenue, // Use the same date-filtered revenue
      revenueGrowth,
      totalImpressions,
      conversionRate,
      totalClicks,
      totalConversions,
      
      // Charts data
      revenueByMonth,
      campaignStatusData,
      
      // Lists
      topShows,
      recentActivity: activities,
      upcomingDeadlines: deadlines,
      
      // Additional stats
      totalShows: totalShowsCount,
      activeShows: activeShowsCount,
      recentEpisodes: recentEpisodesCount,
      totalAdvertisers: totalAdvertisersCount,
      activeAdvertisers: activeAdvertisersCount,
      avgBudget,
      utilizationRate
    }

    console.log('✅ Dashboard API: Successfully fetched data')
    console.log('📊 Dashboard API: Final response data:', {
      activeCampaigns: dashboardData.activeCampaigns,
      monthlyRevenue: dashboardData.monthlyRevenue,
      totalRevenue: dashboardData.totalRevenue,
      campaignsCount: campaigns.length,
      showsCount: totalShowsCount,
      advertisersCount: totalAdvertisersCount
    })
    
    // The dashboard expects the data directly, not wrapped in a data property
    return NextResponse.json(dashboardData)

  } catch (error: any) {
    console.error('❌ Dashboard API Error:', error)
    console.error('❌ Dashboard API Error Stack:', error.stack)
    console.error('❌ Dashboard API Error Details:', error.message)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error.message,
        type: error.name
      },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest) => {
  // Call the handler directly with proper authentication check
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return getHandler(request as AuthenticatedRequest)
}