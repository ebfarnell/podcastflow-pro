import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, SchemaModels } from '@/lib/db/schema-db'

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

    // Build query
    const where: any = {
      organizationId: user.organizationId,
      isActive: true,
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get agencies from organization schema
    let agenciesQuery = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM "Advertiser" WHERE "agencyId" = a.id AND "isActive" = true) as active_advertisers,
        (SELECT COUNT(*) FROM "Campaign" c 
         INNER JOIN "Advertiser" adv ON adv.id = c."advertiserId" 
         WHERE adv."agencyId" = a.id) as campaign_count
      FROM "Agency" a
      WHERE a."isActive" = true
    `
    const queryParams: any[] = []
    
    if (search) {
      agenciesQuery += ` AND LOWER(a.name) LIKE LOWER($1)`
      queryParams.push(`%${search}%`)
    }
    
    agenciesQuery += ` ORDER BY a.name ASC LIMIT ${limit}`
    
    const agenciesRaw = await querySchema(orgSlug, agenciesQuery, queryParams)
    
    // Get sample advertisers for each agency
    const agencies = await Promise.all(agenciesRaw.map(async (agency) => {
      const advertisersQuery = `
        SELECT id, name 
        FROM "Advertiser" 
        WHERE "agencyId" = $1 AND "isActive" = true 
        LIMIT 5
      `
      const advertisers = await querySchema(orgSlug, advertisersQuery, [agency.id])
      
      return {
        ...agency,
        _count: {
          advertisers: parseInt(agency.active_advertisers) || 0,
          campaigns: parseInt(agency.campaign_count) || 0
        },
        advertisers
      }
    }))

    // Transform for frontend
    const transformedAgencies = agencies.map(agency => ({
      id: agency.id,
      agencyId: agency.id,
      name: agency.name,
      email: agency.contactEmail || '',
      phone: agency.contactPhone || '',
      contactEmail: agency.contactEmail || '',
      contactPhone: agency.contactPhone || '',
      website: agency.website || '',
      address: {
        street: agency.address || '',
        city: agency.city || '',
        state: agency.state || '',
        zip: agency.zipCode || '',
        country: agency.country || 'USA'
      },
      status: agency.isActive ? 'active' : 'inactive',
      advertisers: agency.advertisers,
      advertiserCount: agency._count.advertisers,
      campaignCount: agency._count.campaigns,
      totalSpend: 0, // Would calculate from campaigns
      createdAt: agency.createdAt.toISOString(),
      updatedAt: agency.updatedAt.toISOString(),
    }))

    console.log(`✅ Agencies API: Returning ${transformedAgencies.length} agencies`)

    return NextResponse.json(transformedAgencies)
  } catch (error) {
    console.error('❌ Agencies API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agencies' },
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

    // Only sales, admin, and master can create agencies
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, phone, website, address } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create agency in organization schema
    const agencyId = `agn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createQuery = `
      INSERT INTO "Agency" (
        id, name, "contactEmail", "contactPhone", website, 
        address, city, state, "zipCode", country,
        "organizationId", "isActive", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, NOW(), NOW()
      )
      RETURNING *
    `
    
    const agencies = await querySchema(orgSlug, createQuery, [
      agencyId,
      name,
      email || null,
      phone || null,
      website || null,
      address?.street || null,
      address?.city || null,
      address?.state || null,
      address?.zip || null,
      address?.country || null,
      user.organizationId,
      user.id
    ])
    
    const agency = agencies[0]

    console.log(`✅ Agency created: ${agency.name}`)

    const transformedAgency = {
      id: agency.id,
      agencyId: agency.id,
      name: agency.name,
      email: agency.contactEmail || '',
      phone: agency.contactPhone || '',
      contactEmail: agency.contactEmail || '',
      contactPhone: agency.contactPhone || '',
      website: agency.website || '',
      address: {
        street: agency.address || '',
        city: agency.city || '',
        state: agency.state || '',
        zip: agency.zipCode || '',
        country: agency.country || ''
      },
      status: 'active',
      advertisers: [],
      advertiserCount: 0,
      campaignCount: 0,
      totalSpend: 0,
      createdAt: agency.createdAt.toISOString(),
      updatedAt: agency.updatedAt.toISOString(),
    }

    return NextResponse.json(transformedAgency, { status: 201 })
  } catch (error) {
    console.error('❌ Agency creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create agency' },
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