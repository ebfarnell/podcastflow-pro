import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { workflowAutomation } from '@/lib/workflow/automation-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Define valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  'draft': ['pending_approval', 'cancelled'],
  'pending_approval': ['approved', 'draft', 'cancelled'],
  'approved': ['booked', 'cancelled'],
  'booked': ['confirmed', 'cancelled'],
  'confirmed': [], // Terminal state
  'cancelled': [] // Terminal state
}

// Define required permissions for each transition
const PERMISSION_REQUIREMENTS: Record<string, string[]> = {
  'pending_approval': ['master', 'admin', 'sales'], // Anyone can submit for approval
  'approved': ['master', 'admin'], // Only admins can approve
  'booked': ['master', 'admin', 'sales'], // Sales can book approved orders
  'confirmed': ['master', 'admin'], // Only admins can confirm
  'cancelled': ['master', 'admin'], // Only admins can cancel
  'draft': ['master', 'admin'] // Only admins can return to draft (rejection)
}

export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        '/api/orders/workflow',
        request
      )
    }

    const { searchParams } = new URL(request.url)
    const organizationId = user.organizationId

    // Get workflow statistics using schema-aware query
    const workflowStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM("netAmount") as total_amount
      FROM "Order"
      GROUP BY status
    `
    const workflowStatsRaw = await querySchema<any>(orgSlug, workflowStatsQuery, [])
    
    const workflowStats = workflowStatsRaw.map(stat => ({
      status: stat.status,
      _count: { status: parseInt(stat.count) },
      _sum: { netAmount: parseFloat(stat.total_amount || '0') }
    }))

    // Get recent status changes using schema-aware query
    const recentChangesQuery = `
      SELECT 
        osh.*,
        o.id as order_id, o."orderNumber" as order_number,
        c.id as campaign_id, c.name as campaign_name,
        u.id as user_id, u.name as user_name, u.email as user_email
      FROM "OrderStatusHistory" osh
      INNER JOIN "Order" o ON o.id = osh."orderId"
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN public."User" u ON u.id = osh."changedBy"
      ORDER BY osh."changedAt" DESC
      LIMIT 50
    `
    const recentChangesRaw = await querySchema<any>(orgSlug, recentChangesQuery, [])
    
    // Transform to match expected format
    const recentChanges = recentChangesRaw.map(change => ({
      ...change,
      order: {
        id: change.order_id,
        orderNumber: change.order_number,
        campaign: change.campaign_id ? {
          name: change.campaign_name
        } : null
      },
      changedBy: change.user_id ? {
        name: change.user_name,
        email: change.user_email
      } : null
    }))

    // Get orders by status for workflow view using schema-aware query
    const ordersByStatusQuery = `
      SELECT 
        o.*,
        c.id as campaign_id, c.name as campaign_name,
        a.id as advertiser_id, a.name as advertiser_name,
        (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o.id) as order_items_count
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      WHERE o.status IN ('draft', 'pending_approval', 'approved', 'booked')
      ORDER BY o."createdAt" DESC
    `
    const ordersByStatusRaw = await querySchema<any>(orgSlug, ordersByStatusQuery, [])
    
    // Transform to match expected format
    const ordersByStatus = ordersByStatusRaw.map(order => ({
      ...order,
      campaign: order.campaign_id ? {
        name: order.campaign_name
      } : null,
      advertiser: order.advertiser_id ? {
        name: order.advertiser_name
      } : null,
      _count: {
        orderItems: parseInt(order.order_items_count)
      }
    }))

    // Calculate workflow metrics
    const metrics = {
      averageApprovalTime: 0, // Calculate from order history
      conversionRate: {
        draftToApproved: 0,
        approvedToBooked: 0,
        bookedToConfirmed: 0
      },
      bottlenecks: [] as string[]
    }

    // Calculate average time in each status (simplified for now)
    const statusTimes: any[] = []

    return NextResponse.json({
      workflowStats: workflowStats.reduce((acc, stat) => {
        acc[stat.status] = {
          count: stat._count.status,
          totalValue: stat._sum.netAmount || 0
        }
        return acc
      }, {} as Record<string, any>),
      recentChanges,
      ordersByStatus: ordersByStatus.reduce((acc, order) => {
        if (!acc[order.status]) {
          acc[order.status] = []
        }
        acc[order.status].push(order)
        return acc
      }, {} as Record<string, any[]>),
      metrics,
      statusTimes,
      statusTransitions: STATUS_TRANSITIONS,
      permissionRequirements: PERMISSION_REQUIREMENTS
    })
  } catch (error) {
    console.error('Error fetching workflow data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, toStatus, notes, bulkOrderIds } = body

    // Handle bulk status changes
    if (bulkOrderIds && Array.isArray(bulkOrderIds)) {
      return handleBulkStatusChange(bulkOrderIds, toStatus, notes, user)
    }

    // Handle single order status change
    if (!orderId || !toStatus) {
      return NextResponse.json({ 
        error: 'Order ID and target status are required' 
      }, { status: 400 })
    }

    return handleSingleStatusChange(orderId, toStatus, notes, user)
  } catch (error) {
    console.error('Error updating order status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleSingleStatusChange(orderId: string, toStatus: string, notes: string, user: any) {
  // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
  const orgSlug = await getUserOrgSlug(user.id)
  if (!orgSlug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  
  // Fetch current order using schema-aware query
  const orderQuery = `
    SELECT o.*
    FROM "Order" o
    WHERE o.id = $1
  `
  const orderRaw = await querySchema<any>(orgSlug, orderQuery, [orderId])
  
  if (orderRaw.length === 0) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  
  const order = orderRaw[0]
  
  // Fetch order items
  const orderItemsQuery = `SELECT * FROM "OrderItem" WHERE "orderId" = $1`
  const orderItems = await querySchema<any>(orgSlug, orderItemsQuery, [orderId])
  order.orderItems = orderItems

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Validate status transition
  const validTransitions = STATUS_TRANSITIONS[order.status] || []
  if (!validTransitions.includes(toStatus)) {
    return NextResponse.json({ 
      error: `Invalid status transition from ${order.status} to ${toStatus}` 
    }, { status: 400 })
  }

  // Check permissions
  const requiredRoles = PERMISSION_REQUIREMENTS[toStatus] || []
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return NextResponse.json({ 
      error: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}` 
    }, { status: 403 })
  }

  // Record status change in history using schema-aware query
  const historyQuery = `
    INSERT INTO "OrderStatusHistory" (
      "orderId", "fromStatus", "toStatus", "changedBy", "changedAt", notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `
  await querySchema<any>(orgSlug, historyQuery, [
    order.id, order.status, toStatus, user.id, new Date(), notes
  ])

  // Prepare update data based on new status
  const updateData: any = { status: toStatus }
  
  if (toStatus === 'pending_approval') {
    updateData.submittedAt = new Date()
  } else if (toStatus === 'approved') {
    updateData.approvedAt = new Date()
    updateData.approvedBy = user.id
  } else if (toStatus === 'booked') {
    updateData.bookedAt = new Date()
  } else if (toStatus === 'confirmed') {
    updateData.confirmedAt = new Date()
  } else if (toStatus === 'cancelled') {
    updateData.cancelledAt = new Date()
  }

  // Handle inventory updates
  if (toStatus === 'booked' && order.status === 'approved') {
    // Move from reserved to booked
    const inventoryUpdates = order.orderItems.map(item =>
      querySchema<any>(orgSlug, `
        UPDATE "Inventory" 
        SET "reservedSpots" = "reservedSpots" - 1,
            "bookedSpots" = "bookedSpots" + 1
        WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
      `, [item.showId, item.airDate, item.placementType])
    )
    await Promise.all(inventoryUpdates)
  } else if (toStatus === 'cancelled') {
    // Release inventory
    const currentStatus = order.status
    const inventoryUpdates = order.orderItems.map(item => {
      const updateData: any = {
        availableSpots: { increment: 1 }
      }
      
      if (currentStatus === 'booked' || currentStatus === 'confirmed') {
        updateData.bookedSpots = { decrement: 1 }
      } else {
        updateData.reservedSpots = { decrement: 1 }
      }

      const inventoryUpdateQuery = currentStatus === 'booked' || currentStatus === 'confirmed' ? `
        UPDATE "Inventory" 
        SET "availableSpots" = "availableSpots" + 1,
            "bookedSpots" = "bookedSpots" - 1
        WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
      ` : `
        UPDATE "Inventory" 
        SET "availableSpots" = "availableSpots" + 1,
            "reservedSpots" = "reservedSpots" - 1
        WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
      `
      return querySchema<any>(orgSlug, inventoryUpdateQuery, [item.showId, item.airDate, item.placementType])
    })
    await Promise.all(inventoryUpdates)
  }

  // Update order using schema-aware query
  const updateColumns = ['status = $2']
  const updateParams = [orderId, toStatus]
  let paramCount = 3
  
  if (toStatus === 'pending_approval') {
    updateColumns.push(`"submittedAt" = $${paramCount++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'approved') {
    updateColumns.push(`"approvedAt" = $${paramCount++}`, `"approvedBy" = $${paramCount++}`)
    updateParams.push(new Date(), user.id)
  } else if (toStatus === 'booked') {
    updateColumns.push(`"bookedAt" = $${paramCount++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'confirmed') {
    updateColumns.push(`"confirmedAt" = $${paramCount++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'cancelled') {
    updateColumns.push(`"cancelledAt" = $${paramCount++}`)
    updateParams.push(new Date())
  }
  
  const updateOrderQuery = `
    UPDATE "Order" 
    SET ${updateColumns.join(', ')}
    WHERE id = $1
    RETURNING *
  `
  const updatedOrderRaw = await querySchema<any>(orgSlug, updateOrderQuery, updateParams)

  // Trigger workflow automations
  try {
    await workflowAutomation.executeAutomations({
      userId: user.id,
      orgSlug,
      organizationId: user.organizationId,
      entityId: orderId,
      entityType: 'order',
      previousState: order.status,
      newState: toStatus,
      metadata: {
        orderNumber: order.orderNumber,
        totalAmount: order.netAmount,
        advertiserId: order.advertiserId,
        campaignId: order.campaignId
      }
    })
  } catch (automationError) {
    console.error('Workflow automation error:', automationError)
    // Don't fail the main workflow if automation fails
  }
  
  // Fetch full order details
  const fullOrderQuery = `
    SELECT 
      o.*,
      c.id as campaign_id, c.name as campaign_name,
      a.id as advertiser_id, a.name as advertiser_name
    FROM "Order" o
    LEFT JOIN "Campaign" c ON c.id = o."campaignId"
    LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
    WHERE o.id = $1
  `
  const fullOrderRaw = await querySchema<any>(orgSlug, fullOrderQuery, [orderId])
  const updatedOrder = fullOrderRaw[0]
  
  // Add order items
  const orderItemsWithShowQuery = `
    SELECT 
      oi.*,
      s.id as show_id, s.name as show_name
    FROM "OrderItem" oi
    LEFT JOIN "Show" s ON s.id = oi."showId"
    WHERE oi."orderId" = $1
  `
  const orderItemsWithShow = await querySchema<any>(orgSlug, orderItemsWithShowQuery, [orderId])
  
  updatedOrder.campaign = updatedOrder.campaign_id ? {
    id: updatedOrder.campaign_id,
    name: updatedOrder.campaign_name
  } : null
  updatedOrder.advertiser = updatedOrder.advertiser_id ? {
    id: updatedOrder.advertiser_id,
    name: updatedOrder.advertiser_name
  } : null
  updatedOrder.orderItems = orderItemsWithShow.map(item => ({
    ...item,
    show: item.show_id ? {
      id: item.show_id,
      name: item.show_name
    } : null
  }))

  return NextResponse.json({
    message: `Order status updated from ${order.status} to ${toStatus}`,
    order: updatedOrder,
    previousStatus: order.status,
    newStatus: toStatus
  })
}

async function handleBulkStatusChange(orderIds: string[], toStatus: string, notes: string, user: any) {
  // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
  const orgSlug = await getUserOrgSlug(user.id)
  if (!orgSlug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  
  // Fetch all orders with items in a single query to avoid N+1
  const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(', ')
  const ordersWithItemsQuery = `
    SELECT 
      o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'orderId', oi."orderId",
            'showId', oi."showId",
            'episodeId', oi."episodeId",
            'placementType', oi."placementType",
            'duration', oi.duration,
            'rate', oi.rate,
            'actualRate', oi."actualRate",
            'airDate', oi."airDate",
            'status', oi.status,
            'createdAt', oi."createdAt",
            'updatedAt', oi."updatedAt"
          )
        ) FILTER (WHERE oi.id IS NOT NULL), 
        '[]'::json
      ) as "orderItems"
    FROM "Order" o
    LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
    WHERE o.id IN (${placeholders})
    GROUP BY o.id
  `
  const orders = await querySchema<any>(orgSlug, ordersWithItemsQuery, orderIds)

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ 
      error: 'Some orders not found or inaccessible' 
    }, { status: 404 })
  }

  // Validate all transitions
  const invalidTransitions = orders.filter(order => {
    const validTransitions = STATUS_TRANSITIONS[order.status] || []
    return !validTransitions.includes(toStatus)
  })

  if (invalidTransitions.length > 0) {
    return NextResponse.json({ 
      error: `Invalid transitions detected for orders: ${invalidTransitions.map(o => o.orderNumber).join(', ')}` 
    }, { status: 400 })
  }

  // Check permissions
  const requiredRoles = PERMISSION_REQUIREMENTS[toStatus] || []
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return NextResponse.json({ 
      error: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}` 
    }, { status: 403 })
  }

  // Process all status changes
  const results = []
  
  for (const order of orders) {
    // Record status change using schema-aware query
    const historyQuery = `
      INSERT INTO "OrderStatusHistory" (
        "orderId", "fromStatus", "toStatus", "changedBy", "changedAt", notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `
    await querySchema<any>(orgSlug, historyQuery, [
      order.id, order.status, toStatus, user.id, new Date(), `${notes} (Bulk operation)`
    ])

    // Handle inventory updates (same logic as single order)
    if (toStatus === 'booked' && order.status === 'approved') {
      const inventoryUpdates = order.orderItems.map(item =>
        querySchema<any>(orgSlug, `
          UPDATE "Inventory" 
          SET "reservedSpots" = "reservedSpots" - 1,
              "bookedSpots" = "bookedSpots" + 1
          WHERE "showId" = $1 AND date = $2 AND "placementType" = $3
        `, [item.showId, item.airDate, item.placementType])
      )
      await Promise.all(inventoryUpdates)
    }

    results.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus
    })
  }

  // Bulk update orders
  const updateData: any = { status: toStatus }
  
  if (toStatus === 'pending_approval') {
    updateData.submittedAt = new Date()
  } else if (toStatus === 'approved') {
    updateData.approvedAt = new Date()
    updateData.approvedBy = user.id
  } else if (toStatus === 'booked') {
    updateData.bookedAt = new Date()
  } else if (toStatus === 'confirmed') {
    updateData.confirmedAt = new Date()
  } else if (toStatus === 'cancelled') {
    updateData.cancelledAt = new Date()
  }

  // Bulk update orders using schema-aware query
  const updateColumns = ['status = $1']
  const updateParams: any[] = [toStatus]
  let paramOffset = 2
  
  if (toStatus === 'pending_approval') {
    updateColumns.push(`"submittedAt" = $${paramOffset++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'approved') {
    updateColumns.push(`"approvedAt" = $${paramOffset++}`, `"approvedBy" = $${paramOffset++}`)
    updateParams.push(new Date(), user.id)
  } else if (toStatus === 'booked') {
    updateColumns.push(`"bookedAt" = $${paramOffset++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'confirmed') {
    updateColumns.push(`"confirmedAt" = $${paramOffset++}`)
    updateParams.push(new Date())
  } else if (toStatus === 'cancelled') {
    updateColumns.push(`"cancelledAt" = $${paramOffset++}`)
    updateParams.push(new Date())
  }
  
  const orderPlaceholders = orderIds.map((_, i) => `$${paramOffset + i}`).join(', ')
  updateParams.push(...orderIds)
  
  const bulkUpdateQuery = `
    UPDATE "Order" 
    SET ${updateColumns.join(', ')}
    WHERE id IN (${orderPlaceholders})
  `
  await querySchema<any>(orgSlug, bulkUpdateQuery, updateParams)

  return NextResponse.json({
    message: `${orders.length} orders updated to ${toStatus}`,
    results,
    processedCount: orders.length
  })
}
