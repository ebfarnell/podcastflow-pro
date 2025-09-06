import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { createSecurityAuditLog } from '@/lib/security/audit'
import { getLocationFromIP } from '@/lib/security/ip-utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Parse user agent to get device and browser info
function parseUserAgent(userAgent: string): { device: string; browser: string } {
  let device = 'Unknown Device'
  let browser = 'Unknown Browser'

  if (!userAgent) return { device, browser }

  // Detect device
  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('iPhone')) device = 'iPhone'
    else if (userAgent.includes('iPad')) device = 'iPad'
    else if (userAgent.includes('Android')) device = 'Android'
    else device = 'Mobile Device'
  } else if (userAgent.includes('Macintosh')) {
    device = 'Mac'
  } else if (userAgent.includes('Windows')) {
    device = 'Windows PC'
  } else if (userAgent.includes('Linux')) {
    device = 'Linux'
  }

  // Detect browser
  if (userAgent.includes('Chrome')) {
    const chromeVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1]
    browser = chromeVersion ? `Chrome ${chromeVersion.split('.')[0]}` : 'Chrome'
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const safariVersion = userAgent.match(/Version\/([\d.]+)/)?.[1]
    browser = safariVersion ? `Safari ${safariVersion.split('.')[0]}` : 'Safari'
  } else if (userAgent.includes('Firefox')) {
    const firefoxVersion = userAgent.match(/Firefox\/([\d.]+)/)?.[1]
    browser = firefoxVersion ? `Firefox ${firefoxVersion.split('.')[0]}` : 'Firefox'
  } else if (userAgent.includes('Edge')) {
    const edgeVersion = userAgent.match(/Edge\/([\d.]+)/)?.[1]
    browser = edgeVersion ? `Edge ${edgeVersion.split('.')[0]}` : 'Edge'
  }

  return { device, browser }
}

export async function GET(request: NextRequest) {
  try {
    // Get session from cookie (not authorization header)
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('🔐 Sessions API: Fetching active sessions for user', { userId: session.userId })

    // Get all active sessions for the user from database
    const sessions = await prisma.session.findMany({
      where: {
        userId: session.userId,
        expiresAt: {
          gt: new Date() // Only active sessions
        }
      },
      orderBy: {
        lastAccessedAt: 'desc'
      }
    })

    // Format sessions with device and location info
    const formattedSessions = await Promise.all(
      sessions.map(async (s) => {
        const { device, browser } = parseUserAgent(s.userAgent || '')
        const location = await getLocationFromIP(s.ipAddress || '127.0.0.1')
        
        return {
          id: s.id,
          device: `${browser} on ${device}`,
          browser,
          ipAddress: s.ipAddress,
          location,
          lastActive: s.lastAccessedAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          current: s.token === session.token // Mark current session
        }
      })
    )

    console.log('✅ Sessions API: Returning active sessions')
    return NextResponse.json(formattedSessions)

  } catch (error) {
    console.error('❌ Sessions API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get session from cookie
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    console.log('🔐 Sessions API: Revoking session', { userId: session.userId, sessionId })

    // Verify the session belongs to the user
    const targetSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.userId
      }
    })

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Don't allow revoking current session
    if (targetSession.token === session.token) {
      return NextResponse.json(
        { error: 'Cannot revoke current session' },
        { status: 400 }
      )
    }

    // Delete the session
    await prisma.session.delete({
      where: { id: sessionId }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'SESSION_REVOKED',
      resource: 'session',
      resourceId: sessionId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ Sessions API: Session revoked successfully')
    return NextResponse.json({
      message: 'Session revoked successfully'
    })

  } catch (error) {
    console.error('❌ Sessions API Error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    )
  }
}

// PUT /api/security/sessions - Terminate all sessions except current
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'terminateAll') {
      // Delete all sessions except current
      const deleted = await prisma.session.deleteMany({
        where: {
          userId: session.userId,
          token: {
            not: session.token
          }
        }
      })

      // Create audit log
      await createSecurityAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        userEmail: session.email,
        action: 'ALL_SESSIONS_TERMINATED',
        resource: 'session',
        changes: { count: deleted.count },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true
      })

      console.log('✅ Sessions API: All sessions terminated', { count: deleted.count })
      return NextResponse.json({
        message: `Terminated ${deleted.count} sessions`,
        count: deleted.count
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('❌ Sessions API Error:', error)
    return NextResponse.json(
      { error: 'Failed to terminate sessions' },
      { status: 500 }
    )
  }
}