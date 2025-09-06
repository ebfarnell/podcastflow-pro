import { NextRequest, NextResponse } from 'next/server'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { sendEmailWithAttachment } from '@/lib/email/send-email-with-attachment'
import { pdf } from '@react-pdf/renderer'
import React from 'react'
import { ProposalPDF } from '@/components/schedule-builder/ProposalPDF'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { recipientEmail, recipientName, message } = body

    // Get proposal details
    const proposalQuery = `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', pi.id,
            'episodeId', pi."episodeId",
            'episodeTitle', e.title,
            'episodeNumber', e."episodeNumber",
            'showId', pi."showId",
            'showName', s.name,
            'airDate', pi."airDate",
            'placementType', pi."placementType",
            'price', pi."unitPrice",
            'quantity', pi.quantity,
            'estimatedImpressions', ei."estimatedImpressions"
          )
          ORDER BY pi."airDate", s.name, e."episodeNumber"
        ) as items,
        json_agg(DISTINCT 
          json_build_object(
            'id', s.id,
            'name', s.name,
            'host', s.host,
            'category', s.category
          )
        ) FILTER (WHERE s.id IS NOT NULL) as shows
      FROM "Proposal" p
      LEFT JOIN "ProposalItem" pi ON pi."proposalId" = p.id
      LEFT JOIN "Episode" e ON e.id = pi."episodeId"
      LEFT JOIN "Show" s ON s.id = pi."showId"
      LEFT JOIN "EpisodeInventory" ei ON ei."episodeId" = e.id
      WHERE p.id = $1
      GROUP BY p.id
    `

    const proposalResult = await querySchema(orgSlug, proposalQuery, [params.id])
    
    if (!proposalResult || proposalResult.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposalResult[0]
    const organization = await prisma.organization.findFirst({
      where: { slug: orgSlug }
    })

    // Calculate total price from items
    const totalPrice = proposal.items?.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0
    ) || 0

    // Generate proposal link for PDF download
    const proposalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'}/api/proposals/${params.id}/export`

    // Generate PDF for attachment
    const pdfDoc = React.createElement(ProposalPDF, {
      campaignName: proposal.name,
      campaignBudget: proposal.budget,
      selectedShows: proposal.shows || [],
      selectedSlots: proposal.items || [],
      totalPrice: totalPrice,
      organizationName: organization?.name || 'PodcastFlow Pro',
      generatedDate: new Date()
    })

    const pdfBuffer = await pdf(pdfDoc).toBuffer()

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f5f5f5; }
          .button { 
            display: inline-block; 
            padding: 12px 30px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin-top: 20px;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .metrics { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .metric-row { display: flex; justify-content: space-between; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${organization?.name || 'PodcastFlow Pro'}</h1>
            <p>Campaign Proposal</p>
          </div>
          
          <div class="content">
            <h2>Dear ${recipientName || 'Client'},</h2>
            
            ${message ? `<p>${message}</p>` : '<p>Please find attached your personalized campaign proposal.</p>'}
            
            <div class="metrics">
              <h3>Proposal Overview: ${proposal.name}</h3>
              <div class="metric-row">
                <span><strong>Total Investment:</strong></span>
                <span>$${totalPrice.toLocaleString()}</span>
              </div>
              <div class="metric-row">
                <span><strong>Campaign Budget:</strong></span>
                <span>${proposal.budget ? `$${proposal.budget.toLocaleString()}` : 'Not specified'}</span>
              </div>
              <div class="metric-row">
                <span><strong>Number of Shows:</strong></span>
                <span>${proposal.shows?.length || 0}</span>
              </div>
              <div class="metric-row">
                <span><strong>Total Ad Slots:</strong></span>
                <span>${proposal.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0}</span>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${proposalLink}" style="display: inline-block; padding: 12px 30px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Download Proposal PDF
              </a>
            </div>
            
            <p>The proposal PDF contains detailed information about:</p>
            <ul>
              <li>Complete campaign schedule</li>
              <li>Show distribution and placement types</li>
              <li>Estimated impressions and CPM</li>
              <li>Investment breakdown by show</li>
            </ul>
            
            <p>This proposal is valid for 30 days from today's date. Inventory availability is subject to change.</p>
            
            <p>If you have any questions or would like to discuss this proposal further, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>${user.name}<br>${organization?.name || 'PodcastFlow Pro'}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent from PodcastFlow Pro - Your Podcast Advertising Platform</p>
            <p>© ${new Date().getFullYear()} ${organization?.name || 'PodcastFlow Pro'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email with PDF attachment
    const emailResult = await sendEmailWithAttachment({
      to: recipientEmail,
      subject: `Campaign Proposal: ${proposal.name}`,
      html: emailHtml,
      attachments: [{
        filename: `proposal-${proposal.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    })

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email')
    }

    // Update proposal status to sent
    await querySchema(
      orgSlug,
      `UPDATE "Proposal" SET status = 'sent', "updatedAt" = NOW() WHERE id = $1`,
      [params.id]
    )

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId
    })

  } catch (error: any) {
    console.error('Email proposal API error:', error)
    return NextResponse.json(
      { error: 'Failed to email proposal', details: error.message },
      { status: 500 }
    )
  }
}