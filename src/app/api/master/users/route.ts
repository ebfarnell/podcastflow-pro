import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'

// GET /api/master/users - Get all users across all organizations
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const role = url.searchParams.get('role') || 'all'
    const status = url.searchParams.get('status') || 'all'
    const organizationId = url.searchParams.get('organizationId') || 'all'
    const sortBy = url.searchParams.get('sortBy') || 'name'
    const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {}
    
    if (role !== 'all') {
      where.role = role
    }

    if (status !== 'all') {
      if (status === 'active') {
        where.isActive = true
        where.emailVerified = true
      } else if (status === 'invited') {
        where.isActive = true
        where.emailVerified = false
      } else if (status === 'inactive') {
        where.isActive = false
      }
    }

    if (organizationId !== 'all') {
      where.organizationId = organizationId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Build orderBy clause
    let orderBy: any = { createdAt: 'desc' } // Default fallback
    
    switch (sortBy) {
      case 'name':
        orderBy = { name: sortOrder }
        break
      case 'organization':
        orderBy = { organization: { name: sortOrder } }
        break
      case 'role':
        orderBy = { role: sortOrder }
        break
      case 'status':
        orderBy = { isActive: sortOrder }
        break
      case 'lastLoginAt':
        orderBy = { lastLoginAt: sortOrder }
        break
      case 'createdAt':
        orderBy = { createdAt: sortOrder }
        break
      default:
        orderBy = { name: sortOrder }
    }

    // Get users with organization info
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          organization: true,
          _count: {
            select: {
              sessions: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    // Transform users for response
    const transformedUsers = users.map(user => {
      // Determine status based on isActive and emailVerified
      let status = 'inactive'
      if (user.isActive) {
        if (user.emailVerified) {
          status = 'active'
        } else {
          status = 'invited' // User created but hasn't accepted invitation yet
        }
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status,
        organizationId: user.organizationId,
        organizationName: user.organization?.name || 'No Organization',
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        lastActive: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
        createdAt: user.createdAt.toISOString(),
        sessionCount: user._count.sessions,
        emailVerified: user.emailVerified
      }
    })

    // Calculate summary stats
    const stats = {
      totalUsers: total,
      activeUsers: await prisma.user.count({ where: { ...where, isActive: true } }),
      byRole: await prisma.user.groupBy({
        by: ['role'],
        where,
        _count: true
      }),
      byOrganization: await prisma.user.groupBy({
        by: ['organizationId'],
        where,
        _count: true
      })
    }

    return NextResponse.json({
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    })

  } catch (error) {
    console.error('Master users API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
})

// POST /api/master/users - Create new user
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create user (password will be handled by UserService)
    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.createUser({
      email: body.email,
      password: body.password || 'TempPassword123!', // Temporary password
      name: body.name,
      role: body.role,
      organizationId: body.organizationId
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      }
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
})