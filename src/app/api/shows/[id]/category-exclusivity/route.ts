import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const level = url.searchParams.get('level')
    const activeOnly = url.searchParams.get('activeOnly') === 'true'
    const dateRange = url.searchParams.get('dateRange') // 'current', 'future', 'all'

    let whereClause = '"showId" = $1 AND "organizationId" = $2'
    const queryParams = [params.id, session.organizationId]
    let paramIndex = 3

    if (category) {
      whereClause += ` AND category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    if (level) {
      whereClause += ` AND level = $${paramIndex}`
      queryParams.push(level)
      paramIndex++
    }

    if (activeOnly) {
      whereClause += ` AND "isActive" = true`
    }

    // Date range filtering
    if (dateRange === 'current') {
      whereClause += ` AND "startDate" <= CURRENT_DATE AND "endDate" >= CURRENT_DATE`
    } else if (dateRange === 'future') {
      whereClause += ` AND "startDate" > CURRENT_DATE`
    }

    const { data: exclusivities, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT ce.*, 
              s.name as showName,
              a.name as advertiserName,
              c.name as campaignName,
              u.firstName || ' ' || u.lastName as createdByName
       FROM "CategoryExclusivity" ce
       LEFT JOIN "Show" s ON ce."showId" = s.id
       LEFT JOIN "Advertiser" a ON ce."advertiserId" = a.id
       LEFT JOIN "Campaign" c ON ce."campaignId" = c.id
       LEFT JOIN "User" u ON ce."createdBy" = u.id
       WHERE ${whereClause}
       ORDER BY ce."startDate" DESC, ce.category`,
      queryParams
    )

    if (error) {
      console.error('❌ Category exclusivity query failed:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(exclusivities || [])
  } catch (error) {
    console.error('❌ Category exclusivity API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      category, 
      level, 
      advertiserId, 
      campaignId, 
      startDate, 
      endDate, 
      notes 
    } = body

    if (!category || !level || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Category, level, start date, and end date are required' 
      }, { status: 400 })
    }

    // Validate level
    const validLevels = ['episode', 'show', 'network']
    if (!validLevels.includes(level)) {
      return NextResponse.json({ 
        error: 'Invalid level. Must be episode, show, or network' 
      }, { status: 400 })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (end <= start) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 })
    }

    // Check if show exists
    const { data: show } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id, name FROM "Show" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (!show?.[0]) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Validate advertiser and campaign if provided
    if (advertiserId) {
      const { data: advertiser } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT id FROM "Advertiser" WHERE id = $1 AND "organizationId" = $2`,
        [advertiserId, session.organizationId]
      )

      if (!advertiser?.[0]) {
        return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
      }
    }

    if (campaignId) {
      const { data: campaign } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT id FROM "Campaign" WHERE id = $1 AND "organizationId" = $2`,
        [campaignId, session.organizationId]
      )

      if (!campaign?.[0]) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
    }

    // Check for overlapping exclusivities
    const { data: overlapping } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id FROM "CategoryExclusivity" 
       WHERE "showId" = $1 
         AND category = $2 
         AND level = $3
         AND "startDate" <= $4 
         AND "endDate" >= $5
         AND "isActive" = true
         AND "organizationId" = $6`,
      [params.id, category, level, endDate, startDate, session.organizationId]
    )

    if (overlapping?.length > 0) {
      return NextResponse.json({ 
        error: 'Category exclusivity period overlaps with existing exclusivity for this category and level' 
      }, { status: 400 })
    }

    // Create exclusivity entry
    const { data: exclusivity, error: insertError } = await safeQuerySchema(
      session.organizationSlug,
      `INSERT INTO "CategoryExclusivity" (
        "showId", category, level, "advertiserId", "campaignId", 
        "startDate", "endDate", notes, "createdBy", "organizationId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        params.id,
        category,
        level,
        advertiserId || null,
        campaignId || null,
        startDate,
        endDate,
        notes || '',
        session.userId,
        session.organizationId
      ]
    )

    if (insertError || !exclusivity?.[0]) {
      console.error('❌ Category exclusivity creation failed:', insertError)
      return NextResponse.json({ error: 'Failed to create exclusivity entry' }, { status: 500 })
    }

    // Send notification to relevant users
    const { data: relevantUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" 
       WHERE "organizationId" = $1 
         AND role IN ('admin', 'master', 'sales') 
         AND id != $2 
         AND "isActive" = true`,
      [session.organizationId, session.userId]
    )

    if (relevantUsers?.length > 0) {
      await notificationService.sendBulkNotification({
        title: `Category Exclusivity Set: ${show[0].name}`,
        message: `${category} exclusivity (${level} level) set from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
        type: 'system_update',
        userIds: relevantUsers.map((u: any) => u.id),
        actionUrl: `/shows/${params.id}?tab=exclusivity`,
        sendEmail: false,
        emailData: {
          showName: show[0].name,
          category,
          level,
          startDate: new Date(startDate).toLocaleDateString(),
          endDate: new Date(endDate).toLocaleDateString(),
          setBy: session.firstName && session.lastName ? 
            `${session.firstName} ${session.lastName}` : 'Sales Team',
          showLink: `${process.env.NEXT_PUBLIC_APP_URL}/shows/${params.id}`
        }
      })
    }

    return NextResponse.json(exclusivity[0])
  } catch (error) {
    console.error('❌ Category exclusivity creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Batch operations for multiple exclusivities
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Only administrators can perform batch operations' }, { status: 403 })
    }

    const body = await request.json()
    const { action, exclusivityIds, newStatus } = body

    if (!action || !exclusivityIds || !Array.isArray(exclusivityIds)) {
      return NextResponse.json({ 
        error: 'Action and exclusivity IDs array are required' 
      }, { status: 400 })
    }

    let results = []

    if (action === 'toggle_status') {
      // Toggle active status for multiple exclusivities
      const { data: updated, error } = await safeQuerySchema(
        session.organizationSlug,
        `UPDATE "CategoryExclusivity" 
         SET "isActive" = COALESCE($1, NOT "isActive"), "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = ANY($2) AND "showId" = $3 AND "organizationId" = $4
         RETURNING *`,
        [newStatus, exclusivityIds, params.id, session.organizationId]
      )

      if (error) {
        return NextResponse.json({ error: 'Failed to update exclusivities' }, { status: 500 })
      }

      results = updated || []

      // Send notification about batch update
      const { data: show } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT name FROM "Show" WHERE id = $1`,
        [params.id]
      )

      const { data: relevantUsers } = await safeQuerySchema(
        'public',
        `SELECT id FROM "User" 
         WHERE "organizationId" = $1 
           AND role IN ('admin', 'master', 'sales') 
           AND id != $2`,
        [session.organizationId, session.userId]
      )

      if (relevantUsers?.length > 0 && show?.[0]) {
        await notificationService.sendBulkNotification({
          title: `Exclusivity Rules Updated: ${show[0].name}`,
          message: `${exclusivityIds.length} category exclusivity rules have been ${newStatus === true ? 'activated' : newStatus === false ? 'deactivated' : 'toggled'}`,
          type: 'system_update',
          userIds: relevantUsers.map((u: any) => u.id),
          actionUrl: `/shows/${params.id}?tab=exclusivity`,
          sendEmail: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      action,
      affected: results.length,
      results
    })

  } catch (error) {
    console.error('❌ Category exclusivity batch operation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}