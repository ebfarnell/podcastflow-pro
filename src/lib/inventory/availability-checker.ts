import { querySchema } from '@/lib/db/schema-db'
import { format } from 'date-fns'

export interface InventoryCheckOptions {
  campaignId?: string
  advertiserId?: string
  includeHolds?: boolean
  checkCompetitive?: boolean
}

export interface InventoryStatus {
  available: boolean
  reason?: string
  episodeId?: string
  rate?: number
  availableSlots?: number
  totalSlots?: number
  conflictDetails?: {
    type: 'sold' | 'held' | 'reserved' | 'competitive' | 'no_inventory' | 'max_spots_reached'
    holder?: string
    expiresAt?: Date
  }
}

export interface BulkPlacementCandidate {
  showId: string
  date: Date
  placementType: string
  episodeId?: string
  rate?: number
}

/**
 * Check inventory availability for a specific show, date, and placement type
 * Considers reservations, scheduled spots, and holds
 */
export async function checkInventoryAvailability(
  orgSlug: string,
  params: {
    showId: string
    date: Date
    placementType: string
  },
  options: InventoryCheckOptions = {}
): Promise<InventoryStatus> {
  try {
    const dateStr = format(params.date, 'yyyy-MM-dd')
    
    // First, find the episode for this show and date
    const episodeQuery = `
      SELECT 
        e.id,
        e.title,
        e."airDate",
        e.status,
        ei."preRollSlots",
        ei."midRollSlots", 
        ei."postRollSlots",
        ei."preRollAvailable",
        ei."midRollAvailable",
        ei."postRollAvailable",
        ei."preRollReserved",
        ei."midRollReserved",
        ei."postRollReserved",
        ei."preRollBooked",
        ei."midRollBooked",
        ei."postRollBooked"
      FROM "Episode" e
      LEFT JOIN "EpisodeInventory" ei ON ei."episodeId" = e.id
      WHERE e."showId" = $1
        AND DATE(e."airDate") = DATE($2)
      LIMIT 1
    `
    
    const episodeResult = await querySchema(orgSlug, episodeQuery, [params.showId, dateStr])
    
    if (!episodeResult || episodeResult.length === 0) {
      return {
        available: false,
        reason: 'No episode found for this date',
        conflictDetails: { type: 'no_inventory' }
      }
    }
    
    const episode = episodeResult[0]
    const episodeId = episode.id
    
    // Determine placement column names
    let slotsColumn: string
    let availableColumn: string
    let reservedColumn: string
    let bookedColumn: string
    
    switch (params.placementType.toLowerCase()) {
      case 'pre-roll':
      case 'preroll':
        slotsColumn = 'preRollSlots'
        availableColumn = 'preRollAvailable'
        reservedColumn = 'preRollReserved'
        bookedColumn = 'preRollBooked'
        break
      case 'mid-roll':
      case 'midroll':
        slotsColumn = 'midRollSlots'
        availableColumn = 'midRollAvailable'
        reservedColumn = 'midRollReserved'
        bookedColumn = 'midRollBooked'
        break
      case 'post-roll':
      case 'postroll':
        slotsColumn = 'postRollSlots'
        availableColumn = 'postRollAvailable'
        reservedColumn = 'postRollReserved'
        bookedColumn = 'postRollBooked'
        break
      default:
        return {
          available: false,
          reason: `Invalid placement type: ${params.placementType}`,
          conflictDetails: { type: 'no_inventory' }
        }
    }
    
    const totalSlots = episode[slotsColumn] || 0
    const availableSlots = episode[availableColumn] || 0
    const reservedSlots = episode[reservedColumn] || 0
    const bookedSlots = episode[bookedColumn] || 0
    
    // Check if there's basic availability
    if (totalSlots === 0) {
      return {
        available: false,
        reason: `No ${params.placementType} slots configured for this episode`,
        episodeId,
        availableSlots: 0,
        totalSlots: 0,
        conflictDetails: { type: 'no_inventory' }
      }
    }
    
    if (availableSlots <= 0) {
      // Determine why it's not available
      if (bookedSlots >= totalSlots) {
        return {
          available: false,
          reason: `All ${params.placementType} slots are sold`,
          episodeId,
          availableSlots: 0,
          totalSlots,
          conflictDetails: { type: 'sold' }
        }
      } else if (reservedSlots >= totalSlots) {
        // Check if any reservations belong to this campaign/advertiser
        const reservationCheckQuery = `
          SELECT 
            r.id,
            r."campaignId",
            r."advertiserId",
            r."expiresAt",
            r.status,
            c.name as "campaignName",
            a.name as "advertiserName"
          FROM "ReservationItem" ri
          JOIN "Reservation" r ON r.id = ri."reservationId"
          LEFT JOIN "Campaign" c ON c.id = r."campaignId"
          LEFT JOIN "Advertiser" a ON a.id = r."advertiserId"
          WHERE ri."episodeId" = $1
            AND ri."placementType" = $2
            AND r.status IN ('held', 'pending', 'confirmed')
            AND (r."expiresAt" IS NULL OR r."expiresAt" > NOW())
          LIMIT 1
        `
        
        const reservationResult = await querySchema(
          orgSlug, 
          reservationCheckQuery, 
          [episodeId, params.placementType]
        )
        
        if (reservationResult && reservationResult.length > 0) {
          const reservation = reservationResult[0]
          
          // Check if this is our own reservation
          if (options.campaignId && reservation.campaignId === options.campaignId) {
            return {
              available: true,
              episodeId,
              availableSlots: 1, // Can use our own reservation
              totalSlots
            }
          }
          
          if (options.advertiserId && reservation.advertiserId === options.advertiserId) {
            return {
              available: true,
              episodeId,
              availableSlots: 1, // Can use our own reservation
              totalSlots
            }
          }
          
          return {
            available: false,
            reason: `Slot is held by ${reservation.advertiserName || reservation.campaignName || 'another party'}`,
            episodeId,
            availableSlots: 0,
            totalSlots,
            conflictDetails: {
              type: 'held',
              holder: reservation.advertiserName || reservation.campaignName,
              expiresAt: reservation.expiresAt
            }
          }
        }
      }
    }
    
    // Check for existing scheduled spots
    const scheduledSpotsQuery = `
      SELECT COUNT(*) as count
      FROM "ScheduledSpot" ss
      WHERE ss."showId" = $1
        AND DATE(ss."airDate") = DATE($2)
        AND ss."placementType" = $3
    `
    
    const scheduledResult = await querySchema(
      orgSlug,
      scheduledSpotsQuery,
      [params.showId, dateStr, params.placementType]
    )
    
    const scheduledCount = parseInt(scheduledResult[0]?.count || '0')
    
    // Calculate actual availability
    const actualAvailable = Math.max(0, totalSlots - bookedSlots - reservedSlots - scheduledCount)
    
    if (actualAvailable <= 0) {
      return {
        available: false,
        reason: `No available ${params.placementType} slots`,
        episodeId,
        availableSlots: 0,
        totalSlots,
        conflictDetails: { type: 'sold' }
      }
    }
    
    // Get rate card information
    const rateQuery = `
      SELECT 
        sr."preRollRate",
        sr."midRollRate",
        sr."postRollRate"
      FROM "ShowRateCard" sr
      WHERE sr."showId" = $1
      ORDER BY sr."effectiveDate" DESC
      LIMIT 1
    `
    
    const rateResult = await querySchema(orgSlug, rateQuery, [params.showId])
    let rate = 0
    
    if (rateResult && rateResult.length > 0) {
      const rateCard = rateResult[0]
      switch (params.placementType.toLowerCase()) {
        case 'pre-roll':
        case 'preroll':
          rate = rateCard.preRollRate || 0
          break
        case 'mid-roll':
        case 'midroll':
          rate = rateCard.midRollRate || 0
          break
        case 'post-roll':
        case 'postroll':
          rate = rateCard.postRollRate || 0
          break
      }
    }
    
    return {
      available: true,
      episodeId,
      rate,
      availableSlots: actualAvailable,
      totalSlots
    }
    
  } catch (error) {
    console.error('Inventory availability check error:', error)
    return {
      available: false,
      reason: 'Error checking inventory availability',
      conflictDetails: { type: 'no_inventory' }
    }
  }
}

