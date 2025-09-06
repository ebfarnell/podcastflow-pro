import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { getTenantClient } from '@/lib/db/tenant-isolation'
import { activityService } from '@/lib/activities/activity-service'
import { notificationService } from '@/lib/notifications/notification-service'

export const dynamic = 'force-dynamic'

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Fetch creative request
    const creativeRequest = await tenantDb.creativeRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            advertiser: true,
            agency: true
          }
        },
        campaign: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!creativeRequest) {
      return NextResponse.json({ error: 'Creative request not found' }, { status: 404 })
    }

    // Check permissions
    const canView = 
      user.role === 'admin' || 
      user.role === 'master' ||
      creativeRequest.assignedToId === user.id ||
      creativeRequest.createdBy === user.id

    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    return NextResponse.json({ creativeRequest })

  } catch (error: any) {
    console.error('Get creative request error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creative request', details: error.message },
      { status: 500 }
    )
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      status,
      submittedAssets,
      feedbackHistory,
      submittedAt,
      approvedAt,
      approvedBy
    } = body
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Get existing creative request
    const existing = await tenantDb.creativeRequest.findUnique({
      where: { id },
      include: {
        campaign: true
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Creative request not found' }, { status: 404 })
    }

    // Check permissions
    const canUpdate = 
      user.role === 'admin' || 
      user.role === 'master' ||
      existing.assignedToId === user.id ||
      (status === 'approved' && ['admin', 'master'].includes(user.role))

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (status !== undefined) {
      updateData.status = status
      
      if (status === 'submitted' && !existing.submittedAt) {
        updateData.submittedAt = submittedAt || new Date()
      }
      
      if (status === 'approved') {
        updateData.approvedAt = approvedAt || new Date()
        updateData.approvedBy = approvedBy || user.id
      }
    }

    if (submittedAssets !== undefined) updateData.submittedAssets = submittedAssets
    
    if (feedbackHistory !== undefined) {
      // Append new feedback to history
      const newFeedback = {
        userId: user.id,
        userName: user.name || user.email,
        feedback: feedbackHistory,
        timestamp: new Date()
      }
      updateData.feedbackHistory = [
        ...(existing.feedbackHistory as any[] || []),
        newFeedback
      ]
    }

    // Update creative request
    const updated = await tenantDb.creativeRequest.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            advertiser: true
          }
        },
        campaign: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Log activity
    await activityService.logActivity({
      type: 'task',
      action: 'updated',
      title: 'Creative Request Updated',
      description: `Updated creative request status to ${status}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'creative_request',
      targetId: updated.id,
      targetName: updated.title,
      organizationId: user.organizationId!,
      orderId: updated.orderId,
      campaignId: updated.campaignId,
      metadata: {
        oldStatus: existing.status,
        newStatus: status,
        submittedAssetsCount: submittedAssets?.length
      }
    })

    // Send notifications based on status change
    if (status && status !== existing.status) {
      if (status === 'submitted' && existing.createdBy !== user.id) {
        await notificationService.createNotification({
          userId: existing.createdBy,
          title: 'Creative Assets Submitted',
          message: `Creative assets submitted for ${updated.campaign.name}`,
          type: 'task_update',
          category: 'tasks',
          actionUrl: `/creative-requests/${updated.id}`,
          metadata: {
            creativeRequestId: updated.id,
            campaignName: updated.campaign.name,
            submittedBy: user.name || user.email
          }
        })
      } else if (status === 'approved' && existing.assignedToId !== user.id) {
        await notificationService.createNotification({
          userId: existing.assignedToId,
          title: 'Creative Assets Approved',
          message: `Your creative assets for ${updated.campaign.name} have been approved`,
          type: 'approval',
          category: 'tasks',
          actionUrl: `/orders/${updated.orderId}`,
          metadata: {
            creativeRequestId: updated.id,
            campaignName: updated.campaign.name,
            approvedBy: user.name || user.email
          }
        })
      } else if (status === 'revision_needed' && existing.assignedToId !== user.id) {
        await notificationService.createNotification({
          userId: existing.assignedToId,
          title: 'Creative Revision Needed',
          message: `Revision requested for ${updated.campaign.name}`,
          type: 'task_update',
          category: 'tasks',
          priority: 'high',
          requiresAction: true,
          actionUrl: `/creative-requests/${updated.id}`,
          metadata: {
            creativeRequestId: updated.id,
            campaignName: updated.campaign.name,
            requestedBy: user.name || user.email
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      creativeRequest: updated
    })

  } catch (error: any) {
    console.error('Update creative request error:', error)
    return NextResponse.json(
      { error: 'Failed to update creative request', details: error.message },
      { status: 500 }
    )
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Get existing creative request
    const existing = await tenantDb.creativeRequest.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Creative request not found' }, { status: 404 })
    }

    // Delete creative request
    await tenantDb.creativeRequest.delete({
      where: { id }
    })

    // Log activity
    await activityService.logActivity({
      type: 'task',
      action: 'deleted',
      title: 'Creative Request Deleted',
      description: `Deleted creative request: ${existing.title}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'creative_request',
      targetId: id,
      targetName: existing.title,
      organizationId: user.organizationId!,
      orderId: existing.orderId,
      campaignId: existing.campaignId
    })

    return NextResponse.json({
      success: true,
      message: 'Creative request deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete creative request error:', error)
    return NextResponse.json(
      { error: 'Failed to delete creative request', details: error.message },
      { status: 500 }
    )
  }
}

export const GET = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return getHandler(request as AuthenticatedRequest, context)
}

export const PUT = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return putHandler(request as AuthenticatedRequest, context)
}

export const DELETE = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return deleteHandler(request as AuthenticatedRequest, context)
}