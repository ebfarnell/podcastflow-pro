import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { getUserOrgSlug, querySchema, SchemaModels } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const advertiserId = searchParams.get('advertiserId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query conditions
    let whereConditions = ['1=1']
    const queryParams: any[] = []
    let paramIndex = 1

    if (status) {
      whereConditions.push(`o.status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    if (campaignId) {
      whereConditions.push(`o."campaignId" = $${paramIndex}`)
      queryParams.push(campaignId)
      paramIndex++
    }

    if (advertiserId) {
      whereConditions.push(`o."advertiserId" = $${paramIndex}`)
      queryParams.push(advertiserId)
      paramIndex++
    }

    let dateFilter = ''
    if (startDate || endDate) {
      if (startDate) {
        dateFilter += ` AND oi."airDate" >= $${paramIndex}`
        queryParams.push(startDate)
        paramIndex++
      }
      if (endDate) {
        dateFilter += ` AND oi."airDate" <= $${paramIndex}`
        queryParams.push(endDate)
        paramIndex++
      }
    }

    const whereClause = whereConditions.join(' AND ')

    // Get orders with related data
    const ordersQuery = `
      SELECT DISTINCT
        o.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name,
        u.id as creator_id,
        u.name as creator_name,
        u.email as creator_email,
        (SELECT COUNT(*) FROM "OrderItem" WHERE "orderId" = o.id) as item_count
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      LEFT JOIN "User" u ON u.id = o."createdBy"
      ${dateFilter ? `INNER JOIN "OrderItem" oi ON oi."orderId" = o.id` : ''}
      WHERE ${whereClause} ${dateFilter}
      ORDER BY o."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    
    queryParams.push(limit, (page - 1) * limit)

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM "Order" o
      ${dateFilter ? `INNER JOIN "OrderItem" oi ON oi."orderId" = o.id` : ''}
      WHERE ${whereClause} ${dateFilter}
    `

    const [ordersRaw, countResult] = await Promise.all([
      querySchema(orgSlug, ordersQuery, queryParams),
      querySchema(orgSlug, countQuery, queryParams.slice(0, -2)) // Remove limit/offset for count
    ])

    const total = parseInt(countResult[0]?.total || '0')

    // Get order items for each order
    const orders = await Promise.all(ordersRaw.map(async (order) => {
      const itemsQuery = `
        SELECT 
          oi.*,
          s.name as show_name
        FROM "OrderItem" oi
        LEFT JOIN "Show" s ON s.id = oi."showId"
        WHERE oi."orderId" = $1
        ORDER BY oi."airDate" ASC
      `
      const orderItems = await querySchema(orgSlug, itemsQuery, [order.id])

      return {
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
        orderItems: orderItems.map(item => ({
          ...item,
          show: item.show_name ? {
            id: item.showId,
            name: item.show_name
          } : null
        })),
        _count: {
          orderItems: parseInt(order.item_count) || 0
        }
      }
    }))

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!

    const body = await request.json()
    const { campaignId, advertiserId, agencyId, orderItems, notes } = body

    if (!campaignId || !advertiserId || !orderItems || orderItems.length === 0) {
      return NextResponse.json({ 
        error: 'Campaign, advertiser, and order items are required' 
      }, { status: 400 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify campaign exists in organization schema
    const campaignQuery = `SELECT * FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema(orgSlug, campaignQuery, [campaignId])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Generate order number
    const countQuery = `SELECT COUNT(*) as count FROM "Order"`
    const countResult = await querySchema(orgSlug, countQuery, [])
    const orderCount = parseInt(countResult[0]?.count || '0')
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`

    // Calculate totals
    const totalAmount = orderItems.reduce((sum: number, item: any) => sum + item.rate, 0)

    // Create order in organization schema
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createOrderQuery = `
      INSERT INTO "Order" (
        id, "orderNumber", "campaignId", "advertiserId", "agencyId",
        status, "totalAmount", "discountAmount", "netAmount", notes,
        "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *
    `
    
    const orders = await querySchema(orgSlug, createOrderQuery, [
      orderId,
      orderNumber,
      campaignId,
      advertiserId,
      agencyId || null,
      'draft',
      totalAmount,
      0,
      totalAmount,
      notes || null,
      user.id
    ])
    
    const order = orders[0]
    
    // Create order items
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
        orderId,
        item.showId,
        item.episodeId || null,
        item.placementType,
        item.spotNumber || 1,
        new Date(item.airDate).toISOString(),
        item.length,
        item.isLiveRead || false,
        item.rate,
        item.rate,
        item.adTitle || null,
        item.adScript || null,
        JSON.stringify(item.adTalkingPoints || [])
      ])
    }
    
    // Get complete order with items
    const completeOrderQuery = `
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
    const completeOrders = await querySchema(orgSlug, completeOrderQuery, [orderId])
    const completeOrder = completeOrders[0]
    
    // Get order items
    const itemsQuery = `
      SELECT oi.*, s.name as show_name
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      WHERE oi."orderId" = $1
    `
    const items = await querySchema(orgSlug, itemsQuery, [orderId])
    
    const formattedOrder = {
      ...completeOrder,
      campaign: completeOrder.campaign_name ? {
        id: completeOrder.campaignId,
        name: completeOrder.campaign_name
      } : null,
      advertiser: completeOrder.advertiser_name ? {
        id: completeOrder.advertiserId,
        name: completeOrder.advertiser_name
      } : null,
      agency: completeOrder.agency_name ? {
        id: completeOrder.agencyId,
        name: completeOrder.agency_name
      } : null,
      orderItems: items.map(item => ({
        ...item,
        show: item.show_name ? {
          id: item.showId,
          name: item.show_name
        } : null
      }))
    }

    // Update inventory in organization schema
    for (const item of orderItems) {
      const updateInventoryQuery = `
        UPDATE "Inventory"
        SET 
          "reservedSpots" = "reservedSpots" + 1,
          "availableSpots" = "availableSpots" - 1,
          "updatedAt" = NOW()
        WHERE 
          "showId" = $1 AND 
          date = $2 AND 
          "placementType" = $3
      `
      
      await querySchema(orgSlug, updateInventoryQuery, [
        item.showId,
        new Date(item.airDate).toISOString().split('T')[0],
        item.placementType
      ])
    }

    return NextResponse.json(formattedOrder)
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest) => {
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
  
  return getHandler(authenticatedRequest)
}

// Use direct function export to fix production build issue
export const POST = async (request: NextRequest) => {
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
  
  return postHandler(authenticatedRequest)
}
