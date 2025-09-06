import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showConfigurationId = searchParams.get('showConfigurationId')
    const showId = searchParams.get('showId')
    const status = searchParams.get('status') || 'active'
    const effectiveDate = searchParams.get('effectiveDate') || new Date().toISOString().split('T')[0]

    // Build query conditions
    const conditions = []
    const params = []
    let paramIndex = 1

    if (showConfigurationId) {
      conditions.push(`rc."showConfigurationId" = $${paramIndex}`)
      params.push(showConfigurationId)
      paramIndex++
    }

    if (showId) {
      conditions.push(`sc."showId" = $${paramIndex}`)
      params.push(showId)
      paramIndex++
    }

    if (status) {
      conditions.push(`rc.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    conditions.push(`rc."effectiveDate" <= $${paramIndex}::date`)
    params.push(effectiveDate)
    paramIndex++

    conditions.push(`(rc."expiryDate" IS NULL OR rc."expiryDate" >= $${paramIndex}::date)`)
    params.push(effectiveDate)

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get rate cards with show details
    const { data: rateCards, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          rc.*,
          sc.name as "configurationName",
          sc."episodeLength",
          sc."showId",
          s.name as "showName",
          u1.name as "createdByName",
          u2.name as "approvedByName"
        FROM "RateCard" rc
        JOIN "ShowConfiguration" sc ON rc."showConfigurationId" = sc.id
        JOIN "Show" s ON sc."showId" = s.id
        LEFT JOIN public."User" u1 ON rc."createdBy" = u1.id
        LEFT JOIN public."User" u2 ON rc."approvedBy" = u2.id
        ${whereClause}
        ORDER BY s.name, sc.name, rc."effectiveDate" DESC
      `,
      params
    )

    if (error) {
      console.error('Failed to fetch rate cards:', error)
      return NextResponse.json({ rateCards: [] })
    }

    return NextResponse.json({ rateCards: rateCards || [] })
  } catch (error) {
    console.error('Rate cards fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can create rate cards
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      showConfigurationId,
      effectiveDate,
      expiryDate,
      preRollBaseRate,
      midRollBaseRate,
      postRollBaseRate,
      volumeDiscounts,
      seasonalMultipliers,
      dayOfWeekMultipliers,
      notes,
      autoApprove
    } = body

    // Validate required fields
    if (!showConfigurationId || !effectiveDate || !preRollBaseRate || !midRollBaseRate || !postRollBaseRate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if configuration exists
    const { data: configData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id, "showId" FROM "ShowConfiguration" WHERE id = $1`,
      [showConfigurationId]
    )

    if (!configData || configData.length === 0) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Expire existing active rate cards if needed
    if (autoApprove) {
      await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "RateCard"
          SET 
            "expiryDate" = ($1::date - INTERVAL '1 day')::date,
            status = 'expired',
            "updatedAt" = NOW()
          WHERE "showConfigurationId" = $2
            AND status = 'active'
            AND "effectiveDate" < $1::date
            AND ("expiryDate" IS NULL OR "expiryDate" >= $1::date)
        `,
        [effectiveDate, showConfigurationId]
      )
    }

    const rateCardId = `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create rate card
    const { data: rateCard, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "RateCard" (
          id, "showConfigurationId", "effectiveDate", "expiryDate",
          "preRollBaseRate", "midRollBaseRate", "postRollBaseRate",
          "volumeDiscounts", "seasonalMultipliers", "dayOfWeekMultipliers",
          notes, "createdBy", status,
          "approvedBy", "approvedAt"
        ) VALUES (
          $1, $2, $3::date, $4::date, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
          $11, $12, $13, $14, $15
        )
        RETURNING *
      `,
      [
        rateCardId,
        showConfigurationId,
        effectiveDate,
        expiryDate || null,
        preRollBaseRate,
        midRollBaseRate,
        postRollBaseRate,
        JSON.stringify(volumeDiscounts || []),
        JSON.stringify(seasonalMultipliers || {}),
        JSON.stringify(dayOfWeekMultipliers || {}),
        notes || null,
        session.userId,
        autoApprove ? 'active' : 'draft',
        autoApprove ? session.userId : null,
        autoApprove ? new Date().toISOString() : null
      ]
    )

    if (error) {
      console.error('Failed to create rate card:', error)
      return NextResponse.json(
        { error: 'Failed to create rate card' },
        { status: 500 }
      )
    }

    // Log activity
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "Activity" (id, type, description, "userId", metadata, "createdAt")
        VALUES ($1, 'rate_card_created', $2, $3, $4, NOW())
      `,
      [
        `act_${Date.now()}`,
        `Created rate card effective ${effectiveDate}`,
        session.userId,
        JSON.stringify({ 
          rateCardId, 
          showConfigurationId,
          effectiveDate,
          rates: { preRollBaseRate, midRollBaseRate, postRollBaseRate }
        })
      ]
    )

    return NextResponse.json({ rateCard: rateCard[0] })
  } catch (error) {
    console.error('Rate card creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can update rate cards
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      id, 
      volumeDiscounts, 
      seasonalMultipliers, 
      dayOfWeekMultipliers,
      notes,
      expiryDate
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Rate card ID required' }, { status: 400 })
    }

    // Check if rate card exists and is editable
    const { data: checkData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT status FROM "RateCard" WHERE id = $1`,
      [id]
    )

    if (!checkData || checkData.length === 0) {
      return NextResponse.json({ error: 'Rate card not found' }, { status: 404 })
    }

    if (checkData[0].status === 'expired') {
      return NextResponse.json(
        { error: 'Cannot modify expired rate card' },
        { status: 400 }
      )
    }

    // Build update query
    const updates = [`"updatedAt" = NOW()`]
    const params = []
    let paramIndex = 1

    if (volumeDiscounts !== undefined) {
      updates.push(`"volumeDiscounts" = $${paramIndex}::jsonb`)
      params.push(JSON.stringify(volumeDiscounts))
      paramIndex++
    }

    if (seasonalMultipliers !== undefined) {
      updates.push(`"seasonalMultipliers" = $${paramIndex}::jsonb`)
      params.push(JSON.stringify(seasonalMultipliers))
      paramIndex++
    }

    if (dayOfWeekMultipliers !== undefined) {
      updates.push(`"dayOfWeekMultipliers" = $${paramIndex}::jsonb`)
      params.push(JSON.stringify(dayOfWeekMultipliers))
      paramIndex++
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`)
      params.push(notes)
      paramIndex++
    }

    if (expiryDate !== undefined) {
      updates.push(`"expiryDate" = $${paramIndex}::date`)
      params.push(expiryDate)
      paramIndex++
    }

    params.push(id)

    const { data: rateCard, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        UPDATE "RateCard"
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      params
    )

    if (error) {
      console.error('Failed to update rate card:', error)
      return NextResponse.json(
        { error: 'Failed to update rate card' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rateCard: rateCard[0] })
  } catch (error) {
    console.error('Rate card update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}