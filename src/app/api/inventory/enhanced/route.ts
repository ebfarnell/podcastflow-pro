import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization slug for multi-tenant query
    const orgSlug = session.organizationSlug || await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const showIds = searchParams.get('showIds')?.split(',').filter(Boolean) || []
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || 
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const categories = searchParams.get('categories')?.split(',').filter(Boolean)
    const minImpressions = searchParams.get('minImpressions')
    const maxPrice = searchParams.get('maxPrice')

    // Build query conditions
    const conditions = [`e."airDate" BETWEEN $1::date AND $2::date`]
    const params: any[] = [startDate, endDate]
    let paramIndex = 3

    if (showIds.length > 0) {
      conditions.push(`s.id = ANY($${paramIndex}::text[])`)
      params.push(showIds)
      paramIndex++
    }

    if (categories && categories.length > 0) {
      conditions.push(`s.category = ANY($${paramIndex}::text[])`)
      params.push(categories)
      paramIndex++
    }

    // Skip minImpressions filter as estimatedImpressions column doesn't exist
    // TODO: Add this column to Episode table or calculate from metrics

    const whereClause = conditions.join(' AND ')

    // Get enhanced inventory data
    const { data: inventory, error } = await safeQuerySchema(
      orgSlug,
      `
        WITH episode_inventory AS (
          SELECT 
            e.id as "episodeId",
            e."showId",
            e.title as "episodeTitle",
            e."episodeNumber",
            e."airDate",
            e.status as "episodeStatus",
            NULL as "estimatedImpressions", -- Column doesn't exist yet
            s.name as "showName",
            s.category as "showCategory",
            s.host as "showHost",
            sc.id as "configurationId",
            sc.name as "configurationName",
            sc."episodeLength",
            sc."adLoadType",
            sc."preRollSlots",
            sc."midRollSlots",
            sc."postRollSlots",
            rc."preRollBaseRate",
            rc."midRollBaseRate",
            rc."postRollBaseRate",
            rc."volumeDiscounts",
            rc."seasonalMultipliers",
            rc."dayOfWeekMultipliers"
          FROM "Episode" e
          JOIN "Show" s ON e."showId" = s.id
          JOIN "ShowConfiguration" sc ON sc."showId" = s.id AND sc."isActive" = true
          LEFT JOIN LATERAL (
            SELECT *
            FROM "RateCard" rc
            WHERE rc."showConfigurationId" = sc.id
              AND rc.status = 'active'
              AND rc."effectiveDate" <= e."airDate"
              AND (rc."expiryDate" IS NULL OR rc."expiryDate" >= e."airDate")
            ORDER BY rc."effectiveDate" DESC
            LIMIT 1
          ) rc ON true
          WHERE ${whereClause}
            AND e.status IN ('scheduled', 'published')
            AND s."isActive" = true
        ),
        reservations AS (
          SELECT 
            "episodeId",
            "placementType",
            "slotNumber",
            status,
            "scheduleId"
          FROM "InventoryReservation"
          WHERE status IN ('reserved', 'confirmed')
            AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        ),
        booked_slots AS (
          SELECT 
            si."episodeId",
            si."placementType",
            si."slotNumber"
          FROM "ScheduleBuilderItem" si
          JOIN "ScheduleBuilder" s ON si."scheduleId" = s.id
          WHERE s.status IN ('approved', 'active')
            AND si.status != 'cancelled'
        )
        SELECT 
          ei.*,
          -- Pre-roll availability
          CASE 
            WHEN ei."preRollSlots" > 0 THEN
              ei."preRollSlots" - COALESCE((
                SELECT COUNT(*)
                FROM (
                  SELECT "episodeId", "slotNumber" FROM reservations 
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'pre-roll'
                  UNION
                  SELECT "episodeId", "slotNumber" FROM booked_slots
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'pre-roll'
                ) combined
              ), 0)
            ELSE 0
          END as "preRollAvailable",
          -- Mid-roll availability
          CASE 
            WHEN ei."midRollSlots" > 0 THEN
              ei."midRollSlots" - COALESCE((
                SELECT COUNT(*)
                FROM (
                  SELECT "episodeId", "slotNumber" FROM reservations 
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'mid-roll'
                  UNION
                  SELECT "episodeId", "slotNumber" FROM booked_slots
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'mid-roll'
                ) combined
              ), 0)
            ELSE 0
          END as "midRollAvailable",
          -- Post-roll availability
          CASE 
            WHEN ei."postRollSlots" > 0 THEN
              ei."postRollSlots" - COALESCE((
                SELECT COUNT(*)
                FROM (
                  SELECT "episodeId", "slotNumber" FROM reservations 
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'post-roll'
                  UNION
                  SELECT "episodeId", "slotNumber" FROM booked_slots
                  WHERE "episodeId" = ei."episodeId" AND "placementType" = 'post-roll'
                ) combined
              ), 0)
            ELSE 0
          END as "postRollAvailable",
          -- Calculate adjusted prices based on multipliers
          ei."preRollBaseRate" * 
            COALESCE((ei."seasonalMultipliers"->>to_char(ei."airDate", 'q'))::numeric, 1) *
            COALESCE((ei."dayOfWeekMultipliers"->>lower(to_char(ei."airDate", 'day')))::numeric, 1) 
            as "preRollAdjustedPrice",
          ei."midRollBaseRate" * 
            COALESCE((ei."seasonalMultipliers"->>to_char(ei."airDate", 'q'))::numeric, 1) *
            COALESCE((ei."dayOfWeekMultipliers"->>lower(to_char(ei."airDate", 'day')))::numeric, 1) 
            as "midRollAdjustedPrice",
          ei."postRollBaseRate" * 
            COALESCE((ei."seasonalMultipliers"->>to_char(ei."airDate", 'q'))::numeric, 1) *
            COALESCE((ei."dayOfWeekMultipliers"->>lower(to_char(ei."airDate", 'day')))::numeric, 1) 
            as "postRollAdjustedPrice"
        FROM episode_inventory ei
        WHERE (
          ei."preRollSlots" > 0 OR 
          ei."midRollSlots" > 0 OR 
          ei."postRollSlots" > 0
        )
        ${maxPrice ? `AND (
          ei."preRollBaseRate" <= $${paramIndex} OR
          ei."midRollBaseRate" <= $${paramIndex} OR
          ei."postRollBaseRate" <= $${paramIndex}
        )` : ''}
        ORDER BY ei."airDate", ei."showName", ei."episodeNumber"
        LIMIT 500
      `,
      maxPrice ? [...params, parseFloat(maxPrice)] : params
    )

    if (error) {
      console.error('Failed to fetch inventory:', error)
      return NextResponse.json({ inventory: [] })
    }

    // Get show restrictions for filtering
    const showIdList = [...new Set((inventory || []).map(i => i.showId))]
    
    if (showIdList.length > 0) {
      const { data: restrictions } = await safeQuerySchema(
        orgSlug,
        `
          SELECT 
            "showId",
            "restrictionType",
            category,
            "advertiserId",
            "startDate",
            "endDate"
          FROM "ShowRestriction"
          WHERE "showId" = ANY($1::text[])
            AND (
              "startDate" IS NULL OR "startDate" <= $3::date
            )
            AND (
              "endDate" IS NULL OR "endDate" >= $2::date
            )
        `,
        [showIdList, startDate, endDate]
      )

      // Add restrictions to inventory items
      if (restrictions && inventory) {
        const restrictionMap = new Map()
        restrictions.forEach(r => {
          if (!restrictionMap.has(r.showId)) {
            restrictionMap.set(r.showId, [])
          }
          restrictionMap.get(r.showId).push(r)
        })

        inventory.forEach(item => {
          item.restrictions = restrictionMap.get(item.showId) || []
        })
      }
    }

    return NextResponse.json({ 
      inventory: inventory || [],
      totalCount: inventory?.length || 0,
      dateRange: { startDate, endDate }
    })
  } catch (error) {
    console.error('Enhanced inventory fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}