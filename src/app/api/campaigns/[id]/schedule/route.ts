import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

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

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch campaign with schedules
    const campaignQuery = `
      SELECT 
        c.*,
        a.name as "advertiserName",
        ag.name as "agencyName"
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE c.id = $1
    `
    const campaigns = await querySchema(orgSlug, campaignQuery, [params.id])
    
    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const campaign = {
      ...campaigns[0],
      advertiser: { 
        id: campaigns[0].advertiserId, 
        name: campaigns[0].advertiserName 
      },
      agency: campaigns[0].agencyId ? { 
        id: campaigns[0].agencyId, 
        name: campaigns[0].agencyName 
      } : null
    }

    // Fetch campaign schedules
    const schedulesQuery = `
      SELECT 
        cs.*,
        u.name as "creatorName",
        u.email as "creatorEmail",
        eu.name as "exporterName",
        eu.email as "exporterEmail"
      FROM "CampaignSchedule" cs
      LEFT JOIN public."User" u ON u.id = cs."createdBy"
      LEFT JOIN public."User" eu ON eu.id = cs."exportedBy"
      WHERE cs."campaignId" = $1
      ORDER BY cs.version DESC, cs."createdAt" DESC
    `
    const schedules = await querySchema(orgSlug, schedulesQuery, [params.id])

    // For each schedule, fetch its items
    const schedulesWithItems = await Promise.all(
      schedules.map(async (schedule) => {
        const itemsQuery = `
          SELECT 
            si.*,
            s.name as "showName",
            e.id as "episodeId",
            e.title as "episodeTitle",
            e."episodeNumber"
          FROM "ScheduleItem" si
          LEFT JOIN "Show" s ON s.id = si."showId"
          LEFT JOIN "Episode" e ON e."showId" = si."showId" 
            AND DATE(e."airDate") = DATE(si."airDate")
          WHERE si."scheduleId" = $1
          ORDER BY si."airDate" ASC, si."sortOrder" ASC
        `
        const items = await querySchema(orgSlug, itemsQuery, [schedule.id])
        
        return {
          ...schedule,
          creator: {
            id: schedule.createdBy,
            name: schedule.creatorName,
            email: schedule.creatorEmail
          },
          exporter: schedule.exportedBy ? {
            id: schedule.exportedBy,
            name: schedule.exporterName,
            email: schedule.exporterEmail
          } : null,
          scheduleItems: items.map(item => ({
            ...item,
            show: {
              id: item.showId,
              name: item.showName
            },
            episode: {
              id: item.episodeId,
              title: item.episodeTitle || 'TBD',
              episodeNumber: item.episodeNumber || 0
            }
          }))
        }
      })
    )

    // Fetch orders for this campaign
    const ordersQuery = `
      SELECT 
        o.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'showId', oi."showId",
              'episodeId', oi."episodeId",
              'airDate', oi."airDate",
              'placementType', oi."placementType",
              'unitPrice', oi."rate",
              'showName', s.name,
              'episodeTitle', e.title
            )
          )
          FROM "OrderItem" oi
          LEFT JOIN "Show" s ON s.id = oi."showId"
          LEFT JOIN "Episode" e ON e.id = oi."episodeId"
          WHERE oi."orderId" = o.id
        ) as "orderItems"
      FROM "Order" o
      WHERE o."campaignId" = $1
      AND o.status IN ('approved', 'booked', 'confirmed')
    `
    const orders = await querySchema(orgSlug, ordersQuery, [params.id])
    campaign.orders = orders

    // Fetch available shows with placement details
    const showsQuery = `
      SELECT 
        s.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', sp.id,
              'placementType', sp."placementType",
              'baseRate', sp."baseRate",
              'rates', sp.rates,
              'isActive', sp."isActive"
            )
          )
          FROM "ShowPlacement" sp
          WHERE sp."showId" = s.id AND sp."isActive" = true
        ) as "showPlacements"
      FROM "Show" s
      WHERE s."isActive" = true
      ORDER BY s.name ASC
    `
    const shows = await querySchema(orgSlug, showsQuery)

    // Fetch inventory for the next 90 days
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 90)

    const inventoryQuery = `
      SELECT * FROM "EpisodeInventory"
      WHERE "airDate" >= $1 AND "airDate" <= $2
      ORDER BY "airDate" ASC
    `
    const inventory = await querySchema(orgSlug, inventoryQuery, [startDate, endDate])

    // Calculate availability by show and date
    const availabilityMap: Record<string, Record<string, any>> = {}
    inventory.forEach((inv: any) => {
      const dateKey = inv.airDate.toISOString().split('T')[0]
      if (!availabilityMap[inv.showId]) {
        availabilityMap[inv.showId] = {}
      }
      if (!availabilityMap[inv.showId][dateKey]) {
        availabilityMap[inv.showId][dateKey] = {}
      }
      // Map placement-specific columns to availability structure
      availabilityMap[inv.showId][dateKey]['preroll'] = {
        total: inv.preRollSlots || 0,
        available: inv.preRollAvailable || 0,
        reserved: inv.preRollReserved || 0,
        booked: inv.preRollBooked || 0
      }
      availabilityMap[inv.showId][dateKey]['midroll'] = {
        total: inv.midRollSlots || 0,
        available: inv.midRollAvailable || 0,
        reserved: inv.midRollReserved || 0,
        booked: inv.midRollBooked || 0
      }
      availabilityMap[inv.showId][dateKey]['postroll'] = {
        total: inv.postRollSlots || 0,
        available: inv.postRollAvailable || 0,
        reserved: inv.postRollReserved || 0,
        booked: inv.postRollBooked || 0
      }
    })

    return NextResponse.json({
      campaign,
      shows,
      availability: availabilityMap,
      currentSchedule: schedulesWithItems[0] || null,
      scheduleHistory: schedulesWithItems.slice(1)
    })
  } catch (error) {
    console.error('Error fetching campaign schedule:', error)
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

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, scheduleItems, totalBudget, rateCardTotal } = body

    if (!name || !Array.isArray(scheduleItems) || scheduleItems.length === 0) {
      return NextResponse.json({ 
        error: 'Schedule name and items are required' 
      }, { status: 400 })
    }

    // Calculate rate card delta if both values provided
    let rateCardDelta = 0
    let rateCardPercentage = 100
    if (rateCardTotal && totalBudget) {
      rateCardDelta = totalBudget - rateCardTotal
      rateCardPercentage = (totalBudget / rateCardTotal) * 100
      console.log(`📊 Rate card tracking - Total: ${totalBudget}, Rate card: ${rateCardTotal}, Delta: ${rateCardDelta}, Percentage: ${rateCardPercentage}%`)
    }

    // Verify campaign exists
    const campaignQuery = `SELECT id FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema(orgSlug, campaignQuery, [params.id])
    
    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get latest version
    const versionQuery = `
      SELECT MAX(version) as "maxVersion" 
      FROM "CampaignSchedule" 
      WHERE "campaignId" = $1
    `
    const versionResult = await querySchema(orgSlug, versionQuery, [params.id])
    const latestVersion = versionResult[0]?.maxVersion || 0

    // Create new schedule with rate card tracking
    const scheduleId = 'sched_' + Math.random().toString(36).substr(2, 16)
    const createScheduleQuery = `
      INSERT INTO "CampaignSchedule" (
        id, "campaignId", name, version, status, "createdBy", "createdAt", "updatedAt",
        "rateCardDelta", "rateCardPercentage", "rateCardNotes"
      ) VALUES ($1, $2, $3, $4, 'draft', $5, NOW(), NOW(), $6, $7, $8)
      RETURNING *
    `
    
    const newSchedules = await querySchema(
      orgSlug, 
      createScheduleQuery,
      [
        scheduleId, params.id, name, latestVersion + 1, user.id,
        rateCardDelta, rateCardPercentage, 
        rateCardDelta !== 0 ? `Rate card delta: $${rateCardDelta.toFixed(2)} (${rateCardPercentage.toFixed(1)}% of rate card)` : null
      ]
    )

    // Create schedule items
    const itemValues = scheduleItems.map((item, index) => {
      const itemId = 'si_' + Math.random().toString(36).substr(2, 16)
      return `(
        '${itemId}',
        '${scheduleId}',
        '${item.showId}',
        '${new Date(item.airDate).toISOString()}',
        '${item.placementType}',
        ${item.length},
        ${item.rate},
        ${item.isLiveRead || false},
        ${item.notes ? `'${item.notes}'` : 'NULL'},
        ${index}
      )`
    }).join(',')

    const createItemsQuery = `
      INSERT INTO "ScheduleItem" (
        id, "scheduleId", "showId", "airDate", "placementType", 
        length, rate, "isLiveRead", notes, "sortOrder"
      ) VALUES ${itemValues}
    `
    
    await querySchema(orgSlug, createItemsQuery)

    // Update inventory reservations
    for (const item of scheduleItems) {
      // Determine column names based on placement type
      const placementPrefix = item.placementType === 'preroll' ? 'preRoll' :
                              item.placementType === 'midroll' ? 'midRoll' :
                              item.placementType === 'postroll' ? 'postRoll' : 'midRoll'
      
      const reservedColumn = `"${placementPrefix}Reserved"`
      const availableColumn = `"${placementPrefix}Available"`
      
      const updateInventoryQuery = `
        UPDATE "EpisodeInventory" 
        SET 
          ${reservedColumn} = COALESCE(${reservedColumn}, 0) + 1,
          ${availableColumn} = GREATEST(COALESCE(${availableColumn}, 0) - 1, 0)
        WHERE 
          "showId" = $1 
          AND DATE("airDate") = $2::date
      `
      
      await querySchema(
        orgSlug, 
        updateInventoryQuery,
        [item.showId, new Date(item.airDate)]
      )
    }

    // Fetch the created schedule with items
    const resultQuery = `
      SELECT 
        cs.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', si.id,
              'showId', si."showId",
              'airDate', si."airDate",
              'placementType', si."placementType",
              'length', si.length,
              'rate', si.rate,
              'isLiveRead', si."isLiveRead",
              'notes', si.notes,
              'sortOrder', si."sortOrder",
              'show', json_build_object('id', s.id, 'name', s.name)
            ) ORDER BY si."sortOrder"
          )
          FROM "ScheduleItem" si
          LEFT JOIN "Show" s ON s.id = si."showId"
          WHERE si."scheduleId" = cs.id
        ) as "scheduleItems",
        (
          SELECT SUM(si.rate * COALESCE(si.length, 30) / 30)
          FROM "ScheduleItem" si
          WHERE si."scheduleId" = cs.id
        ) as "totalValue",
        (
          SELECT COUNT(*)
          FROM "ScheduleItem" si
          WHERE si."scheduleId" = cs.id
        ) as "itemCount"
      FROM "CampaignSchedule" cs
      WHERE cs.id = $1
    `
    
    const result = await querySchema(orgSlug, resultQuery, [scheduleId])
    const createdSchedule = result[0]

    // Check if we should auto-advance the campaign to 35%
    try {
      const { campaignWorkflowService } = await import('@/lib/workflow/campaign-workflow-service')
      
      const workflowContext = {
        campaignId: params.id,
        organizationId: user.organizationId || user.organization?.id || orgSlug,
        organizationSlug: orgSlug,
        userId: user.id,
        userName: user.name || user.email,
        userRole: user.role || 'sales'
      }
      
      const advanceResult = await campaignWorkflowService.handleFirstValidSchedule(
        workflowContext,
        createdSchedule
      )
      
      if (advanceResult.advanced) {
        console.log(`[Schedule API] Campaign ${params.id} auto-advanced to ${advanceResult.newProbability}%`)
        // Add advancement info to response
        createdSchedule.campaignAdvanced = true
        createdSchedule.newProbability = advanceResult.newProbability
      }
    } catch (error) {
      // Don't fail the schedule creation if workflow fails
      console.error('[Schedule API] Workflow automation failed:', error)
    }

    return NextResponse.json(createdSchedule)
  } catch (error) {
    console.error('Error creating campaign schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { scheduleId, status, notes } = body

    if (!scheduleId || !status) {
      return NextResponse.json({ 
        error: 'Schedule ID and status are required' 
      }, { status: 400 })
    }

    // Verify schedule exists
    const checkQuery = `
      SELECT id FROM "CampaignSchedule" 
      WHERE id = $1 AND "campaignId" = $2
    `
    const schedules = await querySchema(orgSlug, checkQuery, [scheduleId, params.id])
    
    if (schedules.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Build update query
    let updateFields = [`status = '${status}'`, `"updatedAt" = NOW()`]
    let updateValues = []
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${updateValues.length + 1}`)
      updateValues.push(notes)
    }
    
    if (status === 'sent_to_client') {
      updateFields.push(`"exportedAt" = NOW()`)
      updateFields.push(`"exportedBy" = $${updateValues.length + 1}`)
      updateValues.push(user.id)
    } else if (status === 'approved') {
      updateFields.push(`"clientApprovedAt" = NOW()`)
    }

    const updateQuery = `
      UPDATE "CampaignSchedule" 
      SET ${updateFields.join(', ')}
      WHERE id = '${scheduleId}'
      RETURNING *
    `

    const updatedSchedules = await querySchema(orgSlug, updateQuery, updateValues)

    // Fetch with items
    const resultQuery = `
      SELECT 
        cs.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', si.id,
              'showId', si."showId",
              'airDate', si."airDate",
              'placementType', si."placementType",
              'length', si.length,
              'rate', si.rate,
              'isLiveRead', si."isLiveRead",
              'notes', si.notes,
              'show', json_build_object('id', s.id, 'name', s.name)
            ) ORDER BY si."airDate", si."sortOrder"
          )
          FROM "ScheduleItem" si
          LEFT JOIN "Show" s ON s.id = si."showId"
          WHERE si."scheduleId" = cs.id
        ) as "scheduleItems"
      FROM "CampaignSchedule" cs
      WHERE cs.id = $1
    `
    
    const result = await querySchema(orgSlug, resultQuery, [scheduleId])

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating campaign schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}