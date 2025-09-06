import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { taskService } from '@/lib/tasks/task-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const userId = searchParams.get('userId') || user.id

    // Can only view own tasks unless admin/master
    if (userId !== user.id && !['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tasks = await taskService.getUpcomingTasks(userId, days)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
