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

    // SECURITY FIX: Verify proposal belongs to user's organization before accessing versions
    const proposalOwnershipQuery = `
      SELECT id, "organizationId", "createdBy"
      FROM "Proposal"
      WHERE id = $1
    `
    const proposalCheck = await querySchema<{id: string, organizationId: string, createdBy: string}>(
      orgSlug, 
      proposalOwnershipQuery, 
      [proposalId]
    )

    if (!proposalCheck.length) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposalCheck[0]
    
    // Verify user has access to this proposal (must be in same organization or be the creator)
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
        `/api/proposals/${proposalId}/versions`,
        request
      )
    }

    // Get all versions for this proposal
    const versionsQuery = `
      SELECT 
        pr.*,
        u.name as "changedByName",
        u.email as "changedByEmail"
      FROM "ProposalRevision" pr
      LEFT JOIN public."User" u ON u.id = pr."changedBy"
      WHERE pr."proposalId" = $1
      ORDER BY pr.version DESC
    `

    const versions = await querySchema(orgSlug, versionsQuery, [proposalId])

    return NextResponse.json({ versions })

  } catch (error: any) {
    console.error('Get proposal versions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposal versions', details: error.message },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()
    const { changes, reason } = body

    // Get current proposal data
    const proposalQuery = `
      SELECT p.*, 
        (SELECT COALESCE(MAX(version), 0) FROM "ProposalRevision" WHERE "proposalId" = p.id) as "latestVersion"
      FROM "Proposal" p
      WHERE p.id = $1
    `
    const proposals = await querySchema(orgSlug, proposalQuery, [proposalId])
    
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const proposal = proposals[0]
    const newVersion = (proposal.latestVersion || 0) + 1

    // Create snapshot of current proposal with items
    const itemsQuery = `
      SELECT * FROM "ProposalItem" WHERE "proposalId" = $1
    `
    const items = await querySchema(orgSlug, itemsQuery, [proposalId])
    
    const snapshot = {
      ...proposal,
      items: items
    }

    // Create revision record
    const revisionId = 'rev_' + Math.random().toString(36).substr(2, 16)
    const createRevisionQuery = `
      INSERT INTO "ProposalRevision" (
        id,
        "proposalId",
        version,
        changes,
        "changedBy",
        "changeReason",
        "proposalSnapshot"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `

    const revisions = await querySchema(
      orgSlug,
      createRevisionQuery,
      [
        revisionId,
        proposalId,
        newVersion,
        JSON.stringify(changes),
        user.id,
        reason,
        JSON.stringify(snapshot)
      ]
    )

    // Update proposal version
    const updateProposalQuery = `
      UPDATE "Proposal" 
      SET version = $1, "updatedAt" = NOW()
      WHERE id = $2
    `
    await querySchema(orgSlug, updateProposalQuery, [newVersion, proposalId])

    return NextResponse.json({ 
      success: true,
      revision: revisions[0],
      version: newVersion
    })

  } catch (error: any) {
    console.error('Create proposal version error:', error)
    return NextResponse.json(
      { error: 'Failed to create proposal version', details: error.message },
      { status: 500 }
    )
  }
}