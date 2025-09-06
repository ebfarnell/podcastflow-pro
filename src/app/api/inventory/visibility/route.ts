import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { hasPermission } from '@/types/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/inventory/visibility - Get inventory visibility based on user role
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const showId = searchParams.get('showId')
    
    // Check if user has permission to view inventory
    if (!hasPermission(session.role, 'orders:inventory')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Base query for inventory visibility
    let query = `
      SELECT DISTINCT
        s.id as show_id,
        s.name as show_name,
        s.category,
        s."isActive",
        COUNT(DISTINCT e.id) as episode_count,
        COUNT(DISTINCT ei.id) as inventory_count
      FROM "Show" s
      LEFT JOIN "Episode" e ON e."showId" = s.id AND e.status = 'scheduled' AND e."airDate" > CURRENT_DATE
      LEFT JOIN "EpisodeInventory" ei ON ei."episodeId" = e.id
    `

    const params: any[] = []
    const conditions: string[] = ['s."isActive" = true']

    // Role-based filtering
    if (session.role === 'producer' || session.role === 'talent') {
      // Producers and talent can only see shows they're assigned to
      conditions.push(`
        EXISTS (
          SELECT 1 FROM "_ShowToUser" su 
          WHERE su."A" = s.id AND su."B" = $${params.length + 1}
        )
      `)
      params.push(session.userId)
    } else if (session.role === 'sales') {
      // Sales can see all shows unless restricted
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM "InventoryVisibility" iv
          WHERE iv."showId" = s.id 
          AND iv.role = 'sales'
          AND iv."accessType" = 'blocked'
        )
      `)
    }
    // Admin and master can see all shows

    // Add specific show filter if provided
    if (showId) {
      conditions.push(`s.id = $${params.length + 1}`)
      params.push(showId)
    }

    // Check for custom visibility grants
    conditions.push(`
      OR EXISTS (
        SELECT 1 FROM "InventoryVisibility" iv
        WHERE iv."showId" = s.id
        AND (
          (iv."userId" = $${params.length + 1} AND (iv."expiresAt" IS NULL OR iv."expiresAt" > CURRENT_TIMESTAMP))
          OR (iv.role = $${params.length + 2} AND (iv."expiresAt" IS NULL OR iv."expiresAt" > CURRENT_TIMESTAMP))
        )
      )
    `)
    params.push(session.userId, session.role)

    if (conditions.length > 0) {
      query += ` WHERE (${conditions.join(' AND ')})`
    }

    query += ` GROUP BY s.id, s.name, s.category, s."isActive" ORDER BY s.name`

    const { data: shows, error } = await safeQuerySchema(
      session.organizationSlug,
      query,
      params
    )

    if (error) {
      console.error('Failed to fetch inventory visibility:', error)
      return NextResponse.json({ shows: [] })
    }

    // For each show, get detailed episode inventory if requested
    const detailedView = searchParams.get('detailed') === 'true'
    
    if (detailedView && shows.length > 0) {
      const showsWithInventory = []
      
      for (const show of shows) {
        const { data: episodes } = await safeQuerySchema(
          session.organizationSlug,
          `
            SELECT 
              e.id,
              e.title,
              e."episodeNumber",
              e."airDate",
              e.length,
              ei."preRollSlots",
              ei."preRollAvailable",
              ei."midRollSlots",
              ei."midRollAvailable",
              ei."postRollSlots",
              ei."postRollAvailable",
              (ei."preRollSlots" - ei."preRollAvailable") as "preRollSold",
              (ei."midRollSlots" - ei."midRollAvailable") as "midRollSold",
              (ei."postRollSlots" - ei."postRollAvailable") as "postRollSold"
            FROM "Episode" e
            LEFT JOIN "EpisodeInventory" ei ON ei."episodeId" = e.id
            WHERE e."showId" = $1
              AND e.status = 'scheduled'
              AND e."airDate" > CURRENT_DATE
            ORDER BY e."airDate"
          `,
          [show.show_id]
        )
        
        showsWithInventory.push({
          ...show,
          episodes: episodes || []
        })
      }
      
      return NextResponse.json({ shows: showsWithInventory })
    }

    return NextResponse.json({ shows })
  } catch (error) {
    console.error('Inventory visibility error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory visibility' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/visibility - Grant or revoke inventory visibility
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can manage visibility
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { showId, userId, role, accessType, expiresAt, notes } = body

    if (!showId || (!userId && !role) || !accessType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create or update visibility record
    const { error } = await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryVisibility" (
          id, "showId", "userId", role, "accessType", 
          "grantedBy", "grantedAt", "expiresAt", notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8
        )
        ON CONFLICT ("showId", "userId", "role") 
        DO UPDATE SET
          "accessType" = EXCLUDED."accessType",
          "grantedBy" = EXCLUDED."grantedBy",
          "grantedAt" = CURRENT_TIMESTAMP,
          "expiresAt" = EXCLUDED."expiresAt",
          notes = EXCLUDED.notes
      `,
      [
        'iv_' + Math.random().toString(36).substr(2, 16),
        showId,
        userId || null,
        role || null,
        accessType,
        session.userId,
        expiresAt || null,
        notes || null
      ]
    )

    if (error) {
      console.error('Failed to update inventory visibility:', error)
      return NextResponse.json(
        { error: 'Failed to update visibility' },
        { status: 500 }
      )
    }

    // Log the change
    await safeQuerySchema(
      session.organizationSlug,
      `
        INSERT INTO "InventoryChangeLog" (
          id, "episodeId", "changeType", "newValue", "changedBy"
        ) VALUES (
          $1, $2, 'visibility_updated', $3::jsonb, $4
        )
      `,
      [
        'icl_' + Math.random().toString(36).substr(2, 16),
        showId, // Using showId as episodeId for show-level changes
        JSON.stringify({ userId, role, accessType, expiresAt }),
        session.userId
      ]
    )

    return NextResponse.json({ 
      success: true,
      message: 'Inventory visibility updated successfully' 
    })
  } catch (error) {
    console.error('Inventory visibility update error:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory visibility' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/visibility - Remove visibility grant
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can manage visibility
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const visibilityId = searchParams.get('id')

    if (!visibilityId) {
      return NextResponse.json(
        { error: 'Visibility ID required' },
        { status: 400 }
      )
    }

    const { error } = await safeQuerySchema(
      session.organizationSlug,
      `DELETE FROM "InventoryVisibility" WHERE id = $1`,
      [visibilityId]
    )

    if (error) {
      console.error('Failed to delete inventory visibility:', error)
      return NextResponse.json(
        { error: 'Failed to delete visibility' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Inventory visibility removed successfully' 
    })
  } catch (error) {
    console.error('Inventory visibility delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete inventory visibility' },
      { status: 500 }
    )
  }
}