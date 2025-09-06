import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        `/api/advertisers/${id}`,
        request
      )
    }
    
    // Get advertiser with agency and campaigns
    const advertiserQuery = `
      SELECT 
        a.*,
        ag.id as agency_id,
        ag.name as agency_name,
        (
          SELECT COUNT(*) FROM "Campaign" WHERE "advertiserId" = a.id
        ) as campaign_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'name', c.name,
              'status', c.status,
              'budget', c.budget,
              'startDate', c."startDate",
              'endDate', c."endDate",
              'ad_count', (
                SELECT COUNT(*) FROM "AdApproval" WHERE "campaignId" = c.id
              )
            )
          )
          FROM "Campaign" c
          WHERE c."advertiserId" = a.id
        ) as campaigns
      FROM "Advertiser" a
      LEFT JOIN "Agency" ag ON ag.id = a."agencyId"
      WHERE a.id = $1
    `
    
    const result = await querySchema<any>(orgSlug, advertiserQuery, [id])
    
    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }
    
    const advertiser = result[0]

    // Transform for compatibility
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
        country: advertiser.country || 'USA'
      },
      agency: advertiser.agency_id ? {
        id: advertiser.agency_id,
        name: advertiser.agency_name
      } : null,
      agencyId: advertiser.agencyId,
      status: advertiser.isActive ? 'active' : 'inactive',
      campaigns: (advertiser.campaigns || []).map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        budget: c.budget,
        startDate: c.startDate,
        endDate: c.endDate,
        adCount: c.ad_count || 0
      })),
      campaignCount: parseInt(advertiser.campaign_count) || 0,
      totalSpend: (advertiser.campaigns || []).reduce((sum, c) => sum + (c.budget || 0), 0),
      averageCPM: 0, // Would need campaign metrics
      createdAt: advertiser.createdAt,
      updatedAt: advertiser.updatedAt,
    }

    return NextResponse.json(transformedAdvertiser)
  } catch (error) {
    console.error('❌ Advertiser GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch advertiser' },
      { status: 500 }
    )
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, and master can update advertisers
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, phone, industry, website, address, agencyId } = body

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if advertiser exists
    const existingQuery = `SELECT * FROM "Advertiser" WHERE id = $1`
    const existingResult = await querySchema<any>(orgSlug, existingQuery, [id])
    
    if (!existingResult || existingResult.length === 0) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }
    
    const existingAdvertiser = existingResult[0]

    // Check for duplicate names if name is being updated
    if (name !== undefined && name !== existingAdvertiser.name) {
      const normalizedName = name.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
      
      const duplicateCheckQuery = `
        SELECT id, name 
        FROM "Advertiser" 
        WHERE LOWER(REGEXP_REPLACE(TRIM(name), '[^\\w\\s]', '', 'g')) = $1
          AND "isActive" = true
          AND id != $2
      `
      const existingAdvertisers = await querySchema<any>(orgSlug, duplicateCheckQuery, [normalizedName, id])
      
      if (existingAdvertisers.length > 0) {
        return NextResponse.json(
          { 
            error: `An advertiser with a similar name already exists: "${existingAdvertisers[0].name}". Please use a different name.`,
            existingAdvertiser: {
              id: existingAdvertisers[0].id,
              name: existingAdvertisers[0].name
            }
          },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    if (name !== undefined && name !== existingAdvertiser.name) {
      updateFields.push(`name = $${paramIndex++}`)
      updateParams.push(name)
    }
    if (email !== undefined && email !== existingAdvertiser.contactEmail) {
      updateFields.push(`"contactEmail" = $${paramIndex++}`)
      updateParams.push(email)
    }
    if (phone !== undefined && phone !== existingAdvertiser.contactPhone) {
      updateFields.push(`"contactPhone" = $${paramIndex++}`)
      updateParams.push(phone)
    }
    if (website !== undefined && website !== existingAdvertiser.website) {
      updateFields.push(`website = $${paramIndex++}`)
      updateParams.push(website)
    }
    if (industry !== undefined && industry !== existingAdvertiser.industry) {
      updateFields.push(`industry = $${paramIndex++}`)
      updateParams.push(industry)
    }
    if (address?.street !== undefined && address.street !== existingAdvertiser.address) {
      updateFields.push(`address = $${paramIndex++}`)
      updateParams.push(address.street)
    }
    if (address?.city !== undefined && address.city !== existingAdvertiser.city) {
      updateFields.push(`city = $${paramIndex++}`)
      updateParams.push(address.city)
    }
    if (address?.state !== undefined && address.state !== existingAdvertiser.state) {
      updateFields.push(`state = $${paramIndex++}`)
      updateParams.push(address.state)
    }
    if (address?.zip !== undefined && address.zip !== existingAdvertiser.zipCode) {
      updateFields.push(`"zipCode" = $${paramIndex++}`)
      updateParams.push(address.zip)
    }
    if (address?.country !== undefined && address.country !== existingAdvertiser.country) {
      updateFields.push(`country = $${paramIndex++}`)
      updateParams.push(address.country)
    }
    if (agencyId !== undefined && agencyId !== existingAdvertiser.agencyId) {
      updateFields.push(`"agencyId" = $${paramIndex++}`)
      updateParams.push(agencyId)
    }
    
    // Always update updatedBy and updatedAt
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)
    updateFields.push(`"updatedAt" = NOW()`)
    
    // Add ID for WHERE clause
    updateParams.push(id)
    
    const updateQuery = `
      UPDATE "Advertiser"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const updatedResult = await querySchema<any>(orgSlug, updateQuery, updateParams)
    const advertiser = updatedResult[0]
    
    // Get agency info if present
    let agency = null
    if (advertiser.agencyId) {
      const agencyQuery = `SELECT id, name FROM "Agency" WHERE id = $1`
      const agencyResult = await querySchema<any>(orgSlug, agencyQuery, [advertiser.agencyId])
      agency = agencyResult[0]
    }

    console.log(`✅ Advertiser updated: ${advertiser.name}`)

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
      agency: agency ? {
        id: agency.id,
        name: agency.name
      } : null,
      agencyId: advertiser.agencyId,
      status: advertiser.isActive ? 'active' : 'inactive',
      createdAt: advertiser.createdAt,
      updatedAt: advertiser.updatedAt,
    }

    return NextResponse.json(transformedAdvertiser)
  } catch (error) {
    console.error('❌ Advertiser update error:', error)
    return NextResponse.json(
      { error: 'Failed to update advertiser' },
      { status: 500 }
    )
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete advertisers
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Only administrators can delete advertisers' }, { status: 403 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if advertiser exists and get campaign count
    const advertiserQuery = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM "Campaign" WHERE "advertiserId" = a.id) as campaign_count
      FROM "Advertiser" a
      WHERE a.id = $1
    `
    
    const result = await querySchema<any>(orgSlug, advertiserQuery, [id])
    
    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }
    
    const advertiser = result[0]
    
    // Check if advertiser has campaigns
    if (parseInt(advertiser.campaign_count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete advertiser with active campaigns. Please delete all campaigns first.' },
        { status: 400 }
      )
    }
    
    // Hard delete the advertiser
    await querySchema(orgSlug, `DELETE FROM "Advertiser" WHERE id = $1`, [id])

    console.log(`✅ Advertiser deleted: ${advertiser.name}`)

    return NextResponse.json({ 
      success: true,
      message: 'Advertiser deleted successfully' 
    })
  } catch (error) {
    console.error('❌ Advertiser delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete advertiser' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
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
  
  return getHandler(authenticatedRequest, context)
}

// Use direct function export to fix production build issue
export const PUT = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
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
  
  return putHandler(authenticatedRequest, context)
}

// Use direct function export to fix production build issue
export const DELETE = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
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
  
  return deleteHandler(authenticatedRequest, context)
}