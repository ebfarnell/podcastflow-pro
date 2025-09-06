import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, querySchema, safeQuerySchema, getSchemaName } from '@/lib/db/schema-db'

// Extended debug mode flag - set via environment or hardcoded for testing
const DEBUG_MODE = process.env.ENABLE_REJECTION_DEBUG === 'true' || true

function debugLog(context: string, data: any) {
  if (DEBUG_MODE) {
    console.log(`[REJECT_DEBUG][${new Date().toISOString()}][${context}]`, 
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Log incoming request details
    debugLog(`${requestId}:REQUEST`, {
      method: request.method,
      url: request.url,
      campaignId: params.id,
      headers: {
        'content-type': request.headers.get('content-type'),
        'cookie': request.headers.get('cookie') ? '[PRESENT]' : '[MISSING]',
        'authorization': request.headers.get('authorization') ? '[PRESENT]' : '[MISSING]'
      }
    })

    // Parse request body
    const body = await request.json()
    debugLog(`${requestId}:BODY`, { reason: body.reason })

    // Get and validate session
    const session = await getSessionFromCookie(request)
    debugLog(`${requestId}:SESSION`, {
      exists: !!session,
      userId: session?.userId,
      role: session?.role,
      organizationId: session?.organizationId,
      organizationSlug: session?.organizationSlug
    })

    if (!session) {
      debugLog(`${requestId}:AUTH_FAIL`, 'No valid session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // FIX: Use session.role instead of session.userRole
    // Only admin and master roles can reject campaigns
    debugLog(`${requestId}:ROLE_CHECK`, {
      userRole: session.role,
      allowedRoles: ['admin', 'master'],
      hasPermission: ['admin', 'master'].includes(session.role)
    })

    if (!['admin', 'master'].includes(session.role)) {
      debugLog(`${requestId}:ROLE_DENIED`, `User role '${session.role}' not authorized`)
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
    }

    // Get organization context
    const orgSlug = session.organizationSlug || await getUserOrgSlug(session.userId)
    const schemaName = getSchemaName(orgSlug)
    debugLog(`${requestId}:ORG_CONTEXT`, { orgSlug, schemaName })

    if (!orgSlug) {
      debugLog(`${requestId}:ORG_FAIL`, 'Organization not found for user')
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const campaignId = params.id
    const { reason } = body
    const timestamp = new Date().toISOString()

    // First, check if campaign exists and get its current state
    // Note: Don't use schema in the query - safeQuerySchema handles it
    const checkCampaignQuery = `
      SELECT id, name, status, "approvalRequestId", "reservationId", "advertiserId", "agencyId", budget
      FROM "Campaign"
      WHERE id = $1
    `
    
    debugLog(`${requestId}:CAMPAIGN_CHECK_QUERY`, { query: checkCampaignQuery, params: [campaignId] })
    
    const { data: existingCampaigns, error: checkError } = await safeQuerySchema(
      orgSlug, 
      checkCampaignQuery, 
      [campaignId]
    )

    if (checkError) {
      debugLog(`${requestId}:CAMPAIGN_CHECK_ERROR`, checkError)
      return NextResponse.json({ error: 'Failed to check campaign status' }, { status: 500 })
    }

    if (!existingCampaigns || existingCampaigns.length === 0) {
      debugLog(`${requestId}:CAMPAIGN_NOT_FOUND`, { campaignId })
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = existingCampaigns[0]
    debugLog(`${requestId}:CAMPAIGN_STATE`, campaign)

    // Check if campaign is in a state that can be rejected
    if (campaign.status === 'rejected') {
      debugLog(`${requestId}:ALREADY_REJECTED`, { campaignId, currentStatus: campaign.status })
      return NextResponse.json({ 
        error: 'Campaign is already rejected',
        campaign 
      }, { status: 400 })
    }

    // Start transaction-like operations for workflow automation
    const workflowActions = []

    // 1. If there's a reservation, we need to release the inventory
    if (campaign.reservationId) {
      debugLog(`${requestId}:RELEASE_INVENTORY`, { reservationId: campaign.reservationId })
      
      const releaseInventoryQuery = `
        UPDATE "EpisodeInventory"
        SET 
          status = 'available',
          "reservedBy" = NULL,
          "reservedAt" = NULL,
          "updatedAt" = $2
        WHERE "reservationId" = $1
        RETURNING id, "episodeId", "showId"
      `
      
      const { data: releasedInventory, error: releaseError } = await safeQuerySchema(
        orgSlug,
        releaseInventoryQuery,
        [campaign.reservationId, timestamp]
      )

      if (releaseError) {
        debugLog(`${requestId}:INVENTORY_RELEASE_ERROR`, releaseError)
        // Log but don't fail - inventory release is secondary
      } else {
        debugLog(`${requestId}:INVENTORY_RELEASED`, { 
          count: releasedInventory?.length || 0,
          items: releasedInventory 
        })
        workflowActions.push(`Released ${releasedInventory?.length || 0} inventory items`)
      }
    }

    // 2. Update campaign status to 65% (back to proposal stage)
    const updateCampaignQuery = `
      UPDATE "Campaign"
      SET 
        status = 'proposal',
        probability = 65,
        "approvalRequestId" = NULL,
        "reservationId" = NULL,
        "lastStatusChangeAt" = $2,
        "lastStatusChangeBy" = $3,
        "updatedAt" = $2,
        "updatedBy" = $3
      WHERE id = $1
      RETURNING *
    `
    
    debugLog(`${requestId}:UPDATE_CAMPAIGN_QUERY`, { 
      query: updateCampaignQuery, 
      params: [campaignId, timestamp, session.userId] 
    })

    const { data: updatedCampaigns, error: updateError } = await safeQuerySchema(
      orgSlug,
      updateCampaignQuery,
      [campaignId, timestamp, session.userId]
    )

    if (updateError) {
      debugLog(`${requestId}:UPDATE_ERROR`, updateError)
      return NextResponse.json({ 
        error: 'Failed to update campaign status',
        details: updateError.message 
      }, { status: 500 })
    }

    if (!updatedCampaigns || updatedCampaigns.length === 0) {
      debugLog(`${requestId}:UPDATE_NO_RESULT`, { campaignId })
      return NextResponse.json({ error: 'Campaign update failed' }, { status: 500 })
    }

    const updatedCampaign = updatedCampaigns[0]
    workflowActions.push('Reset campaign to proposal stage (65%)')

    // 3. If there was an approval request, update it as rejected
    if (campaign.approvalRequestId) {
      debugLog(`${requestId}:UPDATE_APPROVAL`, { approvalRequestId: campaign.approvalRequestId })
      
      const updateApprovalQuery = `
        UPDATE "AdApproval"
        SET 
          status = 'rejected',
          "rejectedAt" = $2,
          "workflowStage" = 'rejected',
          "updatedAt" = $2
        WHERE id = $1
      `
      
      const { error: approvalError } = await safeQuerySchema(
        orgSlug,
        updateApprovalQuery,
        [campaign.approvalRequestId, timestamp]
      )

      if (approvalError) {
        debugLog(`${requestId}:APPROVAL_UPDATE_ERROR`, approvalError)
      } else {
        workflowActions.push('Updated approval request to rejected')
      }
    }

    // 4. Create an activity log entry for audit trail
    const activityLogQuery = `
      INSERT INTO "Activity" (
        id, type, description, metadata, "userId", "organizationId", "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        'campaign_rejected',
        $1,
        $2,
        $3,
        $4,
        $5
      )
    `

    const activityDescription = `Campaign "${campaign.name}" rejected${reason ? `: ${reason}` : ''}`
    const activityMetadata = {
      campaignId,
      campaignName: campaign.name,
      previousStatus: campaign.status,
      newStatus: 'proposal',
      rejectionReason: reason || 'No reason provided',
      workflowActions,
      requestId
    }

    debugLog(`${requestId}:ACTIVITY_LOG`, { description: activityDescription, metadata: activityMetadata })

    const { error: activityError } = await safeQuerySchema(
      orgSlug,
      activityLogQuery,
      [
        activityDescription,
        JSON.stringify(activityMetadata),
        session.userId,
        session.organizationId,
        timestamp
      ]
    )

    if (activityError) {
      debugLog(`${requestId}:ACTIVITY_LOG_ERROR`, activityError)
      // Don't fail on activity log error
    }

    // Success response
    debugLog(`${requestId}:SUCCESS`, {
      campaignId,
      newStatus: updatedCampaign.status,
      probability: updatedCampaign.probability,
      workflowActions
    })

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      workflowActions,
      debug: DEBUG_MODE ? {
        requestId,
        previousState: campaign,
        newState: updatedCampaign,
        actionsPerformed: workflowActions
      } : undefined
    })

  } catch (error) {
    debugLog(`${requestId}:CRITICAL_ERROR`, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    })

    console.error('Error rejecting campaign:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reject campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId: DEBUG_MODE ? requestId : undefined
      },
      { status: 500 }
    )
  }
}