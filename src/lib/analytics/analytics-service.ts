import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { addDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

export interface AnalyticsEventData {
  eventType: 'download' | 'stream' | 'listen_start' | 'listen_complete' | 'rating' | 'share'
  episodeId?: string
  showId?: string
  userId?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  referer?: string
  country?: string
  region?: string
  platform?: string
}

export interface EpisodeAnalyticsUpdate {
  episodeId: string
  downloads?: number
  streams?: number
  uniqueListeners?: number
  completions?: number
  avgListenDuration?: number
  platformBreakdown?: Record<string, number>
  countryBreakdown?: Record<string, number>
}

export interface ShowAnalyticsData {
  showId: string
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly'
  periodStart: Date
  downloads: number
  streams: number
  uniqueListeners: number
  avgRating: number
  totalRevenue: number
  adRevenue: number
  subscriptionRevenue: number
  topEpisodes: string[]
  audienceGrowth: number
}

export interface RatingData {
  episodeId: string
  userId: string
  rating: number
  review?: string
}

class AnalyticsService {
  // Track analytics event
  async trackEvent(data: AnalyticsEventData): Promise<void> {
    try {
      // Create analytics event record
      await prisma.analyticsEvent.create({
        data: {
          eventType: data.eventType,
          episodeId: data.episodeId,
          showId: data.showId,
          userId: data.userId,
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          referer: data.referer,
          country: data.country,
          region: data.region,
          platform: data.platform,
          timestamp: new Date()
        }
      })

      // Update episode analytics based on event type
      if (data.episodeId) {
        await this.updateEpisodeAnalytics(data.episodeId, data.eventType, data)
      }

      // Update show analytics if show ID is provided
      if (data.showId) {
        await this.updateShowAnalyticsAsync(data.showId)
      }
    } catch (error) {
      console.error('Error tracking analytics event:', error)
      throw error
    }
  }

  // Update episode analytics based on event
  private async updateEpisodeAnalytics(
    episodeId: string, 
    eventType: string, 
    data: AnalyticsEventData
  ): Promise<void> {
    const analytics = await prisma.episodeAnalytics.findUnique({
      where: { episodeId }
    })

    if (!analytics) {
      // Create initial analytics record
      await prisma.episodeAnalytics.create({
        data: {
          episodeId,
          downloads: eventType === 'download' ? 1 : 0,
          streams: eventType === 'stream' ? 1 : 0,
          uniqueListeners: ['download', 'stream', 'listen_start'].includes(eventType) ? 1 : 0,
          completions: eventType === 'listen_complete' ? 1 : 0,
          platformBreakdown: data.platform ? { [data.platform]: 1 } : {},
          countryBreakdown: data.country ? { [data.country]: 1 } : {}
        }
      })
    } else {
      // Update existing analytics
      const updates: Prisma.EpisodeAnalyticsUpdateInput = {}

      switch (eventType) {
        case 'download':
          updates.downloads = { increment: 1 }
          break
        case 'stream':
          updates.streams = { increment: 1 }
          break
        case 'listen_complete':
          updates.completions = { increment: 1 }
          break
      }

      // Update platform breakdown
      if (data.platform) {
        const platformBreakdown = analytics.platformBreakdown as Record<string, number> || {}
        platformBreakdown[data.platform] = (platformBreakdown[data.platform] || 0) + 1
        updates.platformBreakdown = platformBreakdown
      }

      // Update country breakdown
      if (data.country) {
        const countryBreakdown = analytics.countryBreakdown as Record<string, number> || {}
        countryBreakdown[data.country] = (countryBreakdown[data.country] || 0) + 1
        updates.countryBreakdown = countryBreakdown
      }

      // Update unique listeners (simplified - in production, use better deduplication)
      if (['download', 'stream', 'listen_start'].includes(eventType)) {
        const recentEvents = await prisma.analyticsEvent.count({
          where: {
            episodeId,
            eventType: { in: ['download', 'stream', 'listen_start'] },
            userId: data.userId,
            timestamp: { gte: addDays(new Date(), -1) }
          }
        })
        
        if (recentEvents === 1) {
          updates.uniqueListeners = { increment: 1 }
        }
      }

      await prisma.episodeAnalytics.update({
        where: { episodeId },
        data: updates
      })
    }
  }

  // Add or update episode rating
  async addRating(data: RatingData): Promise<void> {
    try {
      // Create or update rating
      await prisma.episodeRating.upsert({
        where: {
          episodeId_userId: {
            episodeId: data.episodeId,
            userId: data.userId
          }
        },
        update: {
          rating: data.rating,
          review: data.review,
          updatedAt: new Date()
        },
        create: {
          episodeId: data.episodeId,
          userId: data.userId,
          rating: data.rating,
          review: data.review
        }
      })

      // Update average rating in episode analytics
      const avgRating = await prisma.episodeRating.aggregate({
        where: { episodeId: data.episodeId },
        _avg: { rating: true }
      })

      await prisma.episodeAnalytics.update({
        where: { episodeId: data.episodeId },
        data: { avgRating: avgRating._avg.rating || 0 }
      })

      // Track rating event
      await this.trackEvent({
        eventType: 'rating',
        episodeId: data.episodeId,
        userId: data.userId,
        metadata: { rating: data.rating }
      })
    } catch (error) {
      console.error('Error adding rating:', error)
      throw error
    }
  }

  // Get episode analytics
  async getEpisodeAnalytics(episodeId: string) {
    const analytics = await prisma.episodeAnalytics.findUnique({
      where: { episodeId },
      include: {
        episode: {
          include: {
            show: true
          }
        }
      }
    })

    if (!analytics) {
      return {
        downloads: 0,
        streams: 0,
        totalListens: 0,
        uniqueListeners: 0,
        completions: 0,
        completionRate: 0,
        avgRating: 0,
        totalRatings: 0,
        platformBreakdown: {},
        countryBreakdown: {}
      }
    }

    const totalRatings = await prisma.episodeRating.count({
      where: { episodeId }
    })

    const totalListens = analytics.downloads + analytics.streams
    const completionRate = totalListens > 0 ? (analytics.completions / totalListens) * 100 : 0

    return {
      ...analytics,
      totalListens,
      completionRate,
      totalRatings
    }
  }

  // Get show analytics for a period
  async getShowAnalytics(showId: string, periodType: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate?: Date) {
    const now = new Date()
    const periodStart = startDate || this.getPeriodStart(now, periodType)
    
    // Get or create show analytics for the period
    const analytics = await prisma.showAnalytics.findFirst({
      where: {
        showId,
        periodType,
        periodStart: {
          gte: startOfDay(periodStart),
          lt: endOfDay(periodStart)
        }
      }
    })

    if (!analytics) {
      // Calculate analytics for the period
      return await this.calculateShowAnalytics(showId, periodType, periodStart)
    }

    return analytics
  }

  // Calculate show analytics for a period
  private async calculateShowAnalytics(
    showId: string, 
    periodType: 'daily' | 'weekly' | 'monthly' | 'yearly',
    periodStart: Date
  ): Promise<ShowAnalyticsData> {
    const periodEnd = this.getPeriodEnd(periodStart, periodType)

    // Get all episodes for the show
    const episodes = await prisma.episode.findMany({
      where: { showId },
      include: { analytics: true }
    })

    // Aggregate analytics from episodes
    let downloads = 0
    let streams = 0
    let uniqueListeners = 0
    let totalRatings = 0
    let sumRatings = 0

    for (const episode of episodes) {
      if (episode.analytics) {
        downloads += episode.analytics.downloads
        streams += episode.analytics.streams
        uniqueListeners += episode.analytics.uniqueListeners
        
        if (episode.analytics.avgRating > 0) {
          const episodeRatings = await prisma.episodeRating.count({
            where: { episodeId: episode.id }
          })
          totalRatings += episodeRatings
          sumRatings += episode.analytics.avgRating * episodeRatings
        }
      }
    }

    const avgRating = totalRatings > 0 ? sumRatings / totalRatings : 0

    // Get revenue data (simplified - in production, integrate with payment system)
    const adRevenue = await this.calculateAdRevenue(showId, periodStart, periodEnd)
    const totalRevenue = adRevenue // Add subscription revenue when implemented

    // Get top episodes
    const topEpisodes = episodes
      .filter(ep => ep.analytics)
      .sort((a, b) => {
        const aTotal = (a.analytics?.downloads || 0) + (a.analytics?.streams || 0)
        const bTotal = (b.analytics?.downloads || 0) + (b.analytics?.streams || 0)
        return bTotal - aTotal
      })
      .slice(0, 5)
      .map(ep => ep.id)

    // Calculate audience growth (simplified)
    const previousPeriodStart = this.getPreviousPeriodStart(periodStart, periodType)
    const previousAnalytics = await prisma.showAnalytics.findFirst({
      where: {
        showId,
        periodType,
        periodStart: {
          gte: startOfDay(previousPeriodStart),
          lt: endOfDay(previousPeriodStart)
        }
      }
    })

    const audienceGrowth = previousAnalytics 
      ? ((uniqueListeners - previousAnalytics.uniqueListeners) / previousAnalytics.uniqueListeners) * 100
      : 0

    const analyticsData: ShowAnalyticsData = {
      showId,
      periodType,
      periodStart,
      downloads,
      streams,
      uniqueListeners,
      avgRating,
      totalRevenue,
      adRevenue,
      subscriptionRevenue: 0,
      topEpisodes,
      audienceGrowth
    }

    // Store calculated analytics
    await prisma.showAnalytics.create({
      data: analyticsData
    })

    return analyticsData
  }

  // Calculate ad revenue for a period
  private async calculateAdRevenue(showId: string, startDate: Date, endDate: Date): Promise<number> {
    // Get all ad spots for the show's episodes
    const adSpots = await prisma.adSpot.findMany({
      where: {
        episode: {
          showId,
          airDate: {
            gte: startDate,
            lt: endDate
          }
        },
        status: 'aired'
      },
      include: {
        campaign: true
      }
    })

    // Calculate revenue based on CPM and actual impressions
    let totalRevenue = 0
    for (const spot of adSpots) {
      if (spot.campaign && spot.actualImpressions) {
        const cpm = spot.campaign.cpm || 25 // Default CPM if not set
        totalRevenue += (spot.actualImpressions / 1000) * cpm
      }
    }

    return totalRevenue
  }

  // Update show analytics asynchronously
  private async updateShowAnalyticsAsync(showId: string): Promise<void> {
    // This would typically be handled by a background job
    // For now, we'll just mark it for update
    setTimeout(async () => {
      try {
        await this.calculateShowAnalytics(showId, 'daily', new Date())
      } catch (error) {
        console.error('Error updating show analytics:', error)
      }
    }, 1000)
  }

  // Get analytics trends
  async getAnalyticsTrends(
    showId: string,
    metric: 'downloads' | 'streams' | 'listeners' | 'revenue',
    periodType: 'daily' | 'weekly' | 'monthly',
    periods: number = 7
  ) {
    const trends = []
    const now = new Date()

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = this.getPeriodStartOffset(now, periodType, -i)
      const analytics = await this.getShowAnalytics(showId, periodType, periodStart)
      
      trends.push({
        period: periodStart,
        value: analytics[metric] || 0
      })
    }

    return trends
  }

  // Helper methods for period calculations
  private getPeriodStart(date: Date, periodType: string): Date {
    switch (periodType) {
      case 'daily':
        return startOfDay(date)
      case 'weekly':
        return startOfWeek(date)
      case 'monthly':
        return startOfMonth(date)
      case 'yearly':
        return startOfYear(date)
      default:
        return startOfDay(date)
    }
  }

  private getPeriodEnd(start: Date, periodType: string): Date {
    switch (periodType) {
      case 'daily':
        return addDays(start, 1)
      case 'weekly':
        return addDays(start, 7)
      case 'monthly':
        return addDays(start, 30)
      case 'yearly':
        return addDays(start, 365)
      default:
        return addDays(start, 1)
    }
  }

  private getPreviousPeriodStart(date: Date, periodType: string): Date {
    switch (periodType) {
      case 'daily':
        return addDays(date, -1)
      case 'weekly':
        return addDays(date, -7)
      case 'monthly':
        return addDays(date, -30)
      case 'yearly':
        return addDays(date, -365)
      default:
        return addDays(date, -1)
    }
  }

  private getPeriodStartOffset(date: Date, periodType: string, offset: number): Date {
    const start = this.getPeriodStart(date, periodType)
    switch (periodType) {
      case 'daily':
        return addDays(start, offset)
      case 'weekly':
        return addDays(start, offset * 7)
      case 'monthly':
        return addDays(start, offset * 30)
      default:
        return addDays(start, offset)
    }
  }
}

export const analyticsService = new AnalyticsService()