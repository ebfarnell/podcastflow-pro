/**
 * REFACTORED: Campaigns API Route with Tenant Isolation
 * 
 * This is an example of how to properly implement tenant isolation
 * in API routes. All tenant-scoped data access goes through the
 * tenant isolation layer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma' // Only for public schema
import { z } from 'zod'

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  advertiserId: z.string(),
  agencyId: z.string().optional(),
  budget: z.number().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'cancelled']),
  goals: z.string().optional(),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
})

const campaignFiltersSchema = z.object({
  status: z.enum(['all', 'draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'cancelled']).optional(),
  advertiserId: z.string().optional(),
  agencyId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'startDate', 'endDate', 'budget', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * GET /api/campaigns
 * List campaigns with tenant isolation
 */
export async function GET(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      // Parse and validate query parameters
      const searchParams = Object.fromEntries(request.nextUrl.searchParams)
      const filters = campaignFiltersSchema.parse(searchParams)
      
      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)
      
      // Build where clause
      const where: any = {}
      
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status
      }
      
      if (filters.advertiserId) {
        where.advertiserId = filters.advertiserId
      }
      
      if (filters.agencyId) {
        where.agencyId = filters.agencyId
      }
      
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search } },
          { goals: { contains: filters.search } },
          { notes: { contains: filters.search } }
        ]
      }
      
      if (filters.startDate) {
        where.startDate = { gte: new Date(filters.startDate) }
      }
      
      if (filters.endDate) {
        where.endDate = { lte: new Date(filters.endDate) }
      }
      
      // Calculate pagination
      const skip = (filters.page - 1) * filters.limit
      
      // Execute queries with tenant isolation
      const [campaigns, totalCount] = await Promise.all([
        tenantDb.campaign.findMany({
          where,
          orderBy: { [filters.sortBy]: filters.sortOrder },
          take: filters.limit,
          skip,
          include: {
            advertiser: true,
            agency: true,
            _count: {
              select: {
                orders: true,
                adApprovals: true,
              }
            }
          }
        }),
        tenantDb.campaign.count({ where })
      ])
      
      // Get user details from public schema for created/updated by
      const userIds = [...new Set([
        ...campaigns.map(c => c.createdBy).filter(Boolean),
        ...campaigns.map(c => c.updatedBy).filter(Boolean)
      ])]
      
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
      
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))
      
      // Format response
      const formattedCampaigns = campaigns.map(campaign => ({
        ...campaign,
        createdByUser: campaign.createdBy ? userMap[campaign.createdBy] : null,
        updatedByUser: campaign.updatedBy ? userMap[campaign.updatedBy] : null,
      }))
      
      return NextResponse.json({
        campaigns: formattedCampaigns,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / filters.limit)
        }
      })
      
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request parameters', details: error.errors },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }
  })
}

/**
 * POST /api/campaigns
 * Create a new campaign with tenant isolation
 */
export async function POST(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      const body = await request.json()
      const validatedData = createCampaignSchema.parse(body)
      
      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)
      
      // Verify advertiser belongs to this tenant
      const advertiser = await tenantDb.advertiser.findUnique({
        where: { id: validatedData.advertiserId }
      })
      
      if (!advertiser) {
        return NextResponse.json(
          { error: 'Advertiser not found' },
          { status: 404 }
        )
      }
      
      // Verify agency belongs to this tenant (if provided)
      if (validatedData.agencyId) {
        const agency = await tenantDb.agency.findUnique({
          where: { id: validatedData.agencyId }
        })
        
        if (!agency) {
          return NextResponse.json(
            { error: 'Agency not found' },
            { status: 404 }
          )
        }
      }
      
      // Create campaign with tenant isolation
      const campaign = await tenantDb.campaign.create({
        data: {
          ...validatedData,
          organizationId: context.organizationId,
          createdBy: context.userId,
          updatedBy: context.userId,
          // Ensure dates are properly formatted
          startDate: new Date(validatedData.startDate),
          endDate: new Date(validatedData.endDate),
        },
        include: {
          advertiser: true,
          agency: true,
        }
      })
      
      // Log activity in public schema
      await prisma.systemLog.create({
        data: {
          level: 'info',
          message: `Campaign created: ${campaign.name}`,
          userId: context.userId,
          organizationId: context.organizationId,
          metadata: {
            campaignId: campaign.id,
            advertiserId: campaign.advertiserId,
            budget: campaign.budget
          }
        }
      })
      
      // Get user details for response
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { id: true, name: true, email: true }
      })
      
      return NextResponse.json({
        ...campaign,
        createdByUser: user,
        updatedByUser: user,
      }, { status: 201 })
      
    } catch (error) {
      console.error('Error creating campaign:', error)
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      )
    }
  })
}

/**
 * Example: Master account accessing multiple tenants
 */
export async function GET_MASTER_ANALYTICS(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    // Only master accounts can access this endpoint
    if (!context.isMaster) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    try {
      // Get all active organizations
      const organizations = await prisma.organization.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true }
      })
      
      // Collect campaigns from all tenants
      const allCampaigns = []
      
      for (const org of organizations) {
        // Create a temporary context for each organization
        const orgContext = {
          ...context,
          organizationId: org.id,
          organizationSlug: org.slug,
          schemaName: `org_${org.slug.toLowerCase().replace(/-/g, '_')}`
        }
        
        const tenantDb = getTenantClient(orgContext)
        
        // Get campaigns with tenant info
        const campaigns = await tenantDb.campaign.findMany({
          where: { status: 'active' },
          select: {
            id: true,
            name: true,
            budget: true,
            startDate: true,
            endDate: true,
            status: true,
          }
        })
        
        // Add organization info to each campaign
        allCampaigns.push(...campaigns.map(c => ({
          ...c,
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug
          }
        })))
      }
      
      // Return aggregated data
      return NextResponse.json({
        totalCampaigns: allCampaigns.length,
        totalBudget: allCampaigns.reduce((sum, c) => sum + c.budget, 0),
        campaigns: allCampaigns,
        organizationCount: organizations.length
      })
      
    } catch (error) {
      console.error('Error in master analytics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      )
    }
  })
}