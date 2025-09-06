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
    const userId = searchParams.get('userId')
    const includeHistorical = searchParams.get('includeHistorical') === 'true'

    const where: any = {
      organizationId: user.organizationId,
      year
    }

    if (userId) {
      where.userId = userId
    }

    if (!includeHistorical) {
      const currentDate = new Date()
      where.effectiveDate = { lte: currentDate }
      where.OR = [
        { endDate: null },
        { endDate: { gte: currentDate } }
      ]
    }

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build where conditions
    const whereConditions = ['ec.year = $1']
    const queryParams: any[] = [year]
    let paramIndex = 2

    if (userId) {
      whereConditions.push(`ec."userId" = $${paramIndex++}`)
      queryParams.push(userId)
    }

    if (!includeHistorical) {
      const currentDate = new Date().toISOString()
      whereConditions.push(`ec."effectiveDate" <= $${paramIndex++}`)
      queryParams.push(currentDate)
      whereConditions.push(`(ec."endDate" IS NULL OR ec."endDate" >= $${paramIndex++})`)
      queryParams.push(currentDate)
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch compensation data with user information
    const compensationQuery = `
      SELECT 
        ec.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'role', u.role
        ) as user
      FROM "EmployeeCompensation" ec
      LEFT JOIN public."User" u ON ec."userId" = u.id
      WHERE ${whereClause}
      ORDER BY u.name ASC, ec."effectiveDate" DESC
    `
    
    const { data: compensations = [], error: compensationError } = await safeQuerySchema(orgSlug, compensationQuery, queryParams)
    if (compensationError) {
      console.error('Error fetching compensation data (table may not exist):', compensationError)
    }

    // Process compensation data and calculate totals
    const processedCompensations = compensations.map(comp => ({
      ...comp,
      user: typeof comp.user === 'string' ? JSON.parse(comp.user) : comp.user
    }))

    // Calculate totals
    const totalCompensation = processedCompensations.reduce((total, comp) => {
      const base = comp.baseSalary || 0
      const bonus = comp.actualBonus || comp.targetBonus || 0
      const commission = comp.actualCommission || 0
      const benefits = comp.benefits || 0
      return total + base + bonus + commission + benefits
    }, 0)

    const breakdown = {
      salaries: processedCompensations.reduce((sum, c) => sum + (c.baseSalary || 0), 0),
      bonuses: processedCompensations.reduce((sum, c) => sum + (c.actualBonus || c.targetBonus || 0), 0),
      commissions: processedCompensations.reduce((sum, c) => sum + (c.actualCommission || 0), 0),
      benefits: processedCompensations.reduce((sum, c) => sum + (c.benefits || 0), 0)
    }

    const byRole = processedCompensations.reduce((acc, comp) => {
      const role = comp.user?.role || 'unknown'
      if (!acc[role]) {
        acc[role] = { count: 0, total: 0, average: 0 }
      }
      const compTotal = (comp.baseSalary || 0) + (comp.actualBonus || comp.targetBonus || 0) + 
                       (comp.actualCommission || 0) + (comp.benefits || 0)
      acc[role].count++
      acc[role].total += compTotal
      acc[role].average = acc[role].total / acc[role].count
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      compensations: processedCompensations,
      summary: {
        totalCompensation,
        breakdown,
        byRole,
        employeeCount: processedCompensations.length,
        averageCompensation: processedCompensations.length > 0 ? totalCompensation / processedCompensations.length : 0
      }
    })
  } catch (error) {
    console.error('Error fetching compensation data:', error)
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
    const {
      userId,
      year,
      baseSalary,
      targetBonus,
      actualBonus,
      commissionRate,
      actualCommission,
      benefits,
      effectiveDate,
      endDate
    } = body

    if (!userId || !year || !effectiveDate) {
      return NextResponse.json({ 
        error: 'User, year, and effective date are required' 
      }, { status: 400 })
    }

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify user exists and belongs to organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: user.organizationId
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for overlapping compensation records
    const overlapQuery = `
      SELECT id FROM "EmployeeCompensation"
      WHERE "userId" = $1
        AND year = $2
        AND "effectiveDate" <= $3
        AND ("endDate" IS NULL OR "endDate" >= $4)
      LIMIT 1
    `
    
    const { data: overlapping = [] } = await safeQuerySchema(orgSlug, overlapQuery, [
      userId, year, new Date(effectiveDate).toISOString(), new Date(effectiveDate).toISOString()
    ])

    if (overlapping.length > 0) {
      return NextResponse.json({ 
        error: 'Overlapping compensation record exists for this period' 
      }, { status: 400 })
    }

    // Generate unique ID for the compensation record
    const compensationId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create compensation record
    const createCompensationQuery = `
      INSERT INTO "EmployeeCompensation" (
        id, "organizationId", "userId", year, "baseSalary", "targetBonus", "actualBonus",
        "commissionRate", "actualCommission", benefits, "effectiveDate", "endDate",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      )
      RETURNING *
    `
    
    const createParams = [
      compensationId,
      user.organizationId,
      userId,
      year,
      baseSalary || null,
      targetBonus || null,
      actualBonus || null,
      commissionRate || null,
      actualCommission || null,
      benefits || null,
      new Date(effectiveDate).toISOString(),
      endDate ? new Date(endDate).toISOString() : null
    ]
    
    const { data: newCompensationResult, error: createError } = await safeQuerySchema(orgSlug, createCompensationQuery, createParams)
    if (createError) {
      console.error('Error creating compensation record:', createError)
      return NextResponse.json({ error: 'Failed to create compensation record' }, { status: 500 })
    }
    
    const compensation = {
      ...newCompensationResult?.[0],
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role
      }
    }

    return NextResponse.json(compensation)
  } catch (error) {
    console.error('Error creating compensation record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
