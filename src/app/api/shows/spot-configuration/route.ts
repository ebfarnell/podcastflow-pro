import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { hasPermission } from '@/types/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/shows/spot-configuration - Get spot configuration for a show
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const showId = searchParams.get('showId')

    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID required' },
        { status: 400 }
      )
    }

    // Get show with configurations
    const { data: show, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          s.id,
          s.name,
          s."spotConfiguration",
          s."defaultSpotLoadType",
          s."enableDynamicSpots",
          json_agg(
            json_build_object(
              'id', sc.id,
              'name', sc.name,
              'episodeLength', sc."episodeLength",
              'spotThresholds', sc."spotThresholds",
              'preRollSlots', sc."preRollSlots",
              'midRollSlots', sc."midRollSlots",
              'postRollSlots', sc."postRollSlots",
              'customSpotRules', sc."customSpotRules"
            ) ORDER BY sc."episodeLength"
          ) FILTER (WHERE sc.id IS NOT NULL) as configurations
        FROM "Show" s
        LEFT JOIN "ShowConfiguration" sc ON sc."showId" = s.id
        WHERE s.id = $1
        GROUP BY s.id, s.name, s."spotConfiguration", s."defaultSpotLoadType", s."enableDynamicSpots"
      `,
      [showId]
    )

    if (error) {
      console.error('Failed to fetch show spot configuration:', error)
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: 500 }
      )
    }

    if (!show || show.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      show: show[0],
      configurations: show[0].configurations || []
    })
  } catch (error) {
    console.error('Show spot configuration error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spot configuration' },
      { status: 500 }
    )
  }
}

// PUT /api/shows/spot-configuration - Update spot configuration for a show
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can update spot configuration
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      showId, 
      spotConfiguration, 
      defaultSpotLoadType, 
      enableDynamicSpots,
      configurations 
    } = body

    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID required' },
        { status: 400 }
      )
    }

    // Update show-level settings
    const { error: updateError } = await safeQuerySchema(
      session.organizationSlug,
      `
        UPDATE "Show"
        SET "spotConfiguration" = $1::jsonb,
            "defaultSpotLoadType" = $2,
            "enableDynamicSpots" = $3,
            "updatedAt" = CURRENT_TIMESTAMP,
            "updatedBy" = $4
        WHERE id = $5
      `,
      [
        JSON.stringify(spotConfiguration || {}),
        defaultSpotLoadType || 'standard',
        enableDynamicSpots !== false,
        session.userId,
        showId
      ]
    )

    if (updateError) {
      console.error('Failed to update show spot configuration:', updateError)
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 }
      )
    }

    // Update individual configurations if provided
    if (configurations && Array.isArray(configurations)) {
      for (const config of configurations) {
        if (config.id) {
          // Update existing configuration
          await safeQuerySchema(
            session.organizationSlug,
            `
              UPDATE "ShowConfiguration"
              SET "spotThresholds" = $1::jsonb,
                  "preRollSlots" = $2,
                  "midRollSlots" = $3,
                  "postRollSlots" = $4,
                  "customSpotRules" = $5::jsonb,
                  "updatedAt" = CURRENT_TIMESTAMP
              WHERE id = $6
            `,
            [
              JSON.stringify(config.spotThresholds || []),
              config.preRollSlots || 1,
              config.midRollSlots || 2,
              config.postRollSlots || 1,
              JSON.stringify(config.customSpotRules || {}),
              config.id
            ]
          )
        }
      }
    }

    // Log the change
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryChangeLog" (
          id, "episodeId", "changeType", "newValue", "changedBy"
        ) VALUES (
          $1, $2, 'spot_configuration_updated', $3::jsonb, $4
        )
      `,
      [
        'icl_' + Math.random().toString(36).substr(2, 16),
        showId, // Using showId as episodeId for show-level changes
        JSON.stringify({ 
          spotConfiguration, 
          defaultSpotLoadType, 
          enableDynamicSpots 
        }),
        session.userId
      ]
    )

    // Trigger inventory recalculation for future episodes
    const { data: futureEpisodes } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT id, length FROM "Episode"
        WHERE "showId" = $1
          AND status = 'scheduled'
          AND "airDate" > CURRENT_DATE
      `,
      [showId]
    )

    if (futureEpisodes && futureEpisodes.length > 0) {
      // Recalculate inventory for each episode
      for (const episode of futureEpisodes) {
        const { data: spots } = await safeQuerySchema(
          session.organizationSlug,
          `SELECT * FROM calculate_episode_spots($1, $2)`,
          [episode.length || 30, showId]
        )

        if (spots && spots.length > 0) {
          const spotConfig = spots[0]
          
          // Check if inventory exists and has no bookings
          const { data: inventory } = await safeQuerySchema(
            session.organizationSlug,
            `
              SELECT id, "preRollReserved", "preRollBooked",
                     "midRollReserved", "midRollBooked",
                     "postRollReserved", "postRollBooked"
              FROM "EpisodeInventory"
              WHERE "episodeId" = $1
            `,
            [episode.id]
          )

          if (inventory && inventory.length > 0) {
            const inv = inventory[0]
            // Only update if no reservations or bookings
            if (
              inv.preRollReserved === 0 && inv.preRollBooked === 0 &&
              inv.midRollReserved === 0 && inv.midRollBooked === 0 &&
              inv.postRollReserved === 0 && inv.postRollBooked === 0
            ) {
              await safeQuerySchema(
                session.organizationSlug,
                `
                  UPDATE "EpisodeInventory"
                  SET "preRollSlots" = $1,
                      "preRollAvailable" = $1,
                      "midRollSlots" = $2,
                      "midRollAvailable" = $2,
                      "postRollSlots" = $3,
                      "postRollAvailable" = $3,
                      "spotConfiguration" = $4::jsonb,
                      "lastSyncedAt" = CURRENT_TIMESTAMP
                  WHERE id = $5
                `,
                [
                  spotConfig.prerollslots,
                  spotConfig.midrollslots,
                  spotConfig.postrollslots,
                  JSON.stringify(spotConfig),
                  inv.id
                ]
              )
            }
          }
        }
      }

      // Check for any inventory conflicts
      const { data: conflicts } = await safeQuerySchema(
        session.organizationSlug,
        `
          SELECT 
            ei."episodeId",
            e.title,
            ei."preRollSlots" - ei."preRollAvailable" - ei."preRollReserved" as "preRollIssue",
            ei."midRollSlots" - ei."midRollAvailable" - ei."midRollReserved" as "midRollIssue",
            ei."postRollSlots" - ei."postRollAvailable" - ei."postRollReserved" as "postRollIssue"
          FROM "EpisodeInventory" ei
          JOIN "Episode" e ON e.id = ei."episodeId"
          WHERE e."showId" = $1
            AND (
              ei."preRollSlots" < (ei."preRollReserved" + ei."preRollBooked") OR
              ei."midRollSlots" < (ei."midRollReserved" + ei."midRollBooked") OR
              ei."postRollSlots" < (ei."postRollReserved" + ei."postRollBooked")
            )
        `,
        [showId]
      )

      if (conflicts && conflicts.length > 0) {
        // Create alert for conflicts
        await safeQuerySchema(
          session.organizationSlug,
          `
            INSERT INTO "InventoryAlert" (
              id, "alertType", severity, "showId", details
            ) VALUES (
              $1, 'update_impact', 'high', $2, $3::jsonb
            )
          `,
          [
            'ia_' + Math.random().toString(36).substr(2, 16),
            showId,
            JSON.stringify({
              message: `Spot configuration change created conflicts in ${conflicts.length} episodes`,
              conflicts: conflicts,
              changedBy: session.userId
            })
          ]
        )
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Spot configuration updated successfully',
      episodesUpdated: futureEpisodes?.length || 0
    })
  } catch (error) {
    console.error('Show spot configuration update error:', error)
    return NextResponse.json(
      { error: 'Failed to update spot configuration' },
      { status: 500 }
    )
  }
}

// POST /api/shows/spot-configuration/threshold - Add custom threshold
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can add thresholds
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      showConfigurationId,
      minLength,
      maxLength,
      preRoll,
      midRoll,
      postRoll
    } = body

    if (!showConfigurationId || minLength === undefined || maxLength === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get current thresholds
    const { data: config } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT "spotThresholds"
        FROM "ShowConfiguration"
        WHERE id = $1
      `,
      [showConfigurationId]
    )

    if (!config || config.length === 0) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Add new threshold
    const currentThresholds = config[0].spotThresholds || []
    const newThreshold = {
      minLength,
      maxLength,
      preRoll: preRoll || 1,
      midRoll: midRoll || 0,
      postRoll: postRoll || 0
    }

    // Check for overlaps
    const hasOverlap = currentThresholds.some((t: any) => 
      (minLength >= t.minLength && minLength <= t.maxLength) ||
      (maxLength >= t.minLength && maxLength <= t.maxLength) ||
      (minLength <= t.minLength && maxLength >= t.maxLength)
    )

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Threshold overlaps with existing range' },
        { status: 400 }
      )
    }

    // Add and sort thresholds
    currentThresholds.push(newThreshold)
    currentThresholds.sort((a: any, b: any) => a.minLength - b.minLength)

    // Update configuration
    const { error } = await safeQuerySchema(
      session.organizationSlug,
      `
        UPDATE "ShowConfiguration"
        SET "spotThresholds" = $1::jsonb,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [JSON.stringify(currentThresholds), showConfigurationId]
    )

    if (error) {
      console.error('Failed to add threshold:', error)
      return NextResponse.json(
        { error: 'Failed to add threshold' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Threshold added successfully',
      thresholds: currentThresholds
    })
  } catch (error) {
    console.error('Threshold addition error:', error)
    return NextResponse.json(
      { error: 'Failed to add threshold' },
      { status: 500 }
    )
  }
}