import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { emailService } from '@/lib/email/email-service'

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

    const proposalId = params.id

    // Get current proposal
    const proposalQuery = `
      SELECT p.*, c.name as "campaignName", u.name as "createdByName", u.email as "createdByEmail"
      FROM "Proposal" p
      LEFT JOIN "Campaign" c ON c.id = p."campaignId"
      LEFT JOIN public."User" u ON u.id = p."createdBy"
      WHERE p.id = $1
    `
    const proposals = await querySchema(orgSlug, proposalQuery, [proposalId])
    
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposals[0]

    // Check if user can submit (must be owner or admin)
    if (proposal.createdBy !== user.id && !['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'You can only submit your own proposals' }, { status: 403 })
    }

    if (proposal.approvalStatus === 'approved') {
      return NextResponse.json({ error: 'Proposal is already approved' }, { status: 400 })
    }

    if (proposal.approvalStatus === 'pending_approval') {
      return NextResponse.json({ error: 'Proposal is already pending approval' }, { status: 400 })
    }

    // Get appropriate workflow based on proposal value
    const workflowQuery = `
      SELECT * FROM "ApprovalWorkflow" 
      WHERE "isActive" = true 
      ORDER BY 
        CASE 
          WHEN id = 'workflow_executive' AND $1 > 100000 THEN 1
          WHEN id = 'workflow_high_value' AND $1 > 50000 THEN 2
          ELSE 3
        END
      LIMIT 1
    `
    const workflows = await querySchema(orgSlug, workflowQuery, [proposal.totalValue || 0])
    const workflow = workflows[0] || { id: 'workflow_standard', approvalSteps: [{ level: 1, approverRole: 'admin' }] }

    // Get first approver
    const firstStep = workflow.approvalSteps[0]
    const approverQuery = `
      SELECT u.* FROM public."User" u
      WHERE u."organizationId" = $1 
      AND u.role = $2 
      AND u.status = 'active'
      ORDER BY u."createdAt"
      LIMIT 1
    `
    const approvers = await querySchema('public', approverQuery, [user.organizationId, firstStep.approverRole])
    
    if (approvers.length === 0) {
      return NextResponse.json({ 
        error: `No ${firstStep.approverRole} found to approve proposals` 
      }, { status: 400 })
    }

    const approver = approvers[0]

    // Update proposal status
    const updateProposalQuery = `
      UPDATE "Proposal" 
      SET 
        "approvalStatus" = 'pending_approval',
        "submittedForApprovalAt" = NOW(),
        "currentApproverId" = $1,
        "workflowId" = $2,
        "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `
    
    const updatedProposals = await querySchema(
      orgSlug,
      updateProposalQuery,
      [approver.id, workflow.id, proposalId]
    )

    // Create approval request record
    const approvalId = 'approval_' + Math.random().toString(36).substr(2, 16)
    const createApprovalQuery = `
      INSERT INTO "ProposalApproval" (
        id,
        "proposalId",
        "approverId",
        status,
        "approvalLevel"
      ) VALUES ($1, $2, $3, 'pending', 1)
    `
    
    await querySchema(
      orgSlug,
      createApprovalQuery,
      [approvalId, proposalId, approver.id]
    )

    // Create notification for approver
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
        approver.id,
        'approval_requested',
        'Proposal Approval Requested',
        `${user.name} has submitted proposal "${proposal.name}" for your approval`,
        proposalId,
        'proposal'
      ]
    )

    // Send email notification
    try {
      // For now, send a generic notification since we don't have a specific proposal approval template
      await emailService.sendUserInvitation(
        approver.email,
        approver.name,
        approver.role,
        user.organizationName || 'Organization',
        user.name,
        user.email
      )
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError)
      // Continue even if email fails
    }

    return NextResponse.json({ 
      success: true,
      proposal: updatedProposals[0],
      message: 'Proposal submitted for approval',
      approver: {
        id: approver.id,
        name: approver.name,
        email: approver.email
      }
    })

  } catch (error: any) {
    console.error('Submit for approval error:', error)
    return NextResponse.json(
      { error: 'Failed to submit proposal for approval', details: error.message },
      { status: 500 }
    )
  }
}