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
    const parentId = searchParams.get('parentId')
    const isActive = searchParams.get('isActive')

    let query = `
      SELECT 
        c.*,
        pc.name as "parentName",
        cb.name as "createdByName",
        ub.name as "updatedByName",
        (
          SELECT COUNT(*) FROM "Category" cc 
          WHERE cc."parentId" = c.id
        ) as "childCount",
        (
          SELECT COUNT(*) FROM "AdvertiserCategory" ac 
          WHERE ac."categoryId" = c.id
        ) as "advertiserCount"
      FROM "Category" c
      LEFT JOIN "Category" pc ON pc.id = c."parentId"
      LEFT JOIN public."User" cb ON cb.id = c."createdBy"
      LEFT JOIN public."User" ub ON ub.id = c."updatedBy"
      WHERE c."organizationId" = $1
    `
    const params: any[] = [session.organizationId]
    let paramCounter = 2

    if (parentId !== null) {
      if (parentId === 'root') {
        query += ` AND c."parentId" IS NULL`
      } else {
        query += ` AND c."parentId" = $${paramCounter}`
        params.push(parentId)
        paramCounter++
      }
    }

    if (isActive !== null) {
      query += ` AND c."isActive" = $${paramCounter}`
      params.push(isActive === 'true')
      paramCounter++
    }

    query += ` ORDER BY c.name ASC`

    const { data, error } = await safeQuerySchema(session.organizationSlug, query, params)
    
    if (error) {
      console.error('Failed to fetch categories:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can create categories
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, parentId, isActive = true } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Category name is required' 
      }, { status: 400 })
    }

    // Check if category with same name exists at same level
    let duplicateQuery = `
      SELECT id FROM "Category"
      WHERE name = $1 AND "organizationId" = $2
    `
    const duplicateParams = [name, session.organizationId]

    if (parentId) {
      duplicateQuery += ` AND "parentId" = $3`
      duplicateParams.push(parentId)
    } else {
      duplicateQuery += ` AND "parentId" IS NULL`
    }

    const { data: existing } = await safeQuerySchema(
      session.organizationSlug,
      duplicateQuery,
      duplicateParams
    )

    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: 'A category with this name already exists at this level' 
      }, { status: 409 })
    }

    // Create the category
    const categoryId = uuidv4()
    const insertQuery = `
      INSERT INTO "Category" (
        id, name, description, "parentId", "isActive",
        "organizationId", "createdAt", "updatedAt", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, NOW(), NOW(), $7, $7
      ) RETURNING *
    `

    const { data: newCategory, error } = await safeQuerySchema(
      session.organizationSlug,
      insertQuery,
      [
        categoryId,
        name,
        description || null,
        parentId || null,
        isActive,
        session.organizationId,
        session.userId
      ]
    )

    if (error) {
      console.error('Failed to create category:', error)
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json(newCategory?.[0] || {}, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}