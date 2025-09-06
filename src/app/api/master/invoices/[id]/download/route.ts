import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator'
import prisma from '@/lib/db/prisma'

// GET /api/master/invoices/[id]/download - Download invoice PDF
export const GET = await withMasterProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const invoiceId = params.id

    console.log('📥 Generating and downloading invoice PDF:', invoiceId)

    // Fetch invoice data from database
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        items: true,
        payments: true
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Prepare invoice data for PDF generation
    const invoiceData: InvoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      clientName: invoice.clientName || invoice.organization?.name || 'Unknown Client',
      clientAddress: invoice.clientAddress,
      clientEmail: invoice.clientEmail,
      organizationName: invoice.organization?.name || 'PodcastFlow Pro',
      organizationAddress: [
        invoice.organization?.address,
        invoice.organization?.city,
        invoice.organization?.state,
        invoice.organization?.postalCode
      ].filter(Boolean).join(', '),
      organizationEmail: invoice.organization?.email || 'billing@podcastflow.pro',
      organizationPhone: invoice.organization?.phone,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount || undefined,
      subtotal: invoice.subtotal || undefined,
      status: invoice.status,
      items: invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount
      })),
      notes: invoice.notes || undefined,
      paymentTerms: invoice.paymentTerms || 'Net 30 days'
    }

    // Generate PDF
    const pdfBuffer = generateInvoicePDF(invoiceData)

    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length.toString()
    })

    console.log('✅ Invoice PDF generated successfully:', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      size: pdfBuffer.length
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('❌ Master invoice download error:', error)
    return NextResponse.json(
      { error: 'Failed to download invoice' },
      { status: 500 }
    )
  }
})