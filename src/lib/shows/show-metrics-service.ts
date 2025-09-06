import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface ShowMetricsUpdate {
  showId: string
  totalSubscribers?: number
  newSubscribers?: number
  lostSubscribers?: number
  totalDownloads?: number
  monthlyDownloads?: number
  averageListeners?: number
  averageCompletion?: number
  spotifyListeners?: number
  appleListeners?: number
  googleListeners?: number
  otherListeners?: number
  demographics?: any
}

export interface ShowMetricsSummary {
  showId: string
  showName: string
  totalSubscribers: number
  subscriberGrowth: number
  monthlyDownloads: number
  averageListeners: number
  totalRevenue: number
  monthlyRevenue: number
}

export class ShowMetricsService {
  /**
   * Get or create metrics for a show
   */
  async getOrCreateMetrics(showId: string, organizationId: string) {
    let metrics = await prisma.showMetrics.findUnique({
      where: { showId }
    })

    if (!metrics) {
      // Get show details for initial metrics
      const show = await prisma.show.findUnique({
        where: { id: showId },
        include: {
          episodes: {
            where: { status: 'published' }
          }
        }
      })

      if (!show) {
        throw new Error('Show not found')
      }

      metrics = await prisma.showMetrics.create({
        data: {
          showId,
          organizationId,
          totalEpisodes: show.episodes.length,
          publishedEpisodes: show.episodes.length,
          averageEpisodeLength: show.episodes.length > 0
            ? Math.round(
                show.episodes.reduce((sum, ep) => sum + (ep.duration || 0), 0) / 
                show.episodes.length
              )
            : 0
        }
      })
    }

    return metrics
  }

  /**
   * Update show metrics
   */
  async updateMetrics(update: ShowMetricsUpdate) {
    const { showId, ...data } = update

    // Get current metrics
    const currentMetrics = await prisma.showMetrics.findUnique({
      where: { showId }
    })

    if (!currentMetrics) {
      throw new Error('Show metrics not found')
    }

    // Calculate subscriber growth if subscribers changed
    let subscriberGrowth = currentMetrics.subscriberGrowth
    if (data.totalSubscribers !== undefined && currentMetrics.totalSubscribers > 0) {
      subscriberGrowth = ((data.totalSubscribers - currentMetrics.totalSubscribers) / currentMetrics.totalSubscribers) * 100
    }

    // Update metrics
    const updatedMetrics = await prisma.showMetrics.update({
      where: { showId },
      data: {
        ...data,
        subscriberGrowth,
        lastUpdated: new Date()
      }
    })

    // Record subscriber history if subscribers changed
    if (data.totalSubscribers !== undefined && data.totalSubscribers !== currentMetrics.totalSubscribers) {
      await this.recordSubscriberHistory(showId, data.totalSubscribers)
    }

    return updatedMetrics
  }

  /**
   * Record subscriber history
   */
  async recordSubscriberHistory(showId: string, subscribers: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get previous records for comparison
    const [yesterday, weekAgo, monthAgo] = await Promise.all([
      this.getHistoryRecord(showId, 1),
      this.getHistoryRecord(showId, 7),
      this.getHistoryRecord(showId, 30)
    ])

    const dailyChange = yesterday ? subscribers - yesterday.subscribers : 0
    const weeklyChange = weekAgo ? subscribers - weekAgo.subscribers : 0
    const monthlyChange = monthAgo ? subscribers - monthAgo.subscribers : 0

    const growthRate = yesterday && yesterday.subscribers > 0
      ? ((subscribers - yesterday.subscribers) / yesterday.subscribers) * 100
      : 0

    const churnRate = yesterday && dailyChange < 0
      ? Math.abs(dailyChange / yesterday.subscribers) * 100
      : 0

    // Create or update today's record
    await prisma.showSubscriberHistory.upsert({
      where: {
        showId_date: {
          showId,
          date: today
        }
      },
      update: {
        subscribers,
        dailyChange,
        weeklyChange,
        monthlyChange,
        growthRate,
        churnRate
      },
      create: {
        showId,
        date: today,
        subscribers,
        dailyChange,
        weeklyChange,
        monthlyChange,
        growthRate,
        churnRate
      }
    })
  }

  /**
   * Get historical record from N days ago
   */
  private async getHistoryRecord(showId: string, daysAgo: number) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    date.setHours(0, 0, 0, 0)

    return await prisma.showSubscriberHistory.findFirst({
      where: {
        showId,
        date: {
          gte: date,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })
  }

  /**
   * Get show metrics with calculated values
   */
  async getShowMetrics(showId: string) {
    const metrics = await prisma.showMetrics.findUnique({
      where: { showId }
    })

    if (!metrics) {
      return null
    }

    // Calculate revenue from campaigns that might be related to this show
    // Note: There's no direct relationship between Campaign and Show in the current schema
    // We'll return basic metrics for now and add revenue calculation when the relationship exists
    const totalRevenue = 0
    const monthlyRevenue = 0

    return {
      ...metrics,
      totalRevenue,
      monthlyRevenue
    }
  }

  /**
   * Get subscriber history for a show
   */
  async getSubscriberHistory(showId: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const history = await prisma.showSubscriberHistory.findMany({
      where: {
        showId,
        date: {
          gte: startDate
        }
      },
      orderBy: { date: 'asc' }
    })

    return history
  }

  /**
   * Get metrics summary for multiple shows
   */
  async getShowsMetricsSummary(organizationId: string): Promise<ShowMetricsSummary[]> {
    const shows = await prisma.show.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        metrics: true
      }
    })

    return shows.map(show => ({
      showId: show.id,
      showName: show.name,
      totalSubscribers: show.metrics?.totalSubscribers || 0,
      subscriberGrowth: show.metrics?.subscriberGrowth || 0,
      monthlyDownloads: show.metrics?.monthlyDownloads || 0,
      averageListeners: show.metrics?.averageListeners || 0,
      totalRevenue: show.metrics?.totalRevenue || 0,
      monthlyRevenue: show.metrics?.monthlyRevenue || 0
    }))
  }

  /**
   * Update metrics from external platform APIs
   */
  async syncPlatformMetrics(showId: string, platform: 'spotify' | 'apple' | 'google', data: any) {
    const update: Partial<ShowMetricsUpdate> = {}

    switch (platform) {
      case 'spotify':
        update.spotifyListeners = data.listeners || 0
        break
      case 'apple':
        update.appleListeners = data.listeners || 0
        break
      case 'google':
        update.googleListeners = data.listeners || 0
        break
    }

    if (data.downloads) {
      update.monthlyDownloads = data.downloads
    }

    return await this.updateMetrics({ showId, ...update })
  }

  /**
   * Calculate and update revenue metrics
   */
  async updateRevenueMetrics(showId: string) {
    // Note: There's no direct relationship between Campaign and Show in the current schema
    // For now, we'll set revenue metrics to 0 until the relationship is properly established
    const totalRevenue = 0
    const monthlyRevenue = 0
    const averageCPM = 0

    await this.updateMetrics({
      showId,
      totalRevenue,
      monthlyRevenue,
      averageCPM
    })
  }
}

export const showMetricsService = new ShowMetricsService()