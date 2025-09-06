import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
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
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = user.organizationId
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const startMonth = searchParams.get('startMonth') ? parseInt(searchParams.get('startMonth')!) : 1
    const endMonth = searchParams.get('endMonth') ? parseInt(searchParams.get('endMonth')!) : 12

    // Fetch financial data for the period using schema-aware query
    const financialDataQuery = `
      SELECT * FROM "FinancialData" 
      WHERE year = $1 AND month >= $2 AND month <= $3
      ORDER BY month ASC, "accountType" ASC, "accountCode" ASC
    `
    const { data: financialData = [], error: financialError } = await safeQuerySchema(orgSlug, financialDataQuery, [year, startMonth, endMonth])
    if (financialError) {
      console.error('Error fetching financial data:', financialError)
    }

    // Fetch revenue from orders using schema-aware queries
    const startDate = new Date(year, startMonth - 1, 1)
    const endDate = new Date(year, endMonth - 1, 31)
    
    const ordersQuery = `
      SELECT DISTINCT o.*
      FROM "Order" o
      WHERE o.status IN ('booked', 'confirmed')
        AND EXISTS (
          SELECT 1 FROM "OrderItem" oi 
          WHERE oi."orderId" = o.id 
            AND oi."airDate" >= $1 
            AND oi."airDate" <= $2
        )
    `
    const { data: ordersRaw = [], error: ordersError } = await safeQuerySchema(orgSlug, ordersQuery, [startDate, endDate])
    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
    }
    
    // Fetch order items for each order
    const orders = await Promise.all(ordersRaw.map(async (order) => {
      const itemsQuery = `
        SELECT * FROM "OrderItem"
        WHERE "orderId" = $1 
          AND "airDate" >= $2 
          AND "airDate" <= $3
      `
      const { data: orderItems = [], error: itemsError } = await safeQuerySchema(orgSlug, itemsQuery, [order.id, startDate, endDate])
      if (itemsError) {
        console.error('Error fetching order items:', itemsError)
      }
      return {
        ...order,
        orderItems
      }
    }))

    // Calculate revenue by month
    const revenueByMonth: Record<number, number> = {}
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        const month = new Date(item.airDate).getMonth() + 1
        if (!revenueByMonth[month]) revenueByMonth[month] = 0
        revenueByMonth[month] += item.actualRate
      })
    })

    // Fetch budget data using schema-aware query
    const budgetDataQuery = `
      SELECT 
        be.*,
        bc.id as category_id, bc.name as category_name, bc.type as category_type
      FROM "BudgetEntry" be
      LEFT JOIN "BudgetCategory" bc ON bc.id = be."categoryId"
      WHERE be.year = $1 AND be.month >= $2 AND be.month <= $3
    `
    const { data: budgetDataRaw = [], error: budgetError } = await safeQuerySchema(orgSlug, budgetDataQuery, [year, startMonth, endMonth])
    if (budgetError) {
      console.error('Error fetching budget data:', budgetError)
    }
    
    // Transform to match expected format
    const budgetData = budgetDataRaw.map(entry => ({
      ...entry,
      category: entry.category_id ? {
        id: entry.category_id,
        name: entry.category_name,
        type: entry.category_type
      } : null
    }))

    // Organize P&L structure
    const plByMonth: Record<number, any> = {}
    
    for (let month = startMonth; month <= endMonth; month++) {
      plByMonth[month] = {
        revenue: {
          advertising: revenueByMonth[month] || 0,
          other: 0,
          total: revenueByMonth[month] || 0
        },
        cogs: {
          showRevShare: 0,
          productionCosts: 0,
          total: 0
        },
        grossProfit: 0,
        expenses: {
          salaries: 0,
          benefits: 0,
          bonuses: 0,
          commissions: 0,
          marketing: 0,
          technology: 0,
          office: 0,
          professional: 0,
          other: 0,
          total: 0
        },
        ebitda: 0,
        depreciation: 0,
        interest: 0,
        taxes: 0,
        netIncome: 0
      }
    }

    // Populate P&L with financial data
    financialData.forEach(item => {
      const month = item.month
      if (!plByMonth[month]) return

      switch (item.accountType) {
        case 'revenue':
          if (item.accountName.toLowerCase().includes('other')) {
            plByMonth[month].revenue.other += item.amount
          }
          plByMonth[month].revenue.total += item.amount
          break
        case 'cogs':
          if (item.accountName.toLowerCase().includes('revenue share')) {
            plByMonth[month].cogs.showRevShare += item.amount
          } else {
            plByMonth[month].cogs.productionCosts += item.amount
          }
          plByMonth[month].cogs.total += item.amount
          break
        case 'expense':
          const expenseCategory = categorizeExpense(item.accountName)
          if (plByMonth[month].expenses[expenseCategory] !== undefined) {
            plByMonth[month].expenses[expenseCategory] += item.amount
          } else {
            plByMonth[month].expenses.other += item.amount
          }
          plByMonth[month].expenses.total += item.amount
          break
      }
    })

    // Add employee compensation data using schema-aware query
    const compStartDate = new Date(year, startMonth - 1, 1)
    const compEndDate = new Date(year, endMonth - 1, 31)
    
    const compensationQuery = `
      SELECT * FROM "EmployeeCompensation"
      WHERE year = $1 
        AND "effectiveDate" <= $2
        AND ("endDate" IS NULL OR "endDate" >= $3)
    `
    const { data: compensation = [], error: compensationError } = await safeQuerySchema(orgSlug, compensationQuery, [year, compEndDate, compStartDate])
    if (compensationError) {
      console.error('Error fetching compensation data (table may not exist):', compensationError)
    }

    compensation.forEach(comp => {
      for (let month = startMonth; month <= endMonth; month++) {
        if (comp.baseSalary) {
          plByMonth[month].expenses.salaries += comp.baseSalary / 12
        }
        if (comp.benefits) {
          plByMonth[month].expenses.benefits += comp.benefits / 12
        }
        if (comp.actualBonus) {
          plByMonth[month].expenses.bonuses += comp.actualBonus / 12
        }
        if (comp.actualCommission) {
          plByMonth[month].expenses.commissions += comp.actualCommission / 12
        }
        plByMonth[month].expenses.total += 
          (comp.baseSalary || 0) / 12 +
          (comp.benefits || 0) / 12 +
          (comp.actualBonus || 0) / 12 +
          (comp.actualCommission || 0) / 12
      }
    })

    // Calculate derived values
    Object.keys(plByMonth).forEach(monthStr => {
      const month = parseInt(monthStr)
      const pl = plByMonth[month]
      
      pl.grossProfit = pl.revenue.total - pl.cogs.total
      pl.ebitda = pl.grossProfit - pl.expenses.total
      pl.netIncome = pl.ebitda - pl.depreciation - pl.interest - pl.taxes
    })

    // Calculate totals
    const totals = calculatePeriodTotals(plByMonth)

    // Compare to budget
    const budgetComparison = compareToBudget(plByMonth, budgetData)

    return NextResponse.json({
      period: {
        year,
        startMonth,
        endMonth,
        months: Object.keys(plByMonth).map(m => ({
          number: parseInt(m),
          name: new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'long' })
        }))
      },
      monthlyPL: plByMonth,
      totals,
      budgetComparison,
      metrics: {
        grossMargin: totals.revenue.total > 0 ? (totals.grossProfit / totals.revenue.total) * 100 : 0,
        ebitdaMargin: totals.revenue.total > 0 ? (totals.ebitda / totals.revenue.total) * 100 : 0,
        netMargin: totals.revenue.total > 0 ? (totals.netIncome / totals.revenue.total) * 100 : 0
      }
    })
  } catch (error) {
    console.error('Error generating P&L report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function categorizeExpense(accountName: string): string {
  const name = accountName.toLowerCase()
  if (name.includes('salary') || name.includes('wage')) return 'salaries'
  if (name.includes('benefit') || name.includes('insurance')) return 'benefits'
  if (name.includes('bonus')) return 'bonuses'
  if (name.includes('commission')) return 'commissions'
  if (name.includes('marketing') || name.includes('advertising')) return 'marketing'
  if (name.includes('technology') || name.includes('software')) return 'technology'
  if (name.includes('office') || name.includes('rent')) return 'office'
  if (name.includes('professional') || name.includes('legal') || name.includes('accounting')) return 'professional'
  return 'other'
}

function calculatePeriodTotals(plByMonth: Record<number, any>) {
  const totals = {
    revenue: { advertising: 0, other: 0, total: 0 },
    cogs: { showRevShare: 0, productionCosts: 0, total: 0 },
    grossProfit: 0,
    expenses: {
      salaries: 0, benefits: 0, bonuses: 0, commissions: 0,
      marketing: 0, technology: 0, office: 0, professional: 0,
      other: 0, total: 0
    },
    ebitda: 0,
    depreciation: 0,
    interest: 0,
    taxes: 0,
    netIncome: 0
  }

  Object.values(plByMonth).forEach(month => {
    // Revenue
    totals.revenue.advertising += month.revenue.advertising
    totals.revenue.other += month.revenue.other
    totals.revenue.total += month.revenue.total
    
    // COGS
    totals.cogs.showRevShare += month.cogs.showRevShare
    totals.cogs.productionCosts += month.cogs.productionCosts
    totals.cogs.total += month.cogs.total
    
    // Expenses
    Object.keys(totals.expenses).forEach(key => {
      if (typeof totals.expenses[key as keyof typeof totals.expenses] === 'number') {
        totals.expenses[key as keyof typeof totals.expenses] += month.expenses[key]
      }
    })
    
    // Other
    totals.grossProfit += month.grossProfit
    totals.ebitda += month.ebitda
    totals.depreciation += month.depreciation
    totals.interest += month.interest
    totals.taxes += month.taxes
    totals.netIncome += month.netIncome
  })

  return totals
}

function compareToBudget(plByMonth: Record<number, any>, budgetData: any[]) {
  const comparison: Record<string, any> = {}
  
  budgetData.forEach(budget => {
    const month = budget.month
    if (!comparison[month]) {
      comparison[month] = {
        revenue: { budget: 0, actual: 0, variance: 0, percentVariance: 0 },
        expenses: { budget: 0, actual: 0, variance: 0, percentVariance: 0 },
        netIncome: { budget: 0, actual: 0, variance: 0, percentVariance: 0 }
      }
    }
    
    if (budget.category.type === 'revenue') {
      comparison[month].revenue.budget += budget.budgetAmount
    } else if (budget.category.type === 'expense') {
      comparison[month].expenses.budget += budget.budgetAmount
    }
  })
  
  Object.keys(plByMonth).forEach(monthStr => {
    const month = parseInt(monthStr)
    if (comparison[month]) {
      comparison[month].revenue.actual = plByMonth[month].revenue.total
      comparison[month].revenue.variance = comparison[month].revenue.actual - comparison[month].revenue.budget
      comparison[month].revenue.percentVariance = comparison[month].revenue.budget > 0
        ? (comparison[month].revenue.variance / comparison[month].revenue.budget) * 100
        : 0
        
      comparison[month].expenses.actual = plByMonth[month].expenses.total + plByMonth[month].cogs.total
      comparison[month].expenses.variance = comparison[month].expenses.actual - comparison[month].expenses.budget
      comparison[month].expenses.percentVariance = comparison[month].expenses.budget > 0
        ? (comparison[month].expenses.variance / comparison[month].expenses.budget) * 100
        : 0
        
      comparison[month].netIncome.budget = comparison[month].revenue.budget - comparison[month].expenses.budget
      comparison[month].netIncome.actual = plByMonth[month].netIncome
      comparison[month].netIncome.variance = comparison[month].netIncome.actual - comparison[month].netIncome.budget
      comparison[month].netIncome.percentVariance = comparison[month].netIncome.budget > 0
        ? (comparison[month].netIncome.variance / comparison[month].netIncome.budget) * 100
        : 0
    }
  })
  
  return comparison
}
