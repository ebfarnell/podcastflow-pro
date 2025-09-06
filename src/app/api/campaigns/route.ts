import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma' // Only for public schema
import { getCampaignMetrics } from '@/lib/analytics/campaign-analytics'
import { notifyCampaignCreated } from '@/lib/notifications/notifier-service'
import { randomUUID } from 'crypto'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns
 * List campaigns with tenant isolation
 */
export async function GET(request: NextRequest) {
  try {
    return await withTenantIsolation(request, async (context) => {
      try {
      const url = new URL(request.url)
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const status = url.searchParams.get('status') as string | null
      const advertiserId = url.searchParams.get('advertiserId')
      const search = url.searchParams.get('search')

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Build query for campaigns
      const where: any = {}

      if (status) {
        where.status = status
      }

      if (advertiserId) {
        where.advertiserId = advertiserId
      }

      // Get campaigns using tenant-isolated client
      let campaigns = await tenantDb.campaign.findMany({
        where,
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

      // Filter out campaigns with pending or approved deletion requests
      const deletionRequests = await prisma.deletionRequest.findMany({
        where: {
          entityType: 'campaign',
          status: { in: ['pending', 'approved'] },
          organizationId: context.organizationId
        },
        select: {
          entityId: true,
          status: true
        }
      })
      
      const deletionIds = new Set(deletionRequests.map(dr => dr.entityId))
      campaigns = campaigns.filter(c => !deletionIds.has(c.id))
      
      // Log if we filtered out any campaigns
      if (deletionIds.size > 0) {
        console.log(`[Campaigns API] Filtered out ${deletionIds.size} campaigns with deletion requests`)
      }

      // Batch fetch all advertisers to avoid N+1 queries
      const advertiserIds = [...new Set(campaigns.map(c => c.advertiserId).filter(Boolean))]
      let advertisersMap = new Map()
      
      if (advertiserIds.length > 0) {
        try {
          const advertisers = await tenantDb.advertiser.findMany({
            where: { id: { in: advertiserIds } }
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
              const metrics = await getCampaignMetrics(campaignId, context.organizationSlug)
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
          probability: campaign.probability !== undefined ? campaign.probability : 10,
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

      console.log(`[Campaigns API] Returning ${transformedCampaigns.length} campaigns for ${context.organizationSlug}`)

      return NextResponse.json(transformedCampaigns)
    } catch (error) {
      console.error('[Campaigns API] Error fetching campaigns:', error)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }
  })
  } catch (error: any) {
    // Handle authentication/authorization errors
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('[Campaigns API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign with tenant isolation
 */
export async function POST(request: NextRequest) {
  try {
    return await withTenantIsolation(request, async (context) => {
      try {
      const data = await request.json()
      console.log('[Campaigns API] Creating campaign:', data)

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Validate advertiser exists in tenant
      if (data.advertiserId) {
        const advertiser = await tenantDb.advertiser.findUnique({
          where: { id: data.advertiserId }
        })
        
        if (!advertiser) {
          return NextResponse.json(
            { error: 'Advertiser not found' },
            { status: 404 }
          )
        }
      }

      // Validate agency exists in tenant (if provided)
      if (data.agencyId) {
        const agency = await tenantDb.agency.findUnique({
          where: { id: data.agencyId }
        })
        
        if (!agency) {
          return NextResponse.json(
            { error: 'Agency not found' },
            { status: 404 }
          )
        }
      }

      // Filter out non-database fields before creating campaign
      // Keep adFormats as it's now a database column (JSONB)
      const {
        advertiserName,
        agencyName,
        ...campaignData
      } = data

      // Create the campaign with 10% default probability (Active Pre-Sale)
      const campaign = await tenantDb.campaign.create({
        data: {
          id: randomUUID(),
          ...campaignData,
          organizationId: context.organizationId,
          createdBy: context.userId,
          updatedBy: context.userId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          updatedAt: new Date(),
          // Set default probability to 10% if not provided
          probability: campaignData.probability ?? 10,
          // Set default status to 'active-presale' if not provided
          status: campaignData.status || 'active-presale'
        }
      })

      console.log(`[Campaigns API] Created campaign with ID: ${campaign.id}`)

      // Log activity in public schema
      await prisma.systemLog.create({
        data: {
          level: 'info',
          message: `Campaign created: ${campaign.name}`,
          userId: context.userId,
          organizationId: context.organizationId,
          source: 'campaign-api',
          metadata: {
            campaignId: campaign.id,
            advertiserId: campaign.advertiserId,
            budget: campaign.budget
          }
        }
      })

      // Get advertiser name for notification (if not provided in request)
      let finalAdvertiserName = advertiserName || 'Unknown'
      if (!advertiserName && campaign.advertiserId) {
        const advertiser = await tenantDb.advertiser.findUnique({
          where: { id: campaign.advertiserId },
          select: { name: true }
        })
        finalAdvertiserName = advertiser?.name || 'Unknown'
      }

      // Send notification for campaign creation
      await notifyCampaignCreated(
        campaign.id,
        campaign.name,
        finalAdvertiserName,
        campaign.status || 'active-presale',
        context.userId, // Seller ID is the creator
        context.organizationId
      )

      return NextResponse.json(campaign, { status: 201 })
    } catch (error) {
      console.error('[Campaigns API] Error creating campaign:', error)
      return NextResponse.json(
        { error: 'Failed to create campaign', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
  } catch (error: any) {
    // Handle authentication/authorization errors
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('[Campaigns API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}