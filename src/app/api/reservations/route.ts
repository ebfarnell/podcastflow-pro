import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { SchemaModels, getUserOrgSlug, querySchema, getSchemaName } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Parse filters
    const filters: any = {}
    
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status')?.split(',')
    }
    
    if (searchParams.get('advertiserId')) {
      filters.advertiserId = searchParams.get('advertiserId')
    }
    
    if (searchParams.get('campaignId')) {
      filters.campaignId = searchParams.get('campaignId')
    }
    
    if (searchParams.get('agencyId')) {
      filters.agencyId = searchParams.get('agencyId')
    }
    
    if (searchParams.get('createdBy')) {
      filters.createdBy = searchParams.get('createdBy')
    }
    
    if (searchParams.get('priority')) {
      filters.priority = searchParams.get('priority')?.split(',')
    }
    
    if (searchParams.get('expiresAfter')) {
      filters.expiresAfter = new Date(searchParams.get('expiresAfter')!)
    }
    
    if (searchParams.get('expiresBefore')) {
      filters.expiresBefore = new Date(searchParams.get('expiresBefore')!)
    }
    
    if (searchParams.get('createdAfter')) {
      filters.createdAfter = new Date(searchParams.get('createdAfter')!)
    }
    
    if (searchParams.get('createdBefore')) {
      filters.createdBefore = new Date(searchParams.get('createdBefore')!)
    }

    // Build where clause
    const where: any = {
      organizationId: session.organizationId
    }

    // Apply filters
    if (filters.status?.length) {
      where.status = { in: filters.status }
    }

    if (filters.advertiserId) {
      where.advertiserId = filters.advertiserId
    }

    if (filters.campaignId) {
      where.campaignId = filters.campaignId
    }

    // Query reservations using schema-aware query
    const schemaName = getSchemaName(orgSlug)
    const reservationsQuery = `
      SELECT 
        r.*,
        a.name as "advertiserName",
        c.name as "campaignName",
        COUNT(ri.id) as "totalSlots",
        SUM(ri.rate * ri.length) as "totalAmount"
      FROM "${schemaName}"."Reservation" r
      LEFT JOIN "${schemaName}"."Advertiser" a ON r."advertiserId" = a.id
      LEFT JOIN "${schemaName}"."Campaign" c ON r."campaignId" = c.id
      LEFT JOIN "${schemaName}"."ReservationItem" ri ON r.id = ri."reservationId"
      WHERE r."organizationId" = $1
      ${filters.status?.length ? `AND r.status = ANY($2::text[])` : ''}
      ${filters.advertiserId ? `AND r."advertiserId" = $${filters.status?.length ? 3 : 2}` : ''}
      ${filters.campaignId ? `AND r."campaignId" = $${filters.status?.length ? (filters.advertiserId ? 4 : 3) : (filters.advertiserId ? 3 : 2)}` : ''}
      GROUP BY r.id, a.name, c.name
      ORDER BY r."createdAt" DESC
      LIMIT $${filters.status?.length ? (filters.advertiserId ? (filters.campaignId ? 5 : 4) : (filters.campaignId ? 4 : 3)) : (filters.advertiserId ? (filters.campaignId ? 4 : 3) : (filters.campaignId ? 3 : 2))}
      OFFSET $${filters.status?.length ? (filters.advertiserId ? (filters.campaignId ? 6 : 5) : (filters.campaignId ? 5 : 4)) : (filters.advertiserId ? (filters.campaignId ? 5 : 4) : (filters.campaignId ? 4 : 3))}
    `

    const queryParams: any[] = [session.organizationId]
    if (filters.status?.length) queryParams.push(filters.status)
    if (filters.advertiserId) queryParams.push(filters.advertiserId)
    if (filters.campaignId) queryParams.push(filters.campaignId)
    queryParams.push(limit)
    queryParams.push((page - 1) * limit)

    const reservations = await querySchema(orgSlug, reservationsQuery, queryParams)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "${schemaName}"."Reservation" r
      WHERE r."organizationId" = $1
      ${filters.status?.length ? `AND r.status = ANY($2::text[])` : ''}
      ${filters.advertiserId ? `AND r."advertiserId" = $${filters.status?.length ? 3 : 2}` : ''}
      ${filters.campaignId ? `AND r."campaignId" = $${filters.status?.length ? (filters.advertiserId ? 4 : 3) : (filters.advertiserId ? 3 : 2)}` : ''}
    `

    const countParams = queryParams.slice(0, -2) // Remove limit and offset
    const [{ total }] = await querySchema(orgSlug, countQuery, countParams)

    // Transform the results to match the expected format
    const transformedReservations = reservations.map((r: any) => ({
      id: r.id,
      orderNumber: r.reservationNumber || `RES-${r.id.slice(-8)}`,
      advertiserId: r.advertiserId,
      advertiserName: r.advertiserName || 'Unknown',
      campaignId: r.campaignId,
      campaignName: r.campaignName || 'No Campaign',
      status: r.status || 'pending',
      totalSlots: parseInt(r.totalSlots) || 0,
      totalAmount: parseFloat(r.totalAmount) || 0,
      notes: r.notes,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))

    return NextResponse.json(transformedReservations)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.advertiserId || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: advertiserId and items array' },
        { status: 400 }
      )
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.showId || !item.date || !item.placementType || !item.length || !item.rate) {
        return NextResponse.json(
          { error: 'Each item must have: showId, date, placementType, length, rate' },
          { status: 400 }
        )
      }
    }

    // Calculate total amounts
    const totalAmount = body.items.reduce((sum: number, item: any) => sum + (item.rate * (item.length || 1)), 0)
    const estimatedRevenue = totalAmount // Can be adjusted with markup/fees

    // Calculate expiration time
    const holdDuration = body.holdDuration || 48
    const expiresAt = new Date(Date.now() + holdDuration * 60 * 60 * 1000)
    const timestamp = new Date().toISOString()

    // Generate reservation number
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const reservationNumber = `RES-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

    // Create the reservation
    const schemaName = getSchemaName(orgSlug)
    const createReservationQuery = `
      INSERT INTO "${schemaName}"."Reservation" (
        id,
        "reservationNumber",
        "organizationId",
        "campaignId",
        "advertiserId",
        "agencyId",
        status,
        "holdDuration",
        "expiresAt",
        "totalAmount",
        "estimatedRevenue",
        "createdBy",
        notes,
        priority,
        source,
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `

    const reservationParams = [
      reservationId,
      reservationNumber,
      session.organizationId,
      body.campaignId || null,
      body.advertiserId,
      body.agencyId || null,
      'held',
      holdDuration,
      expiresAt,
      totalAmount,
      estimatedRevenue,
      session.userId,
      body.notes || null,
      body.priority || 'normal',
      body.source || 'web',
      timestamp,
      timestamp
    ]

    const [reservation] = await querySchema(orgSlug, createReservationQuery, reservationParams)

    // Create reservation items
    for (const item of body.items) {
      const itemId = `resitem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const createItemQuery = `
        INSERT INTO "${schemaName}"."ReservationItem" (
          id,
          "reservationId",
          "showId",
          "episodeId",
          date,
          "placementType",
          "spotNumber",
          length,
          rate,
          status,
          notes,
          "createdAt",
          "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `

      await querySchema(orgSlug, createItemQuery, [
        itemId,
        reservationId,
        item.showId,
        item.episodeId || null,
        new Date(item.date),
        item.placementType,
        item.spotNumber || null,
        item.length,
        item.rate,
        'held',
        item.notes || null,
        timestamp,
        timestamp
      ])
    }

    // Get the full reservation with items for response
    const getReservationQuery = `
      SELECT 
        r.*,
        a.name as "advertiserName",
        c.name as "campaignName",
        COUNT(ri.id) as "totalSlots",
        SUM(ri.rate * ri.length) as "totalAmount"
      FROM "${schemaName}"."Reservation" r
      LEFT JOIN "${schemaName}"."Advertiser" a ON r."advertiserId" = a.id
      LEFT JOIN "${schemaName}"."Campaign" c ON r."campaignId" = c.id
      LEFT JOIN "${schemaName}"."ReservationItem" ri ON r.id = ri."reservationId"
      WHERE r.id = $1
      GROUP BY r.id, a.name, c.name
    `

    const [fullReservation] = await querySchema(orgSlug, getReservationQuery, [reservationId])

    // Transform to match expected format
    const transformedReservation = {
      id: fullReservation.id,
      orderNumber: fullReservation.reservationNumber,
      advertiserId: fullReservation.advertiserId,
      advertiserName: fullReservation.advertiserName || 'Unknown',
      campaignId: fullReservation.campaignId,
      campaignName: fullReservation.campaignName || 'Direct Reservation',
      status: fullReservation.status,
      totalSlots: parseInt(fullReservation.totalSlots) || 0,
      totalAmount: parseFloat(fullReservation.totalAmount) || 0,
      notes: fullReservation.notes,
      expiresAt: fullReservation.expiresAt,
      createdAt: fullReservation.createdAt,
      updatedAt: fullReservation.updatedAt
    }

    return NextResponse.json({ reservation: transformedReservation }, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}