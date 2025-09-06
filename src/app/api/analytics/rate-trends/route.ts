import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const showId = url.searchParams.get('showId')
    const placementType = url.searchParams.get('placementType')
    const timeframe = url.searchParams.get('timeframe') || '12months' // 6months, 12months, 24months, all
    const groupBy = url.searchParams.get('groupBy') || 'month' // month, quarter, year
    const comparison = url.searchParams.get('comparison') === 'true'

    // Calculate date range based on timeframe
    let dateFilter = ''
    let dateParams = []
    let paramIndex = 2 // Start after organizationId

    if (timeframe !== 'all') {
      const months = timeframe === '6months' ? 6 : timeframe === '12months' ? 12 : 24
      dateFilter = `AND rh."effectiveDate" >= CURRENT_DATE - INTERVAL '${months} months'`
    }

    // Base query filters
    let whereClause = 'rh."organizationId" = $1'
    const queryParams = [session.organizationId]

    if (showId) {
      whereClause += ` AND rh."showId" = $${paramIndex}`
      queryParams.push(showId)
      paramIndex++
    }

    if (placementType) {
      whereClause += ` AND rh."placementType" = $${paramIndex}`
      queryParams.push(placementType)
      paramIndex++
    }

    // Determine grouping format based on groupBy parameter
    let dateFormat = "to_char(rh.\"effectiveDate\", 'YYYY-MM')"
    if (groupBy === 'quarter') {
      dateFormat = "to_char(rh.\"effectiveDate\", 'YYYY-Q')"
    } else if (groupBy === 'year') {
      dateFormat = "to_char(rh.\"effectiveDate\", 'YYYY')"
    }

    // Main rate trends query
    const { data: rateTrends, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        ${dateFormat} as period,
        rh."placementType",
        s.name as showName,
        s.id as showId,
        AVG(rh.rate) as avgRate,
        MIN(rh.rate) as minRate,
        MAX(rh.rate) as maxRate,
        COUNT(*) as rateChanges,
        COUNT(DISTINCT rh."showId") as showCount,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rh.rate) as medianRate
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       WHERE ${whereClause} ${dateFilter}
       GROUP BY ${dateFormat}, rh."placementType", s.name, s.id
       ORDER BY period DESC, rh."placementType", s.name`,
      queryParams
    )

    if (error) {
      console.error('❌ Rate trends query failed:', error)
      return NextResponse.json([])
    }

    // Calculate rate change percentages and trends
    const trendsWithChanges = (rateTrends || []).map((trend, index, array) => {
      // Find previous period for the same show and placement type
      const previousPeriod = array.find(t => 
        t.showId === trend.showId && 
        t.placementType === trend.placementType && 
        t.period < trend.period
      )

      let changePercent = null
      let changeAmount = null
      let trendDirection = 'stable'

      if (previousPeriod) {
        changeAmount = parseFloat(trend.avgRate) - parseFloat(previousPeriod.avgRate)
        changePercent = ((changeAmount / parseFloat(previousPeriod.avgRate)) * 100).toFixed(2)
        
        if (Math.abs(changePercent) >= 5) {
          trendDirection = changePercent > 0 ? 'increasing' : 'decreasing'
        }
      }

      return {
        ...trend,
        avgRate: parseFloat(trend.avgRate).toFixed(2),
        minRate: parseFloat(trend.minRate).toFixed(2),
        maxRate: parseFloat(trend.maxRate).toFixed(2),
        medianRate: parseFloat(trend.medianRate).toFixed(2),
        changePercent: changePercent ? parseFloat(changePercent) : null,
        changeAmount: changeAmount ? parseFloat(changeAmount.toFixed(2)) : null,
        trendDirection
      }
    })

    // Get current rates for comparison
    const { data: currentRates } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        rh."showId",
        s.name as showName,
        rh."placementType",
        rh.rate as currentRate,
        rh."effectiveDate"
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       WHERE rh."organizationId" = $1
         AND (rh."expiryDate" IS NULL OR rh."expiryDate" >= CURRENT_DATE)
         AND rh."effectiveDate" <= CURRENT_DATE
         ${showId ? `AND rh."showId" = '${showId}'` : ''}
         ${placementType ? `AND rh."placementType" = '${placementType}'` : ''}
       ORDER BY rh."effectiveDate" DESC`,
      [session.organizationId]
    )

    // Calculate summary statistics
    const summary = {
      totalShows: new Set(trendsWithChanges.map(t => t.showId)).size,
      totalRateChanges: trendsWithChanges.reduce((sum, t) => sum + parseInt(t.rateChanges), 0),
      placementTypes: [...new Set(trendsWithChanges.map(t => t.placementType))],
      avgRateAcrossAll: trendsWithChanges.length > 0 
        ? (trendsWithChanges.reduce((sum, t) => sum + parseFloat(t.avgRate), 0) / trendsWithChanges.length).toFixed(2)
        : 0,
      periods: [...new Set(trendsWithChanges.map(t => t.period))].sort().reverse()
    }

    // Market comparison data (if requested)
    let marketComparison = null
    if (comparison) {
      const { data: marketData } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT 
          rh."placementType",
          AVG(rh.rate) as marketAvgRate,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY rh.rate) as q25Rate,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rh.rate) as q75Rate,
          COUNT(DISTINCT rh."showId") as showCount
         FROM "ShowRateHistory" rh
         WHERE rh."organizationId" = $1
           AND (rh."expiryDate" IS NULL OR rh."expiryDate" >= CURRENT_DATE)
           AND rh."effectiveDate" <= CURRENT_DATE
           ${dateFilter}
         GROUP BY rh."placementType"`,
        [session.organizationId]
      )

      marketComparison = (marketData || []).map(market => ({
        ...market,
        marketAvgRate: parseFloat(market.marketAvgRate).toFixed(2),
        q25Rate: parseFloat(market.q25Rate).toFixed(2),
        q75Rate: parseFloat(market.q75Rate).toFixed(2)
      }))
    }

    return NextResponse.json({
      trends: trendsWithChanges,
      currentRates: currentRates || [],
      summary,
      marketComparison,
      metadata: {
        timeframe,
        groupBy,
        showId,
        placementType,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Rate trends analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Rate optimization recommendations
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { showId, placementType, targetRevenue, timeframe = '6months' } = body

    if (!showId) {
      return NextResponse.json({ error: 'Show ID is required' }, { status: 400 })
    }

    // Get historical performance data
    const { data: performanceData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        rh.rate,
        rh."effectiveDate",
        rh."placementType",
        COUNT(o.id) as ordersCount,
        COALESCE(SUM(o."totalValue"), 0) as totalRevenue,
        AVG(o."totalValue") as avgOrderValue
       FROM "ShowRateHistory" rh
       LEFT JOIN "Order" o ON o."showId" = rh."showId" 
         AND o."createdAt" >= rh."effectiveDate"
         AND (rh."expiryDate" IS NULL OR o."createdAt" <= rh."expiryDate")
       WHERE rh."showId" = $1 
         AND rh."organizationId" = $2
         AND rh."effectiveDate" >= CURRENT_DATE - INTERVAL '${timeframe === '6months' ? '6' : '12'} months'
         ${placementType ? `AND rh."placementType" = '${placementType}'` : ''}
       GROUP BY rh.id, rh.rate, rh."effectiveDate", rh."placementType"
       ORDER BY rh."effectiveDate" DESC`,
      [showId, session.organizationId]
    )

    // Get show details
    const { data: show } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT name, category FROM "Show" WHERE id = $1`,
      [showId]
    )

    if (!show?.[0]) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Calculate price elasticity and demand patterns
    const recommendations = []
    const placements = placementType ? [placementType] : ['pre-roll', 'mid-roll', 'post-roll', 'host-read']

    for (const placement of placements) {
      const placementData = (performanceData || []).filter(p => p.placementType === placement)
      
      if (placementData.length < 2) {
        recommendations.push({
          placementType: placement,
          recommendation: 'insufficient_data',
          message: 'Not enough historical data for meaningful recommendations',
          suggestedRate: null,
          confidence: 0
        })
        continue
      }

      // Calculate average conversion rate (orders per rate point)
      const avgRate = placementData.reduce((sum, p) => sum + parseFloat(p.rate), 0) / placementData.length
      const avgRevenue = placementData.reduce((sum, p) => sum + parseFloat(p.totalRevenue), 0) / placementData.length
      const totalOrders = placementData.reduce((sum, p) => sum + parseInt(p.ordersCount), 0)

      // Simple price optimization based on revenue per rate point
      const revenuePerRatePoint = totalOrders > 0 ? avgRevenue / avgRate : 0
      
      let suggestedRate = avgRate
      let confidence = 50
      let recommendationType = 'maintain'
      let message = 'Current rate appears optimal based on historical performance'

      // Determine recommendation based on performance patterns
      if (revenuePerRatePoint > avgRate * 1.5) {
        // High conversion rate - can potentially increase rates
        suggestedRate = avgRate * 1.15
        recommendationType = 'increase'
        message = 'Strong demand indicates potential for rate increase'
        confidence = 75
      } else if (revenuePerRatePoint < avgRate * 0.8 && totalOrders < 5) {
        // Low conversion rate - consider decreasing rates
        suggestedRate = avgRate * 0.9
        recommendationType = 'decrease'
        message = 'Low demand suggests rate reduction may increase bookings'
        confidence = 65
      }

      // Factor in target revenue if provided
      if (targetRevenue && totalOrders > 0) {
        const currentMonthlyRevenue = avgRevenue
        const revenueGap = targetRevenue - currentMonthlyRevenue
        
        if (revenueGap > 0) {
          // Need to increase revenue
          const targetRate = avgRate * (1 + (revenueGap / currentMonthlyRevenue) * 0.5)
          suggestedRate = Math.min(targetRate, avgRate * 1.3) // Cap at 30% increase
          recommendationType = 'increase_for_target'
          message = `Rate increase suggested to reach target revenue of $${targetRevenue.toLocaleString()}`
        }
      }

      recommendations.push({
        placementType: placement,
        recommendation: recommendationType,
        message,
        currentRate: avgRate.toFixed(2),
        suggestedRate: suggestedRate.toFixed(2),
        potentialImpact: ((suggestedRate - avgRate) / avgRate * 100).toFixed(1),
        confidence,
        historicalData: {
          avgRate: avgRate.toFixed(2),
          avgRevenue: avgRevenue.toFixed(2),
          totalOrders,
          revenuePerRatePoint: revenuePerRatePoint.toFixed(2)
        }
      })
    }

    return NextResponse.json({
      showName: show[0].name,
      showId,
      recommendations,
      analysis: {
        timeframe,
        dataPoints: performanceData?.length || 0,
        targetRevenue,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Rate optimization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}