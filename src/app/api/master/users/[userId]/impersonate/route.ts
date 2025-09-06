import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { cookies } from 'next/headers'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/master/users/[userId]/impersonate - Create impersonation session
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check authentication for master role
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await UserService.validateSession(authToken.value)
    if (!currentUser || currentUser.role !== 'master') {
      return NextResponse.json({ error: 'Master access required' }, { status: 403 })
    }

    // Check if user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: {
        id: params.userId
      },
      include: {
        organization: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: 'Cannot impersonate inactive user' },
        { status: 400 }
      )
    }

    // Create a new session for the target user
    const impersonationToken = await UserService.createSession(targetUser.id)

    console.log(`✅ Master user impersonating user ${targetUser.email} (${targetUser.id})`)

    const response = NextResponse.json({
      success: true,
      token: impersonationToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        organizationId: targetUser.organizationId,
        organizationName: targetUser.organization?.name
      },
      message: `Now impersonating ${targetUser.name || targetUser.email}`
    })

    // Set the auth token cookie for the impersonated user
    response.cookies.set('auth-token', impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('❌ Master user impersonation error:', error)
    return NextResponse.json(
      { error: 'Failed to create impersonation session' },
      { status: 500 }
    )
  }
}
