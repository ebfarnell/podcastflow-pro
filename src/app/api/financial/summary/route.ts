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

    const orgSlug = session.organizationSlug || 'org_podcastflow_pro'
    
    // Get current month dates
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    // Get previous month dates for comparison
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Fetch current month revenue
    const { data: revenueData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const campaigns = await prisma.campaign.findMany({
        where: {
          organizationId: session.organizationId,
          startDate: { lte: endOfMonth },
          endDate: { gte: startOfMonth }
        }
      })

      // Calculate prorated revenue for the current month
      const currentMonthRevenue = campaigns.reduce((sum, campaign) => {
        const campaignStart = new Date(campaign.startDate)
        const campaignEnd = new Date(campaign.endDate)
        const effectiveStart = campaignStart > startOfMonth ? campaignStart : startOfMonth
        const effectiveEnd = campaignEnd < endOfMonth ? campaignEnd : endOfMonth
        
        if (effectiveEnd >= effectiveStart) {
          const totalDays = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const monthDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const proratedAmount = (campaign.budget || 0) * (monthDays / totalDays)
          return sum + proratedAmount
        }
        return sum
      }, 0)

      return currentMonthRevenue
    }, 0)

    // Fetch last month revenue for comparison
    const { data: lastMonthRevenue } = await safeQuerySchema(orgSlug, async (prisma) => {
      const campaigns = await prisma.campaign.findMany({
        where: {
          organizationId: session.organizationId,
          startDate: { lte: endOfLastMonth },
          endDate: { gte: startOfLastMonth }
        }
      })

      const revenue = campaigns.reduce((sum, campaign) => {
        const campaignStart = new Date(campaign.startDate)
        const campaignEnd = new Date(campaign.endDate)
        const effectiveStart = campaignStart > startOfLastMonth ? campaignStart : startOfLastMonth
        const effectiveEnd = campaignEnd < endOfLastMonth ? campaignEnd : endOfLastMonth
        
        if (effectiveEnd >= effectiveStart) {
          const totalDays = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const monthDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const proratedAmount = (campaign.budget || 0) * (monthDays / totalDays)
          return sum + proratedAmount
        }
        return sum
      }, 0)

      return revenue
    }, 0)

    // Fetch current month expenses
    const { data: expenseData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      })

      return expenses.reduce((sum, expense) => sum + expense.amount, 0)
    }, 0)

    // Fetch outstanding invoices
    const { data: invoiceData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: session.organizationId,
          status: {
            in: ['sent', 'partial', 'overdue']
          }
        },
        include: {
          payments: true
        }
      })

      const totalOutstanding = invoices.reduce((sum, invoice) => {
        const paidAmount = invoice.payments.reduce((pSum, payment) => pSum + payment.amount, 0)
        return sum + (invoice.amount - paidAmount)
      }, 0)

      const overdueCount = invoices.filter(inv => {
        const dueDate = new Date(inv.dueDate)
        return dueDate < now && inv.status !== 'paid'
      }).length

      return {
        totalOutstanding,
        overdueCount
      }
    }, { totalOutstanding: 0, overdueCount: 0 })

    // Calculate metrics
    const mtdRevenue = revenueData || 0
    const mtdExpenses = expenseData || 0
    const netProfit = mtdRevenue - mtdExpenses
    const profitMargin = mtdRevenue > 0 ? (netProfit / mtdRevenue) * 100 : 0
    const expenseRatio = mtdRevenue > 0 ? (mtdExpenses / mtdRevenue) * 100 : 0
    const revenueGrowth = lastMonthRevenue > 0 ? 
      ((mtdRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

    return NextResponse.json({
      mtdRevenue: Math.round(mtdRevenue),
      mtdExpenses: Math.round(mtdExpenses),
      netProfit: Math.round(netProfit),
      profitMargin: Math.round(profitMargin * 10) / 10,
      expenseRatio: Math.round(expenseRatio * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      outstandingInvoices: Math.round(invoiceData?.totalOutstanding || 0),
      overdueCount: invoiceData?.overdueCount || 0
    })
  } catch (error) {
    console.error('Financial summary error:', error)
    return NextResponse.json(
      { 
        mtdRevenue: 0,
        mtdExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        expenseRatio: 0,
        revenueGrowth: 0,
        outstandingInvoices: 0,
        overdueCount: 0
      },
      { status: 200 }
    )
  }
}