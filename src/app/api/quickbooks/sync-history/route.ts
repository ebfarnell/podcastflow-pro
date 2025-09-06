import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { quickBooksSyncService } from '@/lib/quickbooks/sync-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get sync history
    const history = await quickBooksSyncService.getSyncHistory(user.organizationId, limit)

    return NextResponse.json({
      history,
      total: history.length
    })
  } catch (error) {
    console.error('Error fetching sync history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
