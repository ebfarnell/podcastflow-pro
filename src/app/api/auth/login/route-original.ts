import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
// Temporarily disable imports that might be causing issues
// import { generateToken } from '@/lib/auth/auth-middleware'
// import { logAuthEvent } from '@/lib/audit/audit-middleware'
// import { AuditEventType } from '@/lib/audit/audit-service'
// import { activityService } from '@/lib/activities/activity-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await UserService.findByEmail(email)

    if (!user) {
      // Log failed login attempt
      await logAuthEvent(
        AuditEventType.USER_LOGIN_FAILED,
        request,
        undefined,
        { email, reason: 'User not found' },
        false
      )
      
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Validate password
    const isValidPassword = await UserService.validatePassword(password, user.password)

    if (!isValidPassword) {
      // Log failed login attempt
      await logAuthEvent(
        AuditEventType.USER_LOGIN_FAILED,
        request,
        user.id,
        { email, reason: 'Invalid password' },
        false
      )
      
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      // Log failed login attempt due to inactive account
      await logAuthEvent(
        AuditEventType.USER_LOGIN_FAILED,
        request,
        user.id,
        { email, reason: 'Account deactivated' },
        false
      )
      
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      )
    }

    // Create session
    const sessionToken = await UserService.createSession(user.id)

    // Update last login
    await UserService.updateLastLogin(user.id)

    // Generate JWT token for API access
    const jwtToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      organizationId: user.organizationId || undefined,
    })

    // Set session cookie
    cookies().set('auth-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    })

    // Log successful login to audit log
    await logAuthEvent(
      AuditEventType.USER_LOGIN,
      request,
      user.id,
      {
        email: user.email,
        organizationId: user.organizationId,
        sessionDuration: '8 hours'
      },
      true
    )

    // Log activity
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    await activityService.logActivity({
      type: 'user',
      action: 'login',
      title: 'User Login',
      description: `${user.name} logged into the system`,
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'system',
      targetName: 'Authentication',
      organizationId: user.organizationId!,
      ipAddress,
      userAgent
    })

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({
      user: userWithoutPassword,
      token: jwtToken,
      sessionToken,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}
