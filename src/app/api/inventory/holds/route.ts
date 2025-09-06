import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { hasPermission } from '@/types/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/inventory/holds - Get inventory holds
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('orderId')
    const scheduleId = searchParams.get('scheduleId')
    const episodeId = searchParams.get('episodeId')
    const status = searchParams.get('status')

    let query = `
      SELECT 
        ir.id,
        ir."episodeId",
        ir."placementType",
        ir."slotNumber",
        ir."scheduleId",
        ir."orderId",
        ir.status,
        ir."holdType",
        ir."reservedBy",
        ir."reservedAt",
        ir."expiresAt",
        ir."approvalStatus",
        ir."approvedBy",
        ir."approvedAt",
        ir."rejectionReason",
        e.title as episode_title,
        e."airDate",
        s.name as show_name,
        u.name as reserved_by_name
      FROM "InventoryReservation" ir
      JOIN "Episode" e ON e.id = ir."episodeId"
      JOIN "Show" s ON s.id = e."showId"
      LEFT JOIN public."User" u ON u.id = ir."reservedBy"
      WHERE 1=1
    `

    const params: any[] = []

    if (orderId) {
      query += ` AND ir."orderId" = $${params.length + 1}`
      params.push(orderId)
    }

    if (scheduleId) {
      query += ` AND ir."scheduleId" = $${params.length + 1}`
      params.push(scheduleId)
    }

    if (episodeId) {
      query += ` AND ir."episodeId" = $${params.length + 1}`
      params.push(episodeId)
    }

    if (status) {
      query += ` AND ir.status = $${params.length + 1}`
      params.push(status)
    }

    // Check permissions for non-admin users
    if (!['admin', 'master'].includes(session.role)) {
      if (session.role === 'sales') {
        // Sales can see their own holds
        query += ` AND ir."reservedBy" = $${params.length + 1}`
        params.push(session.userId)
      } else {
        // Other roles need show assignment
        query += ` AND EXISTS (
          SELECT 1 FROM "_ShowToUser" su 
          WHERE su."A" = s.id AND su."B" = $${params.length + 1}
        )`
        params.push(session.userId)
      }
    }

    query += ` ORDER BY e."airDate", ir."reservedAt" DESC`

    const { data: holds, error } = await safeQuerySchema(
      session.organizationSlug,
      query,
      params
    )

    if (error) {
      console.error('Failed to fetch inventory holds:', error)
      return NextResponse.json({ holds: [] })
    }

    return NextResponse.json({ holds: holds || [] })
  } catch (error) {
    console.error('Inventory holds error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory holds' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/holds - Create inventory hold from order
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scheduleId, orderId } = body

    if (!scheduleId || !orderId) {
      return NextResponse.json(
        { error: 'Schedule ID and Order ID required' },
        { status: 400 }
      )
    }

    // Call the database function to create holds
    const { data: result, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM create_inventory_hold($1, $2, $3)`,
      [scheduleId, orderId, session.userId]
    )

    if (error) {
      console.error('Failed to create inventory holds:', error)
      return NextResponse.json(
        { error: 'Failed to create inventory holds' },
        { status: 500 }
      )
    }

    const holdResult = result?.[0]
    
    if (!holdResult?.success) {
      return NextResponse.json(
        { 
          error: 'Failed to create holds',
          details: holdResult?.errors || []
        },
        { status: 400 }
      )
    }

    // Create notification for admin about new holds
    if (holdResult.holdsCreated > 0) {
      await safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "Notification" (
            id, "userId", type, title, message, "relatedId", "relatedType"
          ) 
          SELECT 
            'notif_' || substr(md5(random()::text), 1, 16),
            u.id,
            'inventory_hold_created',
            'New Inventory Holds Created',
            $1 || ' created ' || $2 || ' inventory holds for order ' || $3,
            $4,
            'order'
          FROM public."User" u
          WHERE u."organizationId" = $5
            AND u.role IN ('admin', 'master')
        `,
        [
          session.userName || 'User',
          holdResult.holdsCreated,
          orderId,
          orderId,
          session.organizationId
        ]
      )
    }

    return NextResponse.json({ 
      success: true,
      holdsCreated: holdResult.holdsCreated,
      errors: holdResult.errors || [],
      message: `Successfully created ${holdResult.holdsCreated} inventory holds`
    })
  } catch (error) {
    console.error('Inventory hold creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory holds' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/holds - Approve or reject holds
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can approve/reject holds
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { holdId, action, reason } = body

    if (!holdId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    // Get current hold details
    const { data: holdData } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT ir.*, ei."episodeId", ei."showId"
        FROM "InventoryReservation" ir
        JOIN "EpisodeInventory" ei ON ei."episodeId" = ir."episodeId"
        WHERE ir.id = $1
      `,
      [holdId]
    )

    if (!holdData || holdData.length === 0) {
      return NextResponse.json(
        { error: 'Hold not found' },
        { status: 404 }
      )
    }

    const hold = holdData[0]

    if (action === 'approve') {
      // Approve the hold
      await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "InventoryReservation"
          SET status = 'confirmed',
              "approvalStatus" = 'approved',
              "approvedBy" = $1,
              "approvedAt" = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [session.userId, holdId]
      )

      // Update inventory from reserved to booked
      const updateField = `"${hold.placementType.replace('-', '')}Booked"`
      const reservedField = `"${hold.placementType.replace('-', '')}Reserved"`
      
      await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "EpisodeInventory"
          SET ${updateField} = ${updateField} + 1,
              ${reservedField} = ${reservedField} - 1
          WHERE "episodeId" = $1
        `,
        [hold.episodeId]
      )

      // Update order status if all holds are approved
      if (hold.orderId) {
        const { data: pendingHolds } = await safeQuerySchema(
          session.organizationSlug,
          `
            SELECT COUNT(*) as count
            FROM "InventoryReservation"
            WHERE "orderId" = $1 AND "approvalStatus" = 'pending'
          `,
          [hold.orderId]
        )

        if (pendingHolds?.[0]?.count === 0) {
          await safeQuerySchema(
            session.organizationSlug,
            `
              UPDATE "Order"
              SET status = 'approved',
                  "approvedBy" = $1,
                  "approvedAt" = CURRENT_TIMESTAMP
              WHERE id = $2
            `,
            [session.userId, hold.orderId]
          )
        }
      }
    } else {
      // Reject the hold
      await safeQuerySchema(
        session.organizationSlug,
        `
          UPDATE "InventoryReservation"
          SET status = 'released',
              "approvalStatus" = 'rejected',
              "rejectionReason" = $1,
              "approvedBy" = $2,
              "approvedAt" = CURRENT_TIMESTAMP
          WHERE id = $3
        `,
        [reason || 'Rejected by admin', session.userId, holdId]
      )

      // Release the inventory
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

    // Log the change
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryChangeLog" (
          id, "episodeId", "changeType", "previousValue", "newValue", 
          "affectedOrders", "changedBy"
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7
        )
      `,
      [
        'icl_' + Math.random().toString(36).substr(2, 16),
        hold.episodeId,
        action === 'approve' ? 'hold_approved' : 'hold_rejected',
        JSON.stringify({ holdId, status: hold.status }),
        JSON.stringify({ holdId, status: action === 'approve' ? 'confirmed' : 'released', reason }),
        hold.orderId ? [hold.orderId] : [],
        session.userId
      ]
    )

    // Send notification to the person who created the hold
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "Notification" (
          id, "userId", type, title, message, "relatedId", "relatedType"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
      `,
      [
        'notif_' + Math.random().toString(36).substr(2, 16),
        hold.reservedBy,
        action === 'approve' ? 'hold_approved' : 'hold_rejected',
        action === 'approve' ? 'Inventory Hold Approved' : 'Inventory Hold Rejected',
        action === 'approve' 
          ? `Your inventory hold for ${hold.episode_title} has been approved`
          : `Your inventory hold for ${hold.episode_title} has been rejected. Reason: ${reason || 'Not specified'}`,
        holdId,
        'hold'
      ]
    )

    return NextResponse.json({ 
      success: true,
      message: `Hold ${action}ed successfully`
    })
  } catch (error) {
    console.error('Inventory hold update error:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory hold' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/holds - Release expired holds
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Release all expired holds
    const { data: expiredHolds } = await safeQuerySchema(
      session.organizationSlug,
      `
        UPDATE "InventoryReservation"
        SET status = 'expired'
        WHERE status = 'reserved'
          AND "expiresAt" < CURRENT_TIMESTAMP
        RETURNING id, "episodeId", "placementType"
      `,
      []
    )

    if (expiredHolds && expiredHolds.length > 0) {
      // Update inventory availability for each expired hold
      for (const hold of expiredHolds) {
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

      // Log the changes
      for (const hold of expiredHolds) {
        await safeQuerySchema(
          session.organizationSlug,
          `
            INSERT INTO "InventoryChangeLog" (
              id, "episodeId", "changeType", "changedBy"
            ) VALUES (
              $1, $2, 'hold_expired', 'system'
            )
          `,
          [
            'icl_' + Math.random().toString(36).substr(2, 16),
            hold.episodeId
          ]
        )
      }
    }

    return NextResponse.json({ 
      success: true,
      releasedCount: expiredHolds?.length || 0,
      message: `Released ${expiredHolds?.length || 0} expired holds`
    })
  } catch (error) {
    console.error('Inventory hold cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to clean up expired holds' },
      { status: 500 }
    )
  }
}