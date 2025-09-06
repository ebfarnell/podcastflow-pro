import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import { format } from 'date-fns'

/**
 * GET /api/schedule-availability
 * Fetches actual episode availability for schedule builder based on scheduled episodes
 */
export async function GET(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      const { searchParams } = new URL(request.url)
      const showIds = searchParams.get('showIds')?.split(',').filter(Boolean) || []
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      if (!showIds.length) {
        return NextResponse.json({ availability: {} })
      }

      // Get tenant database client
      const tenantDb = getTenantClient(context)

      // Build date filter
      const dateFilter: any = {}
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate)
      }

      // Fetch scheduled episodes for the specified shows and date range
      const episodes = await tenantDb.episode.findMany({
        where: {
          showId: { in: showIds },
          airDate: dateFilter,
          status: { in: ['scheduled', 'published'] } // Only include scheduled/published episodes
        },
        select: {
          id: true,
          showId: true,
          title: true,
          episodeNumber: true,
          airDate: true,
          status: true
        },
        orderBy: {
          airDate: 'asc'
        }
      })
      
      // Get show data separately since include is not working with tenant isolation
      const showData = await tenantDb.show.findMany({
        where: {
          id: { in: showIds }
        },
        select: {
          id: true,
          name: true,
          preRollSlots: true,
          midRollSlots: true,
          postRollSlots: true
        }
      })
      
      // Create a map for quick lookup
      const showsById = new Map(showData.map(s => [s.id, s]))

      // Check existing reservations/orders to determine what's still available
      const episodeIds = episodes.map(e => e.id)
      
      // Get episode inventory records
      const episodeInventory = await tenantDb.episodeInventory.findMany({
        where: {
          episodeId: { in: episodeIds }
        },
        select: {
          episodeId: true,
          preRollSlots: true,
          preRollAvailable: true,
          preRollReserved: true,
          preRollBooked: true,
          midRollSlots: true,
          midRollAvailable: true,
          midRollReserved: true,
          midRollBooked: true,
          postRollSlots: true,
          postRollAvailable: true,
          postRollReserved: true,
          postRollBooked: true
        }
      })

      // Create a map for quick lookup
      const inventoryByEpisodeId = new Map(
        episodeInventory.map(inv => [inv.episodeId, inv])
      )

      // Build availability map by show and date
      const availabilityByShow: Record<string, Record<string, any>> = {}

      episodes.forEach(episode => {
        const dateKey = format(episode.airDate, 'yyyy-MM-dd')
        const showId = episode.showId
        
        if (!availabilityByShow[showId]) {
          availabilityByShow[showId] = {}
        }

        // Get inventory for this episode
        const inventory = inventoryByEpisodeId.get(episode.id)
        const show = showsById.get(episode.showId)
        
        // If no inventory record exists, create default availability based on show settings
        // This handles episodes that haven't had inventory records created yet
        let availablePreRoll = 0
        let availableMidRoll = 0
        let availablePostRoll = 0
        let totalPreRollSlots = show?.preRollSlots || 1
        let totalMidRollSlots = show?.midRollSlots || 2
        let totalPostRollSlots = show?.postRollSlots || 1
        
        if (inventory) {
          // Use actual inventory data if it exists
          availablePreRoll = inventory.preRollAvailable
          availableMidRoll = inventory.midRollAvailable
          availablePostRoll = inventory.postRollAvailable
          totalPreRollSlots = inventory.preRollSlots
          totalMidRollSlots = inventory.midRollSlots
          totalPostRollSlots = inventory.postRollSlots
        } else {
          // No inventory record exists - assume all slots are available
          availablePreRoll = totalPreRollSlots
          availableMidRoll = totalMidRollSlots
          availablePostRoll = totalPostRollSlots
        }
        
        // Store availability with episode info
        availabilityByShow[showId][dateKey] = {
          episodeId: episode.id,
          episodeTitle: episode.title,
          episodeNumber: episode.episodeNumber,
          preRoll: availablePreRoll > 0,
          midRoll: availableMidRoll > 0,
          postRoll: availablePostRoll > 0,
          availableSlots: {
            preRoll: availablePreRoll,
            midRoll: availableMidRoll,
            postRoll: availablePostRoll
          },
          totalSlots: {
            preRoll: totalPreRollSlots,
            midRoll: totalMidRollSlots,
            postRoll: totalPostRollSlots
          },
          hasInventoryRecord: !!inventory
        }
      })

      return NextResponse.json({
        availability: availabilityByShow,
        episodeCount: episodes.length,
        success: true
      })

    } catch (error) {
      console.error('Schedule availability error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch availability', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
}