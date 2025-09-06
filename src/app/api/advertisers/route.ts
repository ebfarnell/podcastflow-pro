import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import prisma from '@/lib/db/prisma'

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

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const search = url.searchParams.get('search')

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
        '/api/advertisers',
        request
      )
    }

    // Get advertisers from organization schema
    let advertisersQuery = `
      SELECT 
        adv.*,
        ag.id as agency_id,
        ag.name as agency_name,
        ag."contactEmail" as agency_email,
        ag."contactPhone" as agency_phone,
        (SELECT COUNT(*) FROM "Campaign" WHERE "advertiserId" = adv.id) as campaign_count
      FROM "Advertiser" adv
      LEFT JOIN "Agency" ag ON ag.id = adv."agencyId"
      WHERE adv."isActive" = true
    `
    const queryParams: any[] = []
    
    if (search) {
      advertisersQuery += ` AND LOWER(adv.name) LIKE LOWER($1)`
      queryParams.push(`%${search}%`)
    }
    
    advertisersQuery += ` ORDER BY adv.name ASC LIMIT ${limit}`
    
    const advertisersRaw = await querySchema<any>(orgSlug, advertisersQuery, queryParams)
    
    // Filter out advertisers with pending or approved deletion requests
    const deletionRequests = await prisma.deletionRequest.findMany({
      where: {
        entityType: 'advertiser',
        status: { in: ['pending', 'approved'] },
        organizationId: user.organizationId
      },
      select: {
        entityId: true,
        status: true
      }
    })
    
    const deletionIds = new Set(deletionRequests.map(dr => dr.entityId))
    const filteredAdvertisers = advertisersRaw.filter(a => !deletionIds.has(a.id))
    
    if (deletionIds.size > 0) {
      console.log(`[Advertisers API] Filtered out ${deletionIds.size} advertisers with deletion requests`)
    }
    
    // Get sample campaigns for each advertiser
    const advertisers = await Promise.all(filteredAdvertisers.map(async (advertiser: any) => {
      const campaignsQuery = `
        SELECT id, name, status, budget 
        FROM "Campaign" 
        WHERE "advertiserId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 5
      `
      const campaigns = await querySchema<any>(orgSlug, campaignsQuery, [advertiser.id])
      
      return {
        ...advertiser,
        agency: advertiser.agency_id ? {
          id: advertiser.agency_id,
          name: advertiser.agency_name,
          contactEmail: advertiser.agency_email,
          contactPhone: advertiser.agency_phone
        } : null,
        _count: {
          campaigns: parseInt(advertiser.campaign_count) || 0
        },
        campaigns
      }
    }))

    // Transform for compatibility
    const transformedAdvertisers = advertisers.map(advertiser => ({
      id: advertiser.id,
      advertiserId: advertiser.id,
      name: advertiser.name,
      email: advertiser.contactEmail || '',
      phone: advertiser.contactPhone || '',
      contactEmail: advertiser.contactEmail || '',
      contactPhone: advertiser.contactPhone || '',
      website: advertiser.website || '',
      industry: advertiser.industry || '',
      address: {
        street: advertiser.address || '',
        city: advertiser.city || '',
        state: advertiser.state || '',
        zip: advertiser.zipCode || '',
        country: advertiser.country || 'USA'
      },
      agency: advertiser.agency,
      agencyId: advertiser.agencyId,
      status: advertiser.isActive ? 'active' : 'inactive',
      campaigns: advertiser.campaigns,
      campaignCount: advertiser._count.campaigns,
      totalSpend: advertiser.campaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
      averageCPM: 0, // Would need campaign metrics
      createdAt: advertiser.createdAt.toISOString(),
      updatedAt: advertiser.updatedAt.toISOString(),
    }))

    console.log(`✅ Advertisers API: Returning ${transformedAdvertisers.length} advertisers`)

    return NextResponse.json(transformedAdvertisers)
  } catch (error) {
    console.error('❌ Advertisers API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch advertisers' },
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

    // Only sales, admin, and master can create advertisers
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    let { name, email, phone, industry, website, address, agencyId } = body

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Advertiser name is required and cannot be blank' },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Normalize name for duplicate detection
    const normalizedName = name.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
    
    // Check for duplicate names (case-insensitive, ignoring punctuation)
    const duplicateCheckQuery = `
      SELECT id, name 
      FROM "Advertiser" 
      WHERE LOWER(REGEXP_REPLACE(TRIM(name), '[^\\w\\s]', '', 'g')) = $1
        AND "isActive" = true
    `
    const existingAdvertisers = await querySchema<any>(orgSlug, duplicateCheckQuery, [normalizedName])
    
    if (existingAdvertisers.length > 0) {
      return NextResponse.json(
        { 
          error: `An advertiser with a similar name already exists: "${existingAdvertisers[0].name}". Please use a different name or update the existing advertiser.`,
          existingAdvertiser: {
            id: existingAdvertisers[0].id,
            name: existingAdvertisers[0].name
          }
        },
        { status: 409 }
      )
    }

    // Normalize agency ID - convert empty string to null
    if (agencyId === '') {
      agencyId = null
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Verify agency exists if provided
    let agency = null
    if (agencyId) {
      const agencyQuery = `SELECT * FROM "Agency" WHERE id = $1 AND "isActive" = true`
      const agencies = await querySchema<any>(orgSlug, agencyQuery, [agencyId])
      if (agencies.length === 0) {
        return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
      }
      agency = agencies[0]
    }

    // Create advertiser in organization schema
    const advertiserId = `adv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createQuery = `
      INSERT INTO "Advertiser" (
        id, name, "contactEmail", "contactPhone", website, industry,
        address, city, state, "zipCode", country, "agencyId", "organizationId",
        "isActive", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, NOW(), NOW()
      )
      RETURNING *
    `
    
    const advertisers = await querySchema<any>(orgSlug, createQuery, [
      advertiserId,
      name,
      email || null,
      phone || null,
      website || null,
      industry || null,
      address?.street || null,
      address?.city || null,
      address?.state || null,
      address?.zip || null,
      address?.country || null,
      agencyId || null,
      user.organizationId,
      user.id
    ])
    
    const advertiser = advertisers[0]

    console.log(`✅ Advertiser created: ${advertiser.name}`)

    const transformedAdvertiser = {
      id: advertiser.id,
      advertiserId: advertiser.id,
      name: advertiser.name,
      email: advertiser.contactEmail || '',
      phone: advertiser.contactPhone || '',
      contactEmail: advertiser.contactEmail || '',
      contactPhone: advertiser.contactPhone || '',
      website: advertiser.website || '',
      industry: advertiser.industry || '',
      address: {
        street: advertiser.address || '',
        city: advertiser.city || '',
        state: advertiser.state || '',
        zip: advertiser.zipCode || '',
        country: advertiser.country || ''
      },
      agency: agency,
      agencyId: advertiser.agencyId,
      status: 'active',
      campaigns: [],
      campaignCount: 0,
      totalSpend: 0,
      averageCPM: 0,
      createdAt: advertiser.createdAt.toISOString(),
      updatedAt: advertiser.updatedAt.toISOString(),
    }

    return NextResponse.json(transformedAdvertiser, { status: 201 })
  } catch (error) {
    console.error('❌ Advertiser creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create advertiser' },
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

// Use direct function export to fix production build issue
export const POST = async (request: NextRequest) => {
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
  
  return postHandler(authenticatedRequest)
}