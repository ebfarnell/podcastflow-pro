import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showId = searchParams.get('showId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query conditions
    const conditions = [`si."scheduleId" = $1`]
    const params = [params.id]
    let paramIndex = 2

    if (showId) {
      conditions.push(`si."showId" = $${paramIndex}`)
      params.push(showId)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`si."airDate" >= $${paramIndex}::date`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`si."airDate" <= $${paramIndex}::date`)
      params.push(endDate)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Get schedule items with full details
    const { data: items, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          si.*,
          s.name as "showName",
          s.category as "showCategory",
          e.title as "episodeTitle",
          e."episodeNumber",
          e."airDate" as "episodeAirDate",
          e.status as "episodeStatus",
          sc.name as "configurationName",
          sc."episodeLength",
          rc."preRollBaseRate",
          rc."midRollBaseRate",
          rc."postRollBaseRate",
          ac.name as "creativeName"
        FROM "ScheduleBuilderItem" si
        JOIN "Show" s ON si."showId" = s.id
        JOIN "ShowConfiguration" sc ON si."showConfigurationId" = sc.id
        LEFT JOIN "Episode" e ON si."episodeId" = e.id
        LEFT JOIN "RateCard" rc ON rc."showConfigurationId" = sc.id 
          AND rc.status = 'active'
          AND rc."effectiveDate" <= si."airDate"
          AND (rc."expiryDate" IS NULL OR rc."expiryDate" >= si."airDate")
        LEFT JOIN "AdCreative" ac ON si."creativeId" = ac.id
        WHERE ${whereClause}
        ORDER BY si."airDate", s.name, si."placementType", si."slotNumber"
      `,
      params
    )

    if (error) {
      console.error('Failed to fetch schedule items:', error)
      return NextResponse.json({ items: [] })
    }

    return NextResponse.json({ items: items || [] })
  } catch (error) {
    console.error('Schedule items fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and sales can add items
    if (!['admin', 'sales', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      )
    }

    // Check schedule exists and is editable
    const { data: scheduleData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT status FROM "ScheduleBuilder" WHERE id = $1`,
      [params.id]
    )

    if (!scheduleData || scheduleData.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    if (!['draft', 'pending_approval'].includes(scheduleData[0].status)) {
      return NextResponse.json(
        { error: 'Cannot modify approved schedule' },
        { status: 400 }
      )
    }

    const createdItems = []
    const conflicts = []

    // Process each item
    for (const item of items) {
      const itemId = `si_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Check for conflicts
      const conflictCheck = await checkScheduleConflicts(
        session.organizationSlug,
        item.showId,
        item.episodeId,
        item.airDate,
        item.placementType,
        item.slotNumber,
        params.id
      )

      if (conflictCheck.hasConflict) {
        conflicts.push({
          ...item,
          conflict: conflictCheck
        })
        continue
      }

      // Get rate card price
      const { data: rateData } = await safeQuerySchema(
        session.organizationSlug,
        `
          SELECT 
            CASE 
              WHEN $3 = 'pre-roll' THEN rc."preRollBaseRate"
              WHEN $3 = 'mid-roll' THEN rc."midRollBaseRate"
              WHEN $3 = 'post-roll' THEN rc."postRollBaseRate"
            END as "baseRate"
          FROM "RateCard" rc
          WHERE rc."showConfigurationId" = $1
            AND rc.status = 'active'
            AND rc."effectiveDate" <= $2::date
            AND (rc."expiryDate" IS NULL OR rc."expiryDate" >= $2::date)
          ORDER BY rc."effectiveDate" DESC
          LIMIT 1
        `,
        [item.showConfigurationId, item.airDate, item.placementType]
      )

      const rateCardPrice = rateData?.[0]?.baseRate || 0
      const negotiatedPrice = item.negotiatedPrice || rateCardPrice

      // Insert the item
      const { data: newItem, error } = await safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "ScheduleBuilderItem" (
            id, "scheduleId", "showId", "showConfigurationId", "episodeId",
            "airDate", "placementType", "slotNumber", "rateCardPrice",
            "negotiatedPrice", "impressions", status, notes, "addedBy"
          ) VALUES (
            $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14
          )
          RETURNING *
        `,
        [
          itemId,
          params.id,
          item.showId,
          item.showConfigurationId,
          item.episodeId || null,
          item.airDate,
          item.placementType,
          item.slotNumber || 1,
          rateCardPrice,
          negotiatedPrice,
          item.impressions || null,
          'scheduled',
          item.notes || null,
          session.userId
        ]
      )

      if (!error && newItem?.[0]) {
        createdItems.push(newItem[0])

        // Create inventory reservation
        await createInventoryReservation(
          session.organizationSlug,
          item.episodeId,
          item.placementType,
          item.slotNumber || 1,
          params.id,
          itemId,
          session.userId
        )
      }
    }

    // Update schedule totals
    await updateScheduleTotals(session.organizationSlug, params.id)

    return NextResponse.json({
      items: createdItems,
      conflicts,
      success: true
    })
  } catch (error) {
    console.error('Schedule items creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to check for schedule conflicts
async function checkScheduleConflicts(
  orgSlug: string,
  showId: string,
  episodeId: string | null,
  airDate: string,
  placementType: string,
  slotNumber: number,
  currentScheduleId: string
) {
  // Check if slot is already booked
  const { data: bookingCheck } = await safeQuerySchema(
    orgSlug,
    `
      SELECT 
        si.id,
        s.name as "scheduleName",
        s.status as "scheduleStatus"
      FROM "ScheduleBuilderItem" si
      JOIN "ScheduleBuilder" s ON si."scheduleId" = s.id
      WHERE si."episodeId" = $1
        AND si."placementType" = $2
        AND si."slotNumber" = $3
        AND si.status != 'cancelled'
        AND s.id != $4
        AND s.status IN ('approved', 'active')
    `,
    [episodeId, placementType, slotNumber, currentScheduleId]
  )

  if (bookingCheck && bookingCheck.length > 0) {
    return {
      hasConflict: true,
      type: 'slot_booked',
      details: bookingCheck[0]
    }
  }

  // Check for category conflicts
  const { data: categoryCheck } = await safeQuerySchema(
    orgSlug,
    `
      SELECT 
        cc.category,
        cc."exclusivityLevel",
        c.name as "campaignName"
      FROM "ScheduleBuilder" s
      JOIN "Campaign" c ON s."campaignId" = c.id
      JOIN "CampaignCategory" cc ON c.id = cc."campaignId"
      WHERE s.id = $1
        AND cc."exclusivityLevel" != 'none'
        AND (
          cc."exclusivityStartDate" IS NULL 
          OR cc."exclusivityStartDate" <= $2::date
        )
        AND (
          cc."exclusivityEndDate" IS NULL 
          OR cc."exclusivityEndDate" >= $2::date
        )
    `,
    [currentScheduleId, airDate]
  )

  // Check if there are conflicting categories in the same episode/show
  if (categoryCheck && categoryCheck.length > 0) {
    for (const cat of categoryCheck) {
      const scopeCondition = 
        cat.exclusivityLevel === 'episode' ? `si."episodeId" = $3` :
        cat.exclusivityLevel === 'show' ? `si."showId" = $4` :
        '1=1' // network level

      const { data: conflictingCampaigns } = await safeQuerySchema(
        orgSlug,
        `
          SELECT DISTINCT
            c.name as "campaignName",
            cc2.category
          FROM "ScheduleBuilderItem" si
          JOIN "ScheduleBuilder" s ON si."scheduleId" = s.id
          JOIN "Campaign" c ON s."campaignId" = c.id
          JOIN "CampaignCategory" cc2 ON c.id = cc2."campaignId"
          WHERE ${scopeCondition}
            AND si."airDate" = $1::date
            AND s.id != $2
            AND s.status IN ('approved', 'active')
            AND cc2.category = $5
        `,
        [airDate, currentScheduleId, episodeId, showId, cat.category]
      )

      if (conflictingCampaigns && conflictingCampaigns.length > 0) {
        return {
          hasConflict: true,
          type: 'category_conflict',
          details: {
            category: cat.category,
            exclusivityLevel: cat.exclusivityLevel,
            conflictingCampaign: conflictingCampaigns[0].campaignName
          }
        }
      }
    }
  }

  return { hasConflict: false }
}

// Helper function to create inventory reservation
async function createInventoryReservation(
  orgSlug: string,
  episodeId: string,
  placementType: string,
  slotNumber: number,
  scheduleId: string,
  scheduleItemId: string,
  userId: string
) {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  await safeQuerySchema(
    orgSlug,
    `
      INSERT INTO "InventoryReservation" (
        id, "episodeId", "placementType", "slotNumber",
        "scheduleId", "scheduleItemId", status, "reservedBy",
        "expiresAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'reserved', $7,
        NOW() + INTERVAL '24 hours'
      )
      ON CONFLICT ("episodeId", "placementType", "slotNumber", status)
      DO NOTHING
    `,
    [
      reservationId,
      episodeId,
      placementType,
      slotNumber,
      scheduleId,
      scheduleItemId,
      userId
    ]
  )
}

// Helper function to update schedule totals
async function updateScheduleTotals(orgSlug: string, scheduleId: string) {
  await safeQuerySchema(
    orgSlug,
    `
      UPDATE "ScheduleBuilder" s
      SET 
        "totalSpots" = stats."totalSpots",
        "totalImpressions" = stats."totalImpressions",
        "rateCardValue" = stats."rateCardValue",
        "netAmount" = stats."netAmount" - COALESCE(s."discountAmount", 0) + COALESCE(s."valueAddAmount", 0),
        "updatedAt" = NOW()
      FROM (
        SELECT 
          COUNT(*) as "totalSpots",
          SUM(COALESCE("impressions", 0)) as "totalImpressions",
          SUM("rateCardPrice") as "rateCardValue",
          SUM("negotiatedPrice") as "netAmount"
        FROM "ScheduleBuilderItem"
        WHERE "scheduleId" = $1
          AND status != 'cancelled'
      ) stats
      WHERE s.id = $1
    `,
    [scheduleId]
  )
}