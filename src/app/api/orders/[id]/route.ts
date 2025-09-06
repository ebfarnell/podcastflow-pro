import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { getUserOrgSlug, querySchema, SchemaModels } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    const user = request.user!

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get order with related data
    const orderQuery = `
      SELECT 
        o.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name,
        creator.id as creator_id,
        creator.name as creator_name,
        creator.email as creator_email,
        approver.id as approver_id,
        approver.name as approver_name,
        approver.email as approver_email,
        (SELECT COUNT(*) FROM "OrderItem" WHERE "orderId" = o.id) as item_count,
        (SELECT COUNT(*) FROM "Invoice" WHERE "orderId" = o.id) as invoice_count
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      LEFT JOIN "User" creator ON creator.id = o."createdBy"
      LEFT JOIN "User" approver ON approver.id = o."approvedBy"
      WHERE o.id = $1
    `
    const orders = await querySchema(orgSlug, orderQuery, [id])
    
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    const order = orders[0]
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/orders/${id}`,
        request
      )
    }
    
    // Get order items
    const itemsQuery = `
      SELECT 
        oi.*,
        s.name as show_name,
        e.title as episode_title
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      LEFT JOIN "Episode" e ON e.id = oi."episodeId"
      WHERE oi."orderId" = $1
      ORDER BY oi."airDate" ASC
    `
    const orderItems = await querySchema(orgSlug, itemsQuery, [id])
    
    // Get invoices
    const invoicesQuery = `
      SELECT * FROM "Invoice"
      WHERE "orderId" = $1
      ORDER BY "createdAt" DESC
    `
    const invoices = await querySchema(orgSlug, invoicesQuery, [id])
    
    const formattedOrder = {
      ...order,
      campaign: order.campaign_name ? {
        id: order.campaignId,
        name: order.campaign_name
      } : null,
      advertiser: order.advertiser_name ? {
        id: order.advertiserId,
        name: order.advertiser_name
      } : null,
      agency: order.agency_name ? {
        id: order.agencyId,
        name: order.agency_name
      } : null,
      creator: order.creator_id ? {
        id: order.creator_id,
        name: order.creator_name,
        email: order.creator_email
      } : null,
      approver: order.approver_id ? {
        id: order.approver_id,
        name: order.approver_name,
        email: order.approver_email
      } : null,
      orderItems: orderItems.map(item => ({
        ...item,
        show: item.show_name ? {
          id: item.showId,
          name: item.show_name
        } : null,
        episode: item.episode_title ? {
          id: item.episodeId,
          title: item.episode_title
        } : null
      })),
      invoices,
      _count: {
        orderItems: parseInt(order.item_count) || 0,
        invoices: parseInt(order.invoice_count) || 0
      }
    }

    return NextResponse.json(formattedOrder)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    const user = request.user!

    const body = await request.json()
    const { status, discountAmount, notes, orderItems } = body

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify order exists in organization schema
    const existingQuery = `
      SELECT o.*, 
        array_agg(
          json_build_object(
            'id', oi.id,
            'showId', oi."showId",
            'airDate', oi."airDate",
            'placementType', oi."placementType"
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as "orderItems"
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      WHERE o.id = $1
      GROUP BY o.id
    `
    const existingOrders = await querySchema(orgSlug, existingQuery, [id])
    
    if (!existingOrders || existingOrders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    const existingOrder = existingOrders[0]

    // Prepare update data
    const updateData: any = {}
    
    if (notes !== undefined) updateData.notes = notes
    if (discountAmount !== undefined) updateData.discountAmount = discountAmount

    // Handle status transitions
    if (status && status !== existingOrder.status) {
      updateData.status = status

      if (status === 'pending_approval') {
        updateData.submittedAt = new Date()
      } else if (status === 'approved') {
        updateData.approvedAt = new Date()
        updateData.approvedBy = user.id
      } else if (status === 'booked') {
        updateData.bookedAt = new Date()
        
        // Update inventory from reserved to booked
        if (existingOrder.orderItems) {
          for (const item of existingOrder.orderItems) {
            const updateInventoryQuery = `
              UPDATE "Inventory"
              SET 
                "reservedSpots" = "reservedSpots" - 1,
                "bookedSpots" = "bookedSpots" + 1,
                "updatedAt" = NOW()
              WHERE 
                "showId" = $1 AND 
                date = $2::date AND 
                "placementType" = $3
            `
            
            await querySchema(orgSlug, updateInventoryQuery, [
              item.showId,
              new Date(item.airDate).toISOString().split('T')[0],
              item.placementType
            ])
          }
        }
      } else if (status === 'confirmed') {
        updateData.confirmedAt = new Date()
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date()
        
        // Release inventory
        if (existingOrder.orderItems) {
          for (const item of existingOrder.orderItems) {
            let updateInventoryQuery: string
            if (existingOrder.status === 'booked' || existingOrder.status === 'confirmed') {
              updateInventoryQuery = `
                UPDATE "Inventory"
                SET 
                  "availableSpots" = "availableSpots" + 1,
                  "bookedSpots" = "bookedSpots" - 1,
                  "updatedAt" = NOW()
                WHERE 
                  "showId" = $1 AND 
                  date = $2::date AND 
                  "placementType" = $3
              `
            } else {
              updateInventoryQuery = `
                UPDATE "Inventory"
                SET 
                  "availableSpots" = "availableSpots" + 1,
                  "reservedSpots" = "reservedSpots" - 1,
                  "updatedAt" = NOW()
                WHERE 
                  "showId" = $1 AND 
                  date = $2::date AND 
                  "placementType" = $3
              `
            }
            
            await querySchema(orgSlug, updateInventoryQuery, [
              item.showId,
              new Date(item.airDate).toISOString().split('T')[0],
              item.placementType
            ])
          }
        }
      }
    }

    // Update order items if provided
    if (orderItems && Array.isArray(orderItems)) {
      // Delete existing items
      const deleteItemsQuery = `DELETE FROM "OrderItem" WHERE "orderId" = $1`
      await querySchema(orgSlug, deleteItemsQuery, [id])

      // Create new items
      for (const item of orderItems) {
        const itemId = `oi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const createItemQuery = `
          INSERT INTO "OrderItem" (
            id, "orderId", "showId", "episodeId", "placementType",
            "spotNumber", "airDate", length, "isLiveRead", rate,
            "actualRate", "adTitle", "adScript", "adTalkingPoints",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
          )
        `
        
        await querySchema(orgSlug, createItemQuery, [
          itemId,
          id,
          item.showId,
          item.episodeId || null,
          item.placementType,
          item.spotNumber || 1,
          new Date(item.airDate).toISOString(),
          item.length,
          item.isLiveRead || false,
          item.rate,
          item.actualRate || item.rate,
          item.adTitle || null,
          item.adScript || null,
          JSON.stringify(item.adTalkingPoints || [])
        ])
      }

      // Recalculate totals
      const totalAmount = orderItems.reduce((sum: number, item: any) => sum + item.rate, 0)
      updateData.totalAmount = totalAmount
      updateData.netAmount = totalAmount - (discountAmount || existingOrder.discountAmount || 0)
    } else if (discountAmount !== undefined) {
      // Just update net amount if only discount changed
      updateData.netAmount = existingOrder.totalAmount - discountAmount
    }

    // Build update query
    let updateFields: string[] = []
    let updateParams: any[] = []
    let paramIndex = 1

    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'orderItems') {
        updateFields.push(`"${key}" = $${paramIndex}`)
        updateParams.push(value)
        paramIndex++
      }
    })
    
    updateFields.push(`"updatedAt" = NOW()`)
    updateParams.push(id)

    const updateQuery = `
      UPDATE "Order"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    await querySchema(orgSlug, updateQuery, updateParams)
    
    // Get updated order with all data
    const getUpdatedQuery = `
      SELECT 
        o.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      WHERE o.id = $1
    `
    const updatedOrders = await querySchema(orgSlug, getUpdatedQuery, [id])
    const updatedOrder = updatedOrders[0]
    
    // Get order items
    const itemsQuery = `
      SELECT oi.*, s.name as show_name, e.title as episode_title
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      LEFT JOIN "Episode" e ON e.id = oi."episodeId"
      WHERE oi."orderId" = $1
    `
    const items = await querySchema(orgSlug, itemsQuery, [id])
    
    const formattedOrder = {
      ...updatedOrder,
      campaign: updatedOrder.campaign_name ? {
        id: updatedOrder.campaignId,
        name: updatedOrder.campaign_name
      } : null,
      advertiser: updatedOrder.advertiser_name ? {
        id: updatedOrder.advertiserId,
        name: updatedOrder.advertiser_name
      } : null,
      agency: updatedOrder.agency_name ? {
        id: updatedOrder.agencyId,
        name: updatedOrder.agency_name
      } : null,
      orderItems: items.map(item => ({
        ...item,
        show: item.show_name ? {
          id: item.showId,
          name: item.show_name
        } : null,
        episode: item.episode_title ? {
          id: item.episodeId,
          title: item.episode_title
        } : null
      }))
    }

    return NextResponse.json(formattedOrder)
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    const user = request.user!

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify order exists and can be deleted
    const orderQuery = `
      SELECT o.*,
        array_agg(
          json_build_object(
            'id', oi.id,
            'showId', oi."showId",
            'airDate', oi."airDate",
            'placementType', oi."placementType"
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as "orderItems",
        (SELECT COUNT(*) FROM "Invoice" WHERE "orderId" = o.id) as invoice_count
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      WHERE o.id = $1
      GROUP BY o.id
    `
    const orders = await querySchema(orgSlug, orderQuery, [id])
    
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    const order = orders[0]

    // Only allow deletion of draft orders without invoices
    if (order.status !== 'draft' || parseInt(order.invoice_count) > 0) {
      return NextResponse.json({ 
        error: 'Can only delete draft orders without invoices' 
      }, { status: 400 })
    }

    // Release inventory
    if (order.orderItems) {
      for (const item of order.orderItems) {
        const updateInventoryQuery = `
          UPDATE "Inventory"
          SET 
            "reservedSpots" = "reservedSpots" - 1,
            "availableSpots" = "availableSpots" + 1,
            "updatedAt" = NOW()
          WHERE 
            "showId" = $1 AND 
            date = $2::date AND 
            "placementType" = $3
        `
        
        await querySchema(orgSlug, updateInventoryQuery, [
          item.showId,
          new Date(item.airDate).toISOString().split('T')[0],
          item.placementType
        ])
      }
    }

    // Delete order items first
    const deleteItemsQuery = `DELETE FROM "OrderItem" WHERE "orderId" = $1`
    await querySchema(orgSlug, deleteItemsQuery, [id])
    
    // Delete order
    const deleteOrderQuery = `DELETE FROM "Order" WHERE id = $1`
    await querySchema(orgSlug, deleteOrderQuery, [id])

    return NextResponse.json({ message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return getHandler(authenticatedRequest, context)
}

// Use direct function export to fix production build issue
export const PUT = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return putHandler(authenticatedRequest, context)
}

// Use direct function export to fix production build issue
export const DELETE = async (request: NextRequest, context: { params: { [key: string]: string } }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return deleteHandler(authenticatedRequest, context)
}
