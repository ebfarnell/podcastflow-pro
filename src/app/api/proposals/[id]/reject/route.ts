import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const rejectSchema = z.object({
  comments: z.string().min(1, 'Comments are required when rejecting'),
  requiredChanges: z.array(z.string()).optional(),
})

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

    // Only admin and master can reject
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { comments, requiredChanges } = rejectSchema.parse(body)
    const proposalId = params.id

    // Get current proposal
    const proposalQuery = `
      SELECT * FROM "Proposal" WHERE id = $1
    `
    const proposals = await querySchema(orgSlug, proposalQuery, [proposalId])
    
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposals[0]

    if (proposal.approvalStatus === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved proposal' }, { status: 400 })
    }

    // Create rejection record
    const approvalId = 'approval_' + Math.random().toString(36).substr(2, 16)
    const createApprovalQuery = `
      INSERT INTO "ProposalApproval" (
        id,
        "proposalId",
        "approverId",
        status,
        comments,
        "approvedAt",
        "requiredChanges"
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING *
    `
    
    await querySchema(
      orgSlug,
      createApprovalQuery,
      [
        approvalId, 
        proposalId, 
        user.id, 
        'rejected', 
        comments,
        requiredChanges ? JSON.stringify(requiredChanges) : null
      ]
    )

    // Update proposal status
    const updateProposalQuery = `
      UPDATE "Proposal" 
      SET 
        "approvalStatus" = 'rejected',
        "currentApproverId" = NULL,
        "approvalNotes" = $1,
        "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
    `
    
    const updatedProposals = await querySchema(
      orgSlug,
      updateProposalQuery,
      [comments, proposalId]
    )

    // Create notification for proposal owner
    const notificationId = 'notif_' + Math.random().toString(36).substr(2, 16)
    const notificationQuery = `
      INSERT INTO "Notification" (
        id,
        "userId",
        type,
        title,
        message,
        "relatedId",
        "relatedType",
        read,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
    `
    
    await querySchema(
      orgSlug,
      notificationQuery,
      [
        notificationId,
        proposal.createdBy,
        'proposal_rejected',
        'Proposal Rejected',
        `Your proposal "${proposal.name}" has been rejected by ${user.name}. Please review the comments and make necessary changes.`,
        proposalId,
        'proposal'
      ]
    )

    return NextResponse.json({ 
      success: true,
      proposal: updatedProposals[0],
      message: 'Proposal rejected with feedback'
    })

  } catch (error: any) {
    console.error('Reject proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to reject proposal', details: error.message },
      { status: 500 }
    )
  }
}