import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; preBillId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId, preBillId } = params

    // Fetch the pre-bill and campaign data
    const { data: preBill, error } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.preBill.findUnique({
          where: {
            id: preBillId,
            campaignId,
            organizationId: session.organizationId,
          },
        })
      }
    )

    if (error || !preBill) {
      return NextResponse.json(
        { error: 'Pre-bill not found' },
        { status: 404 }
      )
    }

    // Fetch campaign details
    const { data: campaign } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.campaign.findUnique({
          where: {
            id: campaignId,
          },
          include: {
            advertiser: true,
            agency: true,
          },
        })
      }
    )

    // Generate a simple PDF-like HTML document
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pre-Bill - ${campaign?.name || 'Campaign'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 {
            color: #333;
            margin: 0;
          }
          .info-section {
            margin-bottom: 30px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .label {
            font-weight: bold;
            color: #666;
          }
          .value {
            color: #333;
          }
          .amount-section {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin: 30px 0;
          }
          .amount {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PRE-BILL</h1>
          <p style="color: #666; margin: 5px 0;">Cash In Advance</p>
        </div>

        <div class="info-section">
          <h2>Campaign Information</h2>
          <div class="info-row">
            <span class="label">Campaign:</span>
            <span class="value">${campaign?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="label">Advertiser:</span>
            <span class="value">${campaign?.advertiser?.name || 'N/A'}</span>
          </div>
          ${campaign?.agency ? `
          <div class="info-row">
            <span class="label">Agency:</span>
            <span class="value">${campaign.agency.name}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="label">Pre-Bill Type:</span>
            <span class="value">${preBill.type === 'campaign' ? 'Full Campaign' : 'Monthly'}</span>
          </div>
          ${preBill.month ? `
          <div class="info-row">
            <span class="label">Period:</span>
            <span class="value">${new Date(preBill.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
          ` : ''}
        </div>

        <div class="amount-section">
          <div class="info-row">
            <span class="label">Amount Due:</span>
            <span class="amount">$${preBill.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        ${preBill.notes ? `
        <div class="info-section">
          <h3>Notes</h3>
          <p>${preBill.notes}</p>
        </div>
        ` : ''}

        <div class="info-section">
          <h3>Payment Terms</h3>
          <p>Payment is due upon receipt. This pre-bill is for cash-in-advance payment.</p>
        </div>

        <div class="footer">
          <p>Pre-Bill ID: ${preBill.id}</p>
          <p>Generated: ${new Date(preBill.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
      </body>
      </html>
    `

    // Return as HTML that can be printed as PDF
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="pre-bill-${campaign?.name || 'campaign'}-${preBillId}.html"`,
      },
    })
  } catch (error) {
    console.error('Error downloading pre-bill:', error)
    return NextResponse.json(
      { error: 'Failed to download pre-bill' },
      { status: 500 }
    )
  }
}