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

    // Fetch ad request
    const adRequest = await tenantDb.adRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            advertiser: true,
            campaign: true
          }
        },
        show: true,
        episode: true,
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

    if (!adRequest) {
      return NextResponse.json({ error: 'Ad request not found' }, { status: 404 })
    }

    // Check permissions
    const canView = 
      user.role === 'admin' || 
      user.role === 'master' ||
      adRequest.assignedToId === user.id ||
      adRequest.createdBy === user.id

    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    return NextResponse.json({ adRequest })

  } catch (error: any) {
    console.error('Get ad request error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad request', details: error.message },
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
      notes,
      deliverables,
      completedAt
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

    // Get existing ad request
    const existing = await tenantDb.adRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            campaign: true
          }
        },
        show: true
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ad request not found' }, { status: 404 })
    }

    // Check permissions
    const canUpdate = 
      user.role === 'admin' || 
      user.role === 'master' ||
      existing.assignedToId === user.id

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (status !== undefined) {
      updateData.status = status
      
      if (status === 'completed') {
        updateData.completedAt = completedAt || new Date()
        updateData.completedBy = user.id
      }
    }

    if (notes !== undefined) updateData.notes = notes
    if (deliverables !== undefined) updateData.deliverables = deliverables

    // Update ad request
    const updated = await tenantDb.adRequest.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            advertiser: true,
            campaign: true
          }
        },
        show: true,
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
      title: 'Ad Request Updated',
      description: `Updated ad request status to ${status}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'ad_request',
      targetId: updated.id,
      targetName: updated.title,
      organizationId: user.organizationId!,
      orderId: updated.orderId,
      showId: updated.showId,
      metadata: {
        oldStatus: existing.status,
        newStatus: status,
        notes
      }
    })

    // Send notification if status changed
    if (status && status !== existing.status) {
      if (status === 'completed' && existing.createdBy !== user.id) {
        await notificationService.createNotification({
          userId: existing.createdBy,
          title: 'Ad Request Completed',
          message: `Ad request for ${updated.show.name} has been completed`,
          type: 'task_completed',
          category: 'tasks',
          actionUrl: `/orders/${updated.orderId}`,
          metadata: {
            adRequestId: updated.id,
            showName: updated.show.name,
            completedBy: user.name || user.email
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      adRequest: updated
    })

  } catch (error: any) {
    console.error('Update ad request error:', error)
    return NextResponse.json(
      { error: 'Failed to update ad request', details: error.message },
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

    // Get existing ad request
    const existing = await tenantDb.adRequest.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ad request not found' }, { status: 404 })
    }

    // Delete ad request
    await tenantDb.adRequest.delete({
      where: { id }
    })

    // Log activity
    await activityService.logActivity({
      type: 'task',
      action: 'deleted',
      title: 'Ad Request Deleted',
      description: `Deleted ad request: ${existing.title}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'ad_request',
      targetId: id,
      targetName: existing.title,
      organizationId: user.organizationId!,
      orderId: existing.orderId,
      showId: existing.showId
    })

    return NextResponse.json({
      success: true,
      message: 'Ad request deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete ad request error:', error)
    return NextResponse.json(
      { error: 'Failed to delete ad request', details: error.message },
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