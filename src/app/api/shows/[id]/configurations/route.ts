import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get show configurations with rate cards
    const { data: configurations, error } = await safeQuerySchema(
      orgSlug,
      `
        SELECT 
          sc.*,
          rc.id as "rateCardId",
          rc."preRollBaseRate",
          rc."midRollBaseRate",
          rc."postRollBaseRate",
          rc."effectiveDate",
          rc."expiryDate",
          rc.status as "rateCardStatus",
          rc."volumeDiscounts",
          rc."seasonalMultipliers",
          rc."dayOfWeekMultipliers"
        FROM "ShowConfiguration" sc
        LEFT JOIN LATERAL (
          SELECT *
          FROM "RateCard" rc
          WHERE rc."showConfigurationId" = sc.id
            AND rc.status = 'active'
            AND rc."effectiveDate" <= CURRENT_DATE
            AND (rc."expiryDate" IS NULL OR rc."expiryDate" >= CURRENT_DATE)
          ORDER BY rc."effectiveDate" DESC
          LIMIT 1
        ) rc ON true
        WHERE sc."showId" = $1
          AND sc."isActive" = true
        ORDER BY sc."episodeLength", sc.name
      `,
      [params.id]
    )

    if (error) {
      console.error('Failed to fetch configurations:', error)
      return NextResponse.json({ configurations: [] })
    }

    return NextResponse.json({ configurations: configurations || [] })
  } catch (error) {
    console.error('Show configurations fetch error:', error)
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

    // Only admin can create configurations
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization slug for multi-tenant query
    const orgSlug = session.organizationSlug || await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      episodeLength,
      adLoadType,
      preRollSlots,
      midRollSlots,
      postRollSlots,
      preRollDuration,
      midRollDuration,
      postRollDuration,
      releaseDays,
      releaseTime,
      rateCard
    } = body

    // Validate required fields
    if (!name || !episodeLength) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if show exists
    const { data: showData } = await safeQuerySchema(
      orgSlug,
      `SELECT id FROM "Show" WHERE id = $1`,
      [params.id]
    )

    if (!showData || showData.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    const configId = `sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create configuration
    const { data: config, error: configError } = await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "ShowConfiguration" (
          id, "showId", name, "episodeLength", "adLoadType",
          "preRollSlots", "midRollSlots", "postRollSlots",
          "preRollDuration", "midRollDuration", "postRollDuration",
          "releaseDays", "releaseTime", "isActive"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::time, true
        )
        RETURNING *
      `,
      [
        configId,
        params.id,
        name,
        episodeLength,
        adLoadType || 'standard',
        preRollSlots || 1,
        midRollSlots || 2,
        postRollSlots || 1,
        preRollDuration || 30,
        midRollDuration || 60,
        postRollDuration || 30,
        releaseDays || [],
        releaseTime || '08:00:00'
      ]
    )

    if (configError) {
      console.error('Failed to create configuration:', configError)
      return NextResponse.json(
        { error: 'Failed to create configuration' },
        { status: 500 }
      )
    }

    // Create rate card if provided
    if (rateCard && config?.[0]) {
      const rateCardId = `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      await safeQuerySchema(
        orgSlug,
        `
          INSERT INTO "RateCard" (
            id, "showConfigurationId", "effectiveDate",
            "preRollBaseRate", "midRollBaseRate", "postRollBaseRate",
            "volumeDiscounts", "seasonalMultipliers", "dayOfWeekMultipliers",
            status, "createdBy"
          ) VALUES (
            $1, $2, CURRENT_DATE, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb,
            'active', $9
          )
        `,
        [
          rateCardId,
          configId,
          rateCard.preRollBaseRate || 500,
          rateCard.midRollBaseRate || 750,
          rateCard.postRollBaseRate || 400,
          JSON.stringify(rateCard.volumeDiscounts || []),
          JSON.stringify(rateCard.seasonalMultipliers || {}),
          JSON.stringify(rateCard.dayOfWeekMultipliers || {}),
          session.userId
        ]
      )
    }

    // Log activity
    await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
        VALUES ($1, 'show_configuration_created', $2, $3, $4, NOW())
      `,
      [
        `act_${Date.now()}`,
        `Created configuration "${name}" for show`,
        session.userId,
        JSON.stringify({ showId: params.id, configurationId: configId })
      ]
    )

    return NextResponse.json({ configuration: config[0] })
  } catch (error) {
    console.error('Configuration creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}