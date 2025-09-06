import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { campaignBillingService } from '@/lib/invoices/campaign-billing'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/campaigns/[id]/billing - Get campaign billing information
export const GET = await withApiProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const campaignId = params.id

    console.log('📊 Getting campaign billing information:', campaignId)

    // Get payment history and financial metrics
    const paymentHistory = await getCampaignPaymentHistory(campaignId)
    const financialMetrics = await getCampaignFinancialMetrics(campaignId)

    return NextResponse.json({
      campaignId,
      paymentHistory,
      metrics: financialMetrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Campaign billing info error:', error)
    return NextResponse.json(
      { error: 'Failed to get campaign billing information' },
      { status: 500 }
    )
  }
})

// POST /api/campaigns/[id]/billing - Process campaign payment
export const POST = await withApiProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const campaignId = params.id
    const body = await request.json()

    console.log('💳 Processing campaign payment:', { campaignId, amount: body.amount })

    const result = await campaignBillingService.processCampaignPayment({
      campaignId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      transactionId: body.transactionId,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
      reference: body.reference
    })

    // Calculate commission if agency is involved
    if (result.campaign.agencyId) {
      await campaignBillingService.calculateAgencyCommission(campaignId, body.amount)
    }

    // Log payment processing
    const { user } = request as any
    await auditService.log({
      eventType: AuditEventType.PAYMENT_PROCESSED,
      severity: AuditSeverity.HIGH,
      userId: user?.id,
      organizationId: user?.organizationId,
      entityType: 'campaign',
      entityId: campaignId,
      action: 'Processed campaign payment',
      details: {
        invoiceId: result.invoice.id,
        paymentId: result.payment.id,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        transactionId: body.transactionId,
        campaignName: result.campaign.name,
        hasAgencyCommission: !!result.campaign.agencyId
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      invoiceId: result.invoice.id,
      paymentId: result.payment.id,
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Campaign payment processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process campaign payment' },
      { status: 500 }
    )
  }
})

// Helper functions
async function getCampaignPaymentHistory(campaignId: string) {
  // Get organization slug from campaign
  const prisma = (await import('@/lib/db/prisma')).default
  const { UserService } = await import('@/lib/auth/user-service')
  
  // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
  // Get the campaign's organization to determine the correct schema
  const campaignQuery = `SELECT id FROM "Campaign" WHERE id = $1`
  
  // Try to find which org schema contains this campaign
  const organizations = await prisma.organization.findMany({ select: { slug: true } })
  let orgSlug: string | null = null
  
  for (const org of organizations) {
    try {
      const campaigns = await querySchema<any>(org.slug, campaignQuery, [campaignId])
      if (campaigns.length > 0) {
        orgSlug = org.slug
        break
      }
    } catch (error) {
      // Schema might not exist, continue
    }
  }
  
  if (!orgSlug) {
    return []
  }
  
  // Fetch payments using schema-aware queries
  const paymentsQuery = `
    SELECT 
      p.*,
      i.id as invoice_id, i."invoiceNumber" as invoice_number
    FROM "Payment" p
    INNER JOIN "Invoice" i ON i.id = p."invoiceId"
    WHERE EXISTS (
      SELECT 1 FROM "InvoiceItem" ii 
      WHERE ii."invoiceId" = i.id AND ii."campaignId" = $1
    )
    ORDER BY p."paymentDate" DESC
    LIMIT 20
  `
  const paymentsRaw = await querySchema<any>(orgSlug, paymentsQuery, [campaignId])
  
  const payments = paymentsRaw.map(payment => ({
    ...payment,
    invoice: {
      id: payment.invoice_id,
      invoiceNumber: payment.invoice_number
    }
  }))

  return payments.map(payment => ({
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentDate: payment.paymentDate,
    status: payment.status,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice.invoiceNumber,
    notes: payment.notes
  }))
}

async function getCampaignFinancialMetrics(campaignId: string) {
  const prisma = (await import('@/lib/db/prisma')).default
  
  // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
  // Find which org schema contains this campaign
  const organizations = await prisma.organization.findMany({ select: { slug: true } })
  let orgSlug: string | null = null
  let campaign: any = null
  
  for (const org of organizations) {
    try {
      const campaignQuery = `SELECT * FROM "Campaign" WHERE id = $1`
      const campaigns = await querySchema<any>(org.slug, campaignQuery, [campaignId])
      if (campaigns.length > 0) {
        orgSlug = org.slug
        campaign = campaigns[0]
        break
      }
    } catch (error) {
      // Schema might not exist, continue
    }
  }

  if (!campaign || !orgSlug) {
    return null
  }
  
  // Get analytics data
  const analyticsQuery = `SELECT * FROM "CampaignAnalytics" WHERE "campaignId" = $1`
  const analytics = await querySchema<any>(orgSlug, analyticsQuery, [campaignId])
  
  // Count invoice items
  const invoiceItemCountQuery = `SELECT COUNT(*) as count FROM "InvoiceItem" WHERE "campaignId" = $1`
  const countResult = await querySchema<any>(orgSlug, invoiceItemCountQuery, [campaignId])
  const invoiceItemCount = parseInt(countResult[0]?.count || '0')

  // Get total paid amount from invoices using schema-aware queries
  const invoiceItemsQuery = `
    SELECT 
      ii.*,
      i.id as invoice_id,
      json_agg(
        json_build_object(
          'id', p.id,
          'amount', p.amount,
          'status', p.status
        )
      ) FILTER (WHERE p.id IS NOT NULL) as payments
    FROM "InvoiceItem" ii
    INNER JOIN "Invoice" i ON i.id = ii."invoiceId"
    LEFT JOIN "Payment" p ON p."invoiceId" = i.id
    WHERE ii."campaignId" = $1
    GROUP BY ii.id, i.id
  `
  const invoiceItemsRaw = await querySchema<any>(orgSlug, invoiceItemsQuery, [campaignId])
  
  const invoiceItems = invoiceItemsRaw.map(item => ({
    ...item,
    invoice: {
      id: item.invoice_id,
      payments: item.payments || []
    }
  }))

  const totalBilled = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
  const totalPaid = invoiceItems.reduce((sum, item) => {
    const paidAmount = item.invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0)
    return sum + paidAmount
  }, 0)

  // Calculate analytics totals
  const totalSpent = analytics.reduce((sum: number, a: any) => sum + (a.spent || 0), 0)
  const totalImpressions = analytics.reduce((sum: number, a: any) => sum + (a.impressions || 0), 0)
  const totalClicks = analytics.reduce((sum: number, a: any) => sum + (a.clicks || 0), 0)

  return {
    campaignId,
    campaignName: campaign.name,
    totalBudget: campaign.budget,
    totalBilled,
    totalPaid,
    remainingBudget: (campaign.budget || 0) - totalPaid,
    budgetUtilization: campaign.budget > 0 ? (totalPaid / campaign.budget) * 100 : 0,
    totalSpent,
    totalImpressions,
    totalClicks,
    invoiceCount: invoiceItemCount,
    cpm: totalImpressions > 0 ? (totalSpent / totalImpressions) * 1000 : 0,
    cpc: totalClicks > 0 ? totalSpent / totalClicks : 0,
    status: campaign.status
  }
}
