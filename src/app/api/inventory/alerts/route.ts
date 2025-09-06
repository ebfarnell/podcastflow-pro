import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { hasPermission } from '@/types/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/inventory/alerts - Get inventory alerts
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.role, 'orders:approve')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity')
    const alertType = searchParams.get('type')

    let query = `
      SELECT 
        ia.id,
        ia."alertType",
        ia.severity,
        ia."episodeId",
        ia."showId",
        ia."affectedOrders",
        ia."affectedSchedules",
        ia.details,
        ia.status,
        ia."createdAt",
        ia."acknowledgedBy",
        ia."acknowledgedAt",
        ia."resolvedBy",
        ia."resolvedAt",
        ia.resolution,
        e.title as episode_title,
        e."airDate",
        s.name as show_name,
        u1.name as acknowledged_by_name,
        u2.name as resolved_by_name
      FROM "InventoryAlert" ia
      LEFT JOIN "Episode" e ON e.id = ia."episodeId"
      LEFT JOIN "Show" s ON s.id = COALESCE(ia."showId", e."showId")
      LEFT JOIN public."User" u1 ON u1.id = ia."acknowledgedBy"
      LEFT JOIN public."User" u2 ON u2.id = ia."resolvedBy"
      WHERE 1=1
    `

    const params: any[] = []

    if (status !== 'all') {
      query += ` AND ia.status = $${params.length + 1}`
      params.push(status)
    }

    if (severity) {
      query += ` AND ia.severity = $${params.length + 1}`
      params.push(severity)
    }

    if (alertType) {
      query += ` AND ia."alertType" = $${params.length + 1}`
      params.push(alertType)
    }

    query += ` ORDER BY 
      CASE ia.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      ia."createdAt" DESC`

    const { data: alerts, error } = await safeQuerySchema(
      session.organizationSlug,
      query,
      params
    )

    if (error) {
      console.error('Failed to fetch inventory alerts:', error)
      return NextResponse.json({ alerts: [] })
    }

    // Get summary counts
    const { data: summary } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE status = 'active' AND severity = 'high') as high_count,
          COUNT(*) FILTER (WHERE "alertType" = 'overbooking') as overbooking_count,
          COUNT(*) FILTER (WHERE "alertType" = 'deletion_impact') as deletion_count
        FROM "InventoryAlert"
      `,
      []
    )

    return NextResponse.json({ 
      alerts: alerts || [],
      summary: summary?.[0] || {
        active_count: 0,
        critical_count: 0,
        high_count: 0,
        overbooking_count: 0,
        deletion_count: 0
      }
    })
  } catch (error) {
    console.error('Inventory alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory alerts' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/alerts - Create inventory alert (called by system)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      alertType, 
      severity, 
      episodeId, 
      showId, 
      affectedOrders, 
      affectedSchedules, 
      details 
    } = body

    if (!alertType || !severity || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the alert
    const { data: alert, error } = await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryAlert" (
          id, "alertType", severity, "episodeId", "showId",
          "affectedOrders", "affectedSchedules", details, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'active'
        )
        RETURNING id
      `,
      [
        'ia_' + Math.random().toString(36).substr(2, 16),
        alertType,
        severity,
        episodeId || null,
        showId || null,
        affectedOrders || [],
        affectedSchedules || [],
        JSON.stringify(details)
      ]
    )

    if (error) {
      console.error('Failed to create inventory alert:', error)
      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      )
    }

    // Send notifications to admins and affected sellers
    const notificationTargets = new Set<string>()

    // Add all admins
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

    admins?.forEach((admin: any) => notificationTargets.add(admin.id))

    // Add sellers associated with affected orders
    if (affectedOrders && affectedOrders.length > 0) {
      const { data: sellers } = await safeQuerySchema(
        session.organizationSlug,
        `
          SELECT DISTINCT o."submittedBy"
          FROM "Order" o
          WHERE o.id = ANY($1)
            AND o."submittedBy" IS NOT NULL
        `,
        [affectedOrders]
      )

      sellers?.forEach((seller: any) => notificationTargets.add(seller.submittedBy))
    }

    // Create notifications
    const notificationPromises = Array.from(notificationTargets).map(userId =>
      safeQuerySchema(
        session.organizationSlug,
        `
          INSERT INTO "Notification" (
            id, "userId", type, title, message, 
            "relatedId", "relatedType", priority
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
        `,
        [
          'notif_' + Math.random().toString(36).substr(2, 16),
          userId,
          'inventory_alert',
          alertType === 'overbooking' ? 'Inventory Overbooking Alert' : 'Inventory Update Alert',
          details.message || 'An inventory alert requires your attention',
          alert?.[0]?.id,
          'alert',
          severity === 'critical' ? 'high' : 'medium'
        ]
      )
    )

    await Promise.all(notificationPromises)

    return NextResponse.json({ 
      success: true,
      alertId: alert?.[0]?.id,
      notificationsSent: notificationTargets.size
    })
  } catch (error) {
    console.error('Inventory alert creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory alert' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/alerts/:id - Acknowledge or resolve alert
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.role, 'orders:approve')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { alertId, action, resolution } = body

    if (!alertId || !['acknowledge', 'resolve'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    let updateQuery = ''
    let params: any[] = []

    if (action === 'acknowledge') {
      updateQuery = `
        UPDATE "InventoryAlert"
        SET status = 'acknowledged',
            "acknowledgedBy" = $1,
            "acknowledgedAt" = CURRENT_TIMESTAMP
        WHERE id = $2 AND status = 'active'
      `
      params = [session.userId, alertId]
    } else {
      updateQuery = `
        UPDATE "InventoryAlert"
        SET status = 'resolved',
            "resolvedBy" = $1,
            "resolvedAt" = CURRENT_TIMESTAMP,
            resolution = $2
        WHERE id = $3
      `
      params = [session.userId, resolution || 'Resolved by admin', alertId]
    }

    const { error } = await safeQuerySchema(
      session.organizationSlug,
      updateQuery,
      params
    )

    if (error) {
      console.error(`Failed to ${action} inventory alert:`, error)
      return NextResponse.json(
        { error: `Failed to ${action} alert` },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: `Alert ${action}d successfully`
    })
  } catch (error) {
    console.error('Inventory alert update error:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory alert' },
      { status: 500 }
    )
  }
}

