import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch expense
    const expense = await prisma.expense.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['admin', 'master', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const data = await request.json()

    // Check if expense exists and belongs to user's organization
    const existingExpense = await prisma.expense.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      }
    })

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Update expense
    const updatedExpense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        description: data.description || existingExpense.description,
        vendor: data.vendor || existingExpense.vendor,
        amount: data.amount !== undefined ? parseFloat(data.amount) : existingExpense.amount,
        category: data.category || existingExpense.category,
        type: data.type || existingExpense.type,
        frequency: data.type === 'recurring' ? (data.frequency || existingExpense.frequency) : null,
        startDate: data.startDate ? new Date(data.startDate) : existingExpense.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existingExpense.endDate,
        nextDueDate: data.type === 'recurring' && data.frequency 
          ? calculateNextDueDate(data.startDate || existingExpense.startDate, data.frequency)
          : (data.type === 'oneTime' ? null : existingExpense.nextDueDate),
        status: data.status || existingExpense.status,
        notes: data.notes !== undefined ? data.notes : existingExpense.notes,
        invoiceNumber: data.invoiceNumber !== undefined ? data.invoiceNumber : existingExpense.invoiceNumber,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(updatedExpense)
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')?.value
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only admin and master can delete
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if expense exists using schema-aware query
    const existingQuery = `SELECT * FROM "Expense" WHERE id = $1`
    const existingExpenses = await querySchema<any>(orgSlug, existingQuery, [params.id])
    
    if (!existingExpenses || existingExpenses.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Delete expense using schema-aware query
    const deleteQuery = `DELETE FROM "Expense" WHERE id = $1`
    await querySchema(orgSlug, deleteQuery, [params.id])

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense' },
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
