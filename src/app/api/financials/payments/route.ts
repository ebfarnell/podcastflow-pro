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
    const type = searchParams.get('type') as 'incoming' | 'outgoing' | null

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
        '/api/financials/payments',
        request
      )
    }

    // Fetch campaigns for revenue payments using schema-aware query
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

    // Fetch expenses for outgoing payments using schema-aware query
    const expensesQuery = `
      SELECT * FROM "Expense"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND status = 'paid'
      ORDER BY "createdAt" DESC
    `
    const expenses = await querySchema<any>(orgSlug, expensesQuery, [startDate, now])

    const payments = []

    // Transform completed campaigns into incoming payments
    const incomingPayments = campaigns
      .filter(campaign => campaign.status === 'completed')
      .map((campaign, index) => ({
        id: `PAY-IN-${campaign.id.slice(-6).toUpperCase()}`,
        type: 'incoming' as const,
        amount: campaign.budget || 0,
        currency: 'USD',
        status: 'completed',
        date: campaign.endDate || campaign.updatedAt.toISOString(),
        processedDate: campaign.endDate || campaign.updatedAt.toISOString(),
        method: 'Bank Transfer',
        reference: `REV-${campaign.id}`,
        description: `Payment for ${campaign.name}`,
        from: campaign.advertiser.name,
        to: user.organization?.name || 'PodcastFlow Pro',
        client: campaign.advertiser.name,
        invoiceId: `INV-${campaign.id.slice(-6).toUpperCase()}`,
        campaignId: campaign.id
      }))

    // Transform paid expenses into outgoing payments
    const outgoingPayments = expenses.map((expense, index) => ({
      id: `PAY-OUT-${expense.id.slice(-6).toUpperCase()}`,
      type: 'outgoing' as const,
      amount: expense.amount,
      currency: 'USD',
      status: 'completed',
      date: expense.updatedAt.toISOString(),
      processedDate: expense.updatedAt.toISOString(),
      method: 'Bank Transfer',
      reference: expense.invoiceNumber || `EXP-${expense.id}`,
      description: expense.description,
      from: user.organization?.name || 'PodcastFlow Pro',
      to: expense.vendor,
      client: expense.vendor,
      invoiceId: expense.invoiceNumber || null,
      expenseId: expense.id
    }))

    // Combine payments
    let allPayments = [...incomingPayments, ...outgoingPayments]

    // Filter by type if specified
    if (type) {
      allPayments = allPayments.filter(p => p.type === type)
    }

    // Sort by date (newest first)
    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Apply limit
    const limitedPayments = allPayments.slice(0, limit)

    return NextResponse.json(limitedPayments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can record payments
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { campaignId, amount, method, reference, notes } = body

    // Validate required fields
    if (!campaignId || !amount || !method) {
      return NextResponse.json(
        { error: 'Campaign ID, amount, and payment method are required' },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Find the campaign using schema-aware query
    const campaignQuery = `SELECT * FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [campaignId])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    const campaign = campaigns[0]

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Update campaign status to completed if it's not already
    if (campaign.status !== 'completed') {
      const updateQuery = `
        UPDATE "Campaign"
        SET status = 'completed', "endDate" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1
      `
      await querySchema(orgSlug, updateQuery, [campaignId])
    }

    // Return the payment record (we're simulating this since we don't have a Payment model)
    const payment = {
      id: `PAY-${Date.now()}`,
      type: 'incoming',
      amount,
      currency: 'USD',
      status: 'completed',
      date: new Date().toISOString(),
      processedDate: new Date().toISOString(),
      method,
      reference: reference || `PAY-${campaign.id}`,
      description: `Payment recorded for campaign ${campaign.name}`,
      campaignId,
      notes
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}
