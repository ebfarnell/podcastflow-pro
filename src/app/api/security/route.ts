import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    console.log('🔐 Security API: Fetching security settings for user', { userId: user.id })

    // Get active sessions for this user
    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastAccessedAt: 'desc'
      },
      take: 10
    })

    // Get user's recent login history (last 10 logins)
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      }
    })

    // Format sessions
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      device: session.userAgent || 'Unknown Device',
      ipAddress: session.ipAddress || 'Unknown',
      location: 'Unknown', // Would need IP geolocation service for real data
      lastActive: session.lastAccessedAt.toISOString(),
      current: session.token === authToken.value
    }))

    // Create mock login history since we don't track this yet
    const loginHistory = userData?.lastLoginAt ? [
      {
        timestamp: userData.lastLoginAt.toISOString(),
        device: 'Chrome on MacOS',
        ipAddress: request.headers.get('x-forwarded-for') || 'Unknown',
        location: 'Unknown',
        success: true
      }
    ] : []

    // Calculate password age
    const passwordLastChanged = userData?.updatedAt || new Date()
    const passwordAge = Math.floor((Date.now() - passwordLastChanged.getTime()) / (1000 * 60 * 60 * 24))

    // Build response
    const response = {
      passwordLastChanged: passwordLastChanged.toISOString(),
      passwordStrength: 'strong', // Would need password analysis for real strength
      passwordAge: passwordAge,
      twoFactorEnabled: userData?.twoFactorEnabled || false,
      twoFactorMethod: userData?.twoFactorEnabled ? 'authenticator' : null,
      twoFactorVerified: userData?.twoFactorEnabled || false,
      sessions: formattedSessions,
      loginHistory: loginHistory,
      securityPreferences: {
        sessionTimeout: 480, // 8 hours in minutes
        requirePasswordChange: 90, // days
        allowMultipleSessions: true,
        notifyOnNewLogin: true,
        notifyOnPasswordChange: true
      }
    }

    console.log('✅ Security API: Returning security settings')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Security API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const updates = await request.json()
    console.log('🔐 Security API: Updating security settings', { userId: user.id, updates })

    // Handle different types of security updates
    if (updates.twoFactorEnabled !== undefined) {
      // Update 2FA settings
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: updates.twoFactorEnabled,
          twoFactorSecret: updates.twoFactorEnabled ? updates.twoFactorSecret : null,
          updatedAt: new Date()
        }
      })
    }

    if (updates.password) {
      // Update password (would need proper password hashing)
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(updates.password, 10)
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      })
    }

    if (updates.sessionId && updates.action === 'terminate') {
      // Terminate a specific session
      await prisma.session.delete({
        where: { 
          id: updates.sessionId,
          userId: user.id // Ensure user can only delete their own sessions
        }
      })
    }

    if (updates.action === 'terminateAll') {
      // Terminate all sessions except current
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          token: {
            not: authToken.value
          }
        }
      })
    }

    console.log('✅ Security API: Security settings updated successfully')
    return NextResponse.json({
      message: 'Security settings updated successfully'
    })

  } catch (error) {
    console.error('❌ Security API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
