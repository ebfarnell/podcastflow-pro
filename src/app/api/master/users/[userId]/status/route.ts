import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'

// PUT /api/master/users/[userId]/status - Update user status
export const PUT = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { userId: string } }
) => {
  try {
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be active, inactive, or suspended' },
        { status: 400 }
      )
    }

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

    // Update user status
    const updatedUser = await prisma.user.update({
      where: {
        id: params.userId
      },
      data: {
        isActive: status === 'active'
        // Note: we don't have a suspended status field in the current schema
        // In production, you would add a status enum field
      }
    })

    // If suspending user, delete all their sessions
    if (status === 'suspended' || status === 'inactive') {
      await prisma.session.deleteMany({
        where: {
          userId: params.userId
        }
      })
    }

    console.log(`✅ User ${params.userId} status updated to ${status}`)

    return NextResponse.json({
      success: true,
      message: `User status updated to ${status}`,
      user: {
        id: updatedUser.id,
        status: updatedUser.isActive ? 'active' : 'inactive'
      }
    })

  } catch (error) {
    console.error('❌ Master user status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    )
  }
})