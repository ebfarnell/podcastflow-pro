import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { accessLogger } from '@/lib/security/access-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master and admin can access security audit logs
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const type = url.searchParams.get('type') || 'all'

    let data: any = {}

    if (type === 'cross-org' || type === 'all') {
      // Get cross-organization access logs
      data.crossOrgLogs = await accessLogger.getCrossOrgAccessLogs(limit)
    }

    if (type === 'stats' || type === 'all') {
      // Get master access statistics
      data.masterStats = await accessLogger.getMasterAccessStats(7)
    }

    return NextResponse.json({
      success: true,
      data,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id
    })

  } catch (error: any) {
    console.error('Security audit error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve security audit data', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master can manually log security events
    if (user.role !== 'master') {
      return NextResponse.json({ error: 'Master role required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, resource, notes } = body

    if (!action || !resource) {
      return NextResponse.json({ error: 'Action and resource are required' }, { status: 400 })
    }

    // Log manual security audit action
    const success = await accessLogger.logAccess({
      userId: user.id,
      userRole: user.role,
      action: `MANUAL_AUDIT: ${action}`,
      resource,
      userOrganizationId: user.organizationId!,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success,
      message: 'Security audit action logged',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Security audit logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log security audit action', details: error.message },
      { status: 500 }
    )
  }
}