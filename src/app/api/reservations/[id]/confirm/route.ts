import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, querySchema, SchemaModels } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can confirm reservations
    if (!['admin', 'master'].includes(session.userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const reservationId = params.id
    const timestamp = new Date().toISOString()

    // Get reservation details
    const reservationQuery = `
      SELECT r.*, c.name as "campaignName", c."startDate", c."endDate", c.budget
      FROM "${orgSlug}"."Reservation" r
      LEFT JOIN "${orgSlug}"."Campaign" c ON r."campaignId" = c.id
      WHERE r.id = $1 AND r."organizationId" = $2
    `
    const reservations = await querySchema(orgSlug, reservationQuery, [reservationId, session.organizationId])
    
    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    
    const reservation = reservations[0]

    // Check if reservation is already confirmed
    if (reservation.status !== 'held') {
      return NextResponse.json({ 
        error: 'Reservation is not in held status' 
      }, { status: 400 })
    }

    // Begin transaction-like operations
    const results = {
      reservation: null as any,
      campaign: null as any,
      order: null as any
    }

    // 1. Update reservation status to confirmed
    const updateReservationQuery = `
      UPDATE "${orgSlug}"."Reservation"
      SET 
        status = 'confirmed',
        "confirmedBy" = $2,
        "confirmedAt" = $3,
        "updatedAt" = $3
      WHERE id = $1
      RETURNING *
    `
    const updatedReservations = await querySchema(orgSlug, updateReservationQuery, [
      reservationId,
      session.userId,
      timestamp
    ])
    results.reservation = updatedReservations[0]

    // 2. If there's an associated campaign, update its status
    if (reservation.campaignId) {
      const now = new Date()
      const startDate = reservation.startDate ? new Date(reservation.startDate) : now
      const endDate = reservation.endDate ? new Date(reservation.endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      let campaignStatus = 'booked' // Default to booked
      if (now >= startDate && now <= endDate) {
        campaignStatus = 'active' // Campaign is in flight
      }

      const updateCampaignQuery = `
        UPDATE "${orgSlug}"."Campaign"
        SET 
          status = $2,
          "approvedBy" = $3,
          "approvedAt" = $4,
          "updatedAt" = $4
        WHERE id = $1
        RETURNING *
      `
      const updatedCampaigns = await querySchema(orgSlug, updateCampaignQuery, [
        reservation.campaignId,
        campaignStatus,
        session.userId,
        timestamp
      ])
      results.campaign = updatedCampaigns[0]
    }

    // 3. Create Order from Reservation
    const orderId = `order_${Date.now()}_${uuidv4().substring(0, 8)}`
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    
    // Calculate order amounts
    const grossAmount = reservation.totalAmount || reservation.budget || 0
    const discountPercentage = 0
    const discountAmount = grossAmount * (discountPercentage / 100)
    const netAmount = grossAmount - discountAmount
    const commissionPercentage = 15 // Standard commission
    const commissionAmount = netAmount * (commissionPercentage / 100)
    const totalAmount = netAmount + commissionAmount

    const createOrderQuery = `
      INSERT INTO "${orgSlug}"."Order" (
        id,
        "orderNumber",
        "campaignId",
        "advertiserId",
        "agencyId",
        "organizationId",
        "orderDate",
        "startDate",
        "endDate",
        "grossAmount",
        "discountPercentage",
        "discountAmount",
        "netAmount",
        "commissionPercentage",
        "commissionAmount",
        "totalAmount",
        status,
        notes,
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `
    
    const now = new Date()
    const startDate = reservation.startDate || reservation.createdAt
    const endDate = reservation.endDate || reservation.expiresAt
    const orderStatus = now >= new Date(startDate) && now <= new Date(endDate) ? 'active' : 'confirmed'

    const orders = await querySchema(orgSlug, createOrderQuery, [
      orderId,
      orderNumber,
      reservation.campaignId,
      reservation.advertiserId,
      reservation.agencyId,
      session.organizationId,
      timestamp,
      startDate,
      endDate,
      grossAmount,
      discountPercentage,
      discountAmount,
      netAmount,
      commissionPercentage,
      commissionAmount,
      totalAmount,
      orderStatus,
      `Order created from confirmed reservation ${reservation.reservationNumber || reservation.id}`,
      session.userId,
      timestamp,
      timestamp
    ])
    results.order = orders[0]

    // 4. Convert ReservationItems to OrderItems
    const reservationItemsQuery = `
      SELECT * FROM "${orgSlug}"."ReservationItem"
      WHERE "reservationId" = $1
    `
    const reservationItems = await querySchema(orgSlug, reservationItemsQuery, [reservationId])

    for (const item of reservationItems) {
      const orderItemId = `orderitem_${Date.now()}_${uuidv4().substring(0, 8)}`
      const createOrderItemQuery = `
        INSERT INTO "${orgSlug}"."OrderItem" (
          id,
          "orderId",
          "showId",
          "episodeId",
          "placementType",
          length,
          rate,
          quantity,
          "totalAmount",
          "airDate",
          status,
          "createdAt",
          "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `
      
      await querySchema(orgSlug, createOrderItemQuery, [
        orderItemId,
        orderId,
        item.showId,
        item.episodeId,
        item.placementType,
        item.length,
        item.rate,
        1, // quantity
        item.rate,
        item.date,
        'scheduled',
        timestamp,
        timestamp
      ])
    }

    // 5. Update inventory - release reserved spots and mark as booked
    const updateInventoryQuery = `
      UPDATE "${orgSlug}"."Inventory" i
      SET 
        "reservedSpots" = GREATEST(0, i."reservedSpots" - ri.count),
        "bookedSpots" = i."bookedSpots" + ri.count,
        "updatedAt" = $2
      FROM (
        SELECT "inventoryId", COUNT(*) as count
        FROM "${orgSlug}"."ReservationItem"
        WHERE "reservationId" = $1
        GROUP BY "inventoryId"
      ) ri
      WHERE i.id = ri."inventoryId"
    `
    await querySchema(orgSlug, updateInventoryQuery, [reservationId, timestamp])

    return NextResponse.json({
      success: true,
      message: 'Reservation confirmed and converted to order',
      reservation: results.reservation,
      campaign: results.campaign,
      order: {
        id: results.order.id,
        orderNumber: results.order.orderNumber,
        status: results.order.status,
        totalAmount: results.order.totalAmount
      }
    })
  } catch (error) {
    console.error('Error confirming reservation:', error)
    return NextResponse.json(
      { error: 'Failed to confirm reservation' },
      { status: 500 }
    )
  }
}