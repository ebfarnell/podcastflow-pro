import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
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
    const period = searchParams.get('period') || 'monthly'
    const months = parseInt(searchParams.get('months') || '6')

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
        '/api/financials/cashflow',
        request
      )
    }

    // Generate cash flow data based on period
    const cashFlowData = []
    const now = new Date()
    
    for (let i = months - 1; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

      // Fetch campaigns for this period (income) using schema-aware query
      const campaignsQuery = `
        SELECT * FROM "Campaign"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
      `
      const periodCampaigns = await querySchema<any>(orgSlug, campaignsQuery, [periodStart, periodEnd])
      
      // Fetch expenses for this period using schema-aware query
      const expensesQuery = `
        SELECT * FROM "Expense"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
      `
      const periodExpenses = await querySchema<any>(orgSlug, expensesQuery, [periodStart, periodEnd])
      
      // Calculate income (from campaigns)
      const income = periodCampaigns.reduce((sum, campaign) => {
        return sum + (campaign.budget || 0)
      }, 0)
      
      // Calculate expenses
      const expenses = periodExpenses.reduce((sum, expense) => {
        return sum + expense.amount
      }, 0)
      
      const net = income - expenses
      
      cashFlowData.push({
        month: periodStart.toLocaleDateString('en-US', { month: 'short' }),
        income,
        expenses,
        net
      })
    }

    return NextResponse.json({ data: cashFlowData })
  } catch (error) {
    console.error('Error fetching cash flow:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cash flow data' },
      { status: 500 }
    )
  }
}
