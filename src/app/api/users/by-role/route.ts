import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withApiProtection } from '@/lib/auth/api-protection'
import { PERMISSIONS, hasPermission } from '@/types/auth'

export const dynamic = 'force-dynamic'

async function getUsersByRole(request: any) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const search = searchParams.get('search')

    if (!role) {
      return NextResponse.json(
        { error: 'Role parameter is required' },
        { status: 400 }
      )
    }

    // Get the authenticated user's organization
    const user = request.user
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      )
    }

    // Build query - filter by organization and role
    const whereClause: any = {
      role: role,
      organizationId: user.organizationId
    }

    // Add search if provided
    if (search && search.length > 0) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true
      },
      orderBy: {
        name: 'asc'
      },
      take: 50 // Increased limit to show more users
    })

    console.log(`Found ${users.length} ${role} users in organization ${user.organizationId}`)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users by role:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Import UserService here to avoid circular dependencies
  const { UserService } = await import('@/lib/auth/user-service')
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check permissions - allow admin and master to view users
  if (!hasPermission(user.role, PERMISSIONS.USERS_VIEW)) {
    return NextResponse.json(
      { 
        error: 'Insufficient permissions',
        details: `Missing required permission: ${PERMISSIONS.USERS_VIEW}`
      },
      { status: 403 }
    )
  }
  
  // Add user to request
  const authenticatedRequest = request as any
  authenticatedRequest.user = user
  
  return getUsersByRole(authenticatedRequest)
}