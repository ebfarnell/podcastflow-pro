import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

interface ReserveInventoryOptions {
  campaignId: string
  schemaName: string
  ttlHours: number
  userId: string
}

interface ReleaseInventoryOptions {
  campaignId: string
  schemaName: string
}

export async function reserveInventory(options: ReserveInventoryOptions): Promise<string[]> {
  const { campaignId, schemaName, ttlHours, userId } = options
  const reservationIds: string[] = []

  try {
    // Get all scheduled spots for the campaign
    const { data: spots } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT ss.*, s."name" as "showName", e."episodeNumber", e."airDate"
        FROM "${schema}"."ScheduledSpot" ss
        JOIN "${schema}"."Show" s ON ss."showId" = s.id
        JOIN "${schema}"."Episode" e ON ss."episodeId" = e.id
        WHERE ss."campaignId" = $1
        FOR UPDATE
      `, campaignId)
    })

    if (!spots || spots.length === 0) {
      return reservationIds
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)

    // Create reservations for each spot
    for (const spot of spots) {
      const reservationId = uuidv4()
      
      // Check if already reserved
      const { data: existing } = await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$queryRawUnsafe(`
          SELECT id FROM "${schema}"."InventoryReservation"
          WHERE "episodeId" = $1 
          AND "placementType" = $2
          AND "expiresAt" > NOW()
          AND "campaignId" != $3
        `, spot.episodeId, spot.placementType, campaignId)
      })

      if (existing && existing.length > 0) {
        console.log(`Inventory already reserved for episode ${spot.episodeId}, placement ${spot.placementType}`)
        continue
      }

      // Create reservation
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}"."InventoryReservation" (
            id, "campaignId", "showId", "episodeId", 
            "placementType", "expiresAt", "createdAt", "createdBy"
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
          ON CONFLICT ("episodeId", "placementType") 
          DO UPDATE SET 
            "campaignId" = EXCLUDED."campaignId",
            "expiresAt" = EXCLUDED."expiresAt",
            "updatedAt" = NOW()
        `, reservationId, campaignId, spot.showId, spot.episodeId, 
           spot.placementType, expiresAt, userId)
      })

      reservationIds.push(reservationId)

      // Update episode inventory status
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Episode"
          SET "inventoryStatus" = jsonb_set(
            COALESCE("inventoryStatus", '{}'::jsonb),
            '{${spot.placementType}}',
            '"reserved"'
          ),
          "updatedAt" = NOW()
          WHERE id = $1
        `, spot.episodeId)
      })
    }

    console.log(`Reserved ${reservationIds.length} inventory slots for campaign ${campaignId}`)

  } catch (error) {
    console.error('Error reserving inventory:', error)
    throw error
  }

  return reservationIds
}

export async function releaseInventory(options: ReleaseInventoryOptions): Promise<number> {
  const { campaignId, schemaName } = options
  
  try {
    // Get all reservations for the campaign
    const { data: reservations } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT * FROM "${schema}"."InventoryReservation"
        WHERE "campaignId" = $1
      `, campaignId)
    })

    if (!reservations || reservations.length === 0) {
      return 0
    }

    // Update episode inventory status back to available
    for (const reservation of reservations) {
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Episode"
          SET "inventoryStatus" = jsonb_set(
            COALESCE("inventoryStatus", '{}'::jsonb),
            '{${reservation.placementType}}',
            '"available"'
          ),
          "updatedAt" = NOW()
          WHERE id = $1
        `, reservation.episodeId)
      })
    }

    // Delete reservations
    const { data: deleteResult } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        DELETE FROM "${schema}"."InventoryReservation"
        WHERE "campaignId" = $1
        RETURNING id
      `, campaignId)
    })

    const releasedCount = deleteResult?.length || 0
    console.log(`Released ${releasedCount} inventory reservations for campaign ${campaignId}`)
    
    return releasedCount

  } catch (error) {
    console.error('Error releasing inventory:', error)
    throw error
  }
}

export async function cleanExpiredReservations(schemaName: string): Promise<number> {
  try {
    // Find expired reservations
    const { data: expired } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT * FROM "${schema}"."InventoryReservation"
        WHERE "expiresAt" <= NOW()
      `)
    })

    if (!expired || expired.length === 0) {
      return 0
    }

    // Update episode inventory status for expired reservations
    for (const reservation of expired) {
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Episode"
          SET "inventoryStatus" = jsonb_set(
            COALESCE("inventoryStatus", '{}'::jsonb),
            '{${reservation.placementType}}',
            '"available"'
          ),
          "updatedAt" = NOW()
          WHERE id = $1
        `, reservation.episodeId)
      })
    }

    // Delete expired reservations
    const { data: deleteResult } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        DELETE FROM "${schema}"."InventoryReservation"
        WHERE "expiresAt" <= NOW()
        RETURNING id
      `)
    })

    const cleanedCount = deleteResult?.length || 0
    console.log(`Cleaned ${cleanedCount} expired inventory reservations`)
    
    return cleanedCount

  } catch (error) {
    console.error('Error cleaning expired reservations:', error)
    return 0
  }
}