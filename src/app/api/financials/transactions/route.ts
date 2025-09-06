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
    const dateRange = searchParams.get('dateRange') || 'thisMonth'
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') as 'income' | 'expense' | null

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
        '/api/financials/transactions',
        request
      )
    }

    // Fetch campaigns for revenue transactions using schema-aware query
    const campaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
      ORDER BY c."createdAt" DESC
    `
    const campaignsRaw = await querySchema<any>(orgSlug, campaignsQuery, [startDate, now])
    
    const campaigns = campaignsRaw.map(campaign => ({
      ...campaign,
      advertiser: campaign.advertiser_id ? {
        id: campaign.advertiser_id,
        name: campaign.advertiser_name
      } : null
    }))

    // Fetch expenses using schema-aware query
    const expensesQuery = `
      SELECT 
        e.*,
        u.name as creator_name
      FROM "Expense" e
      LEFT JOIN public."User" u ON u.id = e."createdBy"
      WHERE e."createdAt" >= $1 AND e."createdAt" <= $2
      ORDER BY e."createdAt" DESC
    `
    const expensesRaw = await querySchema<any>(orgSlug, expensesQuery, [startDate, now])
    
    const expenses = expensesRaw.map(expense => ({
      ...expense,
      creator: expense.creator_name ? {
        name: expense.creator_name
      } : null
    }))

    // Convert campaigns to income transactions
    const incomeTransactions = campaigns.map(campaign => ({
      id: `INC-${campaign.id}`,
      type: 'income' as const,
      description: `Campaign: ${campaign.name}`,
      client: campaign.advertiser?.name || 'Direct Client',
      amount: campaign.budget || 0,
      date: campaign.createdAt.toISOString(),
      status: campaign.status === 'completed' ? 'completed' : 'pending',
      category: 'Campaign Revenue',
      reference: campaign.id
    }))

    // Convert expenses to expense transactions
    const expenseTransactions = expenses.map(expense => ({
      id: `EXP-${expense.id}`,
      type: 'expense' as const,
      description: expense.description,
      vendor: expense.vendor,
      amount: expense.amount,
      date: expense.createdAt.toISOString(),
      status: expense.status === 'paid' ? 'completed' : expense.status === 'overdue' ? 'overdue' : 'pending',
      category: expense.category,
      reference: expense.invoiceNumber || expense.id,
      notes: expense.notes
    }))

    // Combine and filter transactions
    let allTransactions = [...incomeTransactions, ...expenseTransactions]
    
    // Filter by type if specified
    if (type) {
      allTransactions = allTransactions.filter(t => t.type === type)
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Apply limit
    const limitedTransactions = allTransactions.slice(0, limit)

    // Calculate summary statistics
    const totalIncome = allTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalExpenses = allTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const netAmount = totalIncome - totalExpenses

    const pendingCount = allTransactions
      .filter(t => t.status === 'pending')
      .length
    
    const completedCount = allTransactions
      .filter(t => t.status === 'completed')
      .length

    return NextResponse.json(limitedTransactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
