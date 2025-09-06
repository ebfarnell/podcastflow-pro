import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { hasPermission } from '@/types/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/orders/schedule-integration - Create order from schedule
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.role, 'orders:create')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { scheduleId, requiresClientApproval, paymentTerms, specialInstructions } = body

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      )
    }

    // Get schedule details
    const { data: scheduleData } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          sb.*,
          COUNT(sbi.id) as item_count,
          json_agg(
            json_build_object(
              'id', sbi.id,
              'episodeId', sbi."episodeId",
              'placementType', sbi."placementType",
              'negotiatedPrice', sbi."negotiatedPrice"
            )
          ) as items
        FROM "ScheduleBuilder" sb
        LEFT JOIN "ScheduleBuilderItem" sbi ON sbi."scheduleId" = sb.id
        WHERE sb.id = $1 AND sb.status = 'approved'
        GROUP BY sb.id
      `,
      [scheduleId]
    )

    if (!scheduleData || scheduleData.length === 0) {
      return NextResponse.json(
        { error: 'Approved schedule not found' },
        { status: 404 }
      )
    }

    const schedule = scheduleData[0]

    // Check if order already exists for this schedule
    const { data: existingOrder } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id FROM "Order" WHERE "scheduleId" = $1`,
      [scheduleId]
    )

    if (existingOrder && existingOrder.length > 0) {
      return NextResponse.json(
        { error: 'Order already exists for this schedule' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = `ORD-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Create the order
    const { data: newOrder, error: orderError } = await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "Order" (
          id, "orderNumber", "campaignId", "scheduleId",
          "organizationId", "advertiserId", "agencyId",
          status, "totalAmount", "netAmount",
          "requiresClientApproval", "paymentTerms", "specialInstructions",
          "submittedAt", "submittedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          CURRENT_TIMESTAMP, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id
      `,
      [
        'ord_' + Math.random().toString(36).substr(2, 16),
        orderNumber,
        schedule.campaignId,
        scheduleId,
        session.organizationSlug,
        schedule.advertiserId,
        schedule.agencyId,
        'pending_approval',
        schedule.netAmount,
        schedule.netAmount,
        requiresClientApproval || false,
        paymentTerms || 'net30',
        specialInstructions || null,
        session.userId
      ]
    )

    if (orderError) {
      console.error('Failed to create order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    const orderId = newOrder[0].id

    // Create inventory holds for the order
    const { data: holdResult } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM create_inventory_hold($1, $2, $3)`,
      [scheduleId, orderId, session.userId]
    )

    if (!holdResult?.[0]?.success) {
      // Rollback order creation if holds failed
      await safeQuerySchema(
        session.organizationSlug,
        `DELETE FROM "Order" WHERE id = $1`,
        [orderId]
      )

      return NextResponse.json(
        { 
          error: 'Failed to create inventory holds',
          details: holdResult?.[0]?.errors || []
        },
        { status: 400 }
      )
    }

    // Create order items from schedule items
    const orderItemPromises = schedule.items.map((item: any) =>
      safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "OrderItem" (
            id, "orderId", "showId", "episodeId",
            "placementType", "airDate", "length",
            "rate", "actualRate", status
          )
          SELECT 
            $1, $2, e."showId", $3, $4,
            e."airDate", 30, $5, $5, 'pending'
          FROM "Episode" e
          WHERE e.id = $3
        `,
        [
          'oi_' + Math.random().toString(36).substr(2, 16),
          orderId,
          item.episodeId,
          item.placementType,
          item.negotiatedPrice
        ]
      )
    )

    await Promise.all(orderItemPromises)

    // Send notifications
    const notificationTargets = []

    // Notify admins
    const { data: admins } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT id FROM public."User"
        WHERE "organizationId" = $1
          AND role IN ('admin', 'master')
          AND "isActive" = true
      `,
      [session.organizationId]
    )

    admins?.forEach((admin: any) => notificationTargets.push({
      userId: admin.id,
      type: 'order_created',
      title: 'New Order Created',
      message: `Order ${orderNumber} has been created from schedule ${schedule.name}`
    }))

    // Notify client if approval required
    if (requiresClientApproval) {
      const { data: clientUsers } = await safeQuerySchema(
        session.organizationSlug,
        `
          SELECT u.id 
          FROM public."User" u
          JOIN "Advertiser" a ON a."primaryContactEmail" = u.email
          WHERE a.id = $1 AND u."isActive" = true
        `,
        [schedule.advertiserId]
      )

      clientUsers?.forEach((client: any) => notificationTargets.push({
        userId: client.id,
        type: 'order_approval_required',
        title: 'Order Approval Required',
        message: `Your approval is required for order ${orderNumber}`
      }))
    }

    // Create all notifications
    const notificationPromises = notificationTargets.map(notification =>
      safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "Notification" (
            id, "userId", type, title, message, 
            "relatedId", "relatedType"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          'notif_' + Math.random().toString(36).substr(2, 16),
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          orderId,
          'order'
        ]
      )
    )

    await Promise.all(notificationPromises)

    // Log the creation
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryChangeLog" (
          id, "episodeId", "changeType", "newValue", 
          "affectedOrders", "changedBy"
        ) VALUES (
          $1, $2, 'order_created', $3::jsonb, $4, $5
        )
      `,
      [
        'icl_' + Math.random().toString(36).substr(2, 16),
        scheduleId, // Using scheduleId as episodeId for order-level changes
        JSON.stringify({ 
          orderId, 
          orderNumber, 
          holdsCreated: holdResult[0].holdsCreated 
        }),
        [orderId],
        session.userId
      ]
    )

    return NextResponse.json({ 
      success: true,
      orderId,
      orderNumber,
      holdsCreated: holdResult[0].holdsCreated,
      notificationsSent: notificationTargets.length,
      message: `Order ${orderNumber} created successfully`
    })
  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

// PUT /api/orders/schedule-integration/:orderId/approve - Approve or reject order
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, action, reason } = body

    if (!orderId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    // Get order details
    const { data: orderData } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT o.*, a.name as advertiser_name
        FROM "Order" o
        LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
        WHERE o.id = $1
      `,
      [orderId]
    )

    if (!orderData || orderData.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const order = orderData[0]

    // Check permissions
    const canApprove = 
      ['admin', 'master'].includes(session.role) ||
      (order.requiresClientApproval && session.role === 'client')

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Insufficient permissions to approve order' },
        { status: 403 }
      )
    }

    if (action === 'approve') {
      // Update order status
      const updateFields = session.role === 'client' 
        ? {
            clientApprovedAt: 'CURRENT_TIMESTAMP',
            clientApprovedBy: session.userId
          }
        : {
            status: "'approved'",
            approvedAt: 'CURRENT_TIMESTAMP',
            approvedBy: session.userId
          }

      const updateQuery = session.role === 'client'
        ? `UPDATE "Order" SET "clientApprovedAt" = ${updateFields.clientApprovedAt}, "clientApprovedBy" = $1 WHERE id = $2`
        : `UPDATE "Order" SET status = ${updateFields.status}, "approvedAt" = ${updateFields.approvedAt}, "approvedBy" = $1 WHERE id = $2`

      await safeQuerySchema(
        session.organizationSlug,
        updateQuery,
        [session.userId, orderId]
      )

      // If admin approval and client approval not required, or both approvals complete
      if (
        session.role !== 'client' || 
        !order.requiresClientApproval ||
        (order.clientApprovedAt && session.role === 'admin')
      ) {
        // Approve all inventory holds
        await safeQuerySchema(
          session.organizationSlug,
          `
            UPDATE "InventoryReservation"
            SET status = 'confirmed',
                "approvalStatus" = 'approved',
                "approvedBy" = $1,
                "approvedAt" = CURRENT_TIMESTAMP
            WHERE "orderId" = $2 AND status = 'reserved'
          `,
          [session.userId, orderId]
        )

        // Update inventory from reserved to booked
        await safeQuerySchema(
          session.organizationSlug,
          `
            UPDATE "EpisodeInventory" ei
            SET "preRollBooked" = "preRollBooked" + subq."preRollCount",
                "preRollReserved" = "preRollReserved" - subq."preRollCount",
                "midRollBooked" = "midRollBooked" + subq."midRollCount",
                "midRollReserved" = "midRollReserved" - subq."midRollCount",
                "postRollBooked" = "postRollBooked" + subq."postRollCount",
                "postRollReserved" = "postRollReserved" - subq."postRollCount"
            FROM (
              SELECT 
                "episodeId",
                COUNT(*) FILTER (WHERE "placementType" = 'pre-roll') as "preRollCount",
                COUNT(*) FILTER (WHERE "placementType" = 'mid-roll') as "midRollCount",
                COUNT(*) FILTER (WHERE "placementType" = 'post-roll') as "postRollCount"
              FROM "InventoryReservation"
              WHERE "orderId" = $1 AND status = 'reserved'
              GROUP BY "episodeId"
            ) subq
            WHERE ei."episodeId" = subq."episodeId"
          `,
          [orderId]
        )

        // Update order items status
        await safeQuerySchema(
          session.organizationSlug,
          `
            UPDATE "OrderItem"
            SET status = 'confirmed',
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "orderId" = $1
          `,
          [orderId]
        )
      }

      // Send notification
      const notificationMessage = session.role === 'client'
        ? `Client has approved order ${order.orderNumber}`
        : `Order ${order.orderNumber} has been approved`

      await safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "Notification" (
            id, "userId", type, title, message, 
            "relatedId", "relatedType"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          'notif_' + Math.random().toString(36).substr(2, 16),
          order.submittedBy,
          'order_approved',
          'Order Approved',
          notificationMessage,
          orderId,
          'order'
        ]
      )
    } else {
      // Reject order
      await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "Order"
          SET status = 'rejected',
              notes = COALESCE(notes || E'\\n', '') || $1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [
          `Rejected by ${session.userName || session.role}: ${reason || 'No reason provided'}`,
          orderId
        ]
      )

      // Release all holds
      const { data: holds } = await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "InventoryReservation"
          SET status = 'released',
              "approvalStatus" = 'rejected',
              "rejectionReason" = $1,
              "approvedBy" = $2,
              "approvedAt" = CURRENT_TIMESTAMP
          WHERE "orderId" = $3 AND status = 'reserved'
          RETURNING "episodeId", "placementType"
        `,
        [reason || 'Order rejected', session.userId, orderId]
      )

      // Update inventory availability
      if (holds && holds.length > 0) {
        for (const hold of holds) {
          const availableField = `"${hold.placementType.replace('-', '')}Available"`
          const reservedField = `"${hold.placementType.replace('-', '')}Reserved"`
          
          await safeQuerySchema(
            session.organizationSlug,
            `
              UPDATE "EpisodeInventory"
              SET ${availableField} = ${availableField} + 1,
                  ${reservedField} = ${reservedField} - 1
              WHERE "episodeId" = $1
            `,
            [hold.episodeId]
          )
        }
      }

      // Send notification
      await safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "Notification" (
            id, "userId", type, title, message, 
            "relatedId", "relatedType"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          'notif_' + Math.random().toString(36).substr(2, 16),
          order.submittedBy,
          'order_rejected',
          'Order Rejected',
          `Order ${order.orderNumber} has been rejected. Reason: ${reason || 'Not specified'}`,
          orderId,
          'order'
        ]
      )
    }

    // Log the change
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryChangeLog" (
          id, "episodeId", "changeType", "previousValue", 
          "newValue", "affectedOrders", "changedBy"
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7
        )
      `,
      [
        'icl_' + Math.random().toString(36).substr(2, 16),
        order.scheduleId,
        action === 'approve' ? 'order_approved' : 'order_rejected',
        JSON.stringify({ status: order.status }),
        JSON.stringify({ 
          status: action === 'approve' ? 'approved' : 'rejected',
          reason: reason || null
        }),
        [orderId],
        session.userId
      ]
    )

    return NextResponse.json({ 
      success: true,
      message: `Order ${action}ed successfully`
    })
  } catch (error) {
    console.error('Order approval error:', error)
    return NextResponse.json(
      { error: `Failed to ${body.action} order` },
      { status: 500 }
    )
  }
}