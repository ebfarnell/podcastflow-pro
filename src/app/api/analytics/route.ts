import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    // Validate session
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
        '/api/analytics',
        request
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const campaignFilter = url.searchParams.get('campaignFilter') || 'all'

    console.log('📊 Analytics API: Fetching analytics', { timeRange, campaignFilter, organizationId })

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

    // Build where clause based on user role
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: now
      }
    }

    // Organization-specific filtering (except for master)
    if (role !== 'master') {
      whereClause.organizationId = organizationId
    }

    // Apply campaign filter if needed
    if (campaignFilter !== 'all') {
      whereClause.id = campaignFilter
    }

    // Fetch campaigns with related data using schema-aware queries
    let campaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name, a.email as advertiser_email
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
    `
    const queryParams = [startDate, now]
    
    // Apply campaign filter if needed
    if (campaignFilter !== 'all') {
      campaignsQuery += ` AND c.id = $3`
      queryParams.push(campaignFilter)
    }
    
    const { data: campaignsRaw, error: campaignsError } = await safeQuerySchema<any>(orgSlug, campaignsQuery, queryParams)
    if (campaignsError) {
      console.error('Failed to fetch campaigns:', campaignsError)
      // Return empty data instead of 500 error
      return NextResponse.json({
        kpis: {
          totalRevenue: 0,
          revenueGrowth: 0,
          activeCampaigns: 0,
          campaignGrowth: 0,
          totalImpressions: 0,
          impressionGrowth: 0,
          uniqueListeners: 0,
          listenerGrowth: 0,
          averageCTR: 0,
          conversionRate: 0
        },
        revenueData: [],
        performanceData: [],
        audienceData: [],
        campaignPerformance: [],
        summary: {
          totalCampaigns: 0,
          activeCampaigns: 0,
          completedCampaigns: 0,
          totalBudget: 0,
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalRevenue: 0,
          roi: 0,
          avgCTR: 0,
          avgConversionRate: 0,
          avgCostPerClick: 0,
          avgCostPerConversion: 0
        },
        timeRange,
        campaignFilter,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString()
        }
      })
    }
    
    // Transform campaigns to match expected format
    const campaigns = campaignsRaw.map(c => ({
      ...c,
      advertiser: c.advertiser_id ? {
        id: c.advertiser_id,
        name: c.advertiser_name,
        email: c.advertiser_email
      } : null
    }))

    // Fetch real analytics data using schema-aware queries
    const analyticsQuery = `
      SELECT 
        ca.*,
        c.id as campaign_id, c.name as campaign_name
      FROM "CampaignAnalytics" ca
      LEFT JOIN "Campaign" c ON c.id = ca."campaignId"
      WHERE ca.date >= $1 AND ca.date <= $2
    `
    const { data: campaignAnalyticsRaw } = await safeQuerySchema<any>(orgSlug, analyticsQuery, [startDate, now])
    
    // Transform analytics to match expected format
    const campaignAnalytics = campaignAnalyticsRaw.map(ca => ({
      ...ca,
      campaign: ca.campaign_id ? {
        id: ca.campaign_id,
        name: ca.campaign_name
      } : null
    }))

    // Calculate metrics from real data
    const totalCampaigns = campaigns.length
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0)
    
    // Calculate real metrics from analytics data
    let totalImpressions = 0
    let totalClicks = 0
    let totalSpend = 0
    
    // Use real analytics data if available
    if (campaignAnalytics.length > 0) {
      campaignAnalytics.forEach(analytics => {
        totalImpressions += analytics.impressions
        totalClicks += analytics.clicks
        totalSpend += analytics.spent
      })
    } else {
      // No analytics data available - return zeros instead of estimates
      totalImpressions = 0
      totalClicks = 0
      totalSpend = 0
    }

    // Calculate conversions from real analytics data
    let totalConversions = 0
    if (campaignAnalytics.length > 0) {
      totalConversions = campaignAnalytics.reduce((sum, analytics) => sum + analytics.conversions, 0)
    } else {
      totalConversions = 0 // No data - return zero instead of estimate
    }

    // Calculate averages
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    const avgCostPerClick = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCostPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0

    // Calculate revenue from real data or estimate
    const totalRevenue = totalConversions * 150 // Assuming $150 per conversion for now
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0

    // Get previous period data for growth calculations
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - (now.getDate() - startDate.getDate()))
    
    const previousWhere = {
      ...whereClause,
      createdAt: {
        gte: previousStartDate,
        lt: startDate
      }
    }

    // Fetch previous period campaigns using schema-aware query
    const previousCampaignsQuery = `
      SELECT * FROM "Campaign" 
      WHERE "createdAt" >= $1 AND "createdAt" < $2
    `
    const { data: previousCampaigns } = await safeQuerySchema<any>(orgSlug, previousCampaignsQuery, [previousStartDate, startDate])

    const previousRevenue = previousCampaigns.reduce((sum, c) => {
      const estimatedImpressions = Math.floor((c.budget || 0) * 10)
      const clicks = Math.floor(estimatedImpressions * 0.02)
      const conversions = Math.floor(clicks * 0.1)
      return sum + (conversions * 150)
    }, 0)

    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0

    // Build response with comprehensive analytics data
    const response = {
      kpis: {
        totalRevenue,
        revenueGrowth,
        activeCampaigns,
        campaignGrowth: previousCampaigns.length > 0 ? ((activeCampaigns - previousCampaigns.filter(c => c.status === 'active').length) / previousCampaigns.filter(c => c.status === 'active').length) * 100 : 0,
        totalImpressions,
        impressionGrowth: 0, // TODO: Calculate from previous period
        uniqueListeners: Math.floor(totalImpressions * 0.7), // Estimate 70% unique
        listenerGrowth: 0, // TODO: Calculate from previous period
        averageCTR: avgCTR,
        conversionRate: avgConversionRate
      },
      revenueData: [], // Will be populated by revenue endpoint
      performanceData: [], // Will be populated by performance endpoint
      audienceData: [], // Will be populated by audience endpoint
      campaignPerformance: [], // Will be populated by campaigns endpoint
      summary: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        totalBudget,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        roi,
        avgCTR,
        avgConversionRate,
        avgCostPerClick,
        avgCostPerConversion
      },
      // Indicate which data sources are unavailable
      sourcesUnavailable: campaignAnalytics.length === 0 ? ['analytics'] : [],
      timeRange,
      campaignFilter,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    }

    console.log(`✅ Analytics API: Returning analytics summary for ${totalCampaigns} campaigns`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Analytics API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return getHandler(authenticatedRequest)
}