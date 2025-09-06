import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, querySchema, getSchemaClient, safeQuerySchema } from '@/lib/db/schema-db'
import { allocateBulkSpots, BulkAllocationInput } from '@/lib/inventory/bulk-allocator'
import { checkInventoryAvailability } from '@/lib/inventory/availability-checker'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

// Enhanced input validation schema
const bulkCommitSchema = z.object({
  campaignId: z.string().uuid().optional(),
  advertiserId: z.string().uuid(),
  agencyId: z.string().uuid().optional(),
  showIds: z.array(z.string().uuid()).min(1),
  dateRange: z.object({
    start: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid start date'),
    end: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid end date')
  }).transform(obj => ({
    start: new Date(obj.start),
    end: new Date(obj.end)
  })),
  weekdays: z.array(z.number().min(0).max(6)),
  placementTypes: z.array(z.enum(['pre-roll', 'mid-roll', 'post-roll'])),
  spotsRequested: z.number().int().positive(),
  spotsPerWeek: z.number().int().positive().optional(),
  allowMultiplePerShowPerDay: z.boolean().default(false),
  fallbackStrategy: z.enum(['strict', 'relaxed', 'fill_anywhere']).default('strict'),
  maxSpotsPerShowPerDay: z.number().int().positive().optional(),
  idempotencyKey: z.string().uuid().optional()
})

// Error code mappings
const ERROR_CODES = {
  E_SCHEMA: 'E_SCHEMA',
  E_INPUT: 'E_INPUT',
  E_INV_AVAIL: 'E_INV_AVAIL',
  E_FK: 'E_FK',
  E_DUP: 'E_DUP',
  E_TXN: 'E_TXN',
  E_RATE: 'E_RATE',
  E_UNEXPECTED: 'E_UNEXPECTED'
} as const

type ErrorCode = keyof typeof ERROR_CODES

function mapPrismaErrorToCode(error: any): ErrorCode {
  if (error.code === 'P2002') return 'E_DUP'
  if (error.code === 'P2003') return 'E_FK'
  if (error.code === 'P2025') return 'E_FK'
  if (error.code === 'P2034') return 'E_TXN'
  if (error.message?.includes('rate')) return 'E_RATE'
  if (error.message?.includes('schema')) return 'E_SCHEMA'
  return 'E_UNEXPECTED'
}

function createErrorResponse(
  code: ErrorCode,
  correlationId: string,
  message: string,
  details?: any
) {
  return NextResponse.json(
    {
      error: message,
      code,
      correlationId,
      ...details
    },
    { status: code === 'E_INV_AVAIL' ? 409 : code === 'E_INPUT' ? 400 : 500 }
  )
}

