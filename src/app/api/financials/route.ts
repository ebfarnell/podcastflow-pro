import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('dateRange') || 'thisMonth'

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (dateRange) {
      case 'thisMonth':
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'lastMonth':
        startDate.setMonth(now.getMonth() - 1)
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        now.setDate(0) // Last day of previous month
        break
      case 'thisQuarter':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        startDate.setMonth(currentQuarter * 3)
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisYear':
        startDate.setMonth(0)
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        break
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
        '/api/financials',
        request
      )
    }

    // Fetch campaigns for revenue using schema-aware queries
    const campaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
    `
    const campaignsRaw = await querySchema<any>(orgSlug, campaignsQuery, [startDate, now])
    
    const campaigns = campaignsRaw.map(campaign => ({
      ...campaign,
      advertiser: campaign.advertiser_id ? {
        id: campaign.advertiser_id,
        name: campaign.advertiser_name
      } : null
    }))

    // Fetch expenses using schema-aware queries
    const expensesQuery = `
      SELECT * FROM "Expense"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
    `
    const expenses = await querySchema<any>(orgSlug, expensesQuery, [startDate, now])

    // Calculate revenue from campaigns (using budget as proxy for now)
    const totalRevenue = campaigns.reduce((sum, campaign) => {
      return sum + (campaign.budget || 0)
    }, 0)

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => {
      return sum + expense.amount
    }, 0)

    // Calculate different expense categories
    const expensesByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
      return acc
    }, {} as Record<string, number>)

    // Calculate recurring vs one-time expenses
    const recurringExpenses = expenses
      .filter(e => e.type === 'recurring')
      .reduce((sum, e) => sum + e.amount, 0)
    
    const oneTimeExpenses = expenses
      .filter(e => e.type === 'oneTime')
      .reduce((sum, e) => sum + e.amount, 0)

    // Calculate expenses by status
    const paidExpenses = expenses
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0)
    
    const pendingExpenses = expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0)
    
    const overdueExpenses = expenses
      .filter(e => e.status === 'overdue')
      .reduce((sum, e) => sum + e.amount, 0)

    // Calculate profit metrics
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Calculate growth (compare to previous period)
    const previousPeriodEnd = new Date(startDate)
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)
    const previousPeriodStart = new Date(startDate)
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1)

    const previousCampaignsQuery = `
      SELECT * FROM "Campaign"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
    `
    const previousCampaigns = await querySchema<any>(orgSlug, previousCampaignsQuery, [previousPeriodStart, previousPeriodEnd])

    const previousRevenue = previousCampaigns.reduce((sum, campaign) => {
      return sum + (campaign.budget || 0)
    }, 0)

    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0

    // Count invoices (campaigns that are active or completed)
    const outstandingInvoiceCount = campaigns.filter(c => 
      c.status === 'active' || c.status === 'completed'
    ).length

    // Estimate outstanding amount (campaigns not yet paid)
    const outstandingInvoices = campaigns
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.budget || 0), 0)

    // Estimate monthly recurring revenue (from recurring expenses as a proxy)
    const monthlyRecurring = recurringExpenses

    const response = {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      outstandingInvoices,
      outstandingInvoiceCount,
      monthlyRecurring,
      revenueGrowth,
      expenses: {
        total: totalExpenses,
        recurring: recurringExpenses,
        oneTime: oneTimeExpenses,
        paid: paidExpenses,
        pending: pendingExpenses,
        overdue: overdueExpenses,
        byCategory: expensesByCategory
      },
      campaigns: {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        completed: campaigns.filter(c => c.status === 'completed').length
      },
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching financial summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial summary' },
      { status: 500 }
    )
  }
}