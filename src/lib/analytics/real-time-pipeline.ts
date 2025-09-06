import prisma from '@/lib/db/prisma'
import { analyticsWebSocket } from './websocket-service'

/**
 * Real-time analytics data structure
 */
export interface AnalyticsEvent {
  eventType: 'impression' | 'click' | 'conversion' | 'view' | 'engagement' | 'completion' | 'skip'
  campaignId: string
  organizationId: string
  timestamp: Date
  metadata?: {
    adSlotId?: string
    episodeId?: string
    showId?: string
    userAgent?: string
    ipAddress?: string
    sessionId?: string
    referrer?: string
    deviceType?: string
    location?: string
    duration?: number
    position?: number
  }
  value?: number // For revenue/cost tracking
}

/**
 * Aggregated metrics for real-time display
 */
export interface RealTimeMetrics {
  campaignId: string
  timestamp: Date
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  conversionRate: number
  totalSpent: number
  cpc: number
  cpa: number
  engagementRate: number
  averageViewTime: number
  bounceRate: number
  adPlaybacks: number
  completionRate: number
  skipRate: number
}

/**
 * Real-time analytics pipeline for campaign tracking
 */
export class RealTimeAnalyticsPipeline {
  private eventBuffer: AnalyticsEvent[] = []
  private bufferSize = 100
  private flushInterval = 5000 // 5 seconds
  private isProcessing = false

  constructor() {
    // Start the processing loop
    this.startProcessingLoop()
  }

  /**
   * Ingest a single analytics event
   */
  async ingestEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Validate event
      if (!this.validateEvent(event)) {
        console.error('❌ Invalid analytics event:', event)
        return
      }

      // Add to buffer
      this.eventBuffer.push({
        ...event,
        timestamp: event.timestamp || new Date()
      })

      console.log('📊 Analytics event ingested:', {
        eventType: event.eventType,
        campaignId: event.campaignId,
        bufferSize: this.eventBuffer.length
      })

      // Notify real-time subscribers
      analyticsWebSocket.notifyAnalyticsEvent(
        event.eventType,
        event.campaignId,
        event.organizationId,
        event.metadata
      )