/**
 * Check if multiple spots can be placed on the same show/day
 */
export async function checkMultipleSpotAllowance(
  orgSlug: string,
  showId: string,
  date: Date,
  requestedSpots: number,
  allowMultiple: boolean,
  maxSpotsPerShowPerDay: number = 1
): Promise<{ allowed: boolean; maxAllowed: number; reason?: string }> {
  if (!allowMultiple) {
    // Check if any spot already exists for this show/date
    const existingQuery = `
      SELECT COUNT(*) as count
      FROM "ScheduledSpot" ss
      WHERE ss."showId" = $1
        AND DATE(ss.date) = DATE($2)
    `
    
    const result = await querySchema(orgSlug, existingQuery, [showId, format(date, 'yyyy-MM-dd')])
    const existingCount = parseInt(result[0]?.count || '0')
    
    if (existingCount > 0) {
      return {
        allowed: false,
        maxAllowed: 0,
        reason: 'A spot already exists for this show on this date'
      }
    }
    
    return {
      allowed: requestedSpots <= 1,
      maxAllowed: 1,
      reason: requestedSpots > 1 ? 'Multiple spots per show/day not allowed' : undefined
    }
  }
  
  // Multiple spots allowed - check against max limit
  const existingQuery = `
    SELECT COUNT(*) as count
    FROM "ScheduledSpot" ss
    WHERE ss."showId" = $1
      AND DATE(ss.date) = DATE($2)
  `
  
  const result = await querySchema(orgSlug, existingQuery, [showId, format(date, 'yyyy-MM-dd')])
  const existingCount = parseInt(result[0]?.count || '0')
  const remainingSlots = maxSpotsPerShowPerDay - existingCount
  
  if (remainingSlots <= 0) {
    return {
      allowed: false,
      maxAllowed: 0,
      reason: `Maximum ${maxSpotsPerShowPerDay} spots per show/day already reached`
    }
  }
  
  return {
    allowed: requestedSpots <= remainingSlots,
    maxAllowed: remainingSlots,
    reason: requestedSpots > remainingSlots 
      ? `Only ${remainingSlots} more spots allowed (max ${maxSpotsPerShowPerDay} per show/day)` 
      : undefined
  }
}