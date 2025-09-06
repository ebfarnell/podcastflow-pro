import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface ActivityData {
  type: string
  action: string
  title: string
  description?: string
  actorId?: string
  actorName: string
  actorEmail: string
  actorRole?: string
  targetType: string
  targetId?: string
  targetName?: string
  organizationId: string
  metadata?: any
  ipAddress?: string
  userAgent?: string
  campaignId?: string
  showId?: string
  episodeId?: string
}

export interface ActivityFilter {
  organizationId?: string
  type?: string
  action?: string
  actorId?: string
  targetType?: string
  targetId?: string
  campaignId?: string
  showId?: string
  episodeId?: string
  startDate?: Date
  endDate?: Date
}

export class ActivityService {
  /**
   * Check if the Activity model is available in Prisma
   */
  private isActivityModelAvailable(): boolean {
    return typeof (prisma as any).activity !== 'undefined' && 
           typeof (prisma as any).activity.create === 'function'
  }

  /**
   * Log an activity
   */
  async logActivity(data: ActivityData): Promise<any> {
    try {
      // Check if Activity model exists before attempting to use it
      if (!this.isActivityModelAvailable()) {
        // Fallback: Log to console when Activity model is not available
        console.log(`📝 Activity logged (no DB model): ${data.type}/${data.action} - ${data.title}`)
        console.log(`   Actor: ${data.actorName} (${data.actorEmail})`)
        console.log(`   Target: ${data.targetType}/${data.targetId} - ${data.targetName}`)
        console.log(`   Org: ${data.organizationId}`)
        
        // Return a mock activity object for compatibility
        return {
          id: `mock-${Date.now()}`,
          type: data.type,
          action: data.action,
          title: data.title,
          description: data.description,
          actorName: data.actorName,
          actorEmail: data.actorEmail,
          targetType: data.targetType,
          targetId: data.targetId,
          targetName: data.targetName,
          organizationId: data.organizationId,
          timestamp: new Date(),
          metadata: data.metadata || {}
        }
      }

      // Activity model is available, proceed with normal database logging
      const activity = await (prisma as any).activity.create({
        data: {
          type: data.type,
          action: data.action,
          title: data.title,
          description: data.description,
          actorId: data.actorId,
          actorName: data.actorName,
          actorEmail: data.actorEmail,
          actorRole: data.actorRole,
          targetType: data.targetType,
          targetId: data.targetId,
          targetName: data.targetName,
          organizationId: data.organizationId,
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          campaignId: data.campaignId,
          showId: data.showId,
          episodeId: data.episodeId,
          timestamp: new Date()
        }
      })

      console.log(`📝 Activity logged: ${data.type}/${data.action} - ${data.title}`)
      return activity
    } catch (error) {
      console.error('❌ Failed to log activity:', error)
      // Enhanced error logging for debugging
      if (error instanceof Error) {
        console.error('  Error message:', error.message)
        console.error('  Error stack:', error.stack)
      }
      // Don't throw - activity logging should not break the app
      return null
    }
  }

  /**
   * Log campaign activity
   */
  async logCampaignActivity(
    campaign: any,
    action: string,
    actor: any,
    additionalData?: any
  ) {
    const actionDescriptions: Record<string, string> = {
      created: `created campaign "${campaign.name}"`,
      updated: `updated campaign "${campaign.name}"`,
      activated: `activated campaign "${campaign.name}"`,
      paused: `paused campaign "${campaign.name}"`,
      completed: `completed campaign "${campaign.name}"`,
      deleted: `deleted campaign "${campaign.name}"`
    }

    await this.logActivity({
      type: 'campaign',
      action,
      title: `Campaign ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: actionDescriptions[action] || `${action} campaign "${campaign.name}"`,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'campaign',
      targetId: campaign.id,
      targetName: campaign.name,
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      metadata: {
        budget: campaign.budget,
        status: campaign.status,
        advertiserId: campaign.advertiserId,
        ...additionalData
      }
    })
  }

  /**
   * Log show activity
   */
  async logShowActivity(
    show: any,
    action: string,
    actor: any,
    additionalData?: any
  ) {
    const actionDescriptions: Record<string, string> = {
      created: `added show "${show.name}" to the platform`,
      updated: `updated show "${show.name}" details`,
      activated: `activated show "${show.name}"`,
      deactivated: `deactivated show "${show.name}"`,
      deleted: `removed show "${show.name}"`
    }

    await this.logActivity({
      type: 'show',
      action,
      title: `Show ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: actionDescriptions[action] || `${action} show "${show.name}"`,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'show',
      targetId: show.id,
      targetName: show.name,
      organizationId: show.organizationId,
      showId: show.id,
      metadata: {
        category: show.category,
        host: show.host,
        isActive: show.isActive,
        ...additionalData
      }
    })
  }

