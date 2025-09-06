import { NextRequest, NextResponse } from 'next/server'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import { SchemaModels, getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can view lost campaigns
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const sellerId = url.searchParams.get('sellerId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build query filters for lost campaigns
    const where: any = {
      organizationId: user.organizationId,
      status: 'lost'
    }

    // Add seller filter if provided
    if (sellerId) {
      where.createdBy = sellerId
    }

    // Get lost campaigns
    const campaigns = await SchemaModels.campaign.findMany(orgSlug, where, {
      orderBy: { updatedAt: 'desc' }
    })

    // Apply date filtering in JavaScript
    let filteredCampaigns = campaigns
    if (startDate || endDate) {
      filteredCampaigns = filteredCampaigns.filter(campaign => {
        const campaignStart = new Date(campaign.startDate)
        const campaignEnd = new Date(campaign.endDate)
        
        if (startDate && endDate) {
          const filterStart = new Date(startDate)
          const filterEnd = new Date(endDate)
          return campaignStart <= filterEnd && campaignEnd >= filterStart
        }
        
        if (startDate) {
          const filterStart = new Date(startDate)
          return campaignEnd >= filterStart
        }
        
        if (endDate) {
          const filterEnd = new Date(endDate)
          return campaignStart <= filterEnd
        }
        
        return true
      })
    }

    // Batch fetch advertisers for campaign names
    const advertiserIds = [...new Set(filteredCampaigns.map(c => c.advertiserId).filter(Boolean))]
    let advertisersMap = new Map()
    
    if (advertiserIds.length > 0) {
      try {
        const advertisers = await SchemaModels.advertiser.findMany(orgSlug, {
          id: { in: advertiserIds }
        })
        advertisersMap = new Map(advertisers.map(a => [a.id, a]))
      } catch (error) {
        console.warn('Could not fetch advertisers:', error)
      }
    }

    // Get users for seller information from public schema
    const usersQuery = `
      SELECT id, name, email FROM "User" 
      WHERE "organizationId" = $1 AND role IN ('sales', 'admin')
    `
    const users = await querySchema('public', usersQuery, [user.organizationId])
    const usersMap = new Map(users.map(u => [u.id, u]))

    // Enhance campaigns with related data
    const enhancedCampaigns = filteredCampaigns.map(campaign => {
      const advertiser = advertisersMap.get(campaign.advertiserId)
      const seller = usersMap.get(campaign.createdBy)

      return {
        id: campaign.id,
        name: campaign.name,
        advertiser: advertiser?.name || 'Unknown',
        advertiserName: advertiser?.name || 'Unknown',
        seller: seller?.name || seller?.email || 'Unknown',
        sellerId: campaign.createdBy,
        budget: campaign.budget || 0,
        probability: campaign.probability || 0,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: campaign.status,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        daysInPipeline: Math.floor((new Date(campaign.updatedAt).getTime() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        lostDate: campaign.updatedAt // When it was marked as lost
      }
    })

    // Calculate summary statistics
    const summary = {
      totalLostCampaigns: enhancedCampaigns.length,
      totalLostValue: enhancedCampaigns.reduce((sum, c) => sum + c.budget, 0),
      averageLostDealSize: enhancedCampaigns.length > 0 ? 
        enhancedCampaigns.reduce((sum, c) => sum + c.budget, 0) / enhancedCampaigns.length : 0,
      averageTimeInPipeline: enhancedCampaigns.length > 0 ?
        enhancedCampaigns.reduce((sum, c) => sum + c.daysInPipeline, 0) / enhancedCampaigns.length : 0,
      lostByMonth: {} // Could be implemented later for trend analysis
    }

    // Get sellers list for filter dropdown
    const sellers = users.map(u => ({ id: u.id, name: u.name || u.email }))

    console.log(`[Lost Campaigns API] Returning ${enhancedCampaigns.length} lost campaigns, total value: $${summary.totalLostValue.toLocaleString()}`)

    return NextResponse.json({
      success: true,
      lostCampaigns: enhancedCampaigns,
      summary,
      filters: {
        sellers
      }
    })
  } catch (error) {
    console.error('❌ Lost Campaigns API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lost campaigns' },
      { status: 500 }
    )
  }
}

// Export handlers
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return getHandler(request as AuthenticatedRequest)
}