// Function to check for overbooking (called internally)
export async function checkForOverbooking(
  orgSlug: string,
  episodeId: string,
  placementType: string
): Promise<boolean> {
  const { data: inventory } = await safeQuerySchema(
    orgSlug,
    `
      SELECT 
        "${placementType.replace('-', '')}Slots" as slots,
        "${placementType.replace('-', '')}Available" as available,
        "${placementType.replace('-', '')}Reserved" as reserved,
        "${placementType.replace('-', '')}Booked" as booked
      FROM "EpisodeInventory"
      WHERE "episodeId" = $1
    `,
    [episodeId]
  )

  if (!inventory || inventory.length === 0) return false

  const inv = inventory[0]
  const totalUsed = (inv.reserved || 0) + (inv.booked || 0)
  
  if (totalUsed > inv.slots) {
    // Create overbooking alert
    const { data: affectedOrders } = await safeQuerySchema(
      orgSlug,
      `
        SELECT DISTINCT ir."orderId"
        FROM "InventoryReservation" ir
        WHERE ir."episodeId" = $1
          AND ir."placementType" = $2
          AND ir.status IN ('reserved', 'confirmed')
          AND ir."orderId" IS NOT NULL
      `,
      [episodeId, placementType]
    )

    await safeQuerySchema(
      orgSlug,
      `
        INSERT INTO "InventoryAlert" (
          id, "alertType", severity, "episodeId", 
          "affectedOrders", details
        ) VALUES (
          $1, 'overbooking', 'critical', $2, $3, $4::jsonb
        )
      `,
      [
        'ia_' + Math.random().toString(36).substr(2, 16),
        episodeId,
        affectedOrders?.map((o: any) => o.orderId) || [],
        JSON.stringify({
          placementType,
          totalSlots: inv.slots,
          totalUsed,
          overbookedBy: totalUsed - inv.slots,
          message: `Episode is overbooked by ${totalUsed - inv.slots} ${placementType} slots`
        })
      ]
    )

    return true
  }

  return false
}