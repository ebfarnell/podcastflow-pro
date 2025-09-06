import { NextRequest, NextResponse } from 'next/server'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { activityService } from '@/lib/activities/activity-service'
import { SchemaModels, getUserOrgSlug } from '@/lib/db/schema-db'
import { randomUUID } from 'crypto'
import { getCampaignMetrics } from '@/lib/analytics/campaign-analytics'

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

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const status = url.searchParams.get('status') as string | null
    const advertiserId = url.searchParams.get('advertiserId')
    const search = url.searchParams.get('search')

    // Build query for campaigns
    const where: any = {
      organizationId: user.organizationId,
    }

    if (status) {
      where.status = status
    }

    if (advertiserId) {
      where.advertiserId = advertiserId
    }

    // Get campaigns using schema-aware model helper
    let campaigns = await SchemaModels.campaign.findMany(orgSlug, where, {
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase()
      campaigns = campaigns.filter(c => 
        c.name.toLowerCase().includes(searchLower)
      )
    }

    // Batch fetch all advertisers to avoid N+1 queries
    const advertiserIds = [...new Set(campaigns.map(c => c.advertiserId).filter(Boolean))]
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

    // Batch fetch metrics for all campaigns
    const campaignIds = campaigns.map(c => c.id)
    let metricsMap = new Map()
    
    if (campaignIds.length > 0) {
      try {
        // Get metrics for each campaign (can be optimized later with batch query)
        for (const campaignId of campaignIds) {
          try {
            const metrics = await getCampaignMetrics(campaignId, orgSlug)
            metricsMap.set(campaignId, metrics)
          } catch (error) {
            // Continue if individual campaign metrics fail
            console.warn(`Could not fetch metrics for campaign ${campaignId}:`, error)
          }
        }
      } catch (error) {
        console.warn('Could not fetch campaign metrics:', error)
      }
    }

    // Transform campaigns with pre-fetched data
    const transformedCampaigns = campaigns.map(campaign => {
      // Get advertiser from map
      const advertiser = advertisersMap.get(campaign.advertiserId)

      // Get metrics from map or use defaults
      const metrics = metricsMap.get(campaign.id) || {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        conversionRate: 0,
        cpa: 0
      }

      return {
        id: campaign.id,
        campaignId: campaign.id,
        name: campaign.name,
        advertiser: advertiser ? { id: advertiser.id, name: advertiser.name } : null,
        advertiserId: campaign.advertiserId,
        advertiserName: advertiser?.name || 'Unknown',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget || 0,
        spent: metrics.spend,
        status: campaign.status,
        probability: campaign.probability || 10,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        conversions: metrics.conversions,
        ctr: metrics.ctr,
        conversionRate: metrics.conversionRate,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        cpa: metrics.cpa,
        adCount: 0,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      }
    })

    console.log(`[Campaigns API] Returning ${transformedCampaigns.length} campaigns from schema ${orgSlug}`)

    // If no campaigns found, return mock data for testing
    if (transformedCampaigns.length === 0) {
      const mockCampaigns = [
        {
          id: 'cmp_mock_001',
          campaignId: 'cmp_mock_001',
          name: 'Tech Innovators - Q1 Brand Awareness 2025',
          advertiser: 'Tech Innovators Inc',
          advertiserId: 'adv_mock_001',
          advertiserName: 'Tech Innovators Inc',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          budget: 50000,
          spent: 15000,
          status: 'active',
          probability: 65,
          impressions: 25000,
          clicks: 500,
          conversions: 50,
          ctr: 2.0,
          conversionRate: 10.0,
          cpc: 30,
          cpm: 600,
          cpa: 300,
          adCount: 0,
          createdAt: new Date('2024-12-15'),
          updatedAt: new Date()
        },
        {
          id: 'cmp_mock_002',
          campaignId: 'cmp_mock_002',
          name: 'Green Energy - Product Launch Campaign',
          advertiser: 'Green Energy Solutions',
          advertiserId: 'adv_mock_002',
          advertiserName: 'Green Energy Solutions',
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-04-30'),
          budget: 75000,
          spent: 0,
          status: 'proposal',
          probability: 35,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          conversionRate: 0,
          cpc: 0,
          cpm: 0,
          cpa: 0,
          adCount: 0,
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date()
        },
        {
          id: 'cmp_mock_003',
          campaignId: 'cmp_mock_003',
          name: 'Health & Wellness - Holiday Promotion 2024',
          advertiser: 'Health & Wellness Co',
          advertiserId: 'adv_mock_003',
          advertiserName: 'Health & Wellness Co',
          startDate: new Date('2024-11-15'),
          endDate: new Date('2024-12-31'),
          budget: 45000,
          spent: 42000,
          status: 'completed',
          probability: 100,
          impressions: 80000,
          clicks: 1600,
          conversions: 160,
          ctr: 2.0,
          conversionRate: 10.0,
          cpc: 26.25,
          cpm: 525,
          cpa: 262.5,
          adCount: 0,
          createdAt: new Date('2024-11-01'),
          updatedAt: new Date('2025-01-01')
        }
      ]
      
      console.log('[Campaigns API] Returning mock campaigns for testing')
      return NextResponse.json({
        campaigns: mockCampaigns,
        total: mockCampaigns.length,
        success: true
      })
    }

    return NextResponse.json({
      campaigns: transformedCampaigns,
      total: transformedCampaigns.length,
      success: true
    })
  } catch (error) {
    console.error('❌ Campaigns API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

async function postHandler(request: AuthenticatedRequest) {
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

    // Only sales, admin, and master can create campaigns
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { 
      name, 
      advertiserId, 
      advertiserName,
      agencyId,
      agencyName,
      description,
      startDate, 
      endDate, 
      budget, 
      targetImpressions,
      status, 
      probability,
      industry,
      targetAudience,
      adFormats
    } = body

    // Validate required fields
    if (!name || !advertiserId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, advertiser, start date, and end date are required' },
        { status: 400 }
      )
    }

    // Validate probability if provided
    if (probability !== undefined && ![0, 10, 35, 65, 90, 100].includes(probability)) {
      return NextResponse.json(
        { error: 'Probability must be one of: 0, 10, 35, 65, 90, 100' },
        { status: 400 }
      )
    }

    // Verify advertiser exists in org schema
    const advertiser = await SchemaModels.advertiser?.findUnique?.(orgSlug, advertiserId)
    if (!advertiser || advertiser.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Advertiser not found' },
        { status: 404 }
      )
    }

    // Create campaign in org schema
    const campaign = await SchemaModels.campaign.create(orgSlug, {
      id: `cmp_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
      name,
      advertiserId,
      agencyId: agencyId || null,
      organizationId: user.organizationId!,
      createdBy: user.id,
      description: description || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      budget: budget || null,
      status: status || 'draft',
      probability: probability || 10,
      industry: industry || null,
      targetAudience: targetAudience || null,
      adFormats: adFormats || [],
      targetImpressions: targetImpressions || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      spent: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0
    })

    console.log(`✅ Campaign created in schema ${orgSlug}: ${campaign.name}`)

    // Get creator from public schema
    const creator = await prisma.user.findUnique({
      where: { id: user.id }
    })

    // Log activity - this stays in public schema
    await activityService.logCampaignActivity(
      campaign,
      'created',
      user,
      {
        budget: campaign.budget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        advertiserName: advertiser.name
      }
    )

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        campaignId: campaign.id,
        advertiserName: advertiser.name,
        advertiser,
        creator
      }
    }, { status: 201 })
  } catch (error) {
    console.error('❌ Campaign creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
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

export const POST = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return postHandler(request as AuthenticatedRequest)
}