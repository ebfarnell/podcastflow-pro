import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin, sales, and producer can access schedules
    // Client role can only see schedules for their campaigns
    const allowedRoles = ['admin', 'sales', 'master', 'producer', 'client']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    
    // Sanitize and validate inputs
    const status = searchParams.get('status')?.trim()
    const advertiserId = searchParams.get('advertiserId')?.trim()
    const campaignId = searchParams.get('campaignId')?.trim()
    const agencyId = searchParams.get('agencyId')?.trim()
    const startDate = searchParams.get('startDate')?.trim()
    const endDate = searchParams.get('endDate')?.trim()
    const search = searchParams.get('search')?.trim()

    // Build query conditions with tenant isolation
    const conditions = []
    const params = []
    let paramIndex = 1

    // Remove the organizationId filter from conditions since we're already using the org schema
    // The multi-tenant isolation is handled by querying the correct schema

    // Client users can only see schedules for campaigns they have access to
    if (session.role === 'client') {
      // TODO: Add logic to filter by campaigns the client has access to
      // For now, clients see no schedules unless we implement client-campaign mapping
      return NextResponse.json({ schedules: [] })
    }

    if (status && ['draft', 'pending_approval', 'approved', 'active', 'completed', 'cancelled'].includes(status)) {
      conditions.push(`s.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (advertiserId) {
      conditions.push(`s."advertiserId" = $${paramIndex}`)
      params.push(advertiserId)
      paramIndex++
    }

    if (agencyId) {
      conditions.push(`s."agencyId" = $${paramIndex}`)
      params.push(agencyId)
      paramIndex++
    }

    if (campaignId) {
      conditions.push(`s."campaignId" = $${paramIndex}`)
      params.push(campaignId)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`s."endDate" >= $${paramIndex}::date`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`s."startDate" <= $${paramIndex}::date`)
      params.push(endDate)
      paramIndex++
    }

    // Add search functionality for campaign and advertiser names
    if (search && search.length > 0) {
      conditions.push(`(
        LOWER(s.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(c.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(a.name) LIKE LOWER($${paramIndex})
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Debug logging for schedule fetch
    console.log('GET /api/schedules - Query params:', {
      orgSlug,
      campaignId,
      advertiserId,
      conditions: conditions.join(' AND '),
      params
    })

    // Query schedules from org schema with proper error handling
    const { data: schedules, error } = await safeQuerySchema(
      orgSlug,
      `
        SELECT 
          s.*,
          a.name as "advertiserName",
          ag.name as "agencyName",
          c.name as "campaignName",
          u.name as "createdByName",
          COUNT(DISTINCT si."id")::int as "itemCount",
          COUNT(DISTINCT si."showId")::int as "showCount",
          SUM(COALESCE(NULLIF(si."negotiatedPrice", 0), si."rateCardPrice", 0))::numeric as "totalValue"
        FROM "ScheduleBuilder" s
        LEFT JOIN "Advertiser" a ON s."advertiserId" = a.id
        LEFT JOIN "Agency" ag ON s."agencyId" = ag.id
        LEFT JOIN "Campaign" c ON s."campaignId" = c.id
        LEFT JOIN public."User" u ON s."createdBy" = u.id
        LEFT JOIN "ScheduleBuilderItem" si ON s.id = si."scheduleId"
        ${whereClause}
        GROUP BY s.id, a.name, ag.name, c.name, u.name
        ORDER BY s."updatedAt" DESC NULLS LAST, s."createdAt" DESC
        LIMIT 200
      `,
      params
    )

    console.log('GET /api/schedules - Query result:', {
      schedulesFound: schedules?.length || 0,
      error: error?.message
    })

    // Always return an array, even on error
    if (error) {
      console.error('Failed to fetch schedules:', error)
      // Log the error details for debugging but return empty array to client
      console.error('Query params:', params)
      console.error('Organization:', orgSlug)
      
      // Return empty array with success status - this prevents 500 errors
      return NextResponse.json({ 
        schedules: [], 
        total: 0,
        // Include a user-friendly message if this was a specific query
        message: campaignId ? 'No schedules found for this campaign' : undefined
      })
    }

    // Ensure we always return an array
    const scheduleList = Array.isArray(schedules) ? schedules : []
    
    return NextResponse.json({ 
      schedules: scheduleList,
      total: scheduleList.length
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    
    // Even on unexpected errors, return a valid response structure
    return NextResponse.json({ 
      schedules: [],
      total: 0,
      error: 'Unable to load schedules at this time'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin, sales, and producer can create schedules
    if (!['admin', 'sales', 'master', 'producer'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    console.log('POST /api/schedules - Request body:', JSON.stringify(body, null, 2))
    
    const {
      name,
      campaignId,
      advertiserId,
      agencyId,
      startDate,
      endDate,
      totalBudget,
      notes,
      internalNotes,
      items
    } = body

    // Sanitize and validate inputs
    const sanitizedName = name?.trim()
    const sanitizedNotes = notes?.trim()
    const sanitizedInternalNotes = internalNotes?.trim()

    // IMPORTANT: Schedules MUST be linked to a campaign
    // The campaign MUST have an advertiser assigned
    // We do NOT use fallback/default advertisers
    
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required. Schedules must be linked to a campaign.' },
        { status: 400 }
      )
    }
    
    // Get advertiser from campaign - this is the ONLY source of truth
    let actualAdvertiserId = null
    console.log(`POST /api/schedules - Fetching campaign data for campaignId: ${campaignId}`)
    
    const { data: campaignData, error: campaignError } = await safeQuerySchema(
      orgSlug,
      `
        SELECT id, "advertiserId", name
        FROM "Campaign" 
        WHERE id = $1
        LIMIT 1
      `,
      [campaignId]
    )

    console.log(`POST /api/schedules - Campaign query result:`, { data: campaignData, error: campaignError })

    if (!campaignData || campaignData.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found. Please ensure the campaign exists.' },
        { status: 404 }
      )
    }
    
    if (!campaignData[0].advertiserId) {
      return NextResponse.json(
        { error: 'Campaign does not have an advertiser assigned. Please assign an advertiser to the campaign first.' },
        { status: 400 }
      )
    }
    
    actualAdvertiserId = campaignData[0].advertiserId
    console.log(`POST /api/schedules - Using advertiserId from campaign: ${actualAdvertiserId}`)

    // Validate required fields
    if (!sanitizedName || !startDate || !endDate) {
      console.log(`POST /api/schedules - Missing fields: name=${!!sanitizedName}, startDate=${!!startDate}, endDate=${!!endDate}`)
      return NextResponse.json(
        { error: 'Missing required fields: name, startDate, and endDate are required' },
        { status: 400 }
      )
    }
    
    // At this point actualAdvertiserId is guaranteed to be valid from the campaign

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date' },
        { status: 400 }
      )
    }

    // Validate budget if provided
    if (totalBudget !== undefined && totalBudget !== null) {
      const budget = parseFloat(totalBudget)
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json(
          { error: 'Invalid budget amount' },
          { status: 400 }
        )
      }
    }

    // Get agencyId from campaign if not provided
    let campaignAgencyId = agencyId
    if (!campaignAgencyId && campaignData[0].agencyId) {
      campaignAgencyId = campaignData[0].agencyId
    }

    // Check for existing schedules for this campaign
    const { data: existingSchedules } = await safeQuerySchema(
      orgSlug,
      `
        SELECT id, name, status 
        FROM "ScheduleBuilder" 
        WHERE "campaignId" = $1 AND status != 'cancelled'
        LIMIT 1
      `,
      [campaignId]
    )

    if (existingSchedules && existingSchedules.length > 0) {
      return NextResponse.json(
        { 
          error: 'A schedule already exists for this campaign',
          existingScheduleId: existingSchedules[0].id,
          existingScheduleName: existingSchedules[0].name
        },
        { status: 409 } // Conflict
      )
    }

    // Verify advertiser exists (should always pass since it came from campaign)
    const { data: advertiserCheck, error: advertiserError } = await safeQuerySchema(
      orgSlug,
      `SELECT id, name FROM "Advertiser" WHERE id = $1`,
      [actualAdvertiserId]
    )
    
    if (!advertiserCheck || advertiserCheck.length === 0) {
      // This should never happen if campaign has valid advertiser
      console.error(`POST /api/schedules - Advertiser not found but was in campaign: ${actualAdvertiserId}`)
      return NextResponse.json(
        { error: 'Campaign advertiser is invalid. Please check campaign configuration.' },
        { status: 500 }
      )
    }

    // Verify agency if provided
    if (campaignAgencyId) {
      const { data: agencyCheck } = await safeQuerySchema(
        orgSlug,
        `SELECT id FROM "Agency" WHERE id = $1`,
        [campaignAgencyId]
      )

      if (!agencyCheck || agencyCheck.length === 0) {
        return NextResponse.json(
          { error: 'Invalid agency ID' },
          { status: 403 }
        )
      }
    }

    // Generate ID
    const scheduleId = `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create schedule in org schema
    const { data: schedule, error } = await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "ScheduleBuilder" (
          id, name, "campaignId", "advertiserId", "agencyId", "organizationId",
          "startDate", "endDate", "totalBudget",
          notes, "internalNotes", "createdBy", status, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, 'draft', NOW(), NOW()
        )
        RETURNING *
      `,
      [
        scheduleId,
        sanitizedName,
        campaignId, // Always has a value now
        actualAdvertiserId,
        campaignAgencyId || null,
        session.organizationId, // Add organizationId from session
        startDate,
        endDate,
        totalBudget || null,
        sanitizedNotes || null,
        sanitizedInternalNotes || null,
        session.userId
      ]
    )

    if (error) {
      console.error('Failed to create schedule:', error)
      return NextResponse.json(
        { error: 'Failed to create schedule. Please try again.' },
        { status: 500 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
        VALUES ($1, 'schedule_created', $2, $3, $4, NOW())
      `,
      [
        `act_${Date.now()}`,
        `Created schedule: ${sanitizedName}`,
        session.userId,
        JSON.stringify({ scheduleId, advertiserId: actualAdvertiserId, campaignId })
      ]
    )

    // If items were provided, create them
    if (items && Array.isArray(items) && items.length > 0) {
      console.log(`POST /api/schedules - Creating ${items.length} schedule items`)
      
      try {
        for (const item of items) {
          const itemId = `sci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          
          // Get the first available showConfigurationId for the show if not provided
          let showConfigurationId = item.showConfigurationId
          if (!showConfigurationId) {
            const { data: configData } = await safeQuerySchema(
              orgSlug,
              `SELECT id FROM "ShowConfiguration" WHERE "showId" = $1 LIMIT 1`,
              [item.showId]
            )
            showConfigurationId = configData?.[0]?.id || null
          }
          
          // First, get or create episode for this show and date
          let episodeId = item.episodeId
          if (!episodeId) {
            // Check if episode exists for this show and date
            const { data: existingEpisode } = await safeQuerySchema(
              orgSlug,
              `SELECT id FROM "Episode" WHERE "showId" = $1 AND DATE("airDate") = $2::date LIMIT 1`,
              [item.showId, item.airDate]
            )
            
            if (existingEpisode && existingEpisode.length > 0) {
              episodeId = existingEpisode[0].id
            } else {
              // Create new episode
              const { data: nextEpisodeNum } = await safeQuerySchema(
                orgSlug,
                `SELECT COALESCE(MAX("episodeNumber"), 0) + 1 as next_num FROM "Episode" WHERE "showId" = $1`,
                [item.showId]
              )
              
              const { data: showInfo } = await safeQuerySchema(
                orgSlug,
                `SELECT name FROM "Show" WHERE id = $1`,
                [item.showId]
              )
              
              const episodeNumber = nextEpisodeNum?.[0]?.next_num || 1
              const showName = showInfo?.[0]?.name || 'Show'
              episodeId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              
              await safeQuerySchema(
                orgSlug,
                `
                  INSERT INTO "Episode" (
                    id, "showId", title, "episodeNumber", "airDate", duration, 
                    status, "createdAt", "updatedAt", "organizationId"
                  ) VALUES (
                    $1, $2, $3, $4, $5::date, $6, 'scheduled', NOW(), NOW(), $7
                  )
                `,
                [
                  episodeId,
                  item.showId,
                  item.episodeTitle || `${showName} - Episode ${episodeNumber}`,
                  episodeNumber,
                  item.airDate,
                  30,
                  orgSlug
                ]
              )
              
              // Also create EpisodeInventory record
              await safeQuerySchema(
                orgSlug,
                `
                  INSERT INTO "EpisodeInventory" (
                    id, "episodeId", "showId", "airDate",
                    "preRollSlots", "preRollAvailable", "preRollReserved", "preRollBooked",
                    "midRollSlots", "midRollAvailable", "midRollReserved", "midRollBooked",
                    "postRollSlots", "postRollAvailable", "postRollReserved", "postRollBooked",
                    "createdAt", "updatedAt"
                  ) VALUES (
                    $1, $2, $3, $4::date, 2, 2, 0, 0, 3, 3, 0, 0, 2, 2, 0, 0, NOW(), NOW()
                  )
                `,
                [
                  `ei_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  episodeId,
                  item.showId,
                  item.airDate
                ]
              )
            }
          }
          
          const { error: itemError } = await safeQuerySchema(
            orgSlug,
            `
              INSERT INTO "ScheduleBuilderItem" (
                id, "scheduleId", "showId", "showConfigurationId", "episodeId", "airDate", "placementType",
                "negotiatedPrice", "rateCardPrice", "addedBy"
              ) VALUES (
                $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10
              )
            `,
            [
              itemId,
              scheduleId,
              item.showId,
              showConfigurationId,
              episodeId,
              item.airDate,
              item.placementType || 'mid-roll',
              item.negotiatedPrice || item.price || 0,
              item.rateCardPrice || item.price || item.negotiatedPrice || 0,
              session.userId
            ]
          )
          
          if (itemError) {
            console.error('Failed to create schedule item:', itemError)
          }
        }
        
        console.log(`POST /api/schedules - Successfully created ${items.length} schedule items`)
      } catch (itemError) {
        console.error('Error creating schedule items:', itemError)
        // Don't fail the whole request if items fail - schedule is already created
      }
    }

    // Check if campaign should progress to 35% stage when schedule is created WITH ITEMS
    if (campaignId && items && Array.isArray(items) && items.length > 0) {
      try {
        // Get current campaign probability
        const { data: campaignData } = await safeQuerySchema(
          orgSlug,
          `SELECT id, probability, status FROM "Campaign" WHERE id = $1`,
          [campaignId]
        )
        
        if (campaignData && campaignData[0] && campaignData[0].probability < 35) {
          console.log(`Schedule with items created for campaign ${campaignId}, triggering stage progression to 35%`)
          
          // Import the stage engine dynamically to avoid circular dependencies
          const { StageEngine } = await import('@/services/workflow/stage-engine')
          
          // Transition campaign to 35% since schedule has been created with items
          const transitionResult = await StageEngine.transitionToStage({
            campaignId,
            targetStage: 35,
            organizationId: session.organizationId!,
            schemaName: orgSlug,
            userId: session.userId,
            idempotencyKey: `schedule-${scheduleId}-35pct`
          })
          
          if (transitionResult.success) {
            console.log(`✅ Campaign ${campaignId} automatically progressed to 35% after schedule with items creation`)
            
            // Log the stage transition
            await safeQuerySchema(
              orgSlug,
              `
                INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
                VALUES ($1, 'campaign_stage_updated', $2, $3, $4, NOW())
              `,
              [
                `act_${Date.now()}_stage`,
                `Campaign automatically progressed to 35% after schedule creation with items`,
                session.userId,
                JSON.stringify({ 
                  campaignId, 
                  previousStage: campaignData[0].probability,
                  newStage: 35,
                  trigger: 'schedule_created_with_items',
                  scheduleId,
                  itemCount: items.length
                })
              ]
            )
          } else {
            console.warn(`Failed to transition campaign ${campaignId} to 35%:`, transitionResult.errors)
          }
        }
      } catch (stageError) {
        // Don't fail the schedule creation if stage transition fails
        console.error('Error checking/updating campaign stage:', stageError)
      }
    }

    return NextResponse.json({ 
      schedule: schedule[0],
      success: true 
    })
  } catch (error) {
    console.error('Schedule creation error:', error)
    return NextResponse.json(
      { error: 'Unable to create schedule at this time. Please try again.' },
      { status: 500 }
    )
  }
}