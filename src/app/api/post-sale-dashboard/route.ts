import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { checkApiPermissions } from '@/lib/auth/permission-helpers'
import { cache, cacheKeys, withCache } from '@/lib/cache/dashboard-cache'

/**
 * GET /api/post-sale-dashboard
 * 
 * Aggregated endpoint for Post-Sale Dashboard data
 * Returns summary statistics and recent activity
 * 
 * Performance considerations:
 * - Uses parallel queries where possible
 * - Implements caching for heavy aggregations
 * - Limits result sets to prevent timeouts
 */
export async function GET(request: NextRequest) {
  try {
    // Session validation
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Feature flag check - only master and admin for now
    if (!['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Feature not available for your role' }, { status: 403 })
    }

    // Get organization slug from database
    const orgSlug = await getUserOrgSlug(session.userId)
    
    if (!orgSlug) {
      console.error('No organization found for user:', session.userId, 'role:', session.role)
      // For master users without organization, return empty data
      if (session.role === 'master') {
        console.log('Master user without organization, returning empty dashboard data')
        return NextResponse.json({
          summary: {
            orders: { pending: 0, approved: 0, revenue: 0 },
            contracts: { draft: 0, awaiting_signature: 0, executed: 0 },
            creatives: { pending_approval: 0, in_production: 0, approved: 0 },
            tasks: { overdue: 0, today: 0, upcoming: 0 }
          },
          pendingActions: {
            orders: 0,
            contracts: 0,
            creatives: 0,
            approvals: 0,
            adRequests: 0,
            billing: 0
          },
          recentActivity: [],
          lastUpdated: new Date().toISOString()
        })
      }
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const dateTo = searchParams.get('dateTo') || new Date().toISOString()

    // Check if we have cached dashboard data
    const dashboardCacheKey = cacheKeys.dashboard(orgSlug, dateFrom, dateTo)
    const cachedDashboard = cache.get(dashboardCacheKey)
    
    if (cachedDashboard) {
      console.log(`Cache hit for dashboard: ${orgSlug}`)
      return NextResponse.json(cachedDashboard)
    }

    // Execute parallel queries for better performance with caching
    const [
      ordersData,
      contractsData,
      creativesData,
      approvalsData,
      tasksData,
      recentActivityData
    ] = await Promise.all([
      // Orders summary with cache
      withCache(
        cacheKeys.ordersSummary(orgSlug, dateFrom, dateTo),
        () => getOrdersSummary(orgSlug, dateFrom, dateTo),
        60
      ),
      // Contracts summary with cache
      withCache(
        cacheKeys.contractsSummary(orgSlug),
        () => getContractsSummary(orgSlug),
        120 // Longer TTL for less frequently changing data
      ),
      // Creatives summary with cache
      withCache(
        cacheKeys.creativesSummary(orgSlug),
        () => getCreativesSummary(orgSlug),
        120
      ),
      // Approvals summary with cache
      withCache(
        cacheKeys.approvalsSummary(orgSlug),
        () => getApprovalsSummary(orgSlug),
        60
      ),
      // Tasks summary - no cache as it's user-specific and changes frequently
      getTasksSummary(orgSlug, session.userId),
      // Recent activity with cache
      withCache(
        cacheKeys.recentActivity(orgSlug, 10),
        () => getRecentActivity(orgSlug, 10),
        30 // Short TTL for activity feed
      )
    ])

    // Calculate pending actions for badge counts
    const pendingActions = {
      orders: ordersData.pending || 0,
      contracts: contractsData.awaiting_signature || 0,
      creatives: creativesData.pending_approval || 0,
      approvals: approvalsData.pending_review || 0,
      adRequests: 0, // Will be implemented in Phase 3
      billing: 0 // Will be implemented in Phase 4
    }

    const dashboardData = {
      summary: {
        orders: ordersData,
        contracts: contractsData,
        creatives: creativesData,
        tasks: tasksData
      },
      pendingActions,
      recentActivity: recentActivityData,
      lastUpdated: new Date().toISOString()
    }

    // Cache the complete dashboard response
    cache.set(dashboardCacheKey, dashboardData, 60)

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Error fetching post-sale dashboard data:', error)
    // Return empty data structure instead of 500 error for defensive handling
    return NextResponse.json({
      summary: {
        orders: { pending: 0, approved: 0, revenue: 0 },
        contracts: { draft: 0, awaiting_signature: 0, executed: 0 },
        creatives: { pending_approval: 0, in_production: 0, approved: 0 },
        tasks: { overdue: 0, today: 0, upcoming: 0 }
      },
      pendingActions: {
        orders: 0,
        contracts: 0,
        creatives: 0,
        approvals: 0,
        adRequests: 0,
        billing: 0
      },
      recentActivity: [],
      lastUpdated: new Date().toISOString()
    })
  }
}

