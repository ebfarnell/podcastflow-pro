import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { campaignBillingService } from '@/lib/invoices/campaign-billing'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/campaigns/[id]/invoice - Create an invoice for a campaign
export const POST = await withApiProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const campaignId = params.id
    const body = await request.json()

    console.log('📄 Creating campaign invoice:', { campaignId, amount: body.amount })

    const invoice = await campaignBillingService.createCampaignInvoice({
      campaignId,
      amount: body.amount,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
      paymentTerms: body.paymentTerms,
      lineItems: body.lineItems
    })

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate
      },
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Campaign invoice creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign invoice' },
      { status: 500 }
    )
  }
})
