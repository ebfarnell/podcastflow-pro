import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const paramsData = await context.params
    const id = paramsData.id
    
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and sales can access schedules
    if (!['admin', 'sales', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get schedule with all related data
    const { data: scheduleData, error: scheduleError } = await safeQuerySchema(
      orgSlug,
      `
        SELECT 
          s.*,
          a.name as "advertiserName",
          ag.name as "agencyName",
          c.name as "campaignName",
          u1.name as "createdByName",
          u2.name as "approvedByName"
        FROM "ScheduleBuilder" s
        LEFT JOIN "Advertiser" a ON s."advertiserId" = a.id
        LEFT JOIN "Agency" ag ON s."agencyId" = ag.id
        LEFT JOIN "Campaign" c ON s."campaignId" = c.id
        LEFT JOIN public."User" u1 ON s."createdBy" = u1.id
        LEFT JOIN public."User" u2 ON s."approvedBy" = u2.id
        WHERE s.id = $1
      `,
      [id]
    )

    if (scheduleError || !scheduleData || scheduleData.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = scheduleData[0]

    // Get schedule items with show details
    console.log(`GET /api/schedules/${id} - Fetching schedule items`)
    const { data: items, error: itemsError } = await safeQuerySchema(
      orgSlug,
      `
        SELECT 
          si.*,
          s.id as "show_id",
          s.name as "showName",
          s.description as "show_description",
          s.host as "show_host",
          s.category as "show_category",
          e.id as "episode_id",
          e.title as "episodeTitle",
          e."episodeNumber",
          e."airDate" as "episode_airDate",
          sc.name as "configurationName",
          sc."episodeLength"
        FROM "ScheduleBuilderItem" si
        JOIN "Show" s ON si."showId" = s.id
        JOIN "ShowConfiguration" sc ON si."showConfigurationId" = sc.id
        LEFT JOIN "Episode" e ON si."episodeId" = e.id
        WHERE si."scheduleId" = $1
        ORDER BY si."airDate", s.name, si."placementType"
      `,
      [id]
    )
    
    console.log(`GET /api/schedules/${id} - Items query result:`, { 
      itemsFound: items?.length || 0, 
      error: itemsError?.message 
    })

    // Get approval history
    const { data: approvals } = await safeQuerySchema(
      orgSlug,
      `
        SELECT 
          sa.*,
          u1.name as "requestedByName",
          u2.name as "reviewedByName"
        FROM "ScheduleApproval" sa
        LEFT JOIN public."User" u1 ON sa."requestedBy" = u1.id
        LEFT JOIN public."User" u2 ON sa."reviewedBy" = u2.id
        WHERE sa."scheduleId" = $1
        ORDER BY sa."requestedAt" DESC
      `,
      [id]
    )

    // Transform items to include nested show and episode data
    const transformedItems = (items || []).map(item => ({
      ...item,
      show: {
        id: item.show_id,
        name: item.showName,
        description: item.show_description,
        host: item.show_host,
        category: item.show_category
      },
      episode: item.episode_id ? {
        id: item.episode_id,
        title: item.episodeTitle,
        episodeNumber: item.episodeNumber,
        airDate: item.episode_airDate
      } : null
    }))

    return NextResponse.json({
      schedule: {
        ...schedule,
        items: transformedItems
      },
      items: transformedItems,
      approvals: approvals || []
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const paramsData = await context.params
    const id = paramsData.id
    console.log(`PUT /api/schedules/${id} - Starting update`)
    
    const session = await getSessionFromCookie(request)
    if (!session) {
      console.log('PUT /api/schedules/[id] - Unauthorized: No session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`PUT /api/schedules/${id} - User: ${session.userId}, Role: ${session.role}`)

    // Only admin and sales can update schedules
    if (!['admin', 'sales', 'master', 'producer'].includes(session.role)) {
      console.log(`PUT /api/schedules/${id} - Forbidden: Role ${session.role} not allowed`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug first
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      console.log(`PUT /api/schedules/${id} - Organization not found for user ${session.userId}`)
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    console.log(`PUT /api/schedules/${id} - Using organization: ${orgSlug}`)

    const body = await request.json()
    console.log(`PUT /api/schedules/${id} - Request body:`, JSON.stringify(body, null, 2))
    
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
      status,
      items
    } = body

    // Build update query dynamically
    const updates = []
    const params = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      params.push(name)
      paramIndex++
    }

    if (campaignId !== undefined) {
      updates.push(`"campaignId" = $${paramIndex}`)
      params.push(campaignId)
      paramIndex++
    }

    if (advertiserId !== undefined) {
      updates.push(`"advertiserId" = $${paramIndex}`)
      params.push(advertiserId)
      paramIndex++
    }

    if (agencyId !== undefined) {
      updates.push(`"agencyId" = $${paramIndex}`)
      params.push(agencyId)
      paramIndex++
    }

    if (startDate !== undefined) {
      updates.push(`"startDate" = $${paramIndex}::date`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate !== undefined) {
      updates.push(`"endDate" = $${paramIndex}::date`)
      params.push(endDate)
      paramIndex++
    }

    if (totalBudget !== undefined) {
      updates.push(`"totalBudget" = $${paramIndex}`)
      params.push(totalBudget)
      paramIndex++
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`)
      params.push(notes)
      paramIndex++
    }

    if (internalNotes !== undefined) {
      updates.push(`"internalNotes" = $${paramIndex}`)
      params.push(internalNotes)
      paramIndex++
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    // Always update these fields
    updates.push(`"updatedBy" = $${paramIndex}`)
    params.push(session.userId)
    paramIndex++

    updates.push(`"updatedAt" = NOW()`)

    // Add the schedule ID as the last parameter
    params.push(id)

    console.log(`PUT /api/schedules/${id} - Executing update with ${updates.length} fields`)

    const { data: schedule, error } = await safeQuerySchema(
      orgSlug,
      `
        UPDATE "ScheduleBuilder"
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      params
    )

    if (error) {
      console.error(`PUT /api/schedules/${id} - Failed to update schedule:`, error)
      return NextResponse.json(
        { error: 'Failed to update schedule', details: error.message },
        { status: 500 }
      )
    }

    if (!schedule || schedule.length === 0) {
      console.error(`PUT /api/schedules/${id} - Schedule not found after update`)
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const updatedSchedule = schedule[0]
    console.log(`PUT /api/schedules/${id} - Schedule updated successfully: ${updatedSchedule.name}`)

    // Handle schedule items if provided
    if (items && Array.isArray(items)) {
      console.log(`PUT /api/schedules/${id} - Updating ${items.length} schedule items`)
      
      try {
        // First, delete all existing items for this schedule
        const { error: deleteError } = await safeQuerySchema(
          orgSlug,
          `DELETE FROM "ScheduleBuilderItem" WHERE "scheduleId" = $1`,
          [id]
        )
        
        if (deleteError) {
          console.error(`PUT /api/schedules/${id} - Error deleting old items:`, deleteError)
        }
        
        // Then create new items
        let successCount = 0
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
          
          const { error: itemError } = await safeQuerySchema(
            orgSlug,
            `
              INSERT INTO "ScheduleBuilderItem" (
                id, "scheduleId", "showId", "showConfigurationId", "episodeId", "airDate", "placementType",
                "slotNumber", "rateCardPrice", "negotiatedPrice", "addedBy"
              ) VALUES (
                $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11
              )
            `,
            [
              itemId,
              id,
              item.showId,
              showConfigurationId,
              item.episodeId || null,
              item.airDate,
              item.placementType || 'mid-roll',
              item.slotNumber || 1,
              item.rateCardPrice || item.negotiatedPrice || 0,
              item.negotiatedPrice || 0,
              session.userId
            ]
          )
          
          if (itemError) {
            console.error(`PUT /api/schedules/${id} - Failed to create schedule item:`, itemError)
          } else {
            successCount++
          }
        }
        
        console.log(`PUT /api/schedules/${id} - Successfully created ${successCount}/${items.length} schedule items`)
      } catch (itemError) {
        console.error(`PUT /api/schedules/${id} - Error updating schedule items:`, itemError)
        // Don't fail the whole request if items fail - schedule update already succeeded
      }
    }

    // Log activity - use the schedule name from the successfully updated record
    try {
      const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await safeQuerySchema(
        orgSlug,
        `
          INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
          VALUES ($1, 'schedule_updated', $2, $3, $4, NOW())
        `,
        [
          activityId,
          `Updated schedule: ${updatedSchedule.name}`,
          session.userId,
          JSON.stringify({ scheduleId: id, updates: Object.keys(body), itemCount: items?.length || 0 })
        ]
      )
    } catch (activityError) {
      console.error(`PUT /api/schedules/${id} - Error logging activity:`, activityError)
      // Don't fail the request if activity logging fails
    }

    // Check if campaign should progress to 35% stage when schedule is updated with items
    if (updatedSchedule.campaignId && items && items.length > 0) {
      try {
        // Get current campaign probability
        const { data: campaignData } = await safeQuerySchema(
          orgSlug,
          `SELECT id, probability, status FROM "Campaign" WHERE id = $1`,
          [updatedSchedule.campaignId]
        )
        
        if (campaignData && campaignData[0] && campaignData[0].probability < 35) {
          console.log(`Schedule updated with items for campaign ${updatedSchedule.campaignId}, checking for stage progression to 35%`)
          
          // Import the stage engine dynamically to avoid circular dependencies
          const { StageEngine } = await import('@/services/workflow/stage-engine')
          
          // Transition campaign to 35% since schedule has been updated with items
          const transitionResult = await StageEngine.transitionToStage({
            campaignId: updatedSchedule.campaignId,
            targetStage: 35,
            organizationId: session.organizationId!,
            schemaName: orgSlug,
            userId: session.userId,
            idempotencyKey: `schedule-update-${id}-35pct`
          })
          
          if (transitionResult.success) {
            console.log(`Campaign ${updatedSchedule.campaignId} automatically progressed to 35% after schedule update`)
            
            // Log the stage transition
            await safeQuerySchema(
              orgSlug,
              `
                INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
                VALUES ($1, 'campaign_stage_updated', $2, $3, $4, NOW())
              `,
              [
                `act_${Date.now()}_stage`,
                `Campaign automatically progressed to 35% after schedule update`,
                session.userId,
                JSON.stringify({ 
                  campaignId: updatedSchedule.campaignId,
                  previousStage: campaignData[0].probability,
                  newStage: 35,
                  trigger: 'schedule_updated'
                })
              ]
            )
          } else {
            console.warn(`Failed to transition campaign ${updatedSchedule.campaignId} to 35%:`, transitionResult.errors)
          }
        }
      } catch (stageError) {
        // Don't fail the schedule update if stage transition fails
        console.error('Error checking/updating campaign stage:', stageError)
      }
    }

    return NextResponse.json({ 
      schedule: updatedSchedule,
      success: true 
    })
  } catch (error) {
    console.error('PUT /api/schedules/[id] - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const paramsData = await context.params
    const id = paramsData.id
    
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can delete schedules
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if schedule exists and can be deleted
    const { data: checkData } = await safeQuerySchema(
      orgSlug,
      `SELECT status, name FROM "ScheduleBuilder" WHERE id = $1`,
      [id]
    )

    if (!checkData || checkData.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = checkData[0]

    // Allow deletion of draft schedules and schedules with no items
    if (schedule.status !== 'draft') {
      // Check if schedule has any items
      const { data: itemsCheck } = await safeQuerySchema(
        orgSlug,
        `SELECT COUNT(*) as count FROM "ScheduleBuilderItem" WHERE "scheduleId" = $1`,
        [id]
      )
      
      const hasItems = itemsCheck && itemsCheck[0]?.count > 0
      
      if (hasItems) {
        return NextResponse.json(
          { error: 'Cannot delete schedules that have been finalized and contain items' },
          { status: 400 }
        )
      }
    }

    // Delete the schedule (cascade will handle items)
    const { error } = await safeQuerySchema(
      orgSlug,
      `DELETE FROM "ScheduleBuilder" WHERE id = $1`,
      [id]
    )

    if (error) {
      console.error('Failed to delete schedule:', error)
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
        VALUES ($1, 'schedule_deleted', $2, $3, $4, NOW())
      `,
      [
        `act_${Date.now()}`,
        `Deleted schedule: ${schedule.name}`,
        session.userId,
        JSON.stringify({ scheduleId: id })
      ]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Schedule deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}