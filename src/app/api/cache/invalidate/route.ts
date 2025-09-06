import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { invalidateCache, cache } from '@/lib/cache/dashboard-cache'

/**
 * POST /api/cache/invalidate
 * 
 * Invalidate cached data for the dashboard
 * Only accessible by admin and master users
 */
export async function POST(request: NextRequest) {
  try {
    // Session validation
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin and master users to invalidate cache
    if (!['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, orgSlug: requestOrgSlug } = body

    // Get user's organization if not provided
    const orgSlug = requestOrgSlug || await getUserOrgSlug(session.userId)

    // Invalidate based on type
    switch (type) {
      case 'all':
        cache.flush()
        return NextResponse.json({ 
          message: 'All cache cleared',
          stats: cache.stats()
        })

      case 'organization':
        if (!orgSlug) {
          return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
        }
        invalidateCache.organization(orgSlug)
        return NextResponse.json({ 
          message: `Cache cleared for organization: ${orgSlug}`,
          stats: cache.stats()
        })

      case 'orders':
      case 'contracts':
      case 'creatives':
      case 'approvals':
        invalidateCache.summaryType(type, orgSlug)
        return NextResponse.json({ 
          message: `Cache cleared for ${type}${orgSlug ? ` in ${orgSlug}` : ''}`,
          stats: cache.stats()
        })

      case 'user-tasks':
        invalidateCache.userTasks(session.userId)
        return NextResponse.json({ 
          message: `Task cache cleared for user: ${session.userId}`,
          stats: cache.stats()
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid cache type. Valid types: all, organization, orders, contracts, creatives, approvals, user-tasks' 
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error invalidating cache:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cache/invalidate
 * 
 * Get cache statistics
 * Only accessible by admin and master users
 */
export async function GET(request: NextRequest) {
  try {
    // Session validation
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin and master users to view cache stats
    if (!['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stats = cache.stats()
    
    return NextResponse.json({
      stats,
      message: 'Cache statistics retrieved successfully'
    })

  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}