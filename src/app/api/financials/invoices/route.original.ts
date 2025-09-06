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
    const status = searchParams.get('status') as 'paid' | 'pending' | 'overdue' | null

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

    const whereClause: any = {
      organizationId: user.organizationId,
      createdAt: {
        gte: startDate,
        lte: now
      }
    }

    // Master users already handled by schema selection

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
        '/api/financials/invoices',
        request
      )
    }

    // Fetch real invoices from the Invoice model using schema-aware query
    let invoicesQuery = `
      SELECT i.*
      FROM "Invoice" i
      WHERE i."createdAt" >= $1 AND i."createdAt" <= $2
    `
    const queryParams: any[] = [startDate, now]
    
    if (status) {
      invoicesQuery += ` AND i.status = $${queryParams.length + 1}`
      queryParams.push(status)
    }
    
    invoicesQuery += ` ORDER BY i."issueDate" DESC`
    
    if (limit) {
      invoicesQuery += ` LIMIT $${queryParams.length + 1}`
      queryParams.push(limit)
    }
    
    const invoicesRaw = await querySchema<any>(orgSlug, invoicesQuery, queryParams)
    
    // Get organization info from public schema
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true }
    })
    
    // Fetch related data for each invoice
    const invoices = await Promise.all(invoicesRaw.map(async (invoice) => {
      // Fetch invoice items
      const itemsQuery = `SELECT * FROM "InvoiceItem" WHERE "invoiceId" = $1`
      const items = await querySchema<any>(orgSlug, itemsQuery, [invoice.id])
      
      // Fetch payments
      const paymentsQuery = `SELECT * FROM "Payment" WHERE "invoiceId" = $1`
      const payments = await querySchema<any>(orgSlug, paymentsQuery, [invoice.id])
      
      return {
        ...invoice,
        organization: { name: organization?.name || 'Unknown' },
        items: items || [],
        payments: payments || []
      }
    }))

    // Transform to match expected frontend format
    const formattedInvoices = invoices.map(invoice => {
      // Calculate totals from items or use stored amounts
      const itemsTotal = invoice.items.reduce((sum, item) => sum + item.amount, 0)
      const totalAmount = itemsTotal > 0 ? itemsTotal : invoice.totalAmount
      
      // Calculate paid amount from payments
      const paidAmount = invoice.payments
        .filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + payment.amount, 0)
      
      // Determine actual status considering payments
      let actualStatus = invoice.status
      if (actualStatus === 'sent' || actualStatus === 'pending') {
        const now = new Date()
        if (paidAmount >= totalAmount) {
          actualStatus = 'paid'
        } else if (new Date(invoice.dueDate) < now) {
          actualStatus = 'overdue'
        }
      }
      
      return {
        id: invoice.id,
        number: invoice.invoiceNumber,
        campaignId: null, // May not be directly linked to campaigns
        client: invoice.clientName || invoice.organization?.name || 'Unknown Client',
        clientId: invoice.organizationId,
        description: invoice.description,
        amount: totalAmount,
        currency: 'USD',
        status: actualStatus,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        paidDate: actualStatus === 'paid' && invoice.paidDate ? invoice.paidDate.toISOString() : null,
        paymentMethod: paidAmount > 0 ? 'Bank Transfer' : null, // Could be enhanced with actual payment method
        reference: invoice.referenceNumber || invoice.invoiceNumber,
        notes: invoice.notes,
        lineItems: invoice.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.unitPrice,
          amount: item.amount
        })) || [
          {
            description: invoice.description,
            quantity: 1,
            rate: totalAmount,
            amount: totalAmount
          }
        ]
      }
    })

    // Calculate summary statistics from formatted invoices
    const totalAmount = formattedInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const paidAmount = formattedInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
    const pendingAmount = formattedInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0)
    const overdueAmount = formattedInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)
    
    const paidCount = formattedInvoices.filter(inv => inv.status === 'paid').length
    const pendingCount = formattedInvoices.filter(inv => inv.status === 'pending').length
    const overdueCount = formattedInvoices.filter(inv => inv.status === 'overdue').length

    const response = {
      invoices: formattedInvoices,
      summary: {
        total: {
          amount: totalAmount,
          count: formattedInvoices.length
        },
        paid: {
          amount: paidAmount,
          count: paidCount
        },
        pending: {
          amount: pendingAmount,
          count: pendingCount
        },
        overdue: {
          amount: overdueAmount,
          count: overdueCount
        }
      },
      dateRange,
      filters: {
        status,
        limit
      }
    }

    console.log('✅ Financial Invoices API: Returning real invoice data', {
      totalInvoices: formattedInvoices.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}
