import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const showId = url.searchParams.get('showId')
    const startDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDate = url.searchParams.get('endDate') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const placementType = url.searchParams.get('placementType')
    const availableOnly = url.searchParams.get('availableOnly') === 'true'
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query conditions
    const conditions = [`e."airDate" BETWEEN $1::date AND $2::date`]
    const params: any[] = [startDate, endDate]
    let paramIndex = 3

    // Role-based filtering for inventory visibility
    if (user.role === 'producer' || user.role === 'talent') {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM "_ShowToUser" su 
          WHERE su."A" = s.id AND su."B" = $${paramIndex}
        )
      `)
      params.push(user.id)
      paramIndex++
    } else if (user.role === 'sales') {
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM "InventoryVisibility" iv
          WHERE iv."showId" = s.id 
          AND iv.role = 'sales'
          AND iv."accessType" = 'blocked'
        )
      `)
    }

    if (showId) {
      conditions.push(`s.id = $${paramIndex}`)
      params.push(showId)
      paramIndex++
    }

    if (availableOnly) {
      conditions.push(`(
        ei."preRollAvailable" > 0 OR 
        ei."midRollAvailable" > 0 OR 
        ei."postRollAvailable" > 0
      )`)
    }

    const whereClause = conditions.join(' AND ')

    // Build main inventory query using EpisodeInventory table
    const query = `
      SELECT 
        ei.id,
        ei."episodeId",
        e.title as "episodeTitle",
        e."episodeNumber",
        ei."showId",
        s.name as "showName",
        s.category as "showCategory",
        ei."airDate",
        COALESCE(e.length, 30) as "episodeLength",
        ei."preRollSlots",
        ei."preRollAvailable",
        ei."preRollReserved",
        ei."preRollBooked",
        50.00 as "preRollPrice",
        ei."midRollSlots",
        ei."midRollAvailable", 
        ei."midRollReserved",
        ei."midRollBooked",
        75.00 as "midRollPrice",
        ei."postRollSlots",
        ei."postRollAvailable",
        ei."postRollReserved", 
        ei."postRollBooked",
        40.00 as "postRollPrice",
        COALESCE(e.duration, e.length, 30) as "estimatedImpressions",
        (ei."preRollSlots" + ei."midRollSlots" + ei."postRollSlots") as "totalSlots",
        (ei."preRollAvailable" + ei."midRollAvailable" + ei."postRollAvailable") as "totalAvailable",
        (ei."preRollReserved" + ei."midRollReserved" + ei."postRollReserved") as "totalReserved",
        (ei."preRollBooked" + ei."midRollBooked" + ei."postRollBooked") as "totalBooked"
      FROM "EpisodeInventory" ei
      JOIN "Episode" e ON e.id = ei."episodeId"
      JOIN "Show" s ON s.id = ei."showId"
      WHERE ${whereClause}
        AND e.status = 'scheduled'
        AND s."isActive" = true
      ORDER BY ei."airDate", s.name, e."episodeNumber"
      LIMIT 500
    `

    const { data: inventory, error: inventoryError } = await safeQuerySchema(orgSlug, query, params)
    if (inventoryError) {
      console.error(`Inventory query error for org ${orgSlug}:`, inventoryError.message)
      return NextResponse.json({ inventory: [], summary: {} })
    }

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT ei."episodeId") as "totalEpisodes",
        COUNT(DISTINCT ei."showId") as "totalShows", 
        SUM(ei."preRollSlots" + ei."midRollSlots" + ei."postRollSlots") as "totalSlots",
        SUM(ei."preRollAvailable" + ei."midRollAvailable" + ei."postRollAvailable") as "totalAvailable",
        SUM(ei."preRollReserved" + ei."midRollReserved" + ei."postRollReserved") as "totalReserved",
        SUM(ei."preRollBooked" + ei."midRollBooked" + ei."postRollBooked") as "totalBooked",
        AVG(50.00) as "avgPreRollPrice",
        AVG(75.00) as "avgMidRollPrice", 
        AVG(40.00) as "avgPostRollPrice"
      FROM "EpisodeInventory" ei
      JOIN "Episode" e ON e.id = ei."episodeId"
      JOIN "Show" s ON s.id = ei."showId"
      WHERE ${whereClause}
        AND e.status = 'scheduled'
        AND s."isActive" = true
    `

    const { data: summary, error: summaryError } = await safeQuerySchema(orgSlug, summaryQuery, params)
    if (summaryError) {
      console.error(`Summary query error for org ${orgSlug}:`, summaryError.message)
    }

    return NextResponse.json({
      inventory: inventory || [],
      summary: summary?.[0] || {
        totalEpisodes: 0,
        totalShows: 0,
        totalSlots: 0,
        totalAvailable: 0,
        totalReserved: 0,
        totalBooked: 0,
        avgPreRollPrice: 50,
        avgMidRollPrice: 75,
        avgPostRollPrice: 40
      },
      filters: {
        showId,
        startDate,
        endDate,
        placementType,
        availableOnly
      }
    })

  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error.message },
      { status: 500 }
    )
  }
}

// Create inventory records for new episodes
async function postHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { episodeIds, defaultPricing } = body
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['master', 'admin', 'producer'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // TODO: Implement inventory creation for the new Inventory table structure
    // The Inventory table uses showId, date, and placementType instead of episodeId
    console.log('POST /api/inventory needs to be updated for Inventory table structure')

    return NextResponse.json({
      created: 0,
      inventory: [],
      message: 'Inventory creation needs to be updated for new table structure'
    })

  } catch (error: any) {
    console.error('Create inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory', details: error.message },
      { status: 500 }
    )
  }
}

// Direct exports with auth check
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