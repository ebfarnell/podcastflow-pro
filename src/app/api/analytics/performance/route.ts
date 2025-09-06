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
        '/api/analytics/performance',
        request
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')

    console.log('📊 Analytics Performance API: Fetching performance data', { timeRange, customStartDate, customEndDate, organizationId })

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    
    if (customStartDate && customEndDate) {
      // Use custom date range
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      // Use predefined time range
      startDate = new Date()
      switch (timeRange) {
        case '1d':
          startDate.setDate(now.getDate() - 1)
          break
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
    }

    // Fetch campaigns for the time range using schema-aware queries
    const campaignsQuery = `
      SELECT * FROM "Campaign" 
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
      ORDER BY "createdAt" ASC
    `
    const campaigns = await querySchema<any>(orgSlug, campaignsQuery, [startDate, endDate])

    // Generate performance metrics by day
    const performanceData = []
    const current = new Date(startDate)
    const performanceByDate = new Map()
    
    // Group campaigns by date and calculate metrics
    campaigns.forEach(campaign => {
      const date = new Date(campaign.createdAt).toISOString().split('T')[0]
      
      if (!performanceByDate.has(date)) {
        performanceByDate.set(date, {
          impressions: 0,
          clicks: 0,
          episodes: 0,
          campaigns: new Set()
        })
      }
      
      const dayData = performanceByDate.get(date)
      // Estimate impressions based on campaign budget (10K impressions per $1000)
      const estimatedImpressions = Math.floor((campaign.budget || 0) * 10)
      dayData.impressions += estimatedImpressions
      dayData.clicks += Math.floor(estimatedImpressions * 0.02) // 2% CTR estimate
      dayData.campaigns.add(campaign.id)
    })
    
    // Fill in all days in the range
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const dayData = performanceByDate.get(dateStr) || {
        impressions: 0,
        clicks: 0,
        episodes: 0,
        campaigns: new Set()
      }
      
      const conversions = Math.floor(dayData.clicks * 0.1) // 10% conversion rate estimate
      const ctr = dayData.impressions > 0 ? (dayData.clicks / dayData.impressions) * 100 : 0
      const cvr = dayData.clicks > 0 ? (conversions / dayData.clicks) * 100 : 0
      
      performanceData.push({
        date: dateStr,
        impressions: dayData.impressions,
        clicks: dayData.clicks,
        conversions,
        ctr,
        cvr
      })
      
      current.setDate(current.getDate() + 1)
    }

    console.log(`✅ Analytics Performance API: Returning ${performanceData.length} data points`)

    return NextResponse.json({
      data: performanceData
    })

  } catch (error) {
    console.error('❌ Analytics Performance API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}