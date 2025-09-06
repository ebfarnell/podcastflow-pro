import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const showId = searchParams.get('showId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const placementType = searchParams.get('placementType')

    // Default to next 30 days if no date range specified
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Build where clause
    const where: any = {
      organizationId: user.organizationId,
      date: {
        gte: start,
        lte: end
      }
    }

    if (showId) {
      where.showId = showId
    }

    if (placementType) {
      where.placementType = placementType
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Build query for inventory data with show and episode information
    let inventoryQuery = `
      SELECT 
        i.*,
        s.id as show_id,
        s.name as show_name,
        s."coverImage" as show_cover_image,
        s.genre as show_genre,
        s."averageDownloads" as show_average_downloads,
        json_agg(
          json_build_object(
            'id', e.id,
            'title', e.title,
            'airDate', e."airDate"
          ) ORDER BY e."airDate"
        ) FILTER (WHERE e.id IS NOT NULL) as episodes
      FROM "Inventory" i
      LEFT JOIN "Show" s ON s.id = i."showId"
      LEFT JOIN "Episode" e ON e."showId" = s.id 
        AND e."airDate" >= $1 
        AND e."airDate" <= $2
      WHERE i.date >= $1 AND i.date <= $2
    `
    
    const queryParams: any[] = [start, end]
    let paramIndex = 3
    
    if (showId) {
      inventoryQuery += ` AND i."showId" = $${paramIndex}`
      queryParams.push(showId)
      paramIndex++
    }
    
    if (placementType) {
      inventoryQuery += ` AND i."placementType" = $${paramIndex}`
      queryParams.push(placementType)
      paramIndex++
    }
    
    inventoryQuery += `
      GROUP BY i.id, s.id, s.name, s."coverImage", s.genre, s."averageDownloads"
      ORDER BY i.date ASC, i."showId" ASC, i."placementType" ASC
    `
    
    const inventoryRaw = await querySchema<any>(orgSlug, inventoryQuery, queryParams)

    // Get shows for filtering using schema-aware query
    const showsQuery = `
      SELECT id, name 
      FROM "Show" 
      WHERE "isActive" = true
      ORDER BY name
    `
    const shows = await querySchema<any>(orgSlug, showsQuery, [])

    // Transform inventory into ad slots format
    const adSlots = inventoryRaw.flatMap((inv: any) => {
      // Find the episode for this date
      const invDate = new Date(inv.date)
      const episode = inv.episodes?.find((ep: any) => {
        const epDate = new Date(ep.airDate)
        return epDate.toDateString() === invDate.toDateString()
      })

      // Only include slots that match status filter
      let includeSlot = true
      if (status) {
        if (status === 'available' && inv.availableSpots === 0) includeSlot = false
        if (status === 'reserved' && inv.reservedSpots === 0) includeSlot = false
        if (status === 'sold' && inv.bookedSpots === 0) includeSlot = false
      }

      if (!includeSlot) return []

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const showMatch = inv.show_name?.toLowerCase().includes(searchLower) || false
        const episodeMatch = episode?.title?.toLowerCase().includes(searchLower) || false
        if (!showMatch && !episodeMatch) return []
      }

      // Get placement info - for now use default values
      // TODO: Query ShowPlacement table if needed
      const defaultDuration = inv.placementType === 'mid-roll' ? 60 : 30
      const defaultPrice = inv.placementType === 'mid-roll' ? 500 : 
                          inv.placementType === 'pre-roll' ? 300 : 200

      return [{
        id: inv.id,
        showId: inv.showId,
        show: inv.show_name || '',
        showLogo: inv.show_cover_image || '',
        episode: episode?.title || `Episode for ${invDate.toLocaleDateString()}`,
        episodeId: episode?.id,
        publishDate: inv.date,
        slotPosition: inv.placementType,
        duration: `${defaultDuration}s`,
        price: defaultPrice,
        status: inv.availableSpots > 0 ? 'available' : inv.reservedSpots > 0 ? 'reserved' : 'sold',
        targetAudience: inv.show_genre || 'General',
        estimatedReach: inv.show_average_downloads || 0,
        totalSpots: inv.totalSpots || 0,
        availableSpots: inv.availableSpots || 0,
        reservedSpots: inv.reservedSpots || 0,
        bookedSpots: inv.bookedSpots || 0
      }]
    })

    // Calculate statistics
    const stats = {
      totalSlots: adSlots.length,
      availableSlots: adSlots.filter(s => s.status === 'available').length,
      reservedSlots: adSlots.filter(s => s.status === 'reserved').length,
      soldSlots: adSlots.filter(s => s.status === 'sold').length,
      totalValue: adSlots.reduce((sum, slot) => sum + slot.price, 0),
      availableValue: adSlots.filter(s => s.status === 'available').reduce((sum, slot) => sum + slot.price, 0)
    }

    return NextResponse.json({
      slots: adSlots,
      shows,
      stats,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    })

  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability data' },
      { status: 500 }
    )
  }
}
