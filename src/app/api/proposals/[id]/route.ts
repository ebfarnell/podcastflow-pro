import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

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

    const proposalId = params.id

    // Get proposal with all related data
    const proposalQuery = `
      SELECT 
        p.*,
        c.name as "campaignName",
        c."advertiserId",
        a.name as "advertiserName",
        u.name as "createdByName",
        approver.name as "currentApproverName",
        approved_by.name as "approvedByName",
        (
          SELECT json_agg(
            json_build_object(
              'id', pi.id,
              'episodeId', pi."episodeId",
              'showId', pi."showId",
              'showName', s.name,
              'episodeName', e.title,
              'placementType', pi."placementType",
              'quantity', pi.quantity,
              'unitPrice', pi."unitPrice",
              'airDate', pi."airDate"
            )
          )
          FROM "ProposalItem" pi
          LEFT JOIN "Show" s ON s.id = pi."showId"
          LEFT JOIN "Episode" e ON e.id = pi."episodeId"
          WHERE pi."proposalId" = p.id
        ) as items,
        (
          SELECT json_agg(
            json_build_object(
              'id', pa.id,
              'status', pa.status,
              'comments', pa.comments,
              'approvedAt', pa."approvedAt",
              'approverName', approver_user.name,
              'requiredChanges', pa."requiredChanges",
              'createdAt', pa."createdAt"
            ) ORDER BY pa."createdAt" DESC
          )
          FROM "ProposalApproval" pa
          LEFT JOIN public."User" approver_user ON approver_user.id = pa."approverId"
          WHERE pa."proposalId" = p.id
        ) as "approvalHistory"
      FROM "Proposal" p
      LEFT JOIN "Campaign" c ON c.id = p."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN public."User" u ON u.id = p."createdBy"
      LEFT JOIN public."User" approver ON approver.id = p."currentApproverId"
      LEFT JOIN public."User" approved_by ON approved_by.id = p."approvedBy"
      WHERE p.id = $1
    `

    const proposals = await querySchema(orgSlug, proposalQuery, [proposalId])
    
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposals[0]
    
    // SECURITY FIX: Verify user has access to this proposal
    if (proposal.organizationId !== user.organizationId && proposal.createdBy !== user.id && user.role !== 'master') {
      return NextResponse.json({ error: 'Access denied to this proposal' }, { status: 403 })
    }
    
    // SECURITY: Log master cross-organization access
    if (user.role === 'master' && proposal.organizationId !== user.organizationId) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        proposal.organizationId,
        'GET',
        `/api/proposals/${proposalId}`,
        request
      )
    }
    
    // Calculate total value
    const totalValue = proposal.items?.reduce((sum: number, item: any) => 
      sum + (item.quantity * item.unitPrice), 0
    ) || 0

    return NextResponse.json({ 
      ...proposal,
      totalValue
    })

  } catch (error: any) {
    console.error('Get proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposal', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const proposalId = params.id
    const body = await request.json()
    const { changeReason, ...updateData } = body

    // Get current proposal data for version tracking
    const currentQuery = `SELECT * FROM "Proposal" WHERE id = $1`
    const currentProposals = await querySchema(orgSlug, currentQuery, [proposalId])
    
    if (currentProposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const currentProposal = currentProposals[0]

    // Check permissions
    if (currentProposal.createdBy !== user.id && !['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'You can only edit your own proposals' }, { status: 403 })
    }

    // Don't allow editing approved proposals
    if (currentProposal.approvalStatus === 'approved') {
      return NextResponse.json({ error: 'Cannot edit approved proposals' }, { status: 400 })
    }

    // Track version changes
    const { ProposalVersionService } = await import('@/services/proposal-version-service')
    
    // Update proposal
    const updateFields = Object.keys(updateData)
      .filter(field => !['id', 'createdAt', 'createdBy'].includes(field))
      .map((field, index) => `"${field}" = $${index + 2}`)
      .join(', ')
    
    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updateQuery = `
      UPDATE "Proposal" 
      SET ${updateFields}, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `
    
    const updateValues = [proposalId, ...Object.values(updateData).filter((_, index) => {
      const field = Object.keys(updateData)[index]
      return !['id', 'createdAt', 'createdBy'].includes(field)
    })]
    
    const updatedProposals = await querySchema(orgSlug, updateQuery, updateValues)
    const updatedProposal = updatedProposals[0]

    // Create version record
    await ProposalVersionService.trackProposalChange(
      orgSlug,
      proposalId,
      currentProposal,
      updatedProposal,
      user.id,
      changeReason
    )

    // Get updated proposal with all related data
    const finalQuery = `
      SELECT 
        p.*,
        c.name as "campaignName",
        u.name as "createdByName"
      FROM "Proposal" p
      LEFT JOIN "Campaign" c ON c.id = p."campaignId"
      LEFT JOIN public."User" u ON u.id = p."createdBy"
      WHERE p.id = $1
    `
    const finalResult = await querySchema(orgSlug, finalQuery, [proposalId])

    return NextResponse.json({ 
      success: true,
      proposal: finalResult[0]
    })

  } catch (error: any) {
    console.error('Update proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to update proposal', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Only admin and master can delete
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const proposalId = params.id

    // SECURITY FIX: Check if proposal exists and user has permission to delete
    const checkQuery = `SELECT id, "organizationId", "createdBy" FROM "Proposal" WHERE id = $1`
    const proposals = await querySchema<{id: string, organizationId: string, createdBy: string}>(orgSlug, checkQuery, [proposalId])
    
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposals[0]
    
    // Verify user has permission to delete (must be creator, admin, or master)
    if (proposal.organizationId !== user.organizationId && proposal.createdBy !== user.id && !['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'You can only delete proposals in your organization' }, { status: 403 })
    }

    // Delete proposal (cascades to related records)
    const deleteQuery = `DELETE FROM "Proposal" WHERE id = $1`
    await querySchema(orgSlug, deleteQuery, [proposalId])

    return NextResponse.json({ 
      success: true,
      message: 'Proposal deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to delete proposal', details: error.message },
      { status: 500 }
    )
  }
}