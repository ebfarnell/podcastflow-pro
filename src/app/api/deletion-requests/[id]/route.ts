import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/deletion-requests/[id] - Get a specific deletion request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can view deletion requests
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deletionRequest = await prisma.deletionRequest.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId // Ensure multi-tenant isolation
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 })
    }

    // Transform data to match expected frontend interface
    const transformedRequest = {
      id: deletionRequest.id,
      entityType: deletionRequest.entityType,
      entityId: deletionRequest.entityId,
      entityName: deletionRequest.entityName,
      entityValue: null,
      requestedBy: deletionRequest.requestedBy,
      requester: deletionRequest.requester,
      requestedAt: deletionRequest.requestedAt.toISOString(),
      reviewedBy: deletionRequest.reviewedBy,
      reviewer: deletionRequest.reviewer,
      reviewedAt: deletionRequest.reviewedAt?.toISOString(),
      status: deletionRequest.status as 'pending' | 'approved' | 'denied' | 'cancelled',
      reason: deletionRequest.reason,
      reviewNotes: deletionRequest.reviewNotes
    }

    return NextResponse.json(transformedRequest)

  } catch (error) {
    console.error('Error fetching deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deletion request' },
      { status: 500 }
    )
  }
}

// PUT /api/deletion-requests/[id] - Update deletion request (approve/deny)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can approve/deny deletion requests
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, reviewNotes } = body

    // Validate status
    const validStatuses = ['approved', 'denied', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be approved, denied, or cancelled' },
        { status: 400 }
      )
    }

    // First, verify the deletion request exists and belongs to this organization
    const existingRequest = await prisma.deletionRequest.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 })
    }

    // Check if request is still pending
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Deletion request has already been reviewed' },
        { status: 400 }
      )
    }

    // If approved, perform the actual deletion BEFORE updating the status
    if (status === 'approved') {
      console.log(`🗑️ Deletion approved for ${existingRequest.entityType} ${existingRequest.entityId}`)
      
      let deletionSuccessful = false
      let deletionError: string | null = null
      
      try {
        // Import necessary utilities
        const { getUserOrgSlug, safeQuerySchema, getSchemaName } = await import('@/lib/db/schema-db')
        
        // Get organization slug
        const orgSlug = await getUserOrgSlug(session.userId)
        if (!orgSlug) {
          console.error('❌ Could not get organization slug for deletion')
          throw new Error('Organization not found')
        }
        
        // Get the actual schema name (converts hyphens to underscores)
        const schemaName = getSchemaName(orgSlug)

        // Delete based on entity type
        switch (existingRequest.entityType) {
          case 'campaign': {
            console.log(`🗑️ Deleting campaign ${existingRequest.entityId}`)
            
            // First check if campaign exists
            const checkQuery = `
              SELECT id FROM "${schemaName}"."Campaign" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { data: checkData, error: checkError } = await safeQuerySchema(orgSlug, checkQuery, [existingRequest.entityId, existingRequest.organizationId])
            
            if (checkError) {
              console.error(`❌ Failed to check campaign existence: ${checkError}`)
              throw new Error(`Failed to check campaign existence: ${checkError}`)
            }
            
            if (!checkData || checkData.length === 0) {
              console.log(`⚠️ Campaign ${existingRequest.entityId} not found or already deleted`)
              break
            }
            
            // Delete related data first to avoid foreign key constraints
            const deleteRelatedQueries = [
              // Delete ad approvals
              `DELETE FROM "${schemaName}"."AdApproval" WHERE "campaignId" = $1`,
              // Delete ad creatives
              `DELETE FROM "${schemaName}"."AdCreative" WHERE "campaignId" = $1`,
              // Delete blocked spots
              `DELETE FROM "${schemaName}"."BlockedSpot" WHERE "campaignId" = $1`,
              // Delete campaign analytics
              `DELETE FROM "${schemaName}"."CampaignAnalytics" WHERE "campaignId" = $1`,
              // Delete campaign categories
              `DELETE FROM "${schemaName}"."CampaignCategory" WHERE "campaignId" = $1`,
              // Delete campaign schedules
              `DELETE FROM "${schemaName}"."CampaignSchedule" WHERE "campaignId" = $1`,
              // Delete contracts
              `DELETE FROM "${schemaName}"."Contract" WHERE "campaignId" = $1`,
              // Delete invoice items
              `DELETE FROM "${schemaName}"."InvoiceItem" WHERE "campaignId" = $1`,
              // Delete orders
              `DELETE FROM "${schemaName}"."Order" WHERE "campaignId" = $1`,
              // Delete reservations
              `DELETE FROM "${schemaName}"."Reservation" WHERE "campaignId" = $1`,
              // Delete schedule builder entries
              `DELETE FROM "${schemaName}"."ScheduleBuilder" WHERE "campaignId" = $1`,
              // Delete campaign approvals (if exists)
              `DELETE FROM "${schemaName}"."CampaignApproval" WHERE "campaignId" = $1`,
              // Delete campaign versions (if exists)
              `DELETE FROM "${schemaName}"."CampaignVersion" WHERE "campaignId" = $1`,
              // Delete campaign change history (if exists)
              `DELETE FROM "${schemaName}"."CampaignChangeHistory" WHERE "campaignId" = $1`,
              // Delete campaign spots (if exists)
              `DELETE FROM "${schemaName}"."CampaignSpot" WHERE "campaignId" = $1`
            ]
            
            // Execute all related deletions
            for (const query of deleteRelatedQueries) {
              const { error: relatedError } = await safeQuerySchema(orgSlug, query, [existingRequest.entityId])
              if (relatedError) {
                console.warn(`⚠️ Failed to delete related data: ${relatedError}`)
                // Continue with other deletions even if one fails
              }
            }
            
            // Now delete the campaign itself
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Campaign" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete campaign: ${error}`)
              throw new Error(`Failed to delete campaign: ${error}`)
            }
            
            // Verify deletion
            const { data: verifyData, error: verifyError } = await safeQuerySchema(orgSlug, checkQuery, [existingRequest.entityId, existingRequest.organizationId])
            
            if (!verifyError && verifyData && verifyData.length > 0) {
              console.error(`❌ Campaign ${existingRequest.entityId} still exists after deletion attempt`)
              throw new Error('Campaign deletion verification failed')
            }
            
            console.log(`✅ Campaign ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          case 'order': {
            console.log(`🗑️ Deleting order ${existingRequest.entityId}`)
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Order" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete order: ${error}`)
              throw new Error(`Failed to delete order: ${error}`)
            }
            console.log(`✅ Order ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          case 'advertiser': {
            console.log(`🗑️ Deleting advertiser ${existingRequest.entityId}`)
            
            // First check if advertiser exists
            const checkQuery = `
              SELECT id, (SELECT COUNT(*) FROM "${schemaName}"."Campaign" WHERE "advertiserId" = a.id) as campaign_count
              FROM "${schemaName}"."Advertiser" a
              WHERE id = $1 AND "organizationId" = $2
            `
            const { data: checkData, error: checkError } = await safeQuerySchema(orgSlug, checkQuery, [existingRequest.entityId, existingRequest.organizationId])
            
            if (checkError) {
              console.error(`❌ Failed to check advertiser existence: ${checkError}`)
              throw new Error(`Failed to check advertiser existence: ${checkError}`)
            }
            
            if (!checkData || checkData.length === 0) {
              console.log(`⚠️ Advertiser ${existingRequest.entityId} not found or already deleted`)
              break
            }
            
            // Check if advertiser has campaigns
            if (parseInt(checkData[0].campaign_count) > 0) {
              console.error(`❌ Cannot delete advertiser with active campaigns`)
              throw new Error('Cannot delete advertiser with active campaigns. Please delete all campaigns first.')
            }
            
            // Delete the advertiser
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Advertiser" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete advertiser: ${error}`)
              throw new Error(`Failed to delete advertiser: ${error}`)
            }
            
            console.log(`✅ Advertiser ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          case 'agency': {
            console.log(`🗑️ Deleting agency ${existingRequest.entityId}`)
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Agency" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete agency: ${error}`)
              throw new Error(`Failed to delete agency: ${error}`)
            }
            console.log(`✅ Agency ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          case 'show': {
            console.log(`🗑️ Deleting show ${existingRequest.entityId}`)
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Show" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete show: ${error}`)
              throw new Error(`Failed to delete show: ${error}`)
            }
            console.log(`✅ Show ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          case 'episode': {
            console.log(`🗑️ Deleting episode ${existingRequest.entityId}`)
            const deleteQuery = `
              DELETE FROM "${schemaName}"."Episode" 
              WHERE id = $1 AND "organizationId" = $2
            `
            const { error } = await safeQuerySchema(orgSlug, deleteQuery, [existingRequest.entityId, existingRequest.organizationId])
            if (error) {
              console.error(`❌ Failed to delete episode: ${error}`)
              throw new Error(`Failed to delete episode: ${error}`)
            }
            console.log(`✅ Episode ${existingRequest.entityId} deleted successfully`)
            break
          }
          
          default:
            console.error(`❌ Unknown entity type for deletion: ${existingRequest.entityType}`)
            deletionError = `Unknown entity type: ${existingRequest.entityType}`
            break
        }
        
        // If we get here without errors, deletion was successful
        deletionSuccessful = true
        
      } catch (deleteError) {
        console.error('❌ Error during entity deletion:', deleteError)
        deletionError = deleteError instanceof Error ? deleteError.message : 'Unknown deletion error'
        deletionSuccessful = false
      }
      
      // If deletion failed, don't approve the request
      if (!deletionSuccessful) {
        return NextResponse.json(
          { 
            error: 'Failed to delete entity', 
            details: deletionError,
            message: 'The deletion request could not be completed. The entity may have dependencies or the deletion failed.' 
          },
          { status: 500 }
        )
      }
    }

    // Now update the deletion request status after successful deletion (or if not approved)
    const updatedRequest = await prisma.deletionRequest.update({
      where: {
        id: params.id
      },
      data: {
        status,
        reviewNotes: reviewNotes || null,
        reviewedBy: session.userId,
        reviewedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Transform response to match expected format
    const transformedRequest = {
      id: updatedRequest.id,
      entityType: updatedRequest.entityType,
      entityId: updatedRequest.entityId,
      entityName: updatedRequest.entityName,
      entityValue: null,
      requestedBy: updatedRequest.requestedBy,
      requester: updatedRequest.requester,
      requestedAt: updatedRequest.requestedAt.toISOString(),
      reviewedBy: updatedRequest.reviewedBy,
      reviewer: updatedRequest.reviewer,
      reviewedAt: updatedRequest.reviewedAt?.toISOString(),
      status: updatedRequest.status as 'pending' | 'approved' | 'denied' | 'cancelled',
      reason: updatedRequest.reason,
      reviewNotes: updatedRequest.reviewNotes
    }

    return NextResponse.json(transformedRequest)

  } catch (error) {
    console.error('Error updating deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to update deletion request' },
      { status: 500 }
    )
  }
}

// DELETE /api/deletion-requests/[id] - Cancel a deletion request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First, verify the deletion request exists and belongs to this organization
    const existingRequest = await prisma.deletionRequest.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 })
    }

    // Only allow the requester, admins, or masters to cancel
    const canCancel = session.role === 'admin' || 
                     session.role === 'master' || 
                     existingRequest.requestedBy === session.userId

    if (!canCancel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if request is still pending
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending deletion requests' },
        { status: 400 }
      )
    }

    // Update status to cancelled rather than deleting the record
    const cancelledRequest = await prisma.deletionRequest.update({
      where: {
        id: params.id
      },
      data: {
        status: 'cancelled',
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        reviewNotes: 'Cancelled by user'
      }
    })

    return NextResponse.json({ 
      message: 'Deletion request cancelled successfully',
      id: cancelledRequest.id 
    })

  } catch (error) {
    console.error('Error cancelling deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel deletion request' },
      { status: 500 }
    )
  }
}