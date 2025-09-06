import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const approveSchema = z.object({
  comments: z.string().optional(),
  approvalLevel: z.number().default(1),
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

    // Only admin and master can approve
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { comments, approvalLevel } = approveSchema.parse(body)
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
      return NextResponse.json({ error: 'Proposal already approved' }, { status: 400 })
    }

    // Create approval record
    const approvalId = 'approval_' + Math.random().toString(36).substr(2, 16)
    const createApprovalQuery = `
      INSERT INTO "ProposalApproval" (
        id,
        "proposalId",
        "approverId",
        status,
        comments,
        "approvedAt",
        "approvalLevel"
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING *
    `
    
    await querySchema(
      orgSlug,
      createApprovalQuery,
      [approvalId, proposalId, user.id, 'approved', comments, approvalLevel]
    )

    // Check if we need more approvals based on workflow
    const workflowQuery = `
      SELECT "approvalSteps" FROM "ApprovalWorkflow" 
      WHERE id = $1 AND "isActive" = true
    `
    const workflows = await querySchema(
      orgSlug, 
      workflowQuery, 
      [proposal.workflowId || 'workflow_standard']
    )

    let needsMoreApproval = false
    if (workflows.length > 0 && workflows[0].approvalSteps) {
      const steps = workflows[0].approvalSteps
      const nextLevel = approvalLevel + 1
      needsMoreApproval = steps.some((step: any) => step.level === nextLevel)
    }

    // Update proposal status
    const newStatus = needsMoreApproval ? 'pending_approval' : 'approved'
    const updateProposalQuery = `
      UPDATE "Proposal" 
      SET 
        "approvalStatus" = $1,
        "approvedAt" = ${newStatus === 'approved' ? 'NOW()' : 'NULL'},
        "approvedBy" = ${newStatus === 'approved' ? '$2' : 'NULL'},
        "currentApproverId" = NULL,
        "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `
    
    const updatedProposals = await querySchema(
      orgSlug,
      updateProposalQuery,
      [newStatus, user.id, proposalId]
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
        newStatus === 'approved' ? 'proposal_approved' : 'proposal_partial_approval',
        newStatus === 'approved' ? 'Proposal Approved' : 'Proposal Partially Approved',
        newStatus === 'approved' 
          ? `Your proposal "${proposal.name}" has been approved by ${user.name}`
          : `Your proposal "${proposal.name}" has been approved at level ${approvalLevel} by ${user.name}`,
        proposalId,
        'proposal'
      ]
    )

    return NextResponse.json({ 
      success: true,
      proposal: updatedProposals[0],
      status: newStatus,
      message: newStatus === 'approved' 
        ? 'Proposal approved successfully' 
        : 'Proposal approved at current level, awaiting next approval'
    })

  } catch (error: any) {
    console.error('Approve proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to approve proposal', details: error.message },
      { status: 500 }
    )
  }
}