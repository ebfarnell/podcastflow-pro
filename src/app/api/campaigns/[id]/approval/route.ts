import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        `/api/campaigns/${params.id}/approval`,
        request
      )
    }

    // Fetch campaign with approval details using complex SQL query
    const campaignQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name, a.email as advertiser_email,
        ag.id as agency_id, ag.name as agency_name, ag.email as agency_email,
        u.id as creator_id, u.name as creator_name, u.email as creator_email
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      LEFT JOIN public."User" u ON u.id = c."createdBy"
      WHERE c.id = $1
    `
    const campaignRaw = await querySchema<any>(orgSlug, campaignQuery, [params.id])
    
    if (!campaignRaw || campaignRaw.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const campaignData = campaignRaw[0]
    
    // Fetch orders separately with their relationships
    const ordersQuery = `
      SELECT 
        o.*,
        uc.id as creator_id, uc.name as creator_name, uc.email as creator_email,
        ua.id as approver_id, ua.name as approver_name, ua.email as approver_email
      FROM "Order" o
      LEFT JOIN public."User" uc ON uc.id = o."createdBy"
      LEFT JOIN public."User" ua ON ua.id = o."approvedBy"
      WHERE o."campaignId" = $1
      ORDER BY o."createdAt" DESC
    `
    const orders = await querySchema<any>(orgSlug, ordersQuery, [params.id])
    
    // Fetch order items with show details
    const orderItemsQuery = `
      SELECT 
        oi.*,
        s.id as show_id, s.name as show_name, s.host as show_host
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      WHERE oi."orderId" = ANY($1)
    `
    const orderIds = orders.map(o => o.id)
    const orderItems = orderIds.length > 0 ? await querySchema<any>(orgSlug, orderItemsQuery, [orderIds]) : []
    
    // Fetch show placements
    const showPlacementsQuery = `
      SELECT sp.* FROM "ShowPlacement" sp
      WHERE sp."showId" = ANY($1)
    `
    const showIds = [...new Set(orderItems.map(oi => oi.show_id).filter(Boolean))]
    const showPlacements = showIds.length > 0 ? await querySchema<any>(orgSlug, showPlacementsQuery, [showIds]) : []
    
    // Reconstruct the campaign object with nested relationships
    const campaign = {
      ...campaignData,
      advertiser: campaignData.advertiser_id ? {
        id: campaignData.advertiser_id,
        name: campaignData.advertiser_name,
        email: campaignData.advertiser_email
      } : null,
      agency: campaignData.agency_id ? {
        id: campaignData.agency_id,
        name: campaignData.agency_name,
        email: campaignData.agency_email
      } : null,
      creator: campaignData.creator_id ? {
        id: campaignData.creator_id,
        name: campaignData.creator_name,
        email: campaignData.creator_email
      } : null,
      orders: orders.map(order => ({
        ...order,
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
        orderItems: orderItems.filter(oi => oi.orderId === order.id).map(item => ({
          ...item,
          show: item.show_id ? {
            id: item.show_id,
            name: item.show_name,
            host: item.show_host,
            showPlacements: showPlacements.filter(sp => sp.showId === item.show_id)
          } : null
        }))
      }))
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Analyze rate discrepancies
    const rateDiscrepancies: any[] = []
    let totalDiscrepancyAmount = 0

    for (const order of campaign.orders) {
      for (const item of order.orderItems) {
        // Find the expected rate from show placements
        const placement = item.show.showPlacements.find(
          (p: any) => p.placementType === item.placementType
        )

        if (placement) {
          let expectedRate = placement.baseRate
          
          // Check if there's a specific rate for this length
          if (placement.rates && placement.rates[item.length.toString()]) {
            expectedRate = placement.rates[item.length.toString()]
          }

          const actualRate = item.rate
          const discrepancy = actualRate - expectedRate
          const discrepancyPercentage = expectedRate > 0 ? (discrepancy / expectedRate) * 100 : 0

          // Consider it a discrepancy if difference is more than 5% or $50
          if (Math.abs(discrepancyPercentage) > 5 || Math.abs(discrepancy) > 50) {
            rateDiscrepancies.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderItemId: item.id,
              showName: item.show.name,
              placementType: item.placementType,
              length: item.length,
              airDate: item.airDate,
              expectedRate,
              actualRate,
              discrepancy,
              discrepancyPercentage,
              severity: Math.abs(discrepancyPercentage) > 20 ? 'high' : 
                       Math.abs(discrepancyPercentage) > 10 ? 'medium' : 'low'
            })
            totalDiscrepancyAmount += Math.abs(discrepancy)
          }
        }
      }
    }

    // Get approval workflow status
    const approvalSummary = {
      totalOrders: campaign.orders.length,
      draftOrders: campaign.orders.filter(o => o.status === 'draft').length,
      pendingOrders: campaign.orders.filter(o => o.status === 'pending_approval').length,
      approvedOrders: campaign.orders.filter(o => o.status === 'approved').length,
      bookedOrders: campaign.orders.filter(o => o.status === 'booked').length,
      confirmedOrders: campaign.orders.filter(o => o.status === 'confirmed').length,
      cancelledOrders: campaign.orders.filter(o => o.status === 'cancelled').length
    }

    // Calculate financial summary
    const financialSummary = {
      totalOrderValue: campaign.orders.reduce((sum, order) => sum + order.netAmount, 0),
      pendingValue: campaign.orders
        .filter(o => o.status === 'pending_approval')
        .reduce((sum, order) => sum + order.netAmount, 0),
      approvedValue: campaign.orders
        .filter(o => ['approved', 'booked', 'confirmed'].includes(o.status))
        .reduce((sum, order) => sum + order.netAmount, 0),
      totalDiscrepancyAmount
    }

    // Check campaign approval requirements
    const approvalRequirements = {
      budgetExceeded: financialSummary.totalOrderValue > (campaign.budget || 0),
      hasRateDiscrepancies: rateDiscrepancies.length > 0,
      hasHighDiscrepancies: rateDiscrepancies.some(d => d.severity === 'high'),
      hasPendingOrders: approvalSummary.pendingOrders > 0,
      requiresApproval: false
    }

    approvalRequirements.requiresApproval = 
      approvalRequirements.budgetExceeded ||
      approvalRequirements.hasHighDiscrepancies ||
      approvalRequirements.hasPendingOrders

    return NextResponse.json({
      campaign,
      rateDiscrepancies,
      approvalSummary,
      financialSummary,
      approvalRequirements
    })
  } catch (error) {
    console.error('Error fetching campaign approval data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        'POST',
        `/api/campaigns/${params.id}/approval`,
        request
      )
    }

    const body = await request.json()
    const { action, orderIds, notes, overrideDiscrepancies } = body

    // Verify user has approval permissions
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions for approval' }, { status: 403 })
    }

    if (action === 'approve_orders') {
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return NextResponse.json({ error: 'Order IDs are required' }, { status: 400 })
      }

      // Verify all orders belong to this campaign using schema-aware queries
      const ordersQuery = `
        SELECT 
          o.*,
          oi.id as item_id, oi."showId", oi."placementType", oi.length, oi.rate,
          s.name as show_name,
          sp."baseRate", sp.rates
        FROM "Order" o
        LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
        LEFT JOIN "Show" s ON s.id = oi."showId"
        LEFT JOIN "ShowPlacement" sp ON sp."showId" = oi."showId" AND sp."placementType" = oi."placementType"
        WHERE o.id = ANY($1) AND o."campaignId" = $2 AND o.status = 'pending_approval'
      `
      const ordersRaw = await querySchema<any>(orgSlug, ordersQuery, [orderIds, params.id])

      const uniqueOrderIds = [...new Set(ordersRaw.map(row => row.id))]
      if (uniqueOrderIds.length !== orderIds.length) {
        return NextResponse.json({ 
          error: 'Some orders not found or not in pending approval status' 
        }, { status: 400 })
      }

      // Group data by order
      const orders = uniqueOrderIds.map(orderId => {
        const orderRows = ordersRaw.filter(row => row.id === orderId)
        const orderData = orderRows[0]
        return {
          ...orderData,
          orderItems: orderRows.filter(row => row.item_id).map(row => ({
            id: row.item_id,
            showId: row.showId,
            placementType: row.placementType,
            length: row.length,
            rate: row.rate,
            show: {
              name: row.show_name
            },
            placement: {
              baseRate: row.baseRate,
              rates: row.rates
            }
          }))
        }
      })

      // Check for rate discrepancies if not overridden
      if (!overrideDiscrepancies) {
        const discrepancies = []
        for (const order of orders) {
          for (const item of order.orderItems) {
            const placement = item.placement
            if (placement) {
              let expectedRate = placement.baseRate
              if (placement.rates && placement.rates[item.length.toString()]) {
                expectedRate = placement.rates[item.length.toString()]
              }
              const discrepancyPercentage = expectedRate > 0 ? 
                ((item.rate - expectedRate) / expectedRate) * 100 : 0
              
              if (Math.abs(discrepancyPercentage) > 20) {
                discrepancies.push({
                  orderNumber: order.orderNumber,
                  showName: item.show.name,
                  discrepancyPercentage
                })
              }
            }
          }
        }

        if (discrepancies.length > 0) {
          return NextResponse.json({
            error: 'High rate discrepancies detected',
            discrepancies,
            requiresOverride: true
          }, { status: 400 })
        }
      }

      // Approve orders using schema-aware queries
      for (const orderId of orderIds) {
        const updateOrderQuery = `
          UPDATE "Order" 
          SET 
            status = 'approved',
            "approvedAt" = CURRENT_TIMESTAMP,
            "approvedBy" = $2,
            notes = CASE WHEN $3 IS NOT NULL THEN COALESCE(notes, '') || '\n\nApproval Notes: ' || $3 ELSE notes END
          WHERE id = $1
        `
        await querySchema(orgSlug, updateOrderQuery, [orderId, user.id, notes])
      }

      // Log approval action using schema-aware query
      const logApprovalQuery = `
        INSERT INTO "CampaignApproval" (
          "campaignId", "requestedBy", status, "reviewedBy", "reviewedAt", 
          "approvalNotes", "hasRateDiscrepancy", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'approved', $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logApprovalQuery, [
        params.id, user.id, user.id, notes, overrideDiscrepancies || false
      ])

      return NextResponse.json({
        message: `${orders.length} orders approved successfully`,
        approvedOrders: orders.length
      })
    } else if (action === 'reject_orders') {
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return NextResponse.json({ error: 'Order IDs are required' }, { status: 400 })
      }

      if (!notes) {
        return NextResponse.json({ error: 'Rejection notes are required' }, { status: 400 })
      }

      // Reject orders (return to draft) using schema-aware queries
      let rejectedCount = 0
      for (const orderId of orderIds) {
        const rejectOrderQuery = `
          UPDATE "Order" 
          SET status = 'draft', notes = $3
          WHERE id = $1 AND "campaignId" = $2 AND status = 'pending_approval'
        `
        const result = await querySchema(orgSlug, rejectOrderQuery, [orderId, params.id, notes])
        if (result) rejectedCount++
      }

      // Log rejection action using schema-aware query
      const logRejectionQuery = `
        INSERT INTO "CampaignApproval" (
          "campaignId", "requestedBy", status, "reviewedBy", "reviewedAt", 
          "rejectionReason", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'rejected', $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logRejectionQuery, [params.id, user.id, user.id, notes])

      return NextResponse.json({
        message: `${rejectedCount} orders rejected and returned to draft`,
        rejectedOrders: rejectedCount
      })
    } else if (action === 'approve_campaign') {
      // Approve entire campaign using schema-aware query
      const approveCampaignQuery = `
        UPDATE "Campaign" 
        SET 
          status = 'approved',
          "approvedAt" = CURRENT_TIMESTAMP,
          "approvedBy" = $2
        WHERE id = $1
        RETURNING *
      `
      const campaigns = await querySchema<any>(orgSlug, approveCampaignQuery, [params.id, user.id])

      if (!campaigns || campaigns.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      // Auto-approve all pending orders in campaign using schema-aware query
      const approveOrdersQuery = `
        UPDATE "Order" 
        SET 
          status = 'approved',
          "approvedAt" = CURRENT_TIMESTAMP,
          "approvedBy" = $3
        WHERE "campaignId" = $1 AND status = 'pending_approval'
      `
      await querySchema(orgSlug, approveOrdersQuery, [params.id, user.id, user.id])

      // Log campaign approval using schema-aware query
      const logCampaignApprovalQuery = `
        INSERT INTO "CampaignApproval" (
          "campaignId", "requestedBy", status, "reviewedBy", "reviewedAt", 
          "approvalNotes", "hasRateDiscrepancy", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'approved', $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logCampaignApprovalQuery, [
        params.id, user.id, user.id, notes || 'Campaign approved', overrideDiscrepancies || false
      ])

      return NextResponse.json({
        message: 'Campaign and all pending orders approved successfully',
        campaign: campaigns[0]
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing campaign approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
