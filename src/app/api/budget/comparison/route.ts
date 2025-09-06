import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

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
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const compareYear = parseInt(searchParams.get('compareYear') || (year - 1).toString())
    const sellerId = searchParams.get('sellerId')
    const groupBy = searchParams.get('groupBy') as 'month' | 'quarter' | 'year' || 'month'

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query parameters
    const queryParams: any[] = [year]
    let paramIndex = 2

    if (sellerId) {
      queryParams.push(sellerId)
      paramIndex++
    }

    // For sales users, restrict to their own data
    if (user.role === 'sales' && !sellerId) {
      queryParams.push(user.id)
      paramIndex++
    }

    // Build comparison query based on groupBy parameter
    let comparisonQuery = ''
    let groupByClause = ''
    let periodLabel = ''

    switch (groupBy) {
      case 'quarter':
        groupByClause = `
          CASE 
            WHEN hb.month IN (1,2,3) THEN 1
            WHEN hb.month IN (4,5,6) THEN 2
            WHEN hb.month IN (7,8,9) THEN 3
            ELSE 4
          END as quarter
        `
        periodLabel = `hb.year || '-Q' || quarter`
        break
      case 'year':
        groupByClause = 'hb.year'
        periodLabel = 'hb.year::text'
        break
      default: // month
        groupByClause = 'hb.year, hb.month'
        periodLabel = `hb.year || '-' || LPAD(hb.month::text, 2, '0')`
    }

    comparisonQuery = `
      WITH actual_revenue AS (
        -- Get actual revenue from orders/invoices for the current year
        SELECT 
          ${groupBy === 'year' ? `EXTRACT(YEAR FROM o."createdAt")::int` : 
            groupBy === 'quarter' ? `
              EXTRACT(YEAR FROM o."createdAt")::int as year,
              CEILING(EXTRACT(MONTH FROM o."createdAt") / 3.0)::int as quarter` : 
            `EXTRACT(YEAR FROM o."createdAt")::int as year, 
             EXTRACT(MONTH FROM o."createdAt")::int as month`} as period_key,
          SUM(COALESCE(i."totalAmount", o."totalAmount", 0)) as actual_amount
        FROM "Order" o
        LEFT JOIN "Invoice" i ON i."orderId" = o.id
        WHERE EXTRACT(YEAR FROM o."createdAt") = $1
          AND o.status NOT IN ('cancelled', 'voided')
        GROUP BY ${groupBy === 'year' ? `EXTRACT(YEAR FROM o."createdAt")` : 
                  groupBy === 'quarter' ? `EXTRACT(YEAR FROM o."createdAt"), CEILING(EXTRACT(MONTH FROM o."createdAt") / 3.0)` : 
                  `EXTRACT(YEAR FROM o."createdAt"), EXTRACT(MONTH FROM o."createdAt")`}
      ),
      current_data AS (
        SELECT 
          ${groupBy === 'year' ? 'hb.year' : 
            groupBy === 'quarter' ? `hb.year, ${groupByClause.split(' as ')[1]}` : 
            'hb.year, hb.month'} as period_key,
          ${periodLabel} as period,
          SUM(hb."budgetAmount") as "currentBudget",
          COALESCE(ar.actual_amount, 0) as "currentActual",
          (COALESCE(ar.actual_amount, 0) - SUM(hb."budgetAmount")) as "budgetVariance",
          COUNT(DISTINCT CASE 
            WHEN ABS(COALESCE(ar.actual_amount, 0) - hb."budgetAmount") < (hb."budgetAmount" * 0.1) 
            THEN hb."sellerId" 
          END) as "sellersOnTarget",
          COUNT(DISTINCT CASE 
            WHEN ABS(COALESCE(ar.actual_amount, 0) - hb."budgetAmount") >= (hb."budgetAmount" * 0.1) 
            THEN hb."sellerId" 
          END) as "sellersOffTarget"
        FROM "HierarchicalBudget" hb
        LEFT JOIN public."User" s ON hb."sellerId" = s.id
        LEFT JOIN actual_revenue ar ON 
          ${groupBy === 'year' ? 'ar.period_key = hb.year' : 
            groupBy === 'quarter' ? `ar.year = hb.year AND ar.quarter = ${groupByClause.includes('quarter') ? 'quarter' : 'NULL'}` : 
            'ar.year = hb.year AND ar.month = hb.month'}
        WHERE hb.year = $1 AND hb."isActive" = true
          ${sellerId ? `AND hb."sellerId" = $${paramIndex}` : ''}
          ${user.role === 'sales' ? `AND hb."sellerId" = $${user.role === 'sales' && !sellerId ? paramIndex : paramIndex + 1}` : ''}
        GROUP BY ${groupBy === 'year' ? 'hb.year, ar.actual_amount' : 
                  groupBy === 'quarter' ? `hb.year, quarter, ar.actual_amount` : 
                  'hb.year, hb.month, ar.actual_amount'}
      ),
      previous_data AS (
        SELECT 
          ${groupBy === 'year' ? 'hb.year' : 
            groupBy === 'quarter' ? `hb.year, ${groupByClause.split(' as ')[1]}` : 
            'hb.year, hb.month'} as period_key,
          SUM(hb."actualAmount") as "previousActual"
        FROM "HierarchicalBudget" hb
        LEFT JOIN public."User" s ON hb."sellerId" = s.id
        WHERE hb.year = $${paramIndex++} AND hb."isActive" = true
          ${sellerId ? `AND hb."sellerId" = $${paramIndex++}` : ''}
          ${user.role === 'sales' ? `AND hb."sellerId" = $${paramIndex++}` : ''}
        GROUP BY ${groupBy === 'year' ? 'hb.year' : 
                  groupBy === 'quarter' ? `hb.year, quarter` : 
                  'hb.year, hb.month'}
      )
      SELECT 
        cd.period,
        cd."currentBudget",
        cd."currentActual",
        COALESCE(pd."previousActual", 0) as "previousActual",
        cd."budgetVariance",
        CASE 
          WHEN cd."currentBudget" > 0 
          THEN (cd."budgetVariance" / cd."currentBudget") * 100 
          ELSE 0 
        END as "budgetVariancePercent",
        CASE 
          WHEN COALESCE(pd."previousActual", 0) > 0 
          THEN ((cd."currentActual" - COALESCE(pd."previousActual", 0)) / COALESCE(pd."previousActual", 0)) * 100 
          ELSE 0 
        END as "yearOverYearGrowth",
        ABS(cd."budgetVariance") < (cd."currentBudget" * 0.1) as "isOnTarget",
        cd."sellersOnTarget",
        cd."sellersOffTarget"
      FROM current_data cd
      LEFT JOIN previous_data pd ON cd.period_key = pd.period_key
      ORDER BY cd.period
    `

    // Add comparison year to params
    queryParams.push(compareYear)
    if (sellerId) {
      queryParams.push(sellerId)
    }
    if (user.role === 'sales') {
      queryParams.push(user.id)
    }

    const { data: comparison = [], error: comparisonError } = await safeQuerySchema(
      orgSlug, 
      comparisonQuery, 
      queryParams
    )

    if (comparisonError) {
      console.error('Error fetching budget comparison:', comparisonError)
      return NextResponse.json({ comparison: [], summary: {} })
    }

    // Calculate summary statistics (ensure numeric addition)
    const summary = {
      totalCurrentBudget: comparison.reduce((sum, row) => sum + Number(row.currentBudget || 0), 0),
      totalCurrentActual: comparison.reduce((sum, row) => sum + Number(row.currentActual || 0), 0),
      totalPreviousActual: comparison.reduce((sum, row) => sum + Number(row.previousActual || 0), 0),
      overallVariance: comparison.reduce((sum, row) => sum + Number(row.budgetVariance || 0), 0),
      overallYoYGrowth: 0,
      sellersOnTarget: 0,
      sellersOffTarget: 0,
      periodsAnalyzed: comparison.length,
      bestPeriod: null as any,
      worstPeriod: null as any
    }

    // Calculate overall year-over-year growth
    if (summary.totalPreviousActual > 0) {
      summary.overallYoYGrowth = ((summary.totalCurrentActual - summary.totalPreviousActual) / summary.totalPreviousActual) * 100
    }

    // Find best and worst performing periods
    if (comparison.length > 0) {
      summary.bestPeriod = comparison.reduce((best, current) => 
        Number(current.yearOverYearGrowth || 0) > Number(best.yearOverYearGrowth || 0) ? current : best
      )
      
      summary.worstPeriod = comparison.reduce((worst, current) => 
        Number(current.yearOverYearGrowth || 0) < Number(worst.yearOverYearGrowth || 0) ? current : worst
      )

      // Count unique sellers on/off target across all periods
      const sellerStats = comparison.reduce((stats, row) => {
        stats.onTarget += Number(row.sellersOnTarget || 0)
        stats.offTarget += Number(row.sellersOffTarget || 0)
        return stats
      }, { onTarget: 0, offTarget: 0 })

      // Average across periods
      summary.sellersOnTarget = Math.round(sellerStats.onTarget / comparison.length)
      summary.sellersOffTarget = Math.round(sellerStats.offTarget / comparison.length)
    }

    return NextResponse.json({
      comparison,
      summary,
      metadata: {
        year,
        compareYear,
        groupBy,
        sellerId,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching budget comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}