import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma' // Only for public schema
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/financials/invoices
 * List invoices with tenant isolation
 */
export async function GET(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      // Get query parameters
      const searchParams = request.nextUrl.searchParams
      const dateRange = searchParams.get('dateRange') || 'thisMonth'
      const limit = parseInt(searchParams.get('limit') || '10')
      const status = searchParams.get('status') as 'paid' | 'pending' | 'overdue' | null
      const typeParam = searchParams.get('type') as 'incoming' | 'outgoing' | null
      
      // Validate type parameter
      if (typeParam && !['incoming', 'outgoing'].includes(typeParam)) {
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
      }

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

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Build query conditions
      const where: any = {
        createdAt: {
          gte: startDate,
          lte: now
        }
      }

      if (status) {
        where.status = status
      }

      // Apply type filtering (after migration adds the column)
      if (typeParam) {
        where.type = typeParam
      }

      // Fetch invoices with related data
      const invoices = await tenantDb.invoice.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        take: limit,
        include: {
          invoiceItems: true,
          payments: true,
          campaign: true,
          advertiser: true,
          agency: true
        }
      })

      // Get organization info from public schema
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: { name: true }
      })

      // Transform to match expected frontend format
      const formattedInvoices = invoices.map(invoice => {
        // Calculate totals from items or use stored amounts
        const itemsTotal = invoice.invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0)
        const totalAmount = itemsTotal > 0 ? itemsTotal : invoice.totalAmount
        
        // Calculate paid amount from payments
        const paidAmount = invoice.payments
          .filter(payment => payment.status === 'completed')
          .reduce((sum, payment) => sum + (payment.amount || 0), 0)
        
        // Determine actual status considering payments
        let actualStatus = invoice.status
        if (actualStatus === 'sent' || actualStatus === 'pending') {
          const now = new Date()
          if (paidAmount >= totalAmount) {
            actualStatus = 'paid'
          } else if (invoice.dueDate && new Date(invoice.dueDate) < now) {
            actualStatus = 'overdue'
          }
        }
        
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          type: invoice.type || 'incoming', // Use actual type from DB, default to incoming for backward compat
          invoiceType: 'standard', // Keep for backward compatibility
          dueDate: invoice.dueDate?.toISOString(),
          issueDate: invoice.issueDate?.toISOString(),
          amount: totalAmount, // Simplified field name for UI
          totalAmount,
          paidAmount,
          remainingAmount: totalAmount - paidAmount,
          status: actualStatus,
          paymentStatus: paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
          currency: invoice.currency || 'USD',
          organization: { name: organization?.name || 'Unknown' },
          campaignId: invoice.campaignId,
          campaign: invoice.campaign ? {
            id: invoice.campaign.id,
            name: invoice.campaign.name
          } : null,
          advertiser: invoice.advertiser ? {
            id: invoice.advertiser.id,
            name: invoice.advertiser.name
          } : null,
          vendor: invoice.vendor ? {
            id: invoice.vendor.id,
            name: invoice.vendor.name
          } : null,
          agency: invoice.agency ? {
            id: invoice.agency.id,
            name: invoice.agency.name
          } : null,
          items: invoice.invoiceItems.map(item => ({
            id: item.id,
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            amount: item.amount || 0
          })),
          payments: invoice.payments.map(payment => ({
            id: payment.id,
            amount: payment.amount || 0,
            paymentDate: payment.paymentDate?.toISOString(),
            method: payment.paymentMethod || payment.method || 'unknown'
          })),
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString()
        }
      })

      console.log(`✅ Invoices API: Returning ${formattedInvoices.length} invoices for ${context.organizationSlug}`)

      // Calculate summary
      const totalInvoiced = formattedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
      const totalPaid = formattedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0)
      const totalOutstanding = totalInvoiced - totalPaid

      return NextResponse.json({
        invoices: formattedInvoices,
        summary: {
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          count: formattedInvoices.length
        }
      })

    } catch (error) {
      console.error('❌ Invoices API Error:', error)
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
}

/**
 * POST /api/financials/invoices
 * Create a new invoice with tenant isolation
 */
export async function POST(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      const body = await request.json()
      const {
        campaignId,
        advertiserId,
        agencyId,
        type = 'standard',
        issueDate,
        dueDate,
        currency = 'USD',
        notes,
        items = []
      } = body

      // Validate required fields
      if (!advertiserId || items.length === 0) {
        return NextResponse.json(
          { error: 'Advertiser ID and invoice items are required' },
          { status: 400 }
        )
      }

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Verify advertiser exists in tenant
      const advertiser = await tenantDb.advertiser.findUnique({
        where: { id: advertiserId }
      })

      if (!advertiser) {
        return NextResponse.json(
          { error: 'Advertiser not found' },
          { status: 404 }
        )
      }

      // Verify campaign if provided
      if (campaignId) {
        const campaign = await tenantDb.campaign.findUnique({
          where: { id: campaignId }
        })

        if (!campaign) {
          return NextResponse.json(
            { error: 'Campaign not found' },
            { status: 404 }
          )
        }
      }

      // Verify agency if provided
      if (agencyId) {
        const agency = await tenantDb.agency.findUnique({
          where: { id: agencyId }
        })

        if (!agency) {
          return NextResponse.json(
            { error: 'Agency not found' },
            { status: 404 }
          )
        }
      }

      // Generate invoice number
      const invoiceCount = await tenantDb.invoice.count()
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`

      // Calculate total amount
      const totalAmount = items.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.amount) || 0)
      }, 0)

      // Create invoice with items
      const newInvoice = await tenantDb.invoice.create({
        data: {
          invoiceNumber,
          type,
          campaignId,
          advertiserId,
          agencyId,
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          totalAmount,
          currency,
          status: 'draft',
          notes: notes || '',
          createdBy: context.userId,
          organizationId: context.organizationId,
          invoiceItems: {
            create: items.map((item: any) => ({
              description: item.description || '',
              quantity: parseInt(item.quantity) || 1,
              rate: parseFloat(item.rate) || 0,
              amount: parseFloat(item.amount) || 0
            }))
          }
        },
        include: {
          invoiceItems: true,
          campaign: true,
          advertiser: true,
          agency: true
        }
      })

      console.log(`✅ Invoices API: Created invoice "${newInvoice.invoiceNumber}" with ID: ${newInvoice.id}`)

      return NextResponse.json(newInvoice, { status: 201 })

    } catch (error) {
      console.error('❌ Invoices API Error:', error)
      return NextResponse.json(
        { error: 'Failed to create invoice', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
}