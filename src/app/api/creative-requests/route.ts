import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { getTenantClient } from '@/lib/db/tenant-isolation'
import { activityService } from '@/lib/activities/activity-service'

export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'all'
    const assignedToMe = url.searchParams.get('assignedToMe') === 'true'
    const campaignId = url.searchParams.get('campaignId')
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

    if (campaignId) {
      filters.campaignId = campaignId
    }

    if (orderId) {
      filters.orderId = orderId
    }

    // Role-based filtering
    if (user.role === 'sales') {
      // Sales users see creative requests assigned to them
      filters.assignedToId = user.id
    } else if (user.role === 'producer' || user.role === 'talent') {
      // Producers/talent can see creative requests for campaigns they're involved with
      const orders = await tenantDb.order.findMany({
        where: {
          adRequests: {
            some: {
              assignedToId: user.id
            }
          }
        },
        select: { id: true }
      })
      filters.orderId = { in: orders.map(o => o.id) }
    }

    // Fetch creative requests with related data
    const creativeRequests = await tenantDb.creativeRequest.findMany({
      where: filters,
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
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Get statistics
    const stats = {
      total: creativeRequests.length,
      pending: creativeRequests.filter(r => r.status === 'pending').length,
      inProgress: creativeRequests.filter(r => r.status === 'in_progress').length,
      submitted: creativeRequests.filter(r => r.status === 'submitted').length,
      approved: creativeRequests.filter(r => r.status === 'approved').length,
      revisionNeeded: creativeRequests.filter(r => r.status === 'revision_needed').length,
      overdue: creativeRequests.filter(r => 
        !['approved', 'submitted'].includes(r.status) && 
        r.dueDate && 
        new Date(r.dueDate) < new Date()
      ).length
    }

    return NextResponse.json({
      creativeRequests,
      stats
    })

  } catch (error: any) {
    console.error('CreativeRequests API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creative requests', details: error.message },
      { status: 500 }
    )
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { 
      orderId,
      campaignId,
      assignedToId,
      title,
      description,
      requiredAssets,
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

    // Only admin and sales can create creative requests manually
    if (!['admin', 'sales', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const tenantDb = getTenantClient({ organizationSlug: orgSlug })

    // Verify order and campaign exist
    const order = await tenantDb.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const campaign = await tenantDb.campaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Create creative request
    const creativeRequest = await tenantDb.creativeRequest.create({
      data: {
        orderId,
        campaignId,
        assignedToId,
        title,
        description,
        requiredAssets: requiredAssets || [],
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status: 'pending',
        createdBy: user.id,
        organizationId: user.organizationId!
      },
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
      action: 'created',
      title: 'Creative Request Created',
      description: `Created creative request for ${campaign.name}`,
      actorId: user.id,
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'creative_request',
      targetId: creativeRequest.id,
      targetName: creativeRequest.title,
      organizationId: user.organizationId!,
      orderId: order.id,
      campaignId: campaign.id,
      metadata: {
        assignedToId,
        priority,
        dueDate,
        requiredAssetsCount: requiredAssets?.length || 0
      }
    })

    return NextResponse.json({
      success: true,
      creativeRequest
    })

  } catch (error: any) {
    console.error('Create creative request error:', error)
    return NextResponse.json(
      { error: 'Failed to create creative request', details: error.message },
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