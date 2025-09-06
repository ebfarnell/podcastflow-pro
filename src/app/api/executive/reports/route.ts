import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { UserService } from '@/lib/auth/user-service'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
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
        '/api/executive/reports',
        request
      )
    }

    const { searchParams } = new URL(request.url)
    const organizationId = user.organizationId
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Fetch P&L data using schema-aware query
    let financialDataQuery = `
      SELECT * FROM "FinancialData" 
      WHERE year = $1
    `
    const queryParams: any[] = [year]
    
    if (month) {
      financialDataQuery += ` AND month = $${queryParams.length + 1}`
      queryParams.push(month)
    }
    
    financialDataQuery += ` ORDER BY "accountType" ASC, "accountCode" ASC`
    
    const financialData = await querySchema<any>(orgSlug, financialDataQuery, queryParams)

    // Calculate totals by account type
    const totals = financialData.reduce((acc, item) => {
      if (!acc[item.accountType]) {
        acc[item.accountType] = 0
      }
      acc[item.accountType] += item.amount
      return acc
    }, {} as Record<string, number>)

    // Calculate revenue projections based on orders using schema-aware query
    const startDate = new Date(year, month || 0, 1)
    const endDate = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1)
    
    const orderItemsQuery = `
      SELECT 
        oi.*,
        o.id as order_id, o.status as order_status,
        c.id as campaign_id, c.name as campaign_name, c.budget as campaign_budget,
        a.id as advertiser_id, a.name as advertiser_name,
        s.id as show_id, s.name as show_name
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      LEFT JOIN "Show" s ON s.id = oi."showId"
      WHERE o.status IN ('approved', 'booked', 'confirmed')
        AND oi."airDate" >= $1 AND oi."airDate" < $2
    `
    const orderItemsRaw = await querySchema<any>(orgSlug, orderItemsQuery, [startDate, endDate])
    
    // Transform to match expected format
    const orderItems = orderItemsRaw.map(item => ({
      ...item,
      order: {
        id: item.order_id,
        status: item.order_status,
        campaign: item.campaign_id ? {
          id: item.campaign_id,
          name: item.campaign_name,
          budget: item.campaign_budget
        } : null,
        advertiser: item.advertiser_id ? {
          id: item.advertiser_id,
          name: item.advertiser_name
        } : null
      },
      show: item.show_id ? {
        id: item.show_id,
        name: item.show_name
      } : null
    }))

    const projectedRevenue = orderItems.reduce((total, item) => total + item.actualRate, 0)

    // Fetch budget vs actual using schema-aware query
    let budgetDataQuery = `
      SELECT 
        be.*,
        bc.id as category_id, bc.name as category_name, bc.type as category_type
      FROM "BudgetEntry" be
      LEFT JOIN "BudgetCategory" bc ON bc.id = be."categoryId"
      WHERE be.year = $1
    `
    const budgetQueryParams: any[] = [year]
    
    if (month) {
      budgetDataQuery += ` AND be.month = $${budgetQueryParams.length + 1}`
      budgetQueryParams.push(month)
    }
    
    budgetDataQuery += ` ORDER BY bc.type ASC, bc.name ASC`
    
    const budgetDataRaw = await querySchema<any>(orgSlug, budgetDataQuery, budgetQueryParams)
    
    // Transform to match expected format
    const budgetData = budgetDataRaw.map(entry => ({
      ...entry,
      category: entry.category_id ? {
        id: entry.category_id,
        name: entry.category_name,
        type: entry.category_type
      } : null
    }))

    // Fetch campaign performance using schema-aware queries
    const campaignStartDate = new Date(year, month || 0, 1)
    const campaignEndDate = new Date(year, month || 11, 31)
    
    const campaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."startDate" <= $1 AND c."endDate" >= $2
    `
    const campaignsRaw = await querySchema<any>(orgSlug, campaignsQuery, [campaignEndDate, campaignStartDate])
    
    // Batch fetch all orders to avoid N+1 queries
    const campaignIds = campaignsRaw.map(c => c.id)
    let ordersMap = new Map()
    
    if (campaignIds.length > 0) {
      const campaignPlaceholders = campaignIds.map((_, i) => `$${i + 1}`).join(', ')
      const allOrdersQuery = `
        SELECT 
          o.*,
          o."campaignId",
          json_agg(
            json_build_object(
              'id', oi.id,
              'actualRate', oi."actualRate",
              'orderId', oi."orderId"
            )
          ) FILTER (WHERE oi.id IS NOT NULL) as orderItems
        FROM "Order" o
        LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
        WHERE o."campaignId" IN (${campaignPlaceholders}) 
          AND o.status IN ('approved', 'booked', 'confirmed')
        GROUP BY o.id
      `
      const allOrders = await querySchema<any>(orgSlug, allOrdersQuery, campaignIds)
      
      // Group orders by campaign ID
      allOrders.forEach(order => {
        if (!ordersMap.has(order.campaignId)) {
          ordersMap.set(order.campaignId, [])
        }
        ordersMap.get(order.campaignId).push({
          ...order,
          orderItems: order.orderItems || []
        })
      })
    }
    
    // Map campaigns with pre-fetched orders
    const campaigns = campaignsRaw.map(campaign => ({
      ...campaign,
      advertiser: {
        id: campaign.advertiser_id,
        name: campaign.advertiser_name
      },
      orders: ordersMap.get(campaign.id) || []
    }))

    const campaignPerformance = campaigns.map(campaign => {
      const revenue = campaign.orders.reduce((total, order) => 
        total + order.orderItems.reduce((sum, item) => sum + item.actualRate, 0), 0
      )
      return {
        id: campaign.id,
        name: campaign.name,
        advertiser: campaign.advertiser.name,
        budget: campaign.budget || 0,
        revenue,
        utilization: campaign.budget ? (revenue / campaign.budget) * 100 : 0,
        status: campaign.status
      }
    })

    // Fetch employee compensation for costs using schema-aware query
    const compStartDate = new Date(year, month || 0, 1)
    const compEndDate = new Date(year, month || 11, 31)
    
    const employeeCompensationQuery = `
      SELECT 
        ec.*,
        u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role
      FROM "EmployeeCompensation" ec
      LEFT JOIN public."User" u ON u.id = ec."userId"
      WHERE ec.year = $1 
        AND ec."effectiveDate" <= $2
        AND (ec."endDate" IS NULL OR ec."endDate" >= $3)
    `
    const employeeCompensationRaw = await querySchema<any>(orgSlug, employeeCompensationQuery, [year, compEndDate, compStartDate])
    
    // Transform to match expected format
    const employeeCompensation = employeeCompensationRaw.map(comp => ({
      ...comp,
      user: comp.user_id ? {
        name: comp.user_name,
        email: comp.user_email,
        role: comp.user_role
      } : null
    }))

    const totalCompensation = employeeCompensation.reduce((total, comp) => {
      const monthly = ((comp.baseSalary || 0) / 12) + 
                     ((comp.actualBonus || 0) / 12) +
                     ((comp.actualCommission || 0) / 12) +
                     ((comp.benefits || 0) / 12)
      return total + monthly
    }, 0)

    return NextResponse.json({
      financialData,
      totals,
      projectedRevenue,
      budgetData,
      campaignPerformance,
      employeeCompensation: {
        total: totalCompensation,
        breakdown: employeeCompensation
      },
      period: {
        year,
        month,
        monthName: month ? new Date(year, month - 1).toLocaleString('default', { month: 'long' }) : null
      }
    })
  } catch (error) {
    console.error('Error fetching executive reports:', error)
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