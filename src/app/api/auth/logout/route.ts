import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { logAuthEvent } from '@/lib/audit/audit-middleware'
import { AuditEventType } from '@/lib/audit/audit-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (authToken) {
      // Find session to get user info for audit log
      const session = await prisma.session.findFirst({
        where: { token: authToken.value },
        include: { user: true }
      })

      if (session) {
        // Log logout event
        await logAuthEvent(
          AuditEventType.USER_LOGOUT,
          request,
          session.userId,
          {
            email: session.user.email,
            organizationId: session.user.organizationId,
            sessionDuration: `${Math.round((Date.now() - session.createdAt.getTime()) / 1000 / 60)} minutes`
          },
          true
        )
      }

      // Delete session from database
      await prisma.session.deleteMany({
        where: { token: authToken.value }
      })
    }

    // Clear the cookie
    cookies().delete('auth-token')

    return NextResponse.json({
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}
