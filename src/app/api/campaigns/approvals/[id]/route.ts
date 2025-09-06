import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema } from '@/lib/db/schema-db'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { campaignWorkflowService } from '@/lib/workflow/campaign-workflow-service'
import { notificationService } from '@/lib/notifications/notification-service'
import { activityService } from '@/lib/activities/activity-service'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

// GET - Get approval request details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSessionFromCookie(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can view approval requests
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get approval request with campaign details
    const query = `
      SELECT 
        ca.*,
        c.name as campaign_name,
        c.budget as campaign_budget,
        c.probability as campaign_probability,
        c."advertiserId",
        c."agencyId",
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "CampaignApproval" ca
      JOIN "Campaign" c ON c.id = ca."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE ca.id = $1
    `
    
    const results = await querySchema<any>(orgSlug, query, [id])
    
    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

    return NextResponse.json({
      approval: results[0]
    })
  } catch (error) {
    console.error('Error fetching approval request:', error)
    return NextResponse.json({ error: 'Failed to fetch approval request' }, { status: 500 })
  }
}

// PUT - Approve or reject the request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSessionFromCookie(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can approve/reject
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, notes, reason } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get approval request with campaign details
    const getQuery = `
      SELECT 
        ca.*,
        c.id as campaign_id,
        c.name as campaign_name,
        c.budget as campaign_budget,
        c.probability as campaign_probability,
        c."reservationId"
      FROM "CampaignApproval" ca
      JOIN "Campaign" c ON c.id = ca."campaignId"
      WHERE ca.id = $1 AND ca.status = 'pending'
    `
    
    const approvals = await querySchema<any>(orgSlug, getQuery, [id])
    
    if (!approvals || approvals.length === 0) {
      return NextResponse.json({ error: 'Pending approval request not found' }, { status: 404 })
    }

    const approval = approvals[0]

    if (action === 'approve') {
      // Update approval status
      const approveQuery = `
        UPDATE "CampaignApproval"
        SET 
          status = 'approved',
          "approvedBy" = $2,
          "approvedAt" = NOW(),
          "approvalNotes" = $3,
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `
      await querySchema(orgSlug, approveQuery, [id, session.userId, notes || ''])

      // Move campaign to 100% and create order
      const moveToOrderQuery = `
        UPDATE "Campaign"
        SET 
          probability = 100,
          status = 'won',
          "updatedAt" = NOW(),
          "updatedBy" = $2
        WHERE id = $1
      `
      await querySchema(orgSlug, moveToOrderQuery, [approval.campaign_id, session.userId])

      // Create order from campaign
      const orderId = uuidv4()
      const orderNumber = `ORD-${Date.now()}`
      const createOrderQuery = `
        INSERT INTO "Order" (
          id, "orderNumber", "campaignId", "advertiserId", "agencyId",
          "totalAmount", "netAmount", status, "createdAt", "updatedAt",
          "createdBy", "organizationId", "submittedAt", "submittedBy",
          "approvedAt", "approvedBy"
        )
        SELECT 
          $1, $2, id, "advertiserId", "agencyId",
          budget, budget, 'active', NOW(), NOW(),
          $3, "organizationId", NOW(), $3,
          NOW(), $3
        FROM "Campaign"
        WHERE id = $4
        RETURNING *
      `
      await querySchema(orgSlug, createOrderQuery, [orderId, orderNumber, session.userId, approval.campaign_id])

      // Log activity
      await activityService.logActivity({
        type: 'campaign',
        action: 'approved',
        title: 'Campaign Approved at 90%',
        description: `Campaign "${approval.campaign_name}" approved and moved to Order`,
        actorId: session.userId,
        actorName: session.name || session.email,
        actorEmail: session.email,
        actorRole: session.role,
        targetType: 'campaign',
        targetId: approval.campaign_id,
        targetName: approval.campaign_name,
        organizationId: session.organizationId!,
        metadata: {
          approvalId: id,
          orderId,
          notes
        }
      })

      // TODO: Create ad requests, creative requests, contracts, invoicing schedule

      return NextResponse.json({
        success: true,
        message: 'Campaign approved and moved to Order',
        orderId
      })

    } else {
      // Reject - update approval status
      const rejectQuery = `
        UPDATE "CampaignApproval"
        SET 
          status = 'rejected',
          "rejectedBy" = $2,
          "rejectedAt" = NOW(),
          "rejectionReason" = $3,
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `
      await querySchema(orgSlug, rejectQuery, [id, session.userId, reason || ''])

      // Release inventory reservations
      if (approval.reservationId) {
        const releaseQuery = `
          DELETE FROM "InventoryReservation"
          WHERE "scheduleId" = $1
        `
        await querySchema(orgSlug, releaseQuery, [approval.campaign_id])
      }

      // Move campaign back to 65%
      const moveBackQuery = `
        UPDATE "Campaign"
        SET 
          probability = 65,
          "reservationId" = NULL,
          "reservationCreatedAt" = NULL,
          "approvalRequestId" = NULL,
          "updatedAt" = NOW(),
          "updatedBy" = $2
        WHERE id = $1
      `
      await querySchema(orgSlug, moveBackQuery, [approval.campaign_id, session.userId])

      // Log activity
      await activityService.logActivity({
        type: 'campaign',
        action: 'rejected',
        title: 'Campaign Rejected at 90%',
        description: `Campaign "${approval.campaign_name}" rejected and moved back to 65%`,
        actorId: session.userId,
        actorName: session.name || session.email,
        actorEmail: session.email,
        actorRole: session.role,
        targetType: 'campaign',
        targetId: approval.campaign_id,
        targetName: approval.campaign_name,
        organizationId: session.organizationId!,
        metadata: {
          approvalId: id,
          reason
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Campaign rejected and moved back to 65%'
      })
    }
  } catch (error) {
    console.error('Error processing approval:', error)
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
  }
}

// GET all pending approvals
export async function getPendingApprovals(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can view approvals
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const query = `
      SELECT 
        ca.*,
        c.name as campaign_name,
        c.budget as campaign_budget,
        a.name as advertiser_name,
        ag.name as agency_name,
        u.name as requested_by_name
      FROM "CampaignApproval" ca
      JOIN "Campaign" c ON c.id = ca."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      LEFT JOIN "User" u ON u.id = ca."requestedBy"
      WHERE ca.status = 'pending'
      ORDER BY ca."createdAt" DESC
    `
    
    const approvals = await querySchema<any>(orgSlug, query, [])

    return NextResponse.json({
      approvals: approvals || []
    })
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 })
  }
}