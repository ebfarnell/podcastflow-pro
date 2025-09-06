import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/youtube/sync-logs - Get YouTube sync logs for the organization
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization slug - handle both populated and non-populated cases
    let orgSlug = session.organization?.slug
    if (!orgSlug && session.organizationId) {
      // If organization not populated, derive slug from schema name
      // This is a fallback for when the session doesn't have the full org object
      const orgResult = await safeQuerySchema('public', 
        `SELECT slug, "schemaName" FROM "Organization" WHERE id = $1`,
        [session.organizationId]
      )
      if (orgResult.data?.[0]) {
        orgSlug = orgResult.data[0].slug
      }
    }
    
    if (!orgSlug) {
      console.error('Could not determine organization slug for session:', { 
        userId: session.userId,
        organizationId: session.organizationId,
        hasOrg: !!session.organization
      })
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const showId = searchParams.get('showId')

    // Build query
    let query = `
      SELECT 
        id,
        "syncType",
        status,
        "completedAt",
        "totalItems",
        "processedItems",
        "successfulItems",
        "failedItems",
        "quotaUsed",
        "syncConfig",
        results,
        "createdAt"
      FROM "YouTubeSyncLog"
      WHERE "organizationId" = $1
    `
    
    const params: any[] = [session.organizationId]
    
    // Filter by show if provided
    if (showId) {
      query += ` AND "syncConfig"::text LIKE $${params.length + 1}`
      params.push(`%"showId":"${showId}"%`)
    }
    
    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    // Execute query
    const { data: logs, error } = await safeQuerySchema(orgSlug, query, params)
    
    if (error) {
      console.error('Error fetching sync logs:', error)
      return NextResponse.json({ logs: [] })
    }

    // Also get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        SUM("processedItems") as total_items_processed,
        SUM("quotaUsed") as total_quota_used,
        MAX("createdAt") as last_sync_at
      FROM "YouTubeSyncLog"
      WHERE "organizationId" = $1
    `
    
    const { data: stats } = await safeQuerySchema(orgSlug, statsQuery, [session.organizationId])

    return NextResponse.json({
      logs: logs || [],
      stats: stats?.[0] || {
        total_syncs: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        total_items_processed: 0,
        total_quota_used: 0,
        last_sync_at: null
      },
      pagination: {
        limit,
        offset,
        total: parseInt(stats?.[0]?.total_syncs || '0')
      }
    })

  } catch (error) {
    console.error('Error fetching YouTube sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    )
  }
}

// DELETE /api/youtube/sync-logs - Clear old sync logs
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication - only admin/master can clear logs
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization slug - handle both populated and non-populated cases
    let orgSlug = session.organization?.slug
    if (!orgSlug && session.organizationId) {
      // If organization not populated, derive slug from schema name
      const orgResult = await safeQuerySchema('public', 
        `SELECT slug, "schemaName" FROM "Organization" WHERE id = $1`,
        [session.organizationId]
      )
      if (orgResult.data?.[0]) {
        orgSlug = orgResult.data[0].slug
      }
    }
    
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Delete logs older than 30 days
    const deleteQuery = `
      DELETE FROM "YouTubeSyncLog"
      WHERE "organizationId" = $1 
        AND "createdAt" < NOW() - INTERVAL '30 days'
    `
    
    const { error } = await safeQuerySchema(
      orgSlug,
      deleteQuery,
      [session.organizationId]
    )
    
    if (error) {
      console.error('Error clearing sync logs:', error)
      return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Old sync logs cleared successfully',
      success: true 
    })

  } catch (error) {
    console.error('Error clearing YouTube sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to clear sync logs' },
      { status: 500 }
    )
  }
}