      // Flush if buffer is full
      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushBuffer()
      }

    } catch (error) {
      console.error('❌ Error ingesting analytics event:', error)
    }
  }

  /**
   * Ingest multiple analytics events
   */
  async ingestBatch(events: AnalyticsEvent[]): Promise<void> {
    try {
      console.log('📊 Ingesting analytics batch:', events.length, 'events')

      for (const event of events) {
        await this.ingestEvent(event)
      }

      // Force flush after batch
      await this.flushBuffer()

    } catch (error) {
      console.error('❌ Error ingesting analytics batch:', error)
    }
  }

  /**
   * Get real-time metrics for a campaign
   */
  async getRealTimeMetrics(campaignId: string, timeWindow: number = 3600): Promise<RealTimeMetrics | null> {
    try {
      const startTime = new Date(Date.now() - timeWindow * 1000)

      // Get analytics from the last time window
      const analytics = await prisma.campaignAnalytics.findMany({
        where: {
          campaignId,
          date: {
            gte: startTime
          }
        },
        orderBy: { date: 'desc' }
      })

      if (analytics.length === 0) {
        return null
      }

      // Aggregate metrics
      const totals = analytics.reduce((acc, record) => ({
        impressions: acc.impressions + record.impressions,
        clicks: acc.clicks + record.clicks,
        conversions: acc.conversions + record.conversions,
        spent: acc.spent + record.spent,
        adPlaybacks: acc.adPlaybacks + record.adPlaybacks,
        averageViewTime: acc.averageViewTime + record.averageViewTime,
        bounceRate: acc.bounceRate + record.bounceRate,
        completionRate: acc.completionRate + record.completionRate,
        skipRate: acc.skipRate + record.skipRate,
        engagementRate: acc.engagementRate + record.engagementRate
      }), {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spent: 0,
        adPlaybacks: 0,
        averageViewTime: 0,
        bounceRate: 0,
        completionRate: 0,
        skipRate: 0,
        engagementRate: 0
      })

      const recordCount = analytics.length

      return {
        campaignId,
        timestamp: new Date(),
        impressions: totals.impressions,
        clicks: totals.clicks,
        conversions: totals.conversions,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
        totalSpent: totals.spent,
        cpc: totals.clicks > 0 ? totals.spent / totals.clicks : 0,
        cpa: totals.conversions > 0 ? totals.spent / totals.conversions : 0,
        engagementRate: recordCount > 0 ? totals.engagementRate / recordCount : 0,
        averageViewTime: recordCount > 0 ? totals.averageViewTime / recordCount : 0,
        bounceRate: recordCount > 0 ? totals.bounceRate / recordCount : 0,
        adPlaybacks: totals.adPlaybacks,
        completionRate: recordCount > 0 ? totals.completionRate / recordCount : 0,
        skipRate: recordCount > 0 ? totals.skipRate / recordCount : 0
      }

    } catch (error) {
      console.error('❌ Error getting real-time metrics:', error)
      return null
    }
  }

  /**
   * Get aggregated metrics for multiple campaigns
   */
  async getOrganizationMetrics(organizationId: string, timeWindow: number = 3600): Promise<RealTimeMetrics[]> {
    try {
      const startTime = new Date(Date.now() - timeWindow * 1000)

      // Get all campaigns for the organization
      const campaigns = await prisma.campaign.findMany({
        where: { organizationId },
        select: { id: true }
      })

      const campaignIds = campaigns.map(c => c.id)

      if (campaignIds.length === 0) {
        return []
      }

      // Get metrics for all campaigns
      const metrics = await Promise.all(
        campaignIds.map(campaignId => this.getRealTimeMetrics(campaignId, timeWindow))
      )

      return metrics.filter(m => m !== null) as RealTimeMetrics[]

    } catch (error) {
      console.error('❌ Error getting organization metrics:', error)
      return []
    }
  }

  /**
   * Process events and update database
   */
  private async flushBuffer(): Promise<void> {
    if (this.isProcessing || this.eventBuffer.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const eventsToProcess = [...this.eventBuffer]
      this.eventBuffer = []

      console.log('🔄 Processing analytics events:', eventsToProcess.length)

      // Group events by campaign and date
      const groupedEvents = this.groupEventsByDate(eventsToProcess)

      // Process each group
      for (const [key, events] of Object.entries(groupedEvents)) {
        const [campaignId, dateStr] = key.split('|')
        const date = new Date(dateStr)

        await this.updateCampaignAnalytics(campaignId, date, events)
      }

      console.log('✅ Analytics events processed successfully')

    } catch (error) {
      console.error('❌ Error processing analytics events:', error)
      // Re-add events to buffer on error
      this.eventBuffer.unshift(...this.eventBuffer)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Group events by campaign and date
   */
  private groupEventsByDate(events: AnalyticsEvent[]): Record<string, AnalyticsEvent[]> {
    return events.reduce((groups, event) => {
      const dateStr = event.timestamp.toISOString().split('T')[0] // YYYY-MM-DD
      const key = `${event.campaignId}|${dateStr}`

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(event)

      return groups
    }, {} as Record<string, AnalyticsEvent[]>)
  }

  /**
   * Update campaign analytics in database
   */
  private async updateCampaignAnalytics(campaignId: string, date: Date, events: AnalyticsEvent[]): Promise<void> {
    try {
      // Calculate aggregated metrics from events
      const metrics = this.calculateMetrics(events)

      // Get campaign info
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { organizationId: true }
      })

      if (!campaign) {
        console.error('❌ Campaign not found:', campaignId)
        return
      }

      // Upsert analytics record
      await prisma.campaignAnalytics.upsert({
        where: {
          campaignId_date: {
            campaignId,
            date
          }
        },
        create: {
          campaignId,
          organizationId: campaign.organizationId,
          date,
          ...metrics
        },
        update: {
          impressions: { increment: metrics.impressions },
          clicks: { increment: metrics.clicks },
          conversions: { increment: metrics.conversions },
          spent: { increment: metrics.spent },
          adPlaybacks: { increment: metrics.adPlaybacks },
          // Recalculate averages
          ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
          conversionRate: metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0,
          cpc: metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0,
          cpa: metrics.conversions > 0 ? metrics.spent / metrics.conversions : 0,
          engagementRate: metrics.engagementRate,
          averageViewTime: metrics.averageViewTime,
          bounceRate: metrics.bounceRate,
          completionRate: metrics.completionRate,
          skipRate: metrics.skipRate,
          updatedAt: new Date()
        }
      })

      console.log('✅ Campaign analytics updated:', {
        campaignId,
        date: date.toISOString().split('T')[0],
        events: events.length,
        metrics
      })

      // Notify real-time subscribers with updated metrics
      analyticsWebSocket.notifyMetricsUpdate(campaignId, campaign.organizationId, metrics)

    } catch (error) {
      console.error('❌ Error updating campaign analytics:', error)
    }
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(events: AnalyticsEvent[]): Partial<RealTimeMetrics> {
    const impressions = events.filter(e => e.eventType === 'impression').length
    const clicks = events.filter(e => e.eventType === 'click').length
    const conversions = events.filter(e => e.eventType === 'conversion').length
    const views = events.filter(e => e.eventType === 'view').length
    const engagements = events.filter(e => e.eventType === 'engagement').length
    const completions = events.filter(e => e.eventType === 'completion').length
    const skips = events.filter(e => e.eventType === 'skip').length

    // Calculate averages
    const viewTimes = events
      .filter(e => e.eventType === 'view' && e.metadata?.duration)
      .map(e => e.metadata!.duration!)

    const averageViewTime = viewTimes.length > 0 
      ? viewTimes.reduce((sum, time) => sum + time, 0) / viewTimes.length 
      : 0

    const spent = events
      .filter(e => e.value && e.value > 0)
      .reduce((sum, e) => sum + (e.value || 0), 0)

    return {
      impressions,
      clicks,
      conversions,
      spent,
      adPlaybacks: views,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      cpc: clicks > 0 ? spent / clicks : 0,
      cpa: conversions > 0 ? spent / conversions : 0,
      engagementRate: views > 0 ? (engagements / views) * 100 : 0,
      averageViewTime,
      bounceRate: views > 0 ? (skips / views) * 100 : 0,
      completionRate: views > 0 ? (completions / views) * 100 : 0,
      skipRate: views > 0 ? (skips / views) * 100 : 0
    }
  }

  /**
   * Validate analytics event
   */
  private validateEvent(event: AnalyticsEvent): boolean {
    if (!event.eventType || !event.campaignId || !event.organizationId) {
      return false
    }

    const validEventTypes = ['impression', 'click', 'conversion', 'view', 'engagement', 'completion', 'skip']
    if (!validEventTypes.includes(event.eventType)) {
      return false
    }

    return true
  }

  /**
   * Start the processing loop
   */
  private startProcessingLoop(): void {
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushBuffer()
      }
    }, this.flushInterval)

    console.log('🚀 Real-time analytics pipeline started')
  }

  /**
   * Get pipeline status
   */
  getStatus(): any {
    return {
      bufferSize: this.eventBuffer.length,
      isProcessing: this.isProcessing,
      lastFlush: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const realTimeAnalytics = new RealTimeAnalyticsPipeline()