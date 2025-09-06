import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, getAllOrganizationSlugs } from '@/lib/db/schema-db'
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
    
    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    let orgSlug: string | null = null
    let orgSlugs: string[] = []
    
    if (role === 'master') {
      // Master can see all organizations
      orgSlugs = await getAllOrganizationSlugs()
    } else {
      // Regular users only see their organization
      orgSlug = await getUserOrgSlug(user.id)
      if (!orgSlug) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }
      orgSlugs = [orgSlug]
    }

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const limit = parseInt(url.searchParams.get('limit') || '5')
    const sort = url.searchParams.get('sort') || 'revenue:desc'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')

    console.log('📊 Analytics Campaigns API: Fetching campaign performance', { timeRange, customStartDate, customEndDate, limit, sort, organizationId })

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

    // Fetch campaigns from organization schemas
    let allCampaigns: any[] = []
    
    for (const slug of orgSlugs) {
      try {
        const campaignsQuery = `
          SELECT 
            c.*,
            a.id as advertiser_id,
            a.name as advertiser_name,
            (SELECT COUNT(*) FROM "AdApproval" WHERE "campaignId" = c.id) as ad_approval_count
          FROM "Campaign" c
          LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
          WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
        `
        
        const campaigns = await querySchema<any>(slug, campaignsQuery, [startDate, endDate])
        
        // Add organization context
        const campaignsWithOrg = campaigns.map((campaign: any) => ({
          ...campaign,
          organizationSlug: slug,
          advertiser: campaign.advertiser_id ? {
            id: campaign.advertiser_id,
            name: campaign.advertiser_name
          } : null,
          _count: {
            adApprovals: parseInt(campaign.ad_approval_count) || 0
          }
        }))
        
        allCampaigns.push(...campaignsWithOrg)
      } catch (error) {
        console.error(`Error fetching campaigns from ${slug}:`, error)
        // Continue with other organizations
      }
    }
    
    const campaigns = allCampaigns

    // Calculate performance metrics for each campaign
    const campaignPerformance = campaigns.map(campaign => {
      // Calculate impressions from campaign budget
      // Estimate 10K impressions per $1000 budget
      let impressions = Math.floor((campaign.budget || 0) * 10)
      
      // Estimate other metrics
      const clicks = Math.floor(impressions * 0.02) // 2% CTR
      const conversions = Math.floor(clicks * 0.1) // 10% conversion rate
      const revenue = conversions * 150 // $150 per conversion
      const spend = (campaign.budget || 0) * 0.8 // Estimate 80% spend
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      
      return {
        name: campaign.name,
        advertiser: campaign.advertiser?.name || 'Unknown',
        revenue,
        impressions,
        clicks,
        ctr,
        conversions,
        roi,
        spend,
        adApprovalCount: campaign._count.adApprovals,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate
      }
    })

    // Sort campaigns based on sort parameter
    const [sortField, sortOrder] = sort.split(':')
    campaignPerformance.sort((a, b) => {
      const aValue = a[sortField as keyof typeof a] || 0
      const bValue = b[sortField as keyof typeof b] || 0
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1
      } else {
        return aValue > bValue ? 1 : -1
      }
    })

    // Limit results
    const topCampaigns = campaignPerformance.slice(0, limit)

    console.log(`✅ Analytics Campaigns API: Returning top ${topCampaigns.length} campaigns`)

    return NextResponse.json({
      data: topCampaigns
    })

  } catch (error) {
    console.error('❌ Analytics Campaigns API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}