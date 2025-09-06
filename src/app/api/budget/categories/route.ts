import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // expense, revenue, cogs
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build where conditions
    const whereConditions = ['1=1']
    const queryParams: any[] = []
    let paramIndex = 1

    if (type) {
      whereConditions.push(`bc.type = $${paramIndex++}`)
      queryParams.push(type)
    }
    if (!includeInactive) {
      whereConditions.push(`bc."isActive" = $${paramIndex++}`)
      queryParams.push(true)
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch categories with budget entries
    const categoriesQuery = `
      SELECT 
        bc.*,
        json_agg(
          json_build_object(
            'id', be.id,
            'year', be.year,
            'month', be.month,
            'budgetAmount', be."budgetAmount",
            'actualAmount', be."actualAmount"
          ) ORDER BY be.year DESC, be.month DESC
        ) FILTER (WHERE be.id IS NOT NULL) as "budgetEntries"
      FROM "BudgetCategory" bc
      LEFT JOIN "BudgetEntry" be ON be."categoryId" = bc.id
      WHERE ${whereClause}
      GROUP BY bc.id
      ORDER BY bc.type, bc.name
    `
    
    const { data: categories = [], error: categoriesError } = await safeQuerySchema(orgSlug, categoriesQuery, queryParams)
    if (categoriesError) {
      console.error('Error fetching budget categories:', categoriesError)
    }

    // Process categories (budget entries are already JSON aggregated)
    const processedCategories = categories.map(cat => ({
      ...cat,
      budgetEntries: cat.budgetEntries || [],
      totalBudget: calculateCurrentMonthBudget(cat),
      totalActual: calculateCurrentMonthActual(cat)
    }))

    // Build hierarchy
    const rootCategories = processedCategories.filter(cat => !cat.parentCategoryId)
    const categoryHierarchy = rootCategories

    return NextResponse.json({
      categories: categoryHierarchy,
      summary: {
        revenue: processedCategories
          .filter(c => c.type === 'revenue')
          .reduce((sum, c) => sum + c.totalBudget, 0),
        expenses: processedCategories
          .filter(c => c.type === 'expense')
          .reduce((sum, c) => sum + c.totalBudget, 0),
        cogs: processedCategories
          .filter(c => c.type === 'cogs')
          .reduce((sum, c) => sum + c.totalBudget, 0)
      }
    })
  } catch (error) {
    console.error('Error fetching budget categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, parentCategoryId } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    if (!['expense', 'revenue', 'cogs'].includes(type)) {
      return NextResponse.json({ error: 'Invalid category type' }, { status: 400 })
    }

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Generate unique ID for the category
    const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create category
    const createCategoryQuery = `
      INSERT INTO "BudgetCategory" (
        id, name, type, "parentCategoryId", "organizationId", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW(), NOW()
      )
      RETURNING *
    `
    
    const createParams = [
      categoryId,
      name,
      type,
      parentCategoryId || null,
      user.organizationId,
      true
    ]
    
    const { data: newCategoryResult, error: createError } = await safeQuerySchema(orgSlug, createCategoryQuery, createParams)
    if (createError) {
      console.error('Error creating budget category:', createError)
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }
    
    const category = newCategoryResult?.[0]

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function calculateCurrentMonthActual(category: any): number {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  
  if (!category.budgetEntries || !Array.isArray(category.budgetEntries)) {
    return 0
  }
  
  return category.budgetEntries
    .filter((e: any) => e.year === currentYear && e.month === currentMonth)
    .reduce((sum: number, e: any) => sum + (e.actualAmount || 0), 0)
}

function calculateCurrentMonthBudget(category: any): number {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  
  return category.budgetEntries
    .filter((e: any) => e.year === currentYear && e.month === currentMonth)
    .reduce((sum: number, e: any) => sum + e.budgetAmount, 0)
}
