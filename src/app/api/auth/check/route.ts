import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import { verifyAuth } from '@/lib/auth/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('🔐 /api/auth/check - Called at:', new Date().toISOString())
  console.log('🔐 /api/auth/check - Headers:', request.headers.get('cookie'))
  
  try {
    // Skip JWT verification for now and go directly to cookie-based auth
    // const authUser = await verifyAuth(request)
    // if (authUser) {
    //   return NextResponse.json({
    //     authenticated: true,
    //     user: authUser,
    //   })
    // }

    // Check session cookie
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    console.log('🔐 /api/auth/check - Auth token exists:', !!authToken)
    if (!authToken) {
      console.log('🔐 /api/auth/check - No auth token found, returning 401')
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    console.log('🔐 /api/auth/check - Validating session for token:', authToken.value.substring(0, 10) + '...')
    // Validate session
    const user = await UserService.validateSession(authToken.value)

    if (!user) {
      console.log('🔐 /api/auth/check - Session validation failed, user not found')
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }
    
    console.log('🔐 /api/auth/check - Session valid for user:', user.email)

    // Return user data (without password)
    const response = {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
      },
    }
    
    console.log('🔐 /api/auth/check - Returning response:', JSON.stringify(response))
    return NextResponse.json(response)
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}