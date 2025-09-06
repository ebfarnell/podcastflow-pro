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
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showId = searchParams.get('showId')
    const assignedToId = searchParams.get('assignedToId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const filter: any = {
      organizationId: user.organizationId
    }

    if (showId) filter.showId = showId
    if (assignedToId) filter.assignedToId = assignedToId
    
    if (startDate && endDate) {
      filter.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      }
    }

    // For talent/producer, default to their own stats
    if ((user.role === 'talent' || user.role === 'producer') && !assignedToId) {
      filter.assignedToId = user.id
    }

    const stats = await taskService.getTaskStats(filter)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching task stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
