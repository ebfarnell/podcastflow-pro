import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const conflictMode = searchParams.get('conflictMode')

    let query = `
      SELECT 
        cg.*,
        cb.name as "createdByName",
        ub.name as "updatedByName",
        (
          SELECT COUNT(DISTINCT ac."advertiserId") 
          FROM "AdvertiserCategory" ac 
          WHERE ac."competitiveGroupId" = cg.id
        ) as "advertiserCount",
        (
          SELECT json_agg(DISTINCT a.name)
          FROM "AdvertiserCategory" ac
          JOIN "Advertiser" a ON a.id = ac."advertiserId"
          WHERE ac."competitiveGroupId" = cg.id
          LIMIT 5
        ) as "sampleAdvertisers"
      FROM "CompetitiveGroup" cg
      LEFT JOIN public."User" cb ON cb.id = cg."createdBy"
      LEFT JOIN public."User" ub ON ub.id = cg."updatedBy"
      WHERE cg."organizationId" = $1
    `
    const params: any[] = [session.organizationId]
    let paramCounter = 2

    if (isActive !== null) {
      query += ` AND cg."isActive" = $${paramCounter}`
      params.push(isActive === 'true')
      paramCounter++
    }

    if (conflictMode) {
      query += ` AND cg."conflictMode" = $${paramCounter}`
      params.push(conflictMode)
      paramCounter++
    }

    query += ` ORDER BY cg.name ASC`

    const { data, error } = await safeQuerySchema(session.organizationSlug, query, params)
    
    if (error) {
      console.error('Failed to fetch competitive groups:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching competitive groups:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can create competitive groups
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      conflictMode = 'warn',
      isActive = true,
      advertiserIds = []
    } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Group name is required' 
      }, { status: 400 })
    }

    if (!['warn', 'block'].includes(conflictMode)) {
      return NextResponse.json({ 
        error: 'Invalid conflict mode. Must be warn or block' 
      }, { status: 400 })
    }

    // Check if group with same name exists
    const { data: existing } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id FROM "CompetitiveGroup" WHERE name = $1 AND "organizationId" = $2`,
      [name, session.organizationId]
    )

    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: 'A competitive group with this name already exists' 
      }, { status: 409 })
    }

    // Create the competitive group
    const groupId = uuidv4()
    const insertQuery = `
      INSERT INTO "CompetitiveGroup" (
        id, name, description, "conflictMode", "isActive",
        "organizationId", "createdAt", "updatedAt", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, NOW(), NOW(), $7, $7
      ) RETURNING *
    `

    const { data: newGroup, error } = await safeQuerySchema(
      session.organizationSlug,
      insertQuery,
      [
        groupId,
        name,
        description || null,
        conflictMode,
        isActive,
        session.organizationId,
        session.userId
      ]
    )

    if (error) {
      console.error('Failed to create competitive group:', error)
      return NextResponse.json({ error: 'Failed to create competitive group' }, { status: 500 })
    }

    // If advertiserIds provided, update their category associations
    if (advertiserIds.length > 0) {
      const updateQuery = `
        UPDATE "AdvertiserCategory"
        SET "competitiveGroupId" = $1
        WHERE "advertiserId" = ANY($2)
          AND "organizationId" = $3
      `
      
      await safeQuerySchema(
        session.organizationSlug,
        updateQuery,
        [groupId, advertiserIds, session.organizationId]
      )
    }

    return NextResponse.json(newGroup?.[0] || {}, { status: 201 })
  } catch (error) {
    console.error('Error creating competitive group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}