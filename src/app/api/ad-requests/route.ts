import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { getTenantClient } from '@/lib/db/tenant-isolation'
import { activityService } from '@/lib/activities/activity-service'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'all'
    const assignedToMe = url.searchParams.get('assignedToMe') === 'true'
    const showId = url.searchParams.get('showId')
    const orderId = url.searchParams.get('orderId')
    
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

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Build query filters
    const filters: any = {
      organizationId: user.organizationId
    }

    if (status !== 'all') {
      filters.status = status
    }

    if (assignedToMe) {
      filters.assignedToId = user.id
    }

    if (showId) {
      filters.showId = showId
    }

    if (orderId) {
      filters.orderId = orderId
    }

    // Role-based filtering
    if (user.role === 'producer' || user.role === 'talent') {
      filters.assignedToId = user.id
    } else if (user.role === 'sales') {
      // Sales can see requests for orders they created
      const orderIds = await tenantDb.order.findMany({
        where: { createdBy: user.id },
        select: { id: true }
      })
      filters.orderId = { in: orderIds.map(o => o.id) }
    }

    // Fetch ad requests with related data
    const adRequests = await tenantDb.adRequest.findMany({
      where: filters,
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
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Get statistics
    const stats = {
      total: adRequests.length,
      pending: adRequests.filter(r => r.status === 'pending').length,
      inProgress: adRequests.filter(r => r.status === 'in_progress').length,
      completed: adRequests.filter(r => r.status === 'completed').length,
      overdue: adRequests.filter(r => 
        r.status !== 'completed' && 
        r.dueDate && 
        new Date(r.dueDate) < new Date()
      ).length
    }

    return NextResponse.json({
      adRequests,
      stats
    })

  } catch (error: any) {
    console.error('AdRequests API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad requests', details: error.message },
      { status: 500 }
    )
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { 
      orderId,
      showId,
      assignedToId,
      assignedToRole,
      title,
      description,
      requirements,
      dueDate,
      priority = 'medium'
    } = body
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and sales can create ad requests manually
    if (!['admin', 'sales', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Verify order exists
    const order = await tenantDb.order.findUnique({
      where: { id: orderId },
      include: { campaign: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Create ad request
    const adRequest = await tenantDb.adRequest.create({
      data: {
        orderId,
        showId,
        assignedToId,
        assignedToRole,
        title,
        description,
        requirements: requirements || {},
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status: 'pending',
        createdBy: user.id,
        organizationId: user.organizationId!
      },
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
      action: 'created',
      title: 'Ad Request Created',
      description: `Created ad request for ${adRequest.show.name}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'ad_request',
      targetId: adRequest.id,
      targetName: adRequest.title,
      organizationId: user.organizationId!,
      orderId: order.id,
      showId: showId,
      metadata: {
        assignedToId,
        assignedToRole,
        priority,
        dueDate
      }
    })

    return NextResponse.json({
      success: true,
      adRequest
    })

  } catch (error: any) {
    console.error('Create ad request error:', error)
    return NextResponse.json(
      { error: 'Failed to create ad request', details: error.message },
      { status: 500 }
    )
  }
}

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