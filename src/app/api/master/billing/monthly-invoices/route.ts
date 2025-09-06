import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import { campaignBillingService } from '@/lib/invoices/campaign-billing'

// POST /api/master/billing/monthly-invoices - Generate monthly recurring invoices
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const organizationId = body.organizationId // Optional - can generate for all or specific org

    console.log('📅 Generating monthly recurring invoices:', organizationId ? `org: ${organizationId}` : 'all organizations')

    const results = await campaignBillingService.generateMonthlyRecurringInvoices(organizationId)

    const summary = {
      processed: results.length,
      created: results.filter(r => r.status === 'created').length,
      existing: results.filter(r => r.status === 'already_exists').length,
      errors: results.filter(r => r.status === 'error').length,
      totalAmount: results
        .filter(r => r.status === 'created')
        .reduce((sum, r) => sum + (r.amount || 0), 0)
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Monthly invoice generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly invoices' },
      { status: 500 }
    )
  }
})

// GET /api/master/billing/monthly-invoices - Get monthly invoice generation status
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())

    console.log('📊 Getting monthly invoice status:', { year, month })

    const prisma = (await import('@/lib/db/prisma')).default

    // Get invoices for the specified month
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0)

    const monthlyInvoices = await prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: startDate,
          lte: endDate
        },
        plan: 'campaign' // Only campaign-related invoices
      },
      include: {
        organization: true,
        items: {
          include: {
            campaign: true
          }
        },
        payments: true
      },
      orderBy: { issueDate: 'desc' }
    })

    const summary = {
      totalInvoices: monthlyInvoices.length,
      totalAmount: monthlyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidAmount: monthlyInvoices.reduce((sum, inv) => {
        const paid = inv.payments.reduce((paySum, payment) => paySum + payment.amount, 0)
        return sum + paid
      }, 0),
      organizations: new Set(monthlyInvoices.map(inv => inv.organizationId)).size,
      campaigns: new Set(monthlyInvoices.flatMap(inv => 
        inv.items.map(item => item.campaignId).filter(Boolean)
      )).size
    }

    const invoiceDetails = monthlyInvoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      organizationName: invoice.organization.name,
      amount: invoice.totalAmount,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      campaigns: invoice.items
        .filter(item => item.campaign)
        .map(item => ({
          id: item.campaignId,
          name: item.campaign?.name
        })),
      paidAmount: invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
    }))

    return NextResponse.json({
      period: { year, month: month + 1 },
      summary,
      invoices: invoiceDetails,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Monthly invoice status error:', error)
    return NextResponse.json(
      { error: 'Failed to get monthly invoice status' },
      { status: 500 }
    )
  }
})