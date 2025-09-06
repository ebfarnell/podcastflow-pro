import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = `
      SELECT 
        tar.*,
        c.name as "campaignName",
        c."advertiserId",
        c.budget,
        c."startDate",
        c."endDate",
        a.name as "advertiserName",
        s.name as "showName",
        u.name as "talentName",
        u.email as "talentEmail",
        rb.name as "requestedByName",
        rby.name as "respondedByName"
      FROM "TalentApprovalRequest" tar
      LEFT JOIN "Campaign" c ON c.id = tar."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Show" s ON s.id = tar."showId"
      LEFT JOIN public."User" u ON u.id = tar."talentId"
      LEFT JOIN public."User" rb ON rb.id = tar."requestedBy"
      LEFT JOIN public."User" rby ON rby.id = tar."respondedBy"
      WHERE tar.id = $1
    `

    const { data, error } = await safeQuerySchema(session.organizationSlug, query, [params.id])
    
    if (error) {
      console.error('Failed to fetch talent approval:', error)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const approval = data[0]

    // Check permissions
    if (session.role === 'talent' && approval.talentId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Error fetching talent approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, comments, denialReason } = body

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be approve or deny' 
      }, { status: 400 })
    }

    // Fetch the approval request
    const fetchQuery = `
      SELECT * FROM "TalentApprovalRequest"
      WHERE id = $1
    `
    const { data: approvals } = await safeQuerySchema(
      session.organizationSlug,
      fetchQuery,
      [params.id]
    )

    if (!approvals || approvals.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const approval = approvals[0]

    // Check permissions - talent can only respond to their own requests
    // Producers can respond to requests for their shows
    // Admin/master can respond to any
    if (session.role === 'talent' && approval.talentId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (session.role === 'producer') {
      // Check if producer owns the show
      const showQuery = `
        SELECT id FROM "Show" 
        WHERE id = $1 AND "producerId" = $2
      `
      const { data: shows } = await safeQuerySchema(
        session.organizationSlug,
        showQuery,
        [approval.showId, session.userId]
      )

      if (!shows || shows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check if already responded
    if (approval.status !== 'pending') {
      return NextResponse.json({ 
        error: `Request already ${approval.status}` 
      }, { status: 409 })
    }

    // Check if expired
    if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
      // Mark as expired
      await safeQuerySchema(
        session.organizationSlug,
        `UPDATE "TalentApprovalRequest" SET status = 'expired', "updatedAt" = NOW() WHERE id = $1`,
        [params.id]
      )
      return NextResponse.json({ error: 'Request has expired' }, { status: 410 })
    }

    // Update the approval
    const updateQuery = `
      UPDATE "TalentApprovalRequest"
      SET 
        status = $2,
        "respondedAt" = NOW(),
        "respondedBy" = $3,
        comments = $4,
        "denialReason" = $5,
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `

    const { data: updated, error } = await safeQuerySchema(
      session.organizationSlug,
      updateQuery,
      [
        params.id,
        action === 'approve' ? 'approved' : 'denied',
        session.userId,
        comments || null,
        action === 'deny' ? (denialReason || 'No reason provided') : null
      ]
    )

    if (error) {
      console.error('Failed to update talent approval:', error)
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
    }

    // TODO: Send notification to requester about the response

    return NextResponse.json(updated?.[0] || {})
  } catch (error) {
    console.error('Error updating talent approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete approval requests
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deleteQuery = `
      DELETE FROM "TalentApprovalRequest"
      WHERE id = $1
      RETURNING id
    `

    const { data, error } = await safeQuerySchema(
      session.organizationSlug,
      deleteQuery,
      [params.id]
    )

    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Approval request deleted' })
  } catch (error) {
    console.error('Error deleting talent approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}