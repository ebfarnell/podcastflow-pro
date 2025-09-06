import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch show placements from organization schema
    const placementsQuery = `
      SELECT 
        sp.*,
        s.name as "showName",
        s.description as "showDescription"
      FROM "ShowPlacement" sp
      INNER JOIN "Show" s ON s.id = sp."showId"
      WHERE sp."showId" = $1
      ORDER BY sp."placementType" ASC
    `
    
    const placements = await querySchema(orgSlug, placementsQuery, [params.id])

    return NextResponse.json({ placements })
  } catch (error) {
    console.error('Error fetching show placements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
      placementType, 
      totalSpots, 
      liveReadSpots, 
      liveReadPercentage,
      defaultLength, 
      availableLengths, 
      baseRate, 
      rates 
    } = body

    if (!placementType || !totalSpots || !baseRate) {
      return NextResponse.json({ 
        error: 'Placement type, total spots, and base rate are required' 
      }, { status: 400 })
    }

    // SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify show exists in organization schema
    const showQuery = `SELECT id, name FROM "Show" WHERE id = $1`
    const shows = await querySchema(orgSlug, showQuery, [params.id])
    
    if (!shows.length) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }
    const show = shows[0]

    // Check if placement type already exists
    const existingQuery = `
      SELECT id FROM "ShowPlacement" 
      WHERE "showId" = $1 AND "placementType" = $2
    `
    const existing = await querySchema(orgSlug, existingQuery, [params.id, placementType])
    
    if (existing.length > 0) {
      return NextResponse.json({ 
        error: `Placement type '${placementType}' already exists for this show` 
      }, { status: 400 })
    }

    // Create placement in organization schema
    const placementId = `plc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createQuery = `
      INSERT INTO "ShowPlacement" (
        id, "showId", "placementType", "totalSpots", "liveReadSpots", 
        "liveReadPercentage", "defaultLength", "availableLengths", 
        "baseRate", rates, "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      RETURNING *
    `
    
    const placements = await querySchema(orgSlug, createQuery, [
      placementId,
      params.id,
      placementType,
      parseInt(totalSpots),
      parseInt(liveReadSpots) || 0,
      liveReadPercentage ? parseFloat(liveReadPercentage) : null,
      parseInt(defaultLength) || 30,
      JSON.stringify(availableLengths || [15, 30, 60]),
      parseFloat(baseRate),
      JSON.stringify(rates || {})
    ])
    
    const placement = {
      ...placements[0],
      show: {
        id: show.id,
        name: show.name,
        description: show.description || null
      }
    }

    return NextResponse.json(placement)
  } catch (error) {
    console.error('Error creating show placement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
