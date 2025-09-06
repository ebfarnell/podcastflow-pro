import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const organizationId = user.organizationId
    const months = parseInt(searchParams.get('months') || '12')
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + months)

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
        '/api/executive/revenue-projections',
        request
      )
    }

    // Fetch confirmed and pending orders using schema-aware queries
    const ordersQuery = `
      SELECT DISTINCT o.*
      FROM "Order" o
      WHERE o.status IN ('approved', 'booked', 'confirmed')
        AND EXISTS (
          SELECT 1 FROM "OrderItem" oi 
          WHERE oi."orderId" = o.id 
            AND oi."airDate" >= $1 
            AND oi."airDate" <= $2
        )
    `
    const ordersRaw = await querySchema<any>(orgSlug, ordersQuery, [startDate, endDate])
    
    // Fetch order details with items, shows, campaigns, and advertisers
    const orders = await Promise.all(ordersRaw.map(async (order) => {
      // Fetch order items with shows
      const itemsQuery = `
        SELECT 
          oi.*,
          s.id as show_id, s.name as show_name
        FROM "OrderItem" oi
        LEFT JOIN "Show" s ON s.id = oi."showId"
        WHERE oi."orderId" = $1 
          AND oi."airDate" >= $2 
          AND oi."airDate" <= $3
      `
      const orderItemsRaw = await querySchema<any>(orgSlug, itemsQuery, [order.id, startDate, endDate])
      
      const orderItems = orderItemsRaw.map(item => ({
        ...item,
        show: {
          id: item.show_id,
          name: item.show_name
        }
      }))
      
      // Fetch campaign with advertiser
      let campaign = null
      if (order.campaignId) {
        const campaignQuery = `
          SELECT 
            c.*,
            a.id as advertiser_id, a.name as advertiser_name
          FROM "Campaign" c
          LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
          WHERE c.id = $1
        `
        const campaignRaw = await querySchema<any>(orgSlug, campaignQuery, [order.campaignId])
        if (campaignRaw.length > 0) {
          const c = campaignRaw[0]
          campaign = {
            ...c,
            advertiser: {
              id: c.advertiser_id,
              name: c.advertiser_name
            }
          }
        }
      }
      
      return {
        ...order,
        orderItems,
        campaign
      }
    }))

    // Fetch pending proposals (draft orders) using schema-aware queries
    const proposalsQuery = `
      SELECT DISTINCT o.*
      FROM "Order" o
      WHERE o.status IN ('draft', 'pending_approval')
        AND EXISTS (
          SELECT 1 FROM "OrderItem" oi 
          WHERE oi."orderId" = o.id 
            AND oi."airDate" >= $1 
            AND oi."airDate" <= $2
        )
    `
    const proposalsRaw = await querySchema<any>(orgSlug, proposalsQuery, [startDate, endDate])
    
    // Fetch proposal details (reuse same structure as orders)
    const proposals = await Promise.all(proposalsRaw.map(async (order) => {
      const itemsQuery = `
        SELECT 
          oi.*,
          s.id as show_id, s.name as show_name
        FROM "OrderItem" oi
        LEFT JOIN "Show" s ON s.id = oi."showId"
        WHERE oi."orderId" = $1 
          AND oi."airDate" >= $2 
          AND oi."airDate" <= $3
      `
      const orderItemsRaw = await querySchema<any>(orgSlug, itemsQuery, [order.id, startDate, endDate])
      
      const orderItems = orderItemsRaw.map(item => ({
        ...item,
        show: {
          id: item.show_id,
          name: item.show_name
        }
      }))
      
      let campaign = null
      if (order.campaignId) {
        const campaignQuery = `
          SELECT 
            c.*,
            a.id as advertiser_id, a.name as advertiser_name
          FROM "Campaign" c
          LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
          WHERE c.id = $1
        `
        const campaignRaw = await querySchema<any>(orgSlug, campaignQuery, [order.campaignId])
        if (campaignRaw.length > 0) {
          const c = campaignRaw[0]
          campaign = {
            ...c,
            advertiser: {
              id: c.advertiser_id,
              name: c.advertiser_name
            }
          }
        }
      }
      
      return {
        ...order,
        orderItems,
        campaign
      }
    }))

    // Calculate monthly projections
    const monthlyProjections: Record<string, any> = {}
    
    for (let i = 0; i < months; i++) {
      const date = new Date()
      date.setMonth(date.getMonth() + i)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      monthlyProjections[monthKey] = {
        month: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
        confirmed: 0,
        pending: 0,
        potential: 0,
        byShow: {},
        byAdvertiser: {},
        campaigns: new Set()
      }
    }

    // Process confirmed orders
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        const monthKey = `${item.airDate.getFullYear()}-${String(item.airDate.getMonth() + 1).padStart(2, '0')}`
        if (monthlyProjections[monthKey]) {
          monthlyProjections[monthKey].confirmed += item.actualRate
          
          // By show
          if (!monthlyProjections[monthKey].byShow[item.show.name]) {
            monthlyProjections[monthKey].byShow[item.show.name] = { confirmed: 0, pending: 0 }
          }
          monthlyProjections[monthKey].byShow[item.show.name].confirmed += item.actualRate
          
          // By advertiser
          const advertiserName = order.campaign.advertiser.name
          if (!monthlyProjections[monthKey].byAdvertiser[advertiserName]) {
            monthlyProjections[monthKey].byAdvertiser[advertiserName] = { confirmed: 0, pending: 0 }
          }
          monthlyProjections[monthKey].byAdvertiser[advertiserName].confirmed += item.actualRate
          
          monthlyProjections[monthKey].campaigns.add(order.campaign.id)
        }
      })
    })

    // Process pending proposals
    proposals.forEach(order => {
      order.orderItems.forEach(item => {
        const monthKey = `${item.airDate.getFullYear()}-${String(item.airDate.getMonth() + 1).padStart(2, '0')}`
        if (monthlyProjections[monthKey]) {
          monthlyProjections[monthKey].pending += item.actualRate
          
          // By show
          if (!monthlyProjections[monthKey].byShow[item.show.name]) {
            monthlyProjections[monthKey].byShow[item.show.name] = { confirmed: 0, pending: 0 }
          }
          monthlyProjections[monthKey].byShow[item.show.name].pending += item.actualRate
          
          // By advertiser
          const advertiserName = order.campaign.advertiser.name
          if (!monthlyProjections[monthKey].byAdvertiser[advertiserName]) {
            monthlyProjections[monthKey].byAdvertiser[advertiserName] = { confirmed: 0, pending: 0 }
          }
          monthlyProjections[monthKey].byAdvertiser[advertiserName].pending += item.actualRate
        }
      })
    })

    // Calculate historical run rates for projection using schema-aware queries
    const historicalStartDate = new Date(new Date().setMonth(new Date().getMonth() - 6))
    
    const historicalOrdersQuery = `
      SELECT DISTINCT o.*
      FROM "Order" o
      WHERE o.status = 'confirmed'
        AND EXISTS (
          SELECT 1 FROM "OrderItem" oi 
          WHERE oi."orderId" = o.id 
            AND oi."airDate" >= $1 
            AND oi."airDate" < $2
            AND oi.status = 'aired'
        )
    `
    const historicalOrdersRaw = await querySchema<any>(orgSlug, historicalOrdersQuery, [historicalStartDate, startDate])
    
    // Fetch historical order items
    const historicalOrders = await Promise.all(historicalOrdersRaw.map(async (order) => {
      const itemsQuery = `
        SELECT * FROM "OrderItem"
        WHERE "orderId" = $1 
          AND "airDate" >= $2 
          AND "airDate" < $3
          AND status = 'aired'
      `
      const orderItems = await querySchema<any>(orgSlug, itemsQuery, [order.id, historicalStartDate, startDate])
      
      return {
        ...order,
        orderItems
      }
    }))

    // Calculate average monthly revenue from historical data
    const monthlyRevenue: Record<string, number> = {}
    historicalOrders.forEach(order => {
      order.orderItems.forEach(item => {
        const monthKey = `${item.airDate.getFullYear()}-${String(item.airDate.getMonth() + 1).padStart(2, '0')}`
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + item.actualRate
      })
    })

    const avgMonthlyRevenue = Object.values(monthlyRevenue).length > 0
      ? Object.values(monthlyRevenue).reduce((sum, val) => sum + val, 0) / Object.values(monthlyRevenue).length
      : 0

    // Calculate growth rate
    const revenueValues = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
    
    let growthRate = 0
    if (revenueValues.length >= 2) {
      const firstHalf = revenueValues.slice(0, Math.floor(revenueValues.length / 2))
      const secondHalf = revenueValues.slice(Math.floor(revenueValues.length / 2))
      const avgFirst = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length
      growthRate = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) : 0
    }

    // Apply projections based on historical data
    Object.keys(monthlyProjections).forEach((monthKey, index) => {
      const baseProjection = avgMonthlyRevenue * Math.pow(1 + growthRate, index)
      const existingRevenue = monthlyProjections[monthKey].confirmed + monthlyProjections[monthKey].pending
      monthlyProjections[monthKey].potential = Math.max(0, baseProjection - existingRevenue)
      monthlyProjections[monthKey].total = monthlyProjections[monthKey].confirmed + 
                                           monthlyProjections[monthKey].pending + 
                                           monthlyProjections[monthKey].potential
      monthlyProjections[monthKey].campaignCount = monthlyProjections[monthKey].campaigns.size
      delete monthlyProjections[monthKey].campaigns
    })

    // Fetch inventory availability using schema-aware query
    const inventoryQuery = `
      SELECT 
        i.*,
        s.id as show_id, s.name as show_name
      FROM "Inventory" i
      LEFT JOIN "Show" s ON s.id = i."showId"
      WHERE i.date >= $1 AND i.date <= $2
    `
    const inventoryRaw = await querySchema<any>(orgSlug, inventoryQuery, [startDate, endDate])
    
    const inventory = inventoryRaw.map(inv => ({
      ...inv,
      show: {
        id: inv.show_id,
        name: inv.show_name
      }
    }))

    // Calculate fill rate
    const fillRateByMonth: Record<string, any> = {}
    inventory.forEach(inv => {
      const monthKey = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`
      if (!fillRateByMonth[monthKey]) {
        fillRateByMonth[monthKey] = { total: 0, booked: 0 }
      }
      fillRateByMonth[monthKey].total += inv.totalSpots
      fillRateByMonth[monthKey].booked += inv.bookedSpots
    })

    Object.keys(fillRateByMonth).forEach(monthKey => {
      fillRateByMonth[monthKey].fillRate = fillRateByMonth[monthKey].total > 0
        ? (fillRateByMonth[monthKey].booked / fillRateByMonth[monthKey].total) * 100
        : 0
    })

    // Calculate summary metrics
    const projectionArray = Object.entries(monthlyProjections).map(([key, value]) => ({
      monthKey: key,
      ...value,
      fillRate: fillRateByMonth[key]?.fillRate || 0
    }))

    const totalConfirmed = projectionArray.reduce((sum, month) => sum + month.confirmed, 0)
    const totalPending = projectionArray.reduce((sum, month) => sum + month.pending, 0)
    const totalPotential = projectionArray.reduce((sum, month) => sum + month.potential, 0)
    const totalProjected = totalConfirmed + totalPending + totalPotential

    return NextResponse.json({
      summary: {
        totalConfirmed,
        totalPending,
        totalPotential,
        totalProjected,
        avgMonthlyProjected: totalProjected / months,
        growthRate: growthRate * 100,
        confidenceLevel: calculateConfidenceLevel(orders.length, proposals.length, historicalOrders.length)
      },
      monthlyProjections: projectionArray,
      topAdvertisers: getTopAdvertisers(monthlyProjections),
      topShows: getTopShows(monthlyProjections),
      historicalContext: {
        avgMonthlyRevenue,
        dataPoints: Object.keys(monthlyRevenue).length
      }
    })
  } catch (error) {
    console.error('Error generating revenue projections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function calculateConfidenceLevel(confirmedCount: number, pendingCount: number, historicalCount: number): string {
  const totalDataPoints = confirmedCount + pendingCount + historicalCount
  if (totalDataPoints >= 100) return 'High'
  if (totalDataPoints >= 50) return 'Medium'
  if (totalDataPoints >= 20) return 'Low'
  return 'Very Low'
}

function getTopAdvertisers(monthlyProjections: Record<string, any>): any[] {
  const advertiserTotals: Record<string, number> = {}
  
  Object.values(monthlyProjections).forEach(month => {
    Object.entries(month.byAdvertiser).forEach(([advertiser, data]: [string, any]) => {
      advertiserTotals[advertiser] = (advertiserTotals[advertiser] || 0) + data.confirmed + data.pending
    })
  })
  
  return Object.entries(advertiserTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, revenue]) => ({ name, revenue }))
}

function getTopShows(monthlyProjections: Record<string, any>): any[] {
  const showTotals: Record<string, number> = {}
  
  Object.values(monthlyProjections).forEach(month => {
    Object.entries(month.byShow).forEach(([show, data]: [string, any]) => {
      showTotals[show] = (showTotals[show] || 0) + data.confirmed + data.pending
    })
  })
  
  return Object.entries(showTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, revenue]) => ({ name, revenue }))
}
