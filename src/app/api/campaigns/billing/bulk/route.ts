import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { campaignBillingService } from '@/lib/invoices/campaign-billing'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/campaigns/billing/bulk - Bulk process campaign payments
export const POST = await withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { payments } = body

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: 'Payments array is required' },
        { status: 400 }
      )
    }

    console.log('📊 Processing bulk campaign payments:', payments.length, 'payments')

    const results = []
    const errors = []

    // Process each payment
    for (const payment of payments) {
      try {
        const result = await campaignBillingService.processCampaignPayment({
          campaignId: payment.campaignId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          transactionId: payment.transactionId,
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
          dueDate: payment.dueDate ? new Date(payment.dueDate) : undefined,
          notes: payment.notes,
          reference: payment.reference
        })

        // Calculate commission if agency is involved
        if (result.campaign.agencyId) {
          await campaignBillingService.calculateAgencyCommission(payment.campaignId, payment.amount)
        }

        results.push({
          campaignId: payment.campaignId,
          status: 'success',
          invoiceId: result.invoice.id,
          paymentId: result.payment.id,
          amount: payment.amount
        })

      } catch (error) {
        console.error(`❌ Error processing payment for campaign ${payment.campaignId}:`, error)
        errors.push({
          campaignId: payment.campaignId,
          status: 'error',
          error: error.message,
          amount: payment.amount
        })
      }
    }

    const summary = {
      total: payments.length,
      successful: results.length,
      failed: errors.length,
      totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
      failedAmount: errors.reduce((sum, e) => sum + e.amount, 0)
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      errors,
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Bulk payment processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk payments' },
      { status: 500 }
    )
  }
})

// POST /api/campaigns/billing/bulk/invoices - Bulk create campaign invoices
export const PUT = await withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { invoices } = body

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json(
        { error: 'Invoices array is required' },
        { status: 400 }
      )
    }

    console.log('📄 Creating bulk campaign invoices:', invoices.length, 'invoices')

    const results = []
    const errors = []

    // Process each invoice
    for (const invoiceData of invoices) {
      try {
        const invoice = await campaignBillingService.createCampaignInvoice({
          campaignId: invoiceData.campaignId,
          amount: invoiceData.amount,
          issueDate: invoiceData.issueDate ? new Date(invoiceData.issueDate) : undefined,
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
          notes: invoiceData.notes,
          paymentTerms: invoiceData.paymentTerms,
          lineItems: invoiceData.lineItems
        })

        results.push({
          campaignId: invoiceData.campaignId,
          status: 'success',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoiceData.amount
        })

      } catch (error) {
        console.error(`❌ Error creating invoice for campaign ${invoiceData.campaignId}:`, error)
        errors.push({
          campaignId: invoiceData.campaignId,
          status: 'error',
          error: error.message,
          amount: invoiceData.amount
        })
      }
    }

    const summary = {
      total: invoices.length,
      successful: results.length,
      failed: errors.length,
      totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
      failedAmount: errors.reduce((sum, e) => sum + e.amount, 0)
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      errors,
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Bulk invoice creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create bulk invoices' },
      { status: 500 }
    )
  }
})
