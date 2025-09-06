import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { getSchemaName } from '@/lib/db/utils'

// GET /api/master/users/[userId] - Get user details
export const GET = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { userId: string } }
) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: params.userId
      },
      include: {
        organization: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get session count
    const sessionCount = await prisma.session.count({
      where: {
        userId: params.userId,
        expiresAt: {
          gt: new Date()
        }
      }
    })

    // Get recent campaigns if user has access to campaigns
    let campaigns: any[] = []
    if (['master', 'admin', 'sales'].includes(user.role) && user.organization?.slug) {
      try {
        const schemaName = getSchemaName(user.organization.slug)
        const campaignResults = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, name, status, "createdAt"
          FROM "${schemaName}"."Campaign"
          WHERE "organizationId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 5
        `, user.organizationId)
        
        campaigns = campaignResults
      } catch (error) {
        console.warn(`Could not get campaigns for user ${user.id}:`, error)
        // Continue without campaigns
      }
    }

    const userWithDetails = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.isActive ? 'active' : 'inactive',
      organizationId: user.organizationId,
      organizationName: user.organization?.name || 'Unknown',
      phone: user.phone,
      title: user.title,
      department: user.department,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      sessionCount,
      campaigns
    }

    return NextResponse.json({ user: userWithDetails })

  } catch (error) {
    console.error('❌ Master user GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// PUT /api/master/users/[userId] - Update user status
export const PUT = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { userId: string } }
) => {
  try {
    const body = await request.json()

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        id: params.userId
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    
    if (body.status) {
      updateData.isActive = body.status === 'active'
    }
    
    if (body.role) {
      updateData.role = body.role
    }
    
    if (body.name) {
      updateData.name = body.name
    }

    if (body.email) {
      updateData.email = body.email
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone
    }

    if (body.title !== undefined) {
      updateData.title = body.title
    }

    if (body.department !== undefined) {
      updateData.department = body.department
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: {
        id: params.userId
      },
      data: updateData,
      include: {
        organization: true
      }
    })

    const userWithOrg = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.isActive ? 'active' : 'inactive',
      organizationId: updatedUser.organizationId,
      organizationName: updatedUser.organization?.name || 'Unknown',
      phone: updatedUser.phone,
      title: updatedUser.title,
      department: updatedUser.department,
      createdAt: updatedUser.createdAt.toISOString(),
      lastLoginAt: updatedUser.lastLoginAt?.toISOString()
    }

    return NextResponse.json({
      user: userWithOrg,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('❌ Master user PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// DELETE /api/master/users/[userId] - Delete user (hard or soft delete)
export const DELETE = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { userId: string } }
) => {
  try {
    const url = new URL(request.url)
    const permanent = url.searchParams.get('permanent') === 'true'

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        id: params.userId
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of master users (safety check)
    if (existingUser.role === 'master') {
      return NextResponse.json(
        { error: 'Cannot delete master users' },
        { status: 403 }
      )
    }

    if (permanent) {
      // Hard delete - completely remove user and all related data
      await prisma.$transaction(async (tx) => {
        // Delete user sessions
        await tx.session.deleteMany({
          where: { userId: params.userId }
        })

        // Delete the user
        await tx.user.delete({
          where: { id: params.userId }
        })
      })

      return NextResponse.json({
        message: 'User permanently deleted successfully'
      })
    } else {
      // Soft delete by setting isActive to false
      await prisma.user.update({
        where: {
          id: params.userId
        },
        data: {
          isActive: false
        }
      })

      // Delete any active sessions for this user
      await prisma.session.deleteMany({
        where: {
          userId: params.userId
        }
      })

      return NextResponse.json({
        message: 'User deactivated successfully'
      })
    }

  } catch (error) {
    console.error('❌ Master user DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})