// Helper functions for data aggregation
async function getOrdersSummary(orgSlug: string, dateFrom: string, dateTo: string) {
  try {
    // Use safeQuerySchema for defensive queries with proper error handling
    const { data, error } = await safeQuerySchema(orgSlug, `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CASE WHEN status IN ('approved', 'booked', 'confirmed') THEN "netAmount" ELSE 0 END) as revenue
      FROM "Order"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
      GROUP BY status
    `, [new Date(dateFrom), new Date(dateTo)])

    if (error) {
      console.error('Error fetching orders summary:', error)
      return { pending: 0, approved: 0, revenue: 0 }
    }

    const orderData = Array.isArray(data) ? data : []
    const counts = orderData.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count) || 0
      return acc
    }, {} as Record<string, number>)

    const totalRevenue = orderData.reduce((sum, item) => sum + (parseFloat(item.revenue) || 0), 0)

    return {
      pending: counts.pending_approval || counts.pending || 0,
      approved: counts.approved || 0,
      booked: counts.booked || 0,
      confirmed: counts.confirmed || 0,
      revenue: totalRevenue
    }
  } catch (error) {
    console.error('Error in getOrdersSummary:', error)
    return { pending: 0, approved: 0, revenue: 0 }
  }
}

async function getContractsSummary(orgSlug: string) {
  const { data, error } = await safeQuerySchema(orgSlug, async (prisma) => {
    const statusCounts = await prisma.contract.groupBy({
      by: ['status'],
      _count: true
    })

    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count
      return acc
    }, {} as Record<string, number>)

    // Count contracts with pending signatures
    const awaitingSignature = await prisma.contract.count({
      where: {
        status: 'sent',
        signatures: {
          some: {
            status: 'pending'
          }
        }
      }
    })

    return {
      draft: counts.draft || 0,
      sent: counts.sent || 0,
      awaiting_signature: awaitingSignature,
      signed: counts.signed || 0,
      executed: counts.executed || 0
    }
  })

  if (error) {
    console.error('Error fetching contracts summary:', error)
    return { draft: 0, awaiting_signature: 0, executed: 0 }
  }

  return data
}

async function getCreativesSummary(orgSlug: string) {
  const { data, error } = await safeQuerySchema(orgSlug, async (prisma) => {
    const statusCounts = await prisma.adCreative.groupBy({
      by: ['status'],
      _count: true,
      where: {
        status: {
          in: ['active', 'inactive', 'pending_approval']
        }
      }
    })

    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count
      return acc
    }, {} as Record<string, number>)

    // For now, map to simplified statuses
    return {
      pending_approval: counts.pending_approval || 0,
      in_production: counts.inactive || 0, // Assuming inactive means in production
      approved: counts.active || 0
    }
  })

  if (error) {
    console.error('Error fetching creatives summary:', error)
    return { pending_approval: 0, in_production: 0, approved: 0 }
  }

  return data
}

async function getApprovalsSummary(orgSlug: string) {
  const { data, error } = await safeQuerySchema(orgSlug, async (prisma) => {
    const statusCounts = await prisma.adApproval.groupBy({
      by: ['status'],
      _count: true
    })

    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count
      return acc
    }, {} as Record<string, number>)

    return {
      pending_review: (counts.pending || 0) + (counts.submitted || 0),
      in_revision: counts.revision || 0,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0
    }
  })

  if (error) {
    console.error('Error fetching approvals summary:', error)
    return { pending_review: 0, in_revision: 0, approved: 0, rejected: 0 }
  }

  return data
}

async function getTasksSummary(orgSlug: string, userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data, error } = await safeQuerySchema(orgSlug, async (prisma) => {
    // Get both user-specific tasks and general pending approvals that need action
    const [overdue, todayTasks, upcoming, pendingApprovals] = await Promise.all([
      // Overdue tasks assigned to user
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: { not: 'completed' },
          dueDate: { lt: today }
        }
      }),
      // Today's tasks assigned to user
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: { not: 'completed' },
          dueDate: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      // Upcoming tasks (next 7 days) assigned to user
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: { not: 'completed' },
          dueDate: {
            gte: tomorrow,
            lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Count pending orders that need approval (general pending tasks)
      prisma.order.count({
        where: {
          status: { in: ['pending', 'pending_approval'] }
        }
      }).catch(() => 0) // Defensive - table might not exist in all orgs
    ])

    return { 
      overdue, 
      today: todayTasks, 
      upcoming,
      // Include pending approvals in today's count for dashboard visibility
      todayWithApprovals: todayTasks + pendingApprovals
    }
  })

  if (error) {
    console.error('Error fetching tasks summary:', error)
    return { overdue: 0, today: 0, upcoming: 0, todayWithApprovals: 0 }
  }

  return data
}

async function getRecentActivity(orgSlug: string, limit: number = 10) {
  const { data, error } = await safeQuerySchema(orgSlug, async (prisma) => {
    // Get recent activities across different entities
    const activities = await prisma.activity.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return activities.map(activity => ({
      id: activity.id,
      type: activity.entityType,
      action: activity.action,
      description: activity.description,
      actor: activity.actor.name,
      timestamp: activity.createdAt,
      metadata: activity.metadata
    }))
  })

  if (error) {
    console.error('Error fetching recent activity:', error)
    return []
  }

  return data
}