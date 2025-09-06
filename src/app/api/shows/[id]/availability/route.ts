import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

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
        `/api/shows/${params.id}/availability`,
        request
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const placementType = searchParams.get('placementType')

    // Default to next 30 days if no date range specified
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Build inventory query with schema-aware approach
    let inventoryQuery = `
      SELECT * FROM "Inventory" 
      WHERE "showId" = $1 
        AND date >= $2 
        AND date <= $3
    `
    const queryParams = [params.id, start, end]
    
    if (placementType) {
      inventoryQuery += ` AND "placementType" = $4`
      queryParams.push(placementType)
    }
    
    inventoryQuery += ` ORDER BY date ASC, "placementType" ASC`
    
    // Fetch inventory data using schema-aware queries
    const inventory = await querySchema<any>(orgSlug, inventoryQuery, queryParams)

    // Fetch show placements for reference using schema-aware queries
    const placementsQuery = `
      SELECT * FROM "ShowPlacement" 
      WHERE "showId" = $1 AND "isActive" = true
    `
    const placements = await querySchema<any>(orgSlug, placementsQuery, [params.id])

    // Fetch blocked spots with advertiser and campaign details using schema-aware queries
    const blockedSpotsQuery = `
      SELECT 
        bs.*,
        a.id as advertiser_id, a.name as advertiser_name,
        c.id as campaign_id, c.name as campaign_name
      FROM "BlockedSpot" bs
      LEFT JOIN "Advertiser" a ON a.id = bs."advertiserId"
      LEFT JOIN "Campaign" c ON c.id = bs."campaignId"
      WHERE bs."showId" = $1 
        AND (bs."endDate" IS NULL OR bs."endDate" >= $2)
        AND bs."startDate" <= $3
    `
    const blockedSpotsRaw = await querySchema<any>(orgSlug, blockedSpotsQuery, [params.id, start, end])
    
    // Transform blocked spots to match expected format
    const blockedSpots = blockedSpotsRaw.map(bs => ({
      ...bs,
      advertiser: bs.advertiser_id ? {
        id: bs.advertiser_id,
        name: bs.advertiser_name
      } : null,
      campaign: bs.campaign_id ? {
        id: bs.campaign_id,
        name: bs.campaign_name
      } : null
    }))

    // Calculate availability summary
    const availabilitySummary = inventory.reduce((acc: any, inv) => {
      const dateKey = inv.date.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = {}
      }
      
      acc[dateKey][inv.placementType] = {
        total: inv.totalSpots,
        available: inv.availableSpots,
        reserved: inv.reservedSpots,
        booked: inv.bookedSpots,
        utilizationRate: inv.totalSpots > 0 ? ((inv.reservedSpots + inv.bookedSpots) / inv.totalSpots) * 100 : 0,
        availability: inv.availableSpots > 0 ? 'available' : inv.reservedSpots > 0 ? 'limited' : 'sold_out'
      }
      
      return acc
    }, {})

    // Get recent orders for context using schema-aware queries
    const recentOrdersQuery = `
      SELECT 
        oi.*,
        o.id as order_id, o."orderNumber", o.status as order_status,
        a.id as advertiser_id, a.name as advertiser_name
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      WHERE oi."showId" = $1 
        AND oi."airDate" >= $2 
        AND oi."airDate" <= $3
        AND o.status IN ('approved', 'booked', 'confirmed')
      ORDER BY oi."airDate" ASC
      LIMIT 50
    `
    const recentOrdersRaw = await querySchema<any>(orgSlug, recentOrdersQuery, [params.id, start, end])
    
    // Transform recent orders to match expected format
    const recentOrders = recentOrdersRaw.map(roi => ({
      ...roi,
      order: {
        id: roi.order_id,
        orderNumber: roi.orderNumber,
        status: roi.order_status,
        advertiser: roi.advertiser_id ? {
          id: roi.advertiser_id,
          name: roi.advertiser_name
        } : null
      }
    }))

    return NextResponse.json({
      inventory,
      placements,
      blockedSpots,
      availabilitySummary,
      recentOrders,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching show availability:', error)
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
        'POST',
        `/api/shows/${params.id}/availability`,
        request
      )
    }

    const body = await request.json()
    const { action, dates, placementType, adjustments } = body

    if (action === 'bulk_update' && dates && placementType && adjustments) {
      // Bulk update inventory for specific dates using schema-aware queries
      for (const dateStr of dates) {
        const date = new Date(dateStr)
        
        // First check if inventory exists
        const existingInventoryQuery = `
          SELECT id FROM "Inventory" 
          WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
        `
        const existing = await querySchema<any>(orgSlug, existingInventoryQuery, [params.id, date, placementType])
        
        if (existing.length > 0) {
          // Update existing inventory
          const updateQuery = `
            UPDATE "Inventory" 
            SET 
              "totalSpots" = COALESCE($4, "totalSpots"),
              "availableSpots" = COALESCE($5, "availableSpots"),
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
          `
          await querySchema(orgSlug, updateQuery, [
            params.id, 
            date, 
            placementType,
            adjustments.totalSpots ? parseInt(adjustments.totalSpots) : null,
            adjustments.availableSpots ? parseInt(adjustments.availableSpots) : null
          ])
        } else {
          // Create new inventory
          const createQuery = `
            INSERT INTO "Inventory" (
              "showId", date, "placementType", "totalSpots", "availableSpots", 
              "reservedSpots", "bookedSpots", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
          await querySchema(orgSlug, createQuery, [
            params.id,
            date,
            placementType,
            parseInt(adjustments.totalSpots) || 1,
            parseInt(adjustments.availableSpots) || 1
          ])
        }
      }

      return NextResponse.json({ 
        message: `Updated inventory for ${dates.length} dates`,
        updatedDates: dates
      })
    } else if (action === 'generate_inventory') {
      // Generate inventory based on show placements and release frequency using schema-aware queries
      const showQuery = `
        SELECT id, "releaseFrequency" FROM "Show" WHERE id = $1
      `
      const shows = await querySchema<any>(orgSlug, showQuery, [params.id])

      if (!shows || shows.length === 0) {
        return NextResponse.json({ error: 'Show not found' }, { status: 404 })
      }

      const show = shows[0]
      
      // Get show placements
      const placementsQuery = `
        SELECT "placementType", "totalSpots" FROM "ShowPlacement" 
        WHERE "showId" = $1 AND "isActive" = true
      `
      const placements = await querySchema<any>(orgSlug, placementsQuery, [params.id])

      const startDate = new Date(body.startDate || new Date())
      const endDate = new Date(body.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
      const frequency = show.releaseFrequency || 'weekly'

      // Generate dates based on frequency
      const generatedDates: Date[] = []
      let currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        generatedDates.push(new Date(currentDate))
        
        if (frequency === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1)
        } else if (frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7)
        } else if (frequency === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14)
        } else if (frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1)
        } else {
          // Default to weekly
          currentDate.setDate(currentDate.getDate() + 7)
        }
      }

      // Create inventory for each date and placement combination using schema-aware queries
      for (const date of generatedDates) {
        for (const placement of placements) {
          // Check if inventory already exists
          const existingQuery = `
            SELECT id FROM "Inventory" 
            WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
          `
          const existing = await querySchema<any>(orgSlug, existingQuery, [params.id, date, placement.placementType])
          
          if (existing.length === 0) {
            // Only create if it doesn't exist
            const createQuery = `
              INSERT INTO "Inventory" (
                "showId", date, "placementType", "totalSpots", "availableSpots", 
                "reservedSpots", "bookedSpots", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `
            await querySchema(orgSlug, createQuery, [
              params.id,
              date,
              placement.placementType,
              placement.totalSpots,
              placement.totalSpots
            ])
          }
        }
      }

      return NextResponse.json({
        message: `Generated inventory for ${generatedDates.length} dates`,
        generatedDates: generatedDates.length,
        placementTypes: placements.length
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating show availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
