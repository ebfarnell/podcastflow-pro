import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { broadcastInventoryUpdate } from '@/lib/inventory/broadcast-updates'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
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

    // Get query parameters
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'all'
    const createdBy = url.searchParams.get('createdBy')

    // Build query
    let query = `
      SELECT 
        p.*,
        u.name as "createdByName",
        approver.name as "currentApproverName",
        COUNT(pi.id) as "itemCount",
        SUM(pi.quantity * pi."unitPrice") as "totalValue",
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
      LEFT JOIN public."User" u ON u.id = p."createdBy"
      LEFT JOIN public."User" approver ON approver.id = p."currentApproverId"
      LEFT JOIN "ProposalItem" pi ON pi."proposalId" = p.id
      WHERE p."organizationId" = $1
    `
    
    const params: any[] = [user.organizationId]
    let paramIndex = 2

    if (status !== 'all') {
      query += ` AND p.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (createdBy) {
      query += ` AND p."createdBy" = $${paramIndex}`
      params.push(createdBy)
      paramIndex++
    }

    query += ` GROUP BY p.id, u.name, approver.name ORDER BY p."createdAt" DESC`

    const proposals = await querySchema(orgSlug, query, params)

    return NextResponse.json({ proposals })

  } catch (error: any) {
    console.error('Get proposals error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals', details: error.message },
      { status: 500 }
    )
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { name, budget, slots, notes } = body

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

    // Create proposal
    const proposalId = 'prop_' + Math.random().toString(36).substr(2, 16)
    
    const createProposalQuery = `
      INSERT INTO "Proposal" (
        id,
        "organizationId",
        name,
        budget,
        status,
        notes,
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `
    
    const proposalResult = await querySchema(
      orgSlug,
      createProposalQuery,
      [proposalId, user.organizationId, name, budget, 'draft', notes, user.id]
    )

    if (proposalResult.length === 0) {
      throw new Error('Failed to create proposal')
    }

    // Add proposal items
    if (slots && slots.length > 0) {
      const itemPromises = slots.map((slot: any) => {
        const itemId = 'pitem_' + Math.random().toString(36).substr(2, 16)
        const createItemQuery = `
          INSERT INTO "ProposalItem" (
            id,
            "proposalId",
            "episodeId",
            "showId",
            "placementType",
            quantity,
            "unitPrice",
            "airDate",
            "createdAt",
            "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `
        
        return querySchema(
          orgSlug,
          createItemQuery,
          [
            itemId,
            proposalId,
            slot.episodeId,
            slot.showId,
            slot.placementType,
            slot.quantity,
            slot.price,
            slot.airDate
          ]
        )
      })

      await Promise.all(itemPromises)
    }

    return NextResponse.json({ 
      success: true, 
      proposal: proposalResult[0],
      proposalId 
    })

  } catch (error: any) {
    console.error('Create proposal error:', error)
    return NextResponse.json(
      { error: 'Failed to create proposal', details: error.message },
      { status: 500 }
    )
  }
}

// Direct exports with auth check
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return getHandler(request as AuthenticatedRequest)
}

export const POST = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return postHandler(request as AuthenticatedRequest)
}