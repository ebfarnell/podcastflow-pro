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

    const category = await prisma.budgetCategory.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      },
      include: {
        parentCategory: true,
        childCategories: true,
        budgetEntries: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
          take: 12
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error fetching budget category:', error)
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
    const { name, type, parentCategoryId, isActive } = body

    // Verify category exists and belongs to organization
    const existingCategory = await prisma.budgetCategory.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Prevent circular parent relationships
    if (parentCategoryId === params.id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 })
    }

    const updatedCategory = await prisma.budgetCategory.update({
      where: { id: params.id },
      data: {
        name,
        type,
        parentCategoryId,
        isActive
      },
      include: {
        parentCategory: true,
        childCategories: true
      }
    })

    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error('Error updating budget category:', error)
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

    // Verify category exists and belongs to organization
    const existingCategory = await prisma.budgetCategory.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId
      },
      include: {
        childCategories: true,
        budgetEntries: true
      }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Prevent deletion if category has children
    if (existingCategory.childCategories.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with child categories' 
      }, { status: 400 })
    }

    // Prevent deletion if category has budget entries
    if (existingCategory.budgetEntries.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with budget entries. Please delete all entries first.' 
      }, { status: 400 })
    }

    await prisma.budgetCategory.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
