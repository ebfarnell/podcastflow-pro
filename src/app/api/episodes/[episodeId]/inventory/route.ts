import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest, { params }: { params: { episodeId: string } }) {
  try {
    const episodeId = params.episodeId
    
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

    // First check if this is a YouTube episode
    const episodeCheckQuery = `
      SELECT e.id, e."publishUrl", e.title, e."airDate", s.name as "showName"
      FROM "Episode" e
      JOIN "Show" s ON s.id = e."showId"
      WHERE e.id = $1
    `
    const episodeCheck = await querySchema(orgSlug, episodeCheckQuery, [episodeId])
    
    if (episodeCheck.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }
    
    const episode = episodeCheck[0]
    const isYouTubeEpisode = episode.publishUrl && 
      (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be'))
    
    // For YouTube episodes, return empty inventory structure
    if (isYouTubeEpisode) {
      return NextResponse.json({
        inventory: {
          episodeId: episode.id,
          episodeTitle: episode.title,
          airDate: episode.airDate,
          showName: episode.showName,
          preRollSlots: 0,
          preRollAvailable: 0,
          preRollReserved: 0,
          preRollBooked: 0,
          preRollPrice: 0,
          midRollSlots: 0,
          midRollAvailable: 0,
          midRollReserved: 0,
          midRollBooked: 0,
          midRollPrice: 0,
          postRollSlots: 0,
          postRollAvailable: 0,
          postRollReserved: 0,
          postRollBooked: 0,
          postRollPrice: 0,
          estimatedImpressions: 0,
          isYouTubeEpisode: true
        },
        reservations: [],
        summary: {
          totalSlots: 0,
          totalAvailable: 0,
          totalReserved: 0,
          totalBooked: 0
        },
        message: 'Inventory management not available for YouTube episodes'
      })
    }

    // Get episode inventory for traditional podcast episodes
    const inventoryQuery = `
      SELECT 
        ei.*,
        e.title as "episodeTitle",
        e."airDate",
        s.name as "showName"
      FROM "EpisodeInventory" ei
      JOIN "Episode" e ON e.id = ei."episodeId"
      JOIN "Show" s ON s.id = e."showId"
      WHERE ei."episodeId" = $1
    `
    
    const inventoryResult = await querySchema(orgSlug, inventoryQuery, [episodeId])
    
    if (inventoryResult.length === 0) {
      // If no inventory exists for a traditional episode, return empty structure
      return NextResponse.json({
        inventory: {
          episodeId: episode.id,
          episodeTitle: episode.title,
          airDate: episode.airDate,
          showName: episode.showName,
          preRollSlots: 0,
          preRollAvailable: 0,
          preRollReserved: 0,
          preRollBooked: 0,
          preRollPrice: 0,
          midRollSlots: 0,
          midRollAvailable: 0,
          midRollReserved: 0,
          midRollBooked: 0,
          midRollPrice: 0,
          postRollSlots: 0,
          postRollAvailable: 0,
          postRollReserved: 0,
          postRollBooked: 0,
          postRollPrice: 0,
          estimatedImpressions: 0
        },
        reservations: [],
        summary: {
          totalSlots: 0,
          totalAvailable: 0,
          totalReserved: 0,
          totalBooked: 0
        },
        message: 'No inventory configured for this episode'
      })
    }

    const inventory = inventoryResult[0]

    // Get reserved items for this episode
    const reservationsQuery = `
      SELECT 
        ri.*,
        r."reservationNumber",
        r.status as "reservationStatus",
        c.name as "campaignName",
        a.name as "advertiserName"
      FROM "ReservationItem" ri
      JOIN "Reservation" r ON r.id = ri."reservationId"
      LEFT JOIN "Campaign" c ON c.id = r."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = r."advertiserId"
      WHERE ri."episodeId" = $1
      ORDER BY ri."placementType", ri."airDate"
    `
    
    const reservations = await querySchema(orgSlug, reservationsQuery, [episodeId])

    return NextResponse.json({
      inventory,
      reservations,
      summary: {
        totalSlots: inventory.preRollSlots + inventory.midRollSlots + inventory.postRollSlots,
        totalAvailable: inventory.preRollAvailable + inventory.midRollAvailable + inventory.postRollAvailable,
        totalReserved: inventory.preRollReserved + inventory.midRollReserved + inventory.postRollReserved,
        totalBooked: inventory.preRollBooked + inventory.midRollBooked + inventory.postRollBooked
      }
    })

  } catch (error: any) {
    console.error('Episode inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch episode inventory', details: error.message },
      { status: 500 }
    )
  }
}

async function putHandler(request: AuthenticatedRequest, { params }: { params: { episodeId: string } }) {
  try {
    const episodeId = params.episodeId
    const body = await request.json()
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only admin, sales, and producer can update inventory
    if (!['master', 'admin', 'sales', 'producer'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Update inventory slots and pricing
    const updateQuery = `
      UPDATE "EpisodeInventory"
      SET 
        "preRollSlots" = COALESCE($2, "preRollSlots"),
        "preRollPrice" = COALESCE($3, "preRollPrice"),
        "midRollSlots" = COALESCE($4, "midRollSlots"),
        "midRollPrice" = COALESCE($5, "midRollPrice"),
        "postRollSlots" = COALESCE($6, "postRollSlots"),
        "postRollPrice" = COALESCE($7, "postRollPrice"),
        "estimatedImpressions" = COALESCE($8, "estimatedImpressions"),
        "updatedAt" = NOW()
      WHERE "episodeId" = $1
      RETURNING *
    `
    
    const result = await querySchema(
      orgSlug,
      updateQuery,
      [
        episodeId,
        body.preRollSlots,
        body.preRollPrice,
        body.midRollSlots,
        body.midRollPrice,
        body.postRollSlots,
        body.postRollPrice,
        body.estimatedImpressions
      ]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: 'Episode inventory not found' }, { status: 404 })
    }

    // Recalculate available slots
    const recalcQuery = `
      UPDATE "EpisodeInventory" ei
      SET 
        "preRollAvailable" = "preRollSlots" - "preRollReserved" - "preRollBooked",
        "midRollAvailable" = "midRollSlots" - "midRollReserved" - "midRollBooked",
        "postRollAvailable" = "postRollSlots" - "postRollReserved" - "postRollBooked"
      WHERE "episodeId" = $1
      RETURNING *
    `
    
    const updated = await querySchema(orgSlug, recalcQuery, [episodeId])

    return NextResponse.json(updated[0])

  } catch (error: any) {
    console.error('Update inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error.message },
      { status: 500 }
    )
  }
}

// Direct exports with auth check
export const GET = async (request: NextRequest, context: { params: { episodeId: string } }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return getHandler(request as AuthenticatedRequest, context)
}

export const PUT = async (request: NextRequest, context: { params: { episodeId: string } }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return putHandler(request as AuthenticatedRequest, context)
}