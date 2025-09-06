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
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await prisma.budgetEntry.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
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

    if (!entry) {
      return NextResponse.json({ error: 'Budget entry not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...entry,
      variance: entry.actualAmount - entry.budgetAmount,
      variancePercent: entry.budgetAmount > 0 
        ? ((entry.actualAmount - entry.budgetAmount) / entry.budgetAmount) * 100 
        : 0
    })
  } catch (error) {
    console.error('Error fetching budget entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { budgetAmount, actualAmount, notes } = body

    // Verify entry exists and belongs to organization
    const existingEntry = await prisma.budgetEntry.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      }
    })

    if (!existingEntry) {
      return NextResponse.json({ error: 'Budget entry not found' }, { status: 404 })
    }

    const updatedEntry = await prisma.budgetEntry.update({
      where: { id: params.id },
      data: {
        budgetAmount: budgetAmount !== undefined ? budgetAmount : existingEntry.budgetAmount,
        actualAmount: actualAmount !== undefined ? actualAmount : existingEntry.actualAmount,
        notes
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

    return NextResponse.json({
      ...updatedEntry,
      variance: updatedEntry.actualAmount - updatedEntry.budgetAmount,
      variancePercent: updatedEntry.budgetAmount > 0 
        ? ((updatedEntry.actualAmount - updatedEntry.budgetAmount) / updatedEntry.budgetAmount) * 100 
        : 0
    })
  } catch (error) {
    console.error('Error updating budget entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify entry exists and belongs to organization
    const existingEntry = await prisma.budgetEntry.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      }
    })

    if (!existingEntry) {
      return NextResponse.json({ error: 'Budget entry not found' }, { status: 404 })
    }

    await prisma.budgetEntry.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
