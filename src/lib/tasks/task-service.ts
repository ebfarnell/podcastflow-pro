import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { activityService } from '@/lib/activities/activity-service'
import { notificationService } from '@/lib/notifications/notification-service'

export interface TaskData {
  episodeId: string
  title: string
  description?: string
  assignedToId: string
  taskType?: string
  priority?: string
  dueDate?: Date
  notes?: string
}

export interface TaskUpdate {
  title?: string
  description?: string
  assignedToId?: string
  taskType?: string
  priority?: string
  status?: string
  dueDate?: Date | null
  notes?: string
}

export interface TaskFilter {
  episodeId?: string
  assignedToId?: string
  createdById?: string
  status?: string | string[]
  priority?: string | string[]
  taskType?: string | string[]
  dueBefore?: Date
  dueAfter?: Date
  showId?: string
  organizationId?: string
}

export class TaskService {
  /**
   * Create a new task
   */
  async createTask(data: TaskData, createdById: string, organizationId: string) {
    try {
      // Verify episode belongs to organization
      const episode = await prisma.episode.findFirst({
        where: {
          id: data.episodeId,
          show: {
            organizationId
          }
        },
        include: {
          show: true
        }
      })

      if (!episode) {
        throw new Error('Episode not found or access denied')
      }

      // Create the task
      const task = await prisma.episodeTalentTask.create({
        data: {
          episodeId: data.episodeId,
          title: data.title,
          description: data.description,
          assignedToId: data.assignedToId,
          taskType: data.taskType || 'general',
          priority: data.priority || 'medium',
          dueDate: data.dueDate,
          notes: data.notes,
          createdById
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          episode: {
            select: {
              id: true,
              title: true,
              episodeNumber: true,
              show: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      // Log activity
      await activityService.logActivity({
        type: 'task',
        action: 'created',
        title: 'Task Created',
        description: `Created task "${task.title}" for ${task.assignedTo.name}`,
        actorId: createdById,
        actorName: task.createdBy.name,
        actorEmail: task.createdBy.email,
        actorRole: 'producer',
        targetType: 'task',
        targetId: task.id,
        targetName: task.title,
        organizationId,
        episodeId: data.episodeId,
        showId: episode.show.id,
        metadata: {
          assignedTo: task.assignedTo.name,
          priority: task.priority,
          dueDate: task.dueDate,
          episodeTitle: episode.title
        }
      })

      // Send notification to assignee
      try {
        await notificationService.notifyTaskAssignment(
          task.assignedToId,
          task,
          task.createdBy.name || task.createdBy.email,
          true // Send email
        )
        console.log('📧 Task assignment notification sent')
      } catch (notificationError) {
        console.error('❌ Failed to send task notification:', notificationError)
        // Don't fail task creation if notification fails
      }

      console.log('📋 Task created:', task.id)
      return task
    } catch (error) {
      console.error('Error creating task:', error)
      throw error
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    updates: TaskUpdate,
    updatedById: string,
    organizationId: string
  ) {
    try {
      // Verify task exists and user has access
      const existingTask = await prisma.episodeTalentTask.findFirst({
        where: {
          id: taskId,
          episode: {
            show: {
              organizationId
            }
          }
        },
        include: {
          assignedTo: true,
          episode: {
            include: {
              show: true
            }
          }
        }
      })

      if (!existingTask) {
        throw new Error('Task not found or access denied')
      }

      // Track status change for activity log
      const statusChanged = updates.status && updates.status !== existingTask.status

      // Update the task
      const task = await prisma.episodeTalentTask.update({
        where: { id: taskId },
        data: {
          ...updates,
          completedAt: updates.status === 'completed' ? new Date() : 
                      updates.status !== 'completed' ? null : undefined
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          episode: {
            select: {
              id: true,
              title: true,
              episodeNumber: true,
              show: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      // Get updater info
      const updater = await prisma.user.findUnique({
        where: { id: updatedById },
        select: { name: true, email: true, role: true }
      })

      // Log activity for significant changes
      if (statusChanged) {
        await activityService.logActivity({
          type: 'task',
          action: updates.status === 'completed' ? 'completed' : 'status_changed',
          title: updates.status === 'completed' ? 'Task Completed' : 'Task Status Changed',
          description: `${updater?.name} ${updates.status === 'completed' ? 'completed' : 'updated status of'} task "${task.title}"`,
          actorId: updatedById,
          actorName: updater?.name || 'Unknown',
          actorEmail: updater?.email || '',
          actorRole: updater?.role || 'unknown',
          targetType: 'task',
          targetId: task.id,
          targetName: task.title,
          organizationId,
          episodeId: task.episodeId,
          showId: task.episode.show.id,
          metadata: {
            oldStatus: existingTask.status,
            newStatus: updates.status,
            assignedTo: task.assignedTo.name
          }
        })
      } else if (updates.assignedToId && updates.assignedToId !== existingTask.assignedToId) {
        await activityService.logActivity({
          type: 'task',
          action: 'reassigned',
          title: 'Task Reassigned',
          description: `${updater?.name} reassigned task "${task.title}" to ${task.assignedTo.name}`,
          actorId: updatedById,
          actorName: updater?.name || 'Unknown',
          actorEmail: updater?.email || '',
          actorRole: updater?.role || 'unknown',
          targetType: 'task',
          targetId: task.id,
          targetName: task.title,
          organizationId,
          episodeId: task.episodeId,
          showId: task.episode.show.id,
          metadata: {
            oldAssignee: existingTask.assignedTo.name,
            newAssignee: task.assignedTo.name
          }
        })
      }

      console.log('📋 Task updated:', task.id)
      return task
    } catch (error) {
      console.error('Error updating task:', error)
      throw error
    }
  }

  /**
   * Get tasks with filtering
   */
  async getTasks(filter: TaskFilter, limit: number = 50, offset: number = 0) {
    try {
      const where: Prisma.EpisodeTalentTaskWhereInput = {}

      if (filter.episodeId) where.episodeId = filter.episodeId
      if (filter.assignedToId) where.assignedToId = filter.assignedToId
      if (filter.createdById) where.createdById = filter.createdById
      
      if (filter.status) {
        where.status = Array.isArray(filter.status) 
          ? { in: filter.status }
          : filter.status
      }
      
      if (filter.priority) {
        where.priority = Array.isArray(filter.priority)
          ? { in: filter.priority }
          : filter.priority
      }
      
      if (filter.taskType) {
        where.taskType = Array.isArray(filter.taskType)
          ? { in: filter.taskType }
          : filter.taskType
      }

      if (filter.dueBefore || filter.dueAfter) {
        where.dueDate = {}
        if (filter.dueBefore) where.dueDate.lte = filter.dueBefore
        if (filter.dueAfter) where.dueDate.gte = filter.dueAfter
      }

      if (filter.showId) {
        where.episode = {
          showId: filter.showId
        }
      }

      if (filter.organizationId) {
        where.episode = {
          show: {
            organizationId: filter.organizationId
          }
        }
      }

      const [tasks, total] = await Promise.all([
        prisma.episodeTalentTask.findMany({
          where,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            episode: {
              select: {
                id: true,
                title: true,
                episodeNumber: true,
                airDate: true,
                show: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' }
          ],
          take: limit,
          skip: offset
        }),
        prisma.episodeTalentTask.count({ where })
      ])

      return { tasks, total }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      throw error
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string, organizationId: string) {
    return prisma.episodeTalentTask.findFirst({
      where: {
        id: taskId,
        episode: {
          show: {
            organizationId
          }
        }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        episode: {
          include: {
            show: true,
            talentTasks: {
              include: {
                assignedTo: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }
      }
    })
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, deletedById: string, organizationId: string) {
    try {
      const task = await prisma.episodeTalentTask.findFirst({
        where: {
          id: taskId,
          episode: {
            show: {
              organizationId
            }
          }
        },
        include: {
          assignedTo: true,
          episode: {
            include: {
              show: true
            }
          }
        }
      })

      if (!task) {
        throw new Error('Task not found or access denied')
      }

      // Delete the task
      await prisma.episodeTalentTask.delete({
        where: { id: taskId }
      })

      // Get deleter info
      const deleter = await prisma.user.findUnique({
        where: { id: deletedById },
        select: { name: true, email: true, role: true }
      })

      // Log activity
      await activityService.logActivity({
        type: 'task',
        action: 'deleted',
        title: 'Task Deleted',
        description: `${deleter?.name} deleted task "${task.title}"`,
        actorId: deletedById,
        actorName: deleter?.name || 'Unknown',
        actorEmail: deleter?.email || '',
        actorRole: deleter?.role || 'unknown',
        targetType: 'task',
        targetId: task.id,
        targetName: task.title,
        organizationId,
        episodeId: task.episodeId,
        showId: task.episode.show.id,
        metadata: {
          assignedTo: task.assignedTo.name,
          priority: task.priority,
          status: task.status
        }
      })

      console.log('🗑️ Task deleted:', taskId)
      return { success: true }
    } catch (error) {
      console.error('Error deleting task:', error)
      throw error
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(filter: {
    organizationId?: string
    showId?: string
    assignedToId?: string
    dateRange?: { start: Date; end: Date }
  }) {
    const where: Prisma.EpisodeTalentTaskWhereInput = {}

    if (filter.organizationId) {
      where.episode = {
        show: {
          organizationId: filter.organizationId
        }
      }
    }

    if (filter.showId) {
      where.episode = {
        showId: filter.showId
      }
    }

    if (filter.assignedToId) {
      where.assignedToId = filter.assignedToId
    }

    if (filter.dateRange) {
      where.createdAt = {
        gte: filter.dateRange.start,
        lte: filter.dateRange.end
      }
    }

    const [
      totalTasks,
      statusCounts,
      priorityCounts,
      typeCounts,
      overdueTasks,
      completedThisWeek
    ] = await Promise.all([
      prisma.episodeTalentTask.count({ where }),
      prisma.episodeTalentTask.groupBy({
        where,
        by: ['status'],
        _count: { _all: true }
      }),
      prisma.episodeTalentTask.groupBy({
        where,
        by: ['priority'],
        _count: { _all: true }
      }),
      prisma.episodeTalentTask.groupBy({
        where,
        by: ['taskType'],
        _count: { _all: true }
      }),
      prisma.episodeTalentTask.count({
        where: {
          ...where,
          status: { notIn: ['completed', 'cancelled'] },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.episodeTalentTask.count({
        where: {
          ...where,
          status: 'completed',
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    return {
      total: totalTasks,
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count._all
        return acc
      }, {} as Record<string, number>),
      byPriority: priorityCounts.reduce((acc, item) => {
        acc[item.priority] = item._count._all
        return acc
      }, {} as Record<string, number>),
      byType: typeCounts.reduce((acc, item) => {
        acc[item.taskType] = item._count._all
        return acc
      }, {} as Record<string, number>),
      overdue: overdueTasks,
      completedThisWeek
    }
  }

  /**
   * Get upcoming tasks for a user
   */
  async getUpcomingTasks(userId: string, days: number = 7) {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    return prisma.episodeTalentTask.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ['completed', 'cancelled'] },
        dueDate: {
          lte: futureDate,
          gte: new Date()
        }
      },
      include: {
        episode: {
          select: {
            id: true,
            title: true,
            episodeNumber: true,
            airDate: true,
            show: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' }
      ]
    })
  }

  /**
   * Bulk create tasks for an episode
   */
  async createEpisodeTasks(
    episodeId: string,
    tasks: Array<{
      title: string
      assignedToId: string
      taskType: string
      priority?: string
      dueDate?: Date
      description?: string
    }>,
    createdById: string,
    organizationId: string
  ) {
    try {
      // Verify episode belongs to organization
      const episode = await prisma.episode.findFirst({
        where: {
          id: episodeId,
          show: {
            organizationId
          }
        },
        include: {
          show: true
        }
      })

      if (!episode) {
        throw new Error('Episode not found or access denied')
      }

      // Create all tasks
      const createdTasks = await prisma.episodeTalentTask.createMany({
        data: tasks.map(task => ({
          episodeId,
          title: task.title,
          assignedToId: task.assignedToId,
          taskType: task.taskType,
          priority: task.priority || 'medium',
          dueDate: task.dueDate,
          description: task.description,
          createdById
        }))
      })

      // Get creator info
      const creator = await prisma.user.findUnique({
        where: { id: createdById },
        select: { name: true, email: true, role: true }
      })

      // Log activity
      await activityService.logActivity({
        type: 'task',
        action: 'bulk_created',
        title: 'Tasks Created',
        description: `${creator?.name} created ${createdTasks.count} tasks for episode "${episode.title}"`,
        actorId: createdById,
        actorName: creator?.name || 'Unknown',
        actorEmail: creator?.email || '',
        actorRole: creator?.role || 'unknown',
        targetType: 'episode',
        targetId: episodeId,
        targetName: episode.title,
        organizationId,
        episodeId,
        showId: episode.show.id,
        metadata: {
          taskCount: createdTasks.count
        }
      })

      console.log(`📋 Created ${createdTasks.count} tasks for episode ${episodeId}`)
      return createdTasks
    } catch (error) {
      console.error('Error creating episode tasks:', error)
      throw error
    }
  }
}

export const taskService = new TaskService()