export async function POST(request: NextRequest) {
  const correlationId = uuidv4()
  
  try {
    console.log(`[${correlationId}] Bulk commit request initiated`)
    
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session) {
      console.log(`[${correlationId}] Unauthorized request`)
      return createErrorResponse('E_INPUT', correlationId, 'Unauthorized')
    }

    // Check permissions - need edit permission for commit
    if (!['master', 'admin', 'sales', 'producer'].includes(session.role)) {
      console.log(`[${correlationId}] Insufficient permissions for role: ${session.role}`)
      return createErrorResponse('E_INPUT', correlationId, 'Insufficient permissions')
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      console.log(`[${correlationId}] Organization not found for user: ${session.userId}`)
      return createErrorResponse('E_SCHEMA', correlationId, 'Organization not found')
    }

    console.log(`[${correlationId}] Organization: ${orgSlug}, User: ${session.userId}, Role: ${session.role}`)

    // Parse and validate input
    const body = await request.json()
    const validationResult = bulkCommitSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.log(`[${correlationId}] Input validation failed:`, validationResult.error.errors)
      return createErrorResponse(
        'E_INPUT',
        correlationId,
        'Invalid input',
        { details: validationResult.error.errors }
      )
    }

    const input = validationResult.data
    const idempotencyKey = input.idempotencyKey || uuidv4()

    console.log(`[${correlationId}] Request params:`, {
      campaignId: input.campaignId,
      advertiserId: input.advertiserId,
      showCount: input.showIds.length,
      dateRange: `${format(input.dateRange.start, 'yyyy-MM-dd')} to ${format(input.dateRange.end, 'yyyy-MM-dd')}`,
      spotsRequested: input.spotsRequested,
      placementTypes: input.placementTypes,
      fallbackStrategy: input.fallbackStrategy,
      allowMultiplePerShowPerDay: input.allowMultiplePerShowPerDay
    })

    // Check idempotency - see if we've already processed this request
    const { data: idempotencyCheck } = await safeQuerySchema(
      orgSlug,
      `SELECT id, "createdAt", result 
       FROM "BulkScheduleIdempotency" 
       WHERE key = $1 AND "createdAt" > NOW() - INTERVAL '24 hours'`,
      [idempotencyKey]
    )

    if (idempotencyCheck && idempotencyCheck.length > 0) {
      console.log(`[${correlationId}] Returning cached result for idempotency key: ${idempotencyKey}`)
      const cached = idempotencyCheck[0]
      return NextResponse.json({
        success: true,
        cached: true,
        result: cached.result,
        correlationId
      })
    }

    // Validate campaign belongs to org and matches advertiser
    if (input.campaignId) {
      const { data: campaignCheck } = await safeQuerySchema(
        orgSlug,
        'SELECT id, "advertiserId", status FROM "Campaign" WHERE id = $1',
        [input.campaignId]
      )
      
      if (!campaignCheck || campaignCheck.length === 0) {
        console.log(`[${correlationId}] Campaign not found: ${input.campaignId}`)
        return createErrorResponse(
          'E_FK',
          correlationId,
          'Campaign not found or does not belong to organization',
          { campaignId: input.campaignId }
        )
      }

      // Ensure advertiser matches campaign
      if (campaignCheck[0].advertiserId !== input.advertiserId) {
        console.log(`[${correlationId}] Advertiser mismatch: Campaign has ${campaignCheck[0].advertiserId}, request has ${input.advertiserId}`)
        return createErrorResponse(
          'E_FK',
          correlationId,
          'Advertiser does not match campaign',
          { 
            campaignAdvertiserId: campaignCheck[0].advertiserId,
            requestAdvertiserId: input.advertiserId 
          }
        )
      }
    }

    // Validate advertiser exists in org
    const { data: advertiserCheck } = await safeQuerySchema(
      orgSlug,
      'SELECT id, name FROM "Advertiser" WHERE id = $1',
      [input.advertiserId]
    )
    
    if (!advertiserCheck || advertiserCheck.length === 0) {
      console.log(`[${correlationId}] Advertiser not found: ${input.advertiserId}`)
      return createErrorResponse(
        'E_FK',
        correlationId,
        'Advertiser not found in organization',
        { advertiserId: input.advertiserId }
      )
    }

    // Get show metadata and validate
    const showsQuery = `
      SELECT s.id, s.name, 
             src."preRollRate", src."midRollRate", src."postRollRate"
      FROM "Show" s
      LEFT JOIN "ShowRateCard" src ON src."showId" = s.id
      WHERE s.id = ANY($1::text[])
      ORDER BY s.id, src."effectiveDate" DESC
    `
    const { data: showsResult } = await safeQuerySchema(orgSlug, showsQuery, [input.showIds])
    
    if (!showsResult || showsResult.length === 0) {
      console.log(`[${correlationId}] No shows found for IDs: ${input.showIds.join(', ')}`)
      return createErrorResponse(
        'E_FK',
        correlationId,
        'One or more shows not found',
        { showIds: input.showIds }
      )
    }

    // Deduplicate shows (keep latest rate card)
    const showsMap = new Map()
    for (const show of showsResult) {
      if (!showsMap.has(show.id)) {
        showsMap.set(show.id, show)
      }
    }
    const uniqueShows = Array.from(showsMap.values())

    if (uniqueShows.length !== input.showIds.length) {
      const foundIds = uniqueShows.map(s => s.id)
      const missingIds = input.showIds.filter(id => !foundIds.includes(id))
      console.log(`[${correlationId}] Missing shows: ${missingIds.join(', ')}`)
      return createErrorResponse(
        'E_FK',
        correlationId,
        'Some shows not found',
        { missingShowIds: missingIds }
      )
    }

    // Check for missing rates
    const missingRates = []
    for (const show of uniqueShows) {
      for (const placementType of input.placementTypes) {
        // Map placement type to correct column name with proper casing
        let rateColumn = ''
        switch (placementType.toLowerCase()) {
          case 'pre-roll':
            rateColumn = 'preRollRate'
            break
          case 'mid-roll':
            rateColumn = 'midRollRate'
            break
          case 'post-roll':
            rateColumn = 'postRollRate'
            break
        }
        
        if (!show[rateColumn] || show[rateColumn] === null) {
          missingRates.push({
            showId: show.id,
            showName: show.name,
            placementType,
            rateColumn
          })
        }
      }
    }

    if (missingRates.length > 0) {
      console.log(`[${correlationId}] Missing rates:`, missingRates)
      return createErrorResponse(
        'E_RATE',
        correlationId,
        'Missing rate information for some shows',
        { missingRates }
      )
    }

    // Apply defaults
    const defaultSettings = {
      defaultBulkFallbackStrategy: 'strict',
      defaultAllowMultiplePerShowPerDay: false,
      maxSpotsPerShowPerDay: 1
    }
    
    if (!body.fallbackStrategy) {
      input.fallbackStrategy = defaultSettings.defaultBulkFallbackStrategy as any
    }
    if (body.allowMultiplePerShowPerDay === undefined) {
      input.allowMultiplePerShowPerDay = defaultSettings.defaultAllowMultiplePerShowPerDay
    }
    if (!input.maxSpotsPerShowPerDay) {
      input.maxSpotsPerShowPerDay = input.allowMultiplePerShowPerDay ? 3 : 1
    }

    // Perform allocation to get placements (pre-commit preview)
    const allocationInput: BulkAllocationInput = {
      campaignId: input.campaignId,
      advertiserId: input.advertiserId,
      agencyId: input.agencyId,
      showIds: input.showIds,
      dateRange: {
        start: input.dateRange.start,
        end: input.dateRange.end
      },
      weekdays: input.weekdays,
      placementTypes: input.placementTypes,
      spotsRequested: input.spotsRequested,
      spotsPerWeek: input.spotsPerWeek,
      allowMultiplePerShowPerDay: input.allowMultiplePerShowPerDay,
      fallbackStrategy: input.fallbackStrategy,
      maxSpotsPerShowPerDay: input.maxSpotsPerShowPerDay
    }

    console.log(`[${correlationId}] Running allocation preview...`)
    const allocationResult = await allocateBulkSpots(orgSlug, allocationInput, uniqueShows)

    console.log(`[${correlationId}] Allocation result:`, {
      wouldPlace: allocationResult.wouldPlace.length,
      conflicts: allocationResult.conflicts.length,
      firstFivePlacements: allocationResult.wouldPlace.slice(0, 5).map(p => ({
        showId: p.showId,
        date: format(p.date, 'yyyy-MM-dd'),
        placementType: p.placementType,
        rate: p.rate
      }))
    })

    // If no spots can be placed, return early with appropriate error
    if (allocationResult.wouldPlace.length === 0) {
      console.log(`[${correlationId}] No spots could be placed - inventory unavailable`)
      return createErrorResponse(
        'E_INV_AVAIL',
        correlationId,
        'No spots could be placed with the given constraints',
        { 
          result: allocationResult,
          conflicts: allocationResult.conflicts 
        }
      )
    }

    // Check if strict mode and we have shortfall
    if (input.fallbackStrategy === 'strict' && allocationResult.wouldPlace.length < input.spotsRequested) {
      console.log(`[${correlationId}] Strict mode shortfall: ${allocationResult.wouldPlace.length}/${input.spotsRequested}`)
      return createErrorResponse(
        'E_INV_AVAIL',
        correlationId,
        `Strict mode: Only ${allocationResult.wouldPlace.length} of ${input.spotsRequested} spots available`,
        { 
          requested: input.spotsRequested,
          available: allocationResult.wouldPlace.length,
          conflicts: allocationResult.conflicts 
        }
      )
    }

    // Perform transactional commit
    console.log(`[${correlationId}] Beginning transaction for commit...`)
    const { client } = await getSchemaClient(orgSlug)
    
    try {
      await client.query('BEGIN')
      
      const commitResult = await (async () => {
        const placedSpots = []
        const finalConflicts = []
        const rateErrors = []

        // Revalidate and insert each spot
        for (const placement of allocationResult.wouldPlace) {
          // Recheck availability with row lock
          const availabilityQuery = `
            SELECT id 
            FROM "ScheduledSpot" ss
            WHERE ss."showId" = $1 
              AND ss."airDate"::date = $2::date
              AND ss."placementType" = $3
            FOR UPDATE
            LIMIT 1
          `
          const availResult = await client.query(availabilityQuery, [
            placement.showId,
            placement.date,
            placement.placementType
          ])

          if (availResult.rows.length > 0) {
            // Spot taken since preview
            finalConflicts.push({
              showId: placement.showId,
              showName: placement.showName,
              date: placement.date,
              placementType: placement.placementType,
              reason: 'Inventory became unavailable during commit',
              conflictType: 'spot_taken'
            })
            continue
          }

          // Validate rate is not null
          if (!placement.rate && placement.rate !== 0) {
            rateErrors.push({
              showId: placement.showId,
              showName: placement.showName,
              placementType: placement.placementType,
              message: 'Rate is null or invalid'
            })
            continue
          }

          // Insert the scheduled spot
          const spotId = uuidv4()
          const insertQuery = `
            INSERT INTO "ScheduledSpot" (
              id, "showId", "airDate", "placementType", rate, 
              "campaignId", "createdBy", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
          `

          try {
            const insertResult = await client.query(insertQuery, [
              spotId,
              placement.showId,
              placement.date,
              placement.placementType,
              placement.rate,
              input.campaignId || null,
              session.userId
            ])

            if (insertResult.rows.length > 0) {
              placedSpots.push(insertResult.rows[0])

              // Update episode inventory if episodeId is available
              if (placement.episodeId) {
                let columnToUpdate = ''
                switch (placement.placementType.toLowerCase()) {
                  case 'pre-roll':
                  case 'preroll':
                    columnToUpdate = 'preRollBooked'
                    break
                  case 'mid-roll':
                  case 'midroll':
                    columnToUpdate = 'midRollBooked'
                    break
                  case 'post-roll':
                  case 'postroll':
                    columnToUpdate = 'postRollBooked'
                    break
                }

                if (columnToUpdate) {
                  const updateInventoryQuery = `
                    UPDATE "EpisodeInventory" 
                    SET "${columnToUpdate}" = COALESCE("${columnToUpdate}", 0) + 1,
                        "updatedAt" = NOW()
                    WHERE "episodeId" = $1
                  `
                  await client.query(updateInventoryQuery, [placement.episodeId])
                }
              }

              // Log rate card delta if applicable
              if (input.campaignId) {
                // Get the correct rate column name
                let rateColumnName = ''
                switch (placement.placementType.toLowerCase()) {
                  case 'pre-roll':
                    rateColumnName = 'preRollRate'
                    break
                  case 'mid-roll':
                    rateColumnName = 'midRollRate'
                    break
                  case 'post-roll':
                    rateColumnName = 'postRollRate'
                    break
                }
                
                if (rateColumnName) {
                  const originalRateQuery = `
                    SELECT src."${rateColumnName}" as rate
                    FROM "ShowRateCard" src
                    WHERE src."showId" = $1
                    ORDER BY src."effectiveDate" DESC
                    LIMIT 1
                  `
                  const originalRateResult = await client.query(originalRateQuery, [placement.showId])
                  const originalRate = originalRateResult.rows[0]?.rate || placement.rate

                  const deltaQuery = `
                    INSERT INTO "RateCardDelta" (
                      id, "campaignId", "showId", "placementType", 
                      "originalRate", "actualRate", delta, "createdAt"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                  `
                  
                  await client.query(deltaQuery, [
                    uuidv4(),
                    input.campaignId,
                    placement.showId,
                    placement.placementType,
                    originalRate,
                    placement.rate,
                    placement.rate - originalRate
                  ])
                }
              }
            }
          } catch (insertError: any) {
            console.log(`[${correlationId}] Insert error for spot:`, insertError.message)
            if (insertError.code === 'P2002' || insertError.message?.includes('duplicate')) {
              finalConflicts.push({
                showId: placement.showId,
                showName: placement.showName,
                date: placement.date,
                placementType: placement.placementType,
                reason: 'Duplicate spot detected',
                conflictType: 'duplicate'
              })
            } else {
              throw insertError
            }
          }
        }

        // Check if we have rate errors
        if (rateErrors.length > 0) {
          throw new Error(JSON.stringify({ code: 'E_RATE', rateErrors }))
        }

        // Store idempotency record
        const idempotencyInsert = `
          INSERT INTO "BulkScheduleIdempotency" (
            id, key, result, "createdAt"
          ) VALUES ($1, $2, $3, NOW())
        `
        
        const finalResult = {
          placed: placedSpots.length,
          conflicts: finalConflicts.length,
          spots: placedSpots.map(s => ({
            id: s.id,
            showId: s.showId,
            date: s.airDate,
            placementType: s.placementType,
            rate: s.rate
          })),
          conflictDetails: finalConflicts
        }

        await client.query(idempotencyInsert, [
          uuidv4(),
          idempotencyKey,
          JSON.stringify(finalResult)
        ])

        return finalResult
      })()
      
      await client.query('COMMIT')
      console.log(`[${correlationId}] Transaction committed successfully. Placed: ${commitResult.placed}, Conflicts: ${commitResult.conflicts}`)

      // Log activity (non-blocking)
      try {
        const { data: orgData } = await safeQuerySchema(
          'public',
          'SELECT id FROM "Organization" WHERE slug = $1',
          [orgSlug]
        )
        
        if (orgData && orgData.length > 0) {
          const organizationId = orgData[0].id
          
          const activityLog = `
            INSERT INTO "Activity" (
              id, "userId", "organizationId", type, 
              description, metadata, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `
          
          await querySchema(orgSlug, activityLog, [
            uuidv4(),
            session.userId,
            organizationId,
            'bulk_schedule_commit',
            `Bulk scheduled ${commitResult.placed} spots for advertiser ${input.advertiserId}`,
            JSON.stringify({
              advertiserId: input.advertiserId,
              campaignId: input.campaignId,
              spotsRequested: input.spotsRequested,
              spotsPlaced: commitResult.placed,
              strategy: input.fallbackStrategy,
              correlationId
            })
          ])
        }
      } catch (activityError: any) {
        // Activity logging is optional - don't fail the request
        console.log(`[${correlationId}] Activity logging failed (non-critical):`, activityError.message)
      }

      // Check if this triggers workflow advancement
      if (input.campaignId && commitResult.placed > 0) {
        const { data: workflowResult } = await safeQuerySchema(
          orgSlug,
          'SELECT "workflowPercentage", "firstValidScheduleAt" FROM "Campaign" WHERE id = $1',
          [input.campaignId]
        )
        
        if (workflowResult && workflowResult.length > 0) {
          const campaign = workflowResult[0]
          
          // Auto-advance to 35% if this is the first valid schedule
          if (!campaign.firstValidScheduleAt && campaign.workflowPercentage < 35) {
            const advanceQuery = `
              UPDATE "Campaign"
              SET "workflowPercentage" = 35,
                  "firstValidScheduleAt" = NOW(),
                  "updatedAt" = NOW()
              WHERE id = $1
            `
            await querySchema(orgSlug, advanceQuery, [input.campaignId])
            
            console.log(`[${correlationId}] Campaign ${input.campaignId} auto-advanced to 35% after first valid schedule`)
          }
        }
      }

      return NextResponse.json({
        success: true,
        correlationId,
        result: commitResult,
        summary: {
          requested: input.spotsRequested,
          placed: commitResult.placed,
          conflicts: commitResult.conflicts
        }
      })
      
    } catch (transactionError: any) {
      await client.query('ROLLBACK')
      console.error(`[${correlationId}] Transaction error:`, transactionError)
      
      // Check if it's a rate error
      if (transactionError.message?.includes('E_RATE')) {
        try {
          const errorData = JSON.parse(transactionError.message)
          return createErrorResponse(
            'E_RATE',
            correlationId,
            'Rate information missing or invalid',
            { rateErrors: errorData.rateErrors }
          )
        } catch {
          // Fallback if parsing fails
        }
      }
      
      const errorCode = mapPrismaErrorToCode(transactionError)
      return createErrorResponse(
        errorCode,
        correlationId,
        'Transaction failed during commit',
        { 
          details: transactionError.message,
          code: transactionError.code,
          meta: transactionError.meta 
        }
      )
    } finally {
      client.release()
    }

  } catch (error: any) {
    console.error(`[${correlationId}] Unexpected error:`, error)
    const errorCode = mapPrismaErrorToCode(error)
    return createErrorResponse(
      errorCode,
      correlationId,
      'Failed to commit bulk schedule',
      { 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      }
    )
  }
}