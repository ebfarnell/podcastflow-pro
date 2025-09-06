import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const showId = searchParams.get('showId')
    const talentId = searchParams.get('talentId')
    const status = searchParams.get('status')

    let query = `
      SELECT 
        tar.*,
        c.name as "campaignName",
        c."advertiserId",
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
      WHERE 1=1
    `
    const params: any[] = []
    let paramCounter = 1

    // Add filters based on user role
    if (session.role === 'talent') {
      query += ` AND tar."talentId" = $${paramCounter}`
      params.push(session.userId)
      paramCounter++
    } else if (session.role === 'producer') {
      // Producers see approvals for their shows
      query += ` AND tar."showId" IN (
        SELECT id FROM "Show" WHERE "producerId" = $${paramCounter}
      )`
      params.push(session.userId)
      paramCounter++
    }

    // Add optional filters
    if (campaignId) {
      query += ` AND tar."campaignId" = $${paramCounter}`
      params.push(campaignId)
      paramCounter++
    }

    if (showId) {
      query += ` AND tar."showId" = $${paramCounter}`
      params.push(showId)
      paramCounter++
    }

    if (talentId && session.role !== 'talent') {
      query += ` AND tar."talentId" = $${paramCounter}`
      params.push(talentId)
      paramCounter++
    }

    if (status) {
      query += ` AND tar.status = $${paramCounter}`
      params.push(status)
      paramCounter++
    }

    query += ` ORDER BY tar."requestedAt" DESC`

    const { data, error } = await safeQuerySchema(session.organizationSlug, query, params)
    
    if (error) {
      console.error('Failed to fetch talent approvals:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching talent approvals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, master, and producer roles can create approval requests
    if (!['sales', 'admin', 'master', 'producer'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      campaignId, 
      showId, 
      talentId, 
      spotType,
      summaryData,
      expiresAt 
    } = body

    if (!campaignId || !showId || !talentId || !spotType) {
      return NextResponse.json({ 
        error: 'Campaign ID, Show ID, Talent ID, and Spot Type are required' 
      }, { status: 400 })
    }

    // Validate spot type
    if (!['host_read', 'endorsement', 'pre_produced'].includes(spotType)) {
      return NextResponse.json({ 
        error: 'Invalid spot type. Must be host_read, endorsement, or pre_produced' 
      }, { status: 400 })
    }

    // Check if approval already exists for this combination
    const existingQuery = `
      SELECT id FROM "TalentApprovalRequest"
      WHERE "campaignId" = $1 
        AND "showId" = $2 
        AND "talentId" = $3
        AND status = 'pending'
    `
    const { data: existing } = await safeQuerySchema(
      session.organizationSlug,
      existingQuery,
      [campaignId, showId, talentId]
    )

    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: 'An approval request already exists for this campaign, show, and talent combination' 
      }, { status: 409 })
    }

    // Create the approval request
    const approvalId = uuidv4()
    const insertQuery = `
      INSERT INTO "TalentApprovalRequest" (
        id, "campaignId", "showId", "talentId", "spotType",
        "requestedAt", "requestedBy", status, "expiresAt",
        "summaryData", "organizationId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        NOW(), $6, 'pending', $7,
        $8, $9, NOW(), NOW()
      ) RETURNING *
    `

    const expirationDate = expiresAt 
      ? new Date(expiresAt)
      : new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // Default 7 days

    const { data: newApproval, error } = await safeQuerySchema(
      session.organizationSlug,
      insertQuery,
      [
        approvalId,
        campaignId,
        showId,
        talentId,
        spotType,
        session.userId,
        expirationDate,
        JSON.stringify(summaryData || {}),
        session.organizationId
      ]
    )

    if (error) {
      console.error('Failed to create talent approval:', error)
      return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
    }

    // TODO: Send notification to talent/producer

    return NextResponse.json(newApproval?.[0] || {}, { status: 201 })
  } catch (error) {
    console.error('Error creating talent approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}