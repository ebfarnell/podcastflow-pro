import { NextRequest, NextResponse } from 'next/server'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { PERMISSIONS } from '@/types/auth'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/orders
 * List orders with tenant isolation
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const advertiserId = searchParams.get('advertiserId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeWorkflow = searchParams.get('includeWorkflow') === 'true'
    const includeContracts = searchParams.get('includeContracts') === 'true'
    const includeApprovals = searchParams.get('includeApprovals') === 'true'

    // Build query conditions
    let whereClause = ' WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      whereClause += ` AND o."status" = $${paramIndex++}`
      params.push(status)
    }

    if (campaignId) {
      whereClause += ` AND o."campaignId" = $${paramIndex++}`
      params.push(campaignId)
    }

    if (advertiserId) {
      whereClause += ` AND o."advertiserId" = $${paramIndex++}`
      params.push(advertiserId)
    }

    // Filter out orders with pending or approved deletion requests
    whereClause += ` AND NOT EXISTS (
      SELECT 1 FROM public."DeletionRequest" dr 
      WHERE dr."entityType" = 'order' 
      AND dr."entityId" = o.id::text 
      AND dr.status IN ('pending', 'approved')
      AND dr."organizationId" = o."organizationId"
    )`

    const skip = (page - 1) * limit

    // Get orders with basic info
    const ordersQuery = `
      SELECT 
        o.*,
        c.name as "campaignName",
        adv.name as "advertiserName",
        ag.name as "agencyName",
        COUNT(oi.id) as "orderItemsCount"
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" adv ON adv.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      ${whereClause}
      GROUP BY o.id, c.name, adv.name, ag.name
      ORDER BY o."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `

    const { data: orders, error: ordersError } = await safeQuerySchema(orgSlug, ordersQuery, params)
    if (ordersError) {
      console.error(`Orders query error for org ${orgSlug}:`, ordersError.message)
    }

    // Get order items for each order
    const orderIds = orders.map((o: any) => o.id)
    let orderItemsMap: Record<string, any[]> = {}
    
    if (orderIds.length > 0) {
      const orderItemsQuery = `
        SELECT 
          oi.*,
          s.name as "showName"
        FROM "OrderItem" oi
        LEFT JOIN "Show" s ON s.id = oi."showId"
        WHERE oi."orderId" = ANY($1::uuid[])
        ORDER BY oi."airDate" ASC
      `
      
      const { data: orderItems, error: itemsError } = await safeQuerySchema(
        orgSlug, 
        orderItemsQuery, 
        [orderIds]
      )
      if (itemsError) {
        console.error(`Order items query error for org ${orgSlug}:`, itemsError.message)
      }
      
      // Group order items by orderId
      orderItems.forEach((item: any) => {
        if (!orderItemsMap[item.orderId]) {
          orderItemsMap[item.orderId] = []
        }
        orderItemsMap[item.orderId].push(item)
      })
    }

    // If date filtering is requested, filter orders by their items' air dates
    let filteredOrders = orders
    if (startDate || endDate) {
      filteredOrders = orders.filter((order: any) => {
        const items = orderItemsMap[order.id] || []
        return items.some((item: any) => {
          const airDate = item.airDate ? new Date(item.airDate).toISOString() : null
          if (!airDate) return false
          
          if (startDate && airDate < startDate) return false
          if (endDate && airDate > endDate) return false
          
          return true
        })
      })
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM "Order" o ${whereClause}`
    const { data: countResult } = await safeQuerySchema(orgSlug, countQuery, params)
    const totalCount = parseInt(countResult[0]?.count || '0')

    // Get creator information from public schema
    const creatorIds = [...new Set(orders.map((o: any) => o.createdBy).filter(Boolean))]
    const creators = creatorIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, email: true }
    }) : []
    const creatorMap = new Map(creators.map(c => [c.id, c]))

    // Fetch additional data if requested
    let workflowDataMap: Record<string, any> = {}
    let contractsDataMap: Record<string, any[]> = {}
    let approvalsDataMap: Record<string, any[]> = {}

    if (includeWorkflow || includeContracts || includeApprovals) {
      const orderIdsForExtra = orderIds.length > 0 ? orderIds : []
      
      if (includeWorkflow && orderIdsForExtra.length > 0) {
        // Get workflow states for orders
        const workflowQuery = `
          SELECT 
            o.id as "orderId",
            CASE 
              WHEN c.id IS NOT NULL AND c.status = 'executed' THEN 'contract_executed'
              WHEN c.id IS NOT NULL AND c.status = 'sent' THEN 'contract_sent'
              WHEN c.id IS NOT NULL AND c.status = 'draft' THEN 'contract_draft'
              WHEN o.status = 'approved' THEN 'order_approved'
              WHEN o.status = 'pending_approval' THEN 'order_pending'
              ELSE 'draft'
            END as "workflowState",
            COUNT(DISTINCT aa.id) as "approvalsCount",
            COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'approved') as "approvedCount"
          FROM "Order" o
          LEFT JOIN "Contract" c ON c."orderId" = o.id
          LEFT JOIN "AdApproval" aa ON aa."orderId" = o.id
          WHERE o.id = ANY($1::uuid[])
          GROUP BY o.id, c.id, c.status, o.status
        `
        
        const { data: workflowData } = await safeQuerySchema(orgSlug, workflowQuery, [orderIdsForExtra])
        workflowData.forEach((item: any) => {
          workflowDataMap[item.orderId] = {
            workflowState: item.workflowState,
            approvalsCount: parseInt(item.approvalsCount),
            approvedCount: parseInt(item.approvedCount)
          }
        })
      }

      if (includeContracts && orderIdsForExtra.length > 0) {
        // Get contracts for orders
        const contractsQuery = `
          SELECT 
            c.*,
            COUNT(cs.id) as "signaturesCount",
            COUNT(cs.id) FILTER (WHERE cs.status = 'signed') as "signedCount"
          FROM "Contract" c
          LEFT JOIN "ContractSignature" cs ON cs."contractId" = c.id
          WHERE c."orderId" = ANY($1::uuid[])
          GROUP BY c.id
          ORDER BY c."createdAt" DESC
        `
        
        const { data: contractsData } = await safeQuerySchema(orgSlug, contractsQuery, [orderIdsForExtra])
        contractsData.forEach((contract: any) => {
          if (!contractsDataMap[contract.orderId]) {
            contractsDataMap[contract.orderId] = []
          }
          contractsDataMap[contract.orderId].push({
            ...contract,
            signaturesCount: parseInt(contract.signaturesCount),
            signedCount: parseInt(contract.signedCount)
          })
        })
      }

      if (includeApprovals && orderIdsForExtra.length > 0) {
        // Get approvals for orders
        const approvalsQuery = `
          SELECT 
            aa.*,
            ac.name as "creativeName",
            ac.fileUrl as "creativeUrl"
          FROM "AdApproval" aa
          LEFT JOIN "AdCreative" ac ON ac.id = aa."creativeId"
          WHERE aa."orderId" = ANY($1::uuid[])
          ORDER BY aa."createdAt" DESC
        `
        
        const { data: approvalsData } = await safeQuerySchema(orgSlug, approvalsQuery, [orderIdsForExtra])
        approvalsData.forEach((approval: any) => {
          if (!approvalsDataMap[approval.orderId]) {
            approvalsDataMap[approval.orderId] = []
          }
          approvalsDataMap[approval.orderId].push({
            ...approval,
            creative: approval.creativeId ? {
              id: approval.creativeId,
              name: approval.creativeName,
              fileUrl: approval.creativeUrl
            } : null
          })
        })
      }
    }

    // Transform orders for response
    const transformedOrders = filteredOrders.map((order: any) => {
      const creator = order.createdBy ? creatorMap.get(order.createdBy) : null
      const orderItems = orderItemsMap[order.id] || []
      const workflowData = workflowDataMap[order.id] || null
      const contracts = contractsDataMap[order.id] || []
      const approvals = approvalsDataMap[order.id] || []

      const result: any = {
        ...order,
        campaign: order.campaignId ? {
          id: order.campaignId,
          name: order.campaignName
        } : null,
        advertiser: order.advertiserId ? {
          id: order.advertiserId,
          name: order.advertiserName
        } : null,
        agency: order.agencyId ? {
          id: order.agencyId,
          name: order.agencyName
        } : null,
        creator: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        orderItems: orderItems.map((item: any) => ({
          ...item,
          show: item.showId ? {
            id: item.showId,
            name: item.showName
          } : null
        })),
        _count: {
          orderItems: orderItems.length
        }
      }

      // Add optional data
      if (includeWorkflow && workflowData) {
        result.workflow = workflowData
      }
      if (includeContracts) {
        result.contracts = contracts
      }
      if (includeApprovals) {
        result.approvals = approvals
      }

      return result
    })

    console.log(`✅ Orders API: Returning ${transformedOrders.length} orders for ${orgSlug}`)

    return NextResponse.json({
      orders: transformedOrders,
      total: startDate || endDate ? filteredOrders.length : totalCount,
      page,
      limit,
      totalPages: Math.ceil((startDate || endDate ? filteredOrders.length : totalCount) / limit)
    })

  } catch (error) {
    console.error('❌ Orders API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders
 * Create a new order with tenant isolation
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      campaignId,
      advertiserId,
      agencyId,
      orderNumber,
      notes,
      orderItems = []
    } = body

    // Validate required fields
    if (!campaignId || !advertiserId) {
      return NextResponse.json(
        { error: 'Campaign ID and Advertiser ID are required' },
        { status: 400 }
      )
    }

    // Verify campaign exists
    const { data: campaigns } = await safeQuerySchema(
      orgSlug,
      'SELECT id FROM "Campaign" WHERE id = $1',
      [campaignId]
    )
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify advertiser exists
    const { data: advertisers } = await safeQuerySchema(
      orgSlug,
      'SELECT id FROM "Advertiser" WHERE id = $1',
      [advertiserId]
    )
    if (!advertisers || advertisers.length === 0) {
      return NextResponse.json(
        { error: 'Advertiser not found' },
        { status: 404 }
      )
    }

    // Verify agency if provided
    if (agencyId) {
      const { data: agencies } = await safeQuerySchema(
        orgSlug,
        'SELECT id FROM "Agency" WHERE id = $1',
        [agencyId]
      )
      if (!agencies || agencies.length === 0) {
        return NextResponse.json(
          { error: 'Agency not found' },
          { status: 404 }
        )
      }
    }

    // Generate order number if not provided
    const finalOrderNumber = orderNumber || `ORD-${Date.now()}`

    // Calculate total amount from order items
    const totalAmount = orderItems.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 1)
    }, 0)

    // Create order
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createOrderQuery = `
      INSERT INTO "Order" (
        id, "campaignId", "advertiserId", "agencyId", "orderNumber",
        "totalAmount", status, notes, "createdBy", "organizationId",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING *
    `
    
    const { data: orderResult } = await safeQuerySchema(
      orgSlug,
      createOrderQuery,
      [
        orderId,
        campaignId,
        advertiserId,
        agencyId,
        finalOrderNumber,
        totalAmount,
        'draft',
        notes || '',
        user.id,
        user.organizationId
      ]
    )
    
    if (!orderResult || orderResult.length === 0) {
      throw new Error('Failed to create order')
    }
    
    const newOrder = orderResult[0]

    // Create order items
    if (orderItems.length > 0) {
      for (const item of orderItems) {
        const itemId = `oi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const createItemQuery = `
          INSERT INTO "OrderItem" (
            id, "orderId", "showId", "episodeId", "placementType",
            rate, quantity, "airDate", notes, "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
          )
        `
        
        await querySchema(
          orgSlug,
          createItemQuery,
          [
            itemId,
            orderId,
            item.showId,
            item.episodeId || null,
            item.placementType || 'mid-roll',
            parseFloat(item.rate) || 0,
            parseInt(item.quantity) || 1,
            item.airDate ? new Date(item.airDate) : null,
            item.notes || ''
          ]
        )
      }
    }

    // Fetch the complete order with related data
    const completeOrderQuery = `
      SELECT 
        o.*,
        c.name as "campaignName",
        adv.name as "advertiserName",
        ag.name as "agencyName"
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" adv ON adv.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      WHERE o.id = $1
    `
    
    const { data: completeOrder } = await safeQuerySchema(
      orgSlug,
      completeOrderQuery,
      [orderId]
    )
    
    // Fetch order items
    const { data: orderItemsData } = await safeQuerySchema(
      orgSlug,
      `SELECT oi.*, s.name as "showName"
       FROM "OrderItem" oi
       LEFT JOIN "Show" s ON s.id = oi."showId"
       WHERE oi."orderId" = $1`,
      [orderId]
    )

    const result = {
      ...completeOrder[0],
      campaign: campaignId ? {
        id: campaignId,
        name: completeOrder[0].campaignName
      } : null,
      advertiser: {
        id: advertiserId,
        name: completeOrder[0].advertiserName
      },
      agency: agencyId ? {
        id: agencyId,
        name: completeOrder[0].agencyName
      } : null,
      orderItems: orderItemsData.map((item: any) => ({
        ...item,
        show: item.showId ? {
          id: item.showId,
          name: item.showName
        } : null
      }))
    }

    console.log(`✅ Orders API: Created order "${newOrder.orderNumber}" with ID: ${newOrder.id}`)

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    console.error('❌ Orders API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}