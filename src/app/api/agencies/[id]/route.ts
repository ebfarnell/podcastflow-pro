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
        `/api/agencies/${id}`,
        request
      )
    }
    
    // Get agency with advertisers
    const agencyQuery = `
      SELECT 
        a.*,
        (
          SELECT COUNT(*) 
          FROM "Advertiser" 
          WHERE "agencyId" = a.id AND "isActive" = true
        ) as advertiser_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', adv.id,
              'name', adv.name,
              'campaign_count', (
                SELECT COUNT(*) FROM "Campaign" WHERE "advertiserId" = adv.id
              )
            )
          )
          FROM "Advertiser" adv
          WHERE adv."agencyId" = a.id AND adv."isActive" = true
        ) as advertisers
      FROM "Agency" a
      WHERE a.id = $1
    `
    
    const result = await querySchema<any>(orgSlug, agencyQuery, [id])
    
    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }
    
    const agency = result[0]

    // Transform for compatibility
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
        country: agency.country || 'USA'
      },
      status: agency.isActive ? 'active' : 'inactive',
      advertisers: agency.advertisers || [],
      advertiserCount: parseInt(agency.advertiser_count) || 0,
      totalSpend: (agency.advertisers || []).reduce((sum, a) => sum + (a.campaign_count || 0) * 10000, 0), // Placeholder
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    }

    return NextResponse.json(transformedAgency)
  } catch (error) {
    console.error('❌ Agency GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agency' },
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

    // Only sales, admin, and master can update agencies
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, phone, website, address } = body

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if agency exists
    const existingQuery = `SELECT * FROM "Agency" WHERE id = $1`
    const existingResult = await querySchema<any>(orgSlug, existingQuery, [id])
    
    if (!existingResult || existingResult.length === 0) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }
    
    const existingAgency = existingResult[0]

    // Build update data
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    if (name !== undefined && name !== existingAgency.name) {
      updateFields.push(`name = $${paramIndex++}`)
      updateParams.push(name)
    }
    if (email !== undefined && email !== existingAgency.contactEmail) {
      updateFields.push(`"contactEmail" = $${paramIndex++}`)
      updateParams.push(email)
    }
    if (phone !== undefined && phone !== existingAgency.contactPhone) {
      updateFields.push(`"contactPhone" = $${paramIndex++}`)
      updateParams.push(phone)
    }
    if (website !== undefined && website !== existingAgency.website) {
      updateFields.push(`website = $${paramIndex++}`)
      updateParams.push(website)
    }
    if (address?.street !== undefined && address.street !== existingAgency.address) {
      updateFields.push(`address = $${paramIndex++}`)
      updateParams.push(address.street)
    }
    if (address?.city !== undefined && address.city !== existingAgency.city) {
      updateFields.push(`city = $${paramIndex++}`)
      updateParams.push(address.city)
    }
    if (address?.state !== undefined && address.state !== existingAgency.state) {
      updateFields.push(`state = $${paramIndex++}`)
      updateParams.push(address.state)
    }
    if (address?.zip !== undefined && address.zip !== existingAgency.zipCode) {
      updateFields.push(`"zipCode" = $${paramIndex++}`)
      updateParams.push(address.zip)
    }
    if (address?.country !== undefined && address.country !== existingAgency.country) {
      updateFields.push(`country = $${paramIndex++}`)
      updateParams.push(address.country)
    }
    
    // Always update updatedBy and updatedAt
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)
    updateFields.push(`"updatedAt" = NOW()`)
    
    // Add ID for WHERE clause
    updateParams.push(id)
    
    const updateQuery = `
      UPDATE "Agency"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const updatedResult = await querySchema<any>(orgSlug, updateQuery, updateParams)
    const agency = updatedResult[0]

    console.log(`✅ Agency updated: ${agency.name}`)

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
      status: agency.isActive ? 'active' : 'inactive',
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    }

    return NextResponse.json(transformedAgency)
  } catch (error) {
    console.error('❌ Agency update error:', error)
    return NextResponse.json(
      { error: 'Failed to update agency' },
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

    // Only admin and master can delete agencies
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Only administrators can delete agencies' }, { status: 403 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if agency exists and get advertiser count
    const agencyQuery = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM "Advertiser" WHERE "agencyId" = a.id) as advertiser_count
      FROM "Agency" a
      WHERE a.id = $1
    `
    
    const result = await querySchema<any>(orgSlug, agencyQuery, [id])
    
    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }
    
    const agency = result[0]
    
    // Check if agency has advertisers
    if (parseInt(agency.advertiser_count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete agency with active advertisers. Please reassign or delete all advertisers first.' },
        { status: 400 }
      )
    }
    
    // Soft delete (set isActive to false)
    await querySchema(orgSlug, `UPDATE "Agency" SET "isActive" = false WHERE id = $1`, [id])

    console.log(`✅ Agency deleted (soft): ${agency.name}`)

    return NextResponse.json({ 
      success: true,
      message: 'Agency deleted successfully' 
    })
  } catch (error) {
    console.error('❌ Agency delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete agency' },
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