  /**
   * Log episode activity
   */
  async logEpisodeActivity(
    episode: any,
    action: string,
    actor: any,
    showName?: string,
    additionalData?: any
  ) {
    const actionDescriptions: Record<string, string> = {
      created: `created episode "${episode.title}"${showName ? ` for show "${showName}"` : ''}`,
      updated: `updated episode "${episode.title}"`,
      published: `published episode "${episode.title}"`,
      scheduled: `scheduled episode "${episode.title}"`,
      deleted: `deleted episode "${episode.title}"`
    }

    await this.logActivity({
      type: 'episode',
      action,
      title: `Episode ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: actionDescriptions[action] || `${action} episode "${episode.title}"`,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'episode',
      targetId: episode.id,
      targetName: episode.title,
      organizationId: episode.organizationId,
      episodeId: episode.id,
      showId: episode.showId,
      metadata: {
        episodeNumber: episode.episodeNumber,
        duration: episode.duration,
        status: episode.status,
        airDate: episode.airDate,
        showName,
        ...additionalData
      }
    })
  }

  /**
   * Log user activity
   */
  async logUserActivity(
    targetUser: any,
    action: string,
    actor: any,
    additionalData?: any
  ) {
    const actionDescriptions: Record<string, string> = {
      created: `created user account for "${targetUser.name}"`,
      updated: `updated user "${targetUser.name}"`,
      activated: `activated user "${targetUser.name}"`,
      deactivated: `deactivated user "${targetUser.name}"`,
      deleted: `deleted user "${targetUser.name}"`,
      login: `logged into the system`,
      logout: `logged out of the system`,
      password_changed: `changed password`
    }

    await this.logActivity({
      type: 'user',
      action,
      title: `User ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: actionDescriptions[action] || `${action} user "${targetUser.name}"`,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'user',
      targetId: targetUser.id,
      targetName: targetUser.name,
      organizationId: targetUser.organizationId || actor.organizationId,
      metadata: {
        userRole: targetUser.role,
        userEmail: targetUser.email,
        ...additionalData
      }
    })
  }

  /**
   * Log financial activity
   */
  async logFinancialActivity(
    type: 'payment' | 'invoice' | 'refund',
    action: string,
    actor: any,
    targetData: any,
    organizationId: string
  ) {
    await this.logActivity({
      type: 'financial',
      action: `${type}_${action}`,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: targetData.description,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: type,
      targetId: targetData.id,
      targetName: targetData.name || targetData.number,
      organizationId,
      metadata: targetData.metadata
    })
  }

  /**
   * Get activities with filters
   */
  async getActivities(filter: ActivityFilter, limit: number = 50, offset: number = 0) {
    if (!this.isActivityModelAvailable()) {
      console.log('📝 Activities requested but Activity model not available, returning empty result')
      return { activities: [], total: 0 }
    }

    try {
      const where: any = {}

      if (filter.organizationId) where.organizationId = filter.organizationId
      if (filter.type) where.type = filter.type
      if (filter.action) where.action = filter.action
      if (filter.actorId) where.actorId = filter.actorId
      if (filter.targetType) where.targetType = filter.targetType
      if (filter.targetId) where.targetId = filter.targetId
      if (filter.campaignId) where.campaignId = filter.campaignId
      if (filter.showId) where.showId = filter.showId
      if (filter.episodeId) where.episodeId = filter.episodeId

      if (filter.startDate || filter.endDate) {
        where.timestamp = {}
        if (filter.startDate) where.timestamp.gte = filter.startDate
        if (filter.endDate) where.timestamp.lte = filter.endDate
      }

      const [activities, total] = await Promise.all([
        (prisma as any).activity.findMany({
          where,
          include: {
            actor: true,
            campaign: true,
            show: true,
            episode: {
              include: {
                show: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        (prisma as any).activity.count({ where })
      ])

      return { activities, total }
    } catch (error) {
      console.error('❌ Error fetching activities:', error)
      return { activities: [], total: 0 }
    }
  }

  /**
   * Get activity summary for an organization
   */
  async getActivitySummary(organizationId: string, days: number = 7) {
    if (!this.isActivityModelAvailable()) {
      console.log('📝 Activity summary requested but Activity model not available, returning empty result')
      return {
        summary: {},
        totalActivities: 0,
        recentActivity: null,
        periodDays: days,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString()
      }
    }

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const activities = await (prisma as any).activity.groupBy({
        by: ['type', 'action'],
        where: {
          organizationId,
          timestamp: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      })

      const summary = activities.reduce((acc: any, item: any) => {
        if (!acc[item.type]) acc[item.type] = {}
        acc[item.type][item.action] = item._count.id
        return acc
      }, {} as Record<string, Record<string, number>>)

      const recentActivity = await (prisma as any).activity.findFirst({
        where: { organizationId },
        orderBy: { timestamp: 'desc' },
        include: { actor: true }
      })

      const totalActivities = await (prisma as any).activity.count({
        where: {
          organizationId,
          timestamp: { gte: startDate }
        }
      })

      return {
        summary,
        totalActivities,
        recentActivity,
        periodDays: days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Error fetching activity summary:', error)
      return {
        summary: {},
        totalActivities: 0,
        recentActivity: null,
        periodDays: days,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString()
      }
    }
  }

  /**
   * Clean up old activities
   */
  async cleanupOldActivities(retentionDays: number = 90) {
    if (!this.isActivityModelAvailable()) {
      console.log('📝 Activity cleanup requested but Activity model not available, no action taken')
      return 0
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const deleted = await (prisma as any).activity.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      })

      console.log(`🗑️ Cleaned up ${deleted.count} activities older than ${retentionDays} days`)
      return deleted.count
    } catch (error) {
      console.error('❌ Error cleaning up activities:', error)
      return 0
    }
  }
}

export const activityService = new ActivityService()