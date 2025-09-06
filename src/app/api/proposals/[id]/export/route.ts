import { NextRequest, NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import React from 'react'
import { ProposalPDF } from '@/components/schedule-builder/ProposalPDF'

export const dynamic = 'force-dynamic'

export async function GET(
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
            'price', pi.price,
            'quantity', pi.quantity,
            'estimatedImpressions', pi."estimatedImpressions"
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

    // Generate PDF
    const pdfDoc = React.createElement(ProposalPDF, {
      campaignName: proposal.campaignName,
      campaignBudget: proposal.budget,
      selectedShows: proposal.shows || [],
      selectedSlots: proposal.items || [],
      totalPrice: proposal.totalPrice,
      organizationName: organization?.name || 'PodcastFlow Pro',
      generatedDate: new Date()
    })

    const pdfBuffer = await pdf(pdfDoc).toBuffer()

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proposal-${proposal.campaignName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Export proposal API error:', error)
    return NextResponse.json(
      { error: 'Failed to export proposal', details: error.message },
      { status: 500 }
    )
  }
}