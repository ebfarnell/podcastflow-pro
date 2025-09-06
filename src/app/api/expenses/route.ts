import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'oneTime' | 'recurring' | null
    const status = searchParams.get('status') as 'pending' | 'paid' | 'overdue' | 'cancelled' | null
    const category = searchParams.get('category')
    const dateRange = searchParams.get('dateRange')

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        '/api/expenses',
        request
      )
    }

    // Build query conditions
    const conditions: string[] = ['1=1']
    const queryParams: any[] = []
    
    if (type) {
      conditions.push(`type = $${queryParams.length + 1}`)
      queryParams.push(type)
    }

    if (status) {
      conditions.push(`status = $${queryParams.length + 1}`)
      queryParams.push(status)
    }

    if (category) {
      conditions.push(`category = $${queryParams.length + 1}`)
      queryParams.push(category)
    }

    // Add date range filter
    if (dateRange) {
      const now = new Date()
      const startDate = new Date()
      
      switch (dateRange) {
        case 'thisMonth':
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'lastMonth':
          startDate.setMonth(now.getMonth() - 1)
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
          now.setDate(0) // Last day of previous month
          break
        case 'thisQuarter':
          const currentQuarter = Math.floor(now.getMonth() / 3)
          startDate.setMonth(currentQuarter * 3)
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'thisYear':
          startDate.setMonth(0)
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
          break
      }
      
      conditions.push(`"createdAt" >= $${queryParams.length + 1}`)
      queryParams.push(startDate)
      conditions.push(`"createdAt" <= $${queryParams.length + 1}`)
      queryParams.push(now)
    }

    // Fetch expenses using schema-aware query
    const expensesQuery = `
      SELECT 
        e.*,
        u.id as creator_id, u.name as creator_name, u.email as creator_email
      FROM "Expense" e
      LEFT JOIN public."User" u ON u.id = e."createdBy"
      WHERE ${conditions.join(' AND ')}
      ORDER BY e."createdAt" DESC
    `
    const { data: expensesRaw, error } = await safeQuerySchema<any>(orgSlug, expensesQuery, queryParams)
    
    if (error) {
      console.error('Failed to fetch expenses:', error)
      // Return empty array instead of 500 error to match defensive patterns
      return NextResponse.json([])
    }
    
    const expenses = expensesRaw.map(expense => ({
      ...expense,
      creator: expense.creator_id ? {
        id: expense.creator_id,
        name: expense.creator_name,
        email: expense.creator_email
      } : null
    }))

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only admin, master, and sales can create expenses
    if (!['admin', 'master', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.description || !data.vendor || !data.amount || !data.category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Create expense using schema-aware query
    const createQuery = `
      INSERT INTO "Expense" (
        id, description, vendor, amount, category, type, frequency,
        "startDate", "endDate", "nextDueDate", "createdBy", "organizationId",
        status, notes, "invoiceNumber", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `
    
    const createParams = [
      data.description,
      data.vendor,
      parseFloat(data.amount),
      data.category,
      data.type || 'oneTime',
      data.type === 'recurring' ? data.frequency : null,
      data.startDate ? new Date(data.startDate) : new Date(),
      data.endDate ? new Date(data.endDate) : null,
      data.type === 'recurring' && data.frequency ? calculateNextDueDate(data.startDate || new Date(), data.frequency) : null,
      user.id,
      user.organizationId,
      data.status || 'pending',
      data.notes || null,
      data.invoiceNumber || null
    ]
    
    const { data: createdExpenses, error } = await safeQuerySchema<any>(orgSlug, createQuery, createParams)
    
    if (error || !createdExpenses || createdExpenses.length === 0) {
      console.error('Failed to create expense:', error)
      return NextResponse.json(
        { error: 'Failed to create expense' },
        { status: 500 }
      )
    }
    
    const createdExpense = createdExpenses[0]
    
    // Fetch creator info
    const creatorQuery = `SELECT id, name, email FROM public."User" WHERE id = $1`
    const creators = await prisma.user.findMany({
      where: { id: user.id },
      select: { id: true, name: true, email: true }
    })
    
    const expense = {
      ...createdExpense,
      creator: creators[0] || null
    }

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    )
  }
}

function calculateNextDueDate(startDate: Date | string, frequency: 'monthly' | 'quarterly' | 'yearly'): Date {
  const date = new Date(startDate)
  
  switch (frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }
  
  return date
}
