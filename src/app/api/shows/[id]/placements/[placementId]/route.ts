import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; placementId: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
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
        `/api/shows/${params.id}/placements/${params.placementId}`,
        request
      )
    }
    
    const placementQuery = `
      SELECT 
        sp.*,
        s.id as show_id,
        s.name as show_name,
        s.description as show_description
      FROM "ShowPlacement" sp
      INNER JOIN "Show" s ON s.id = sp."showId"
      WHERE sp.id = $1 AND sp."showId" = $2
    `
    
    const placements = await querySchema<any>(orgSlug, placementQuery, [params.placementId, params.id])
    
    if (!placements || placements.length === 0) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
    }
    
    const placement = {
      ...placements[0],
      show: {
        id: placements[0].show_id,
        name: placements[0].show_name,
        description: placements[0].show_description
      }
    }

    return NextResponse.json(placement)
  } catch (error) {
    console.error('Error fetching show placement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; placementId: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      totalSpots, 
      liveReadSpots, 
      liveReadPercentage,
      defaultLength, 
      availableLengths, 
      baseRate, 
      rates,
      isActive 
    } = body

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Verify placement exists
    const existingQuery = `
      SELECT * FROM "ShowPlacement" 
      WHERE id = $1 AND "showId" = $2
    `
    const existing = await querySchema<any>(orgSlug, existingQuery, [params.placementId, params.id])
    
    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    if (totalSpots !== undefined) {
      updateFields.push(`"totalSpots" = $${paramIndex++}`)
      updateParams.push(parseInt(totalSpots))
    }
    if (liveReadSpots !== undefined) {
      updateFields.push(`"liveReadSpots" = $${paramIndex++}`)
      updateParams.push(parseInt(liveReadSpots))
    }
    if (liveReadPercentage !== undefined) {
      updateFields.push(`"liveReadPercentage" = $${paramIndex++}`)
      updateParams.push(parseFloat(liveReadPercentage))
    }
    if (defaultLength !== undefined) {
      updateFields.push(`"defaultLength" = $${paramIndex++}`)
      updateParams.push(parseInt(defaultLength))
    }
    if (availableLengths !== undefined) {
      updateFields.push(`"availableLengths" = $${paramIndex++}`)
      updateParams.push(JSON.stringify(availableLengths))
    }
    if (baseRate !== undefined) {
      updateFields.push(`"baseRate" = $${paramIndex++}`)
      updateParams.push(parseFloat(baseRate))
    }
    if (rates !== undefined) {
      updateFields.push(`rates = $${paramIndex++}`)
      updateParams.push(JSON.stringify(rates))
    }
    if (isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`)
      updateParams.push(isActive)
    }
    
    updateFields.push(`"updatedAt" = NOW()`)
    updateParams.push(params.placementId)
    
    const updateQuery = `
      UPDATE "ShowPlacement"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    await querySchema(orgSlug, updateQuery, updateParams)
    
    // Get updated placement with show info
    const getUpdatedQuery = `
      SELECT 
        sp.*,
        s.id as show_id,
        s.name as show_name,
        s.description as show_description
      FROM "ShowPlacement" sp
      INNER JOIN "Show" s ON s.id = sp."showId"
      WHERE sp.id = $1
    `
    const updated = await querySchema<any>(orgSlug, getUpdatedQuery, [params.placementId])
    
    const placement = {
      ...updated[0],
      show: {
        id: updated[0].show_id,
        name: updated[0].show_name,
        description: updated[0].show_description
      }
    }

    return NextResponse.json(placement)
  } catch (error) {
    console.error('Error updating show placement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; placementId: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Verify placement exists
    const placementQuery = `
      SELECT * FROM "ShowPlacement" 
      WHERE id = $1 AND "showId" = $2
    `
    const placements = await querySchema<any>(orgSlug, placementQuery, [params.placementId, params.id])
    
    if (!placements || placements.length === 0) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
    }
    
    const placement = placements[0]

    // Check if placement is being used in orders or inventory
    const orderItemsQuery = `
      SELECT COUNT(*) as count 
      FROM "OrderItem" 
      WHERE "showId" = $1 AND "placementType" = $2
    `
    const inventoryQuery = `
      SELECT COUNT(*) as count 
      FROM "Inventory" 
      WHERE "showId" = $1 AND "placementType" = $2
    `
    
    const [orderItemsResult, inventoryResult] = await Promise.all([
      querySchema<any>(orgSlug, orderItemsQuery, [params.id, placement.placementType]),
      querySchema<any>(orgSlug, inventoryQuery, [params.id, placement.placementType])
    ])
    
    const orderItems = parseInt(orderItemsResult[0]?.count || '0')
    const inventory = parseInt(inventoryResult[0]?.count || '0')

    if (orderItems > 0 || inventory > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete placement that is being used in orders or inventory' 
      }, { status: 400 })
    }

    // Delete placement
    await querySchema(orgSlug, `DELETE FROM "ShowPlacement" WHERE id = $1`, [params.placementId])

    return NextResponse.json({ message: 'Placement deleted successfully' })
  } catch (error) {
    console.error('Error deleting show placement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
