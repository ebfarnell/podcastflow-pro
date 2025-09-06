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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const categoryId = searchParams.get('categoryId')
    const categoryType = searchParams.get('categoryType')

    const where: any = {
      organizationId: user.organizationId,
      year
    }

    if (month) {
      where.month = month
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (categoryType) {
      where.category = {
        type: categoryType
      }
    }

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build where conditions
    const whereConditions = ['be.year = $1']
    const queryParams: any[] = [year]
    let paramIndex = 2

    if (month) {
      whereConditions.push(`be.month = $${paramIndex++}`)
      queryParams.push(month)
    }

    if (categoryId) {
      whereConditions.push(`be."categoryId" = $${paramIndex++}`)
      queryParams.push(categoryId)
    }

    if (categoryType) {
      whereConditions.push(`bc.type = $${paramIndex++}`)
      queryParams.push(categoryType)
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch budget entries with category and creator information
    const entriesQuery = `
      SELECT 
        be.*,
        json_build_object(
          'id', bc.id,
          'name', bc.name,
          'type', bc.type,
          'isActive', bc."isActive"
        ) as category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as creator
      FROM "BudgetEntry" be
      LEFT JOIN "BudgetCategory" bc ON be."categoryId" = bc.id
      LEFT JOIN public."User" u ON be."createdBy" = u.id
      WHERE ${whereClause}
      ORDER BY be.month ASC, bc.name ASC
    `
    
    const { data: entries = [], error: entriesError } = await safeQuerySchema(orgSlug, entriesQuery, queryParams)
    if (entriesError) {
      console.error('Error fetching budget entries:', entriesError)
    }

    // Process entries and calculate variance
    const entriesWithVariance = entries.map(entry => {
      const category = typeof entry.category === 'string' ? JSON.parse(entry.category) : entry.category
      const creator = typeof entry.creator === 'string' ? JSON.parse(entry.creator) : entry.creator
      
      return {
        ...entry,
        category,
        creator,
        variance: (entry.actualAmount || 0) - (entry.budgetAmount || 0),
        variancePercent: entry.budgetAmount > 0 
          ? (((entry.actualAmount || 0) - entry.budgetAmount) / entry.budgetAmount) * 100 
          : 0
      }
    })

    // Calculate totals by month
    const monthlyTotals: Record<number, any> = {}
    entriesWithVariance.forEach(entry => {
      if (!monthlyTotals[entry.month]) {
        monthlyTotals[entry.month] = {
          month: entry.month,
          budgetTotal: 0,
          actualTotal: 0,
          varianceTotal: 0,
          byType: {
            revenue: { budget: 0, actual: 0 },
            expense: { budget: 0, actual: 0 },
            cogs: { budget: 0, actual: 0 }
          }
        }
      }
      
      monthlyTotals[entry.month].budgetTotal += entry.budgetAmount || 0
      monthlyTotals[entry.month].actualTotal += entry.actualAmount || 0
      monthlyTotals[entry.month].varianceTotal += entry.variance
      
      const type = entry.category?.type || 'expense'
      if (monthlyTotals[entry.month].byType[type]) {
        monthlyTotals[entry.month].byType[type].budget += entry.budgetAmount || 0
        monthlyTotals[entry.month].byType[type].actual += entry.actualAmount || 0
      }
    })

    return NextResponse.json({
      entries: entriesWithVariance,
      monthlyTotals: Object.values(monthlyTotals),
      year,
      month
    })
  } catch (error) {
    console.error('Error fetching budget entries:', error)
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
    const { categoryId, year, month, budgetAmount, notes } = body

    if (!categoryId || !year || !month || budgetAmount === undefined) {
      return NextResponse.json({ 
        error: 'Category, year, month, and budget amount are required' 
      }, { status: 400 })
    }

    // Verify category exists and belongs to organization
    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: user.organizationId
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if entry already exists
    const existingEntry = await prisma.budgetEntry.findUnique({
      where: {
        organizationId_categoryId_year_month: {
          organizationId: user.organizationId,
          categoryId,
          year,
          month
        }
      }
    })

    if (existingEntry) {
      return NextResponse.json({ 
        error: 'Budget entry already exists for this category and period' 
      }, { status: 400 })
    }

    const entry = await prisma.budgetEntry.create({
      data: {
        organizationId: user.organizationId,
        categoryId,
        year,
        month,
        budgetAmount,
        notes,
        createdBy: user.id
      },
      include: {
        category: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error creating budget entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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
    const { entries } = body

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'Entries must be an array' }, { status: 400 })
    }

    // Batch update entries
    const updatePromises = entries.map(entry => 
      prisma.budgetEntry.update({
        where: {
          id: entry.id
        },
        data: {
          budgetAmount: entry.budgetAmount,
          actualAmount: entry.actualAmount,
          notes: entry.notes
        }
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true, updated: entries.length })
  } catch (error) {
    console.error('Error updating budget entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
