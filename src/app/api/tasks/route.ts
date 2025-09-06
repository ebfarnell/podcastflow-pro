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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build filter
    const filter: any = {
      organizationId: user.organizationId
    }

    const episodeId = searchParams.get('episodeId')
    const showId = searchParams.get('showId')
    const assignedToId = searchParams.get('assignedToId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const taskType = searchParams.get('taskType')
    const dueBefore = searchParams.get('dueBefore')
    const dueAfter = searchParams.get('dueAfter')

    if (episodeId) filter.episodeId = episodeId
    if (showId) filter.showId = showId
    if (assignedToId) filter.assignedToId = assignedToId
    if (status) filter.status = status.split(',')
    if (priority) filter.priority = priority.split(',')
    if (taskType) filter.taskType = taskType.split(',')
    if (dueBefore) filter.dueBefore = new Date(dueBefore)
    if (dueAfter) filter.dueAfter = new Date(dueAfter)

    // For talent/producer roles, default to their own tasks
    if ((user.role === 'talent' || user.role === 'producer') && !assignedToId) {
      filter.assignedToId = user.id
    }

    const { tasks, total } = await taskService.getTasks(filter, limit, offset)

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only producers, admins, and master can create tasks
    if (!['producer', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const {
      episodeId,
      title,
      description,
      assignedToId,
      taskType,
      priority,
      dueDate,
      notes,
      bulkTasks // For bulk creation
    } = body

    // Handle bulk task creation
    if (bulkTasks && Array.isArray(bulkTasks)) {
      const result = await taskService.createEpisodeTasks(
        episodeId,
        bulkTasks,
        user.id,
        user.organizationId
      )
      return NextResponse.json({
        message: `Created ${result.count} tasks successfully`,
        count: result.count
      }, { status: 201 })
    }

    // Validate required fields
    if (!episodeId || !title || !assignedToId) {
      return NextResponse.json({ 
        error: 'Missing required fields: episodeId, title, assignedToId' 
      }, { status: 400 })
    }

    const task = await taskService.createTask(
      {
        episodeId,
        title,
        description,
        assignedToId,
        taskType,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes
      },
      user.id,
      user.organizationId
    )

    return NextResponse.json({ 
      message: 'Task created successfully',
      task 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
