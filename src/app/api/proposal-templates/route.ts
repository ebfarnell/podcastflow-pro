import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
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

    // Get templates with their items and filters
    const templatesQuery = `
      SELECT 
        t.*,
        u.name as "createdByName",
        COUNT(DISTINCT ti.id) as "itemCount",
        COUNT(DISTINCT tf.id) as "filterCount",
        json_agg(DISTINCT 
          json_build_object(
            'id', ti.id,
            'placementType', ti."placementType",
            'slotCount', ti."slotCount",
            'budgetPercentage', ti."budgetPercentage",
            'weeklyDistribution', ti."weeklyDistribution",
            'priority', ti.priority
          )
        ) FILTER (WHERE ti.id IS NOT NULL) as items,
        json_agg(DISTINCT 
          json_build_object(
            'id', tf.id,
            'filterType', tf."filterType",
            'filterValue', tf."filterValue"
          )
        ) FILTER (WHERE tf.id IS NOT NULL) as filters
      FROM "ProposalTemplate" t
      LEFT JOIN public."User" u ON u.id = t."createdBy"
      LEFT JOIN "ProposalTemplateItem" ti ON ti."templateId" = t.id
      LEFT JOIN "ProposalTemplateFilter" tf ON tf."templateId" = t.id
      WHERE t."isActive" = true
      GROUP BY t.id, u.name
      ORDER BY t."createdAt" DESC
    `

    const templates = await querySchema(orgSlug, templatesQuery, [])

    return NextResponse.json({ templates })

  } catch (error: any) {
    console.error('Get proposal templates error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposal templates', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { name, description, items, filters } = body

    // Create template
    const templateId = 'tmpl_' + Math.random().toString(36).substr(2, 16)
    
    const createTemplateQuery = `
      INSERT INTO "ProposalTemplate" (
        id,
        name,
        description,
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `
    
    const templateResult = await querySchema(
      orgSlug,
      createTemplateQuery,
      [templateId, name, description, user.id]
    )

    if (templateResult.length === 0) {
      throw new Error('Failed to create template')
    }

    // Add template items
    if (items && items.length > 0) {
      for (const item of items) {
        const itemId = 'tmpl_item_' + Math.random().toString(36).substr(2, 16)
        const createItemQuery = `
          INSERT INTO "ProposalTemplateItem" (
            id,
            "templateId",
            "showId",
            "placementType",
            "slotCount",
            "weeklyDistribution",
            "budgetPercentage",
            priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `
        
        await querySchema(
          orgSlug,
          createItemQuery,
          [
            itemId,
            templateId,
            item.showId || null,
            item.placementType,
            item.slotCount || 1,
            item.weeklyDistribution ? JSON.stringify(item.weeklyDistribution) : null,
            item.budgetPercentage || null,
            item.priority || 0
          ]
        )
      }
    }

    // Add template filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        const filterId = 'tmpl_filter_' + Math.random().toString(36).substr(2, 16)
        const createFilterQuery = `
          INSERT INTO "ProposalTemplateFilter" (
            id,
            "templateId",
            "filterType",
            "filterValue"
          ) VALUES ($1, $2, $3, $4)
        `
        
        await querySchema(
          orgSlug,
          createFilterQuery,
          [filterId, templateId, filter.filterType, JSON.stringify(filter.filterValue)]
        )
      }
    }

    return NextResponse.json({ 
      success: true, 
      template: templateResult[0],
      templateId 
    })

  } catch (error: any) {
    console.error('Create proposal template error:', error)
    return NextResponse.json(
      { error: 'Failed to create proposal template', details: error.message },
      { status: 500 }
    )
  }
}