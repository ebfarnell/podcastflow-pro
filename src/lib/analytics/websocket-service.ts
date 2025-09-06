/**
 * WebSocket service for real-time analytics updates
 * Note: This is a simplified implementation for Server-Sent Events (SSE)
 * since Next.js doesn't natively support WebSockets in API routes
 */

export interface AnalyticsSubscription {
  id: string
  organizationId: string
  campaignIds?: string[]
  lastUpdate: Date
  active: boolean
}

export interface AnalyticsUpdate {
  type: 'metrics' | 'event' | 'status'
  data: any
  timestamp: Date
  organizationId: string
  campaignId?: string
}

/**
 * Real-time analytics notification service
 */
export class AnalyticsWebSocketService {
  private subscriptions: Map<string, AnalyticsSubscription> = new Map()
  private updateQueue: Map<string, AnalyticsUpdate[]> = new Map()
  private maxQueueSize = 100

  /**
   * Subscribe to real-time analytics updates
   */
  subscribe(subscriptionId: string, organizationId: string, campaignIds?: string[]): AnalyticsSubscription {
    const subscription: AnalyticsSubscription = {
      id: subscriptionId,
      organizationId,
      campaignIds,
      lastUpdate: new Date(),
      active: true
    }

    this.subscriptions.set(subscriptionId, subscription)
    
    // Initialize update queue
    if (!this.updateQueue.has(subscriptionId)) {
      this.updateQueue.set(subscriptionId, [])
    }

    console.log('📡 Analytics subscription created:', {
      subscriptionId,
      organizationId,
      campaignIds: campaignIds?.length || 'all'
    })

    return subscription
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId)
    if (subscription) {
      subscription.active = false
      this.subscriptions.delete(subscriptionId)
      this.updateQueue.delete(subscriptionId)

      console.log('📡 Analytics subscription removed:', subscriptionId)
    }
  }

  /**
   * Broadcast analytics update to subscribers
   */
  broadcastUpdate(update: AnalyticsUpdate): void {
    console.log('📡 Broadcasting analytics update:', {
      type: update.type,
      organizationId: update.organizationId,
      campaignId: update.campaignId
    })

    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (!subscription.active) {
        continue
      }

      // Check if update matches subscription
      if (subscription.organizationId !== update.organizationId) {
        continue
      }

      if (subscription.campaignIds && update.campaignId) {
        if (!subscription.campaignIds.includes(update.campaignId)) {
          continue
        }
      }

      // Add to queue
      const queue = this.updateQueue.get(subscriptionId) || []
      queue.push(update)

      // Limit queue size
      if (queue.length > this.maxQueueSize) {
        queue.shift() // Remove oldest update
      }

      this.updateQueue.set(subscriptionId, queue)
      subscription.lastUpdate = new Date()
    }
  }

  /**
   * Get pending updates for a subscription
   */
  getPendingUpdates(subscriptionId: string): AnalyticsUpdate[] {
    const updates = this.updateQueue.get(subscriptionId) || []
    
    // Clear the queue after retrieval
    this.updateQueue.set(subscriptionId, [])
    
    return updates
  }

  /**
   * Get subscription info
   */
  getSubscription(subscriptionId: string): AnalyticsSubscription | null {
    return this.subscriptions.get(subscriptionId) || null
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): AnalyticsSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active)
  }

  /**
   * Clean up inactive subscriptions
   */
  cleanup(): void {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes

    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (subscription.lastUpdate < cutoffTime) {
        console.log('🧹 Cleaning up inactive subscription:', subscriptionId)
        this.unsubscribe(subscriptionId)
      }
    }
  }

  /**
   * Generate analytics event update
   */
  notifyAnalyticsEvent(eventType: string, campaignId: string, organizationId: string, metadata?: any): void {
    const update: AnalyticsUpdate = {
      type: 'event',
      data: {
        eventType,
        campaignId,
        metadata,
        count: 1
      },
      timestamp: new Date(),
      organizationId,
      campaignId
    }

    this.broadcastUpdate(update)
  }

  /**
   * Generate metrics update
   */
  notifyMetricsUpdate(campaignId: string, organizationId: string, metrics: any): void {
    const update: AnalyticsUpdate = {
      type: 'metrics',
      data: {
        campaignId,
        metrics
      },
      timestamp: new Date(),
      organizationId,
      campaignId
    }

    this.broadcastUpdate(update)
  }

  /**
   * Generate status update
   */
  notifyStatusUpdate(organizationId: string, status: any): void {
    const update: AnalyticsUpdate = {
      type: 'status',
      data: status,
      timestamp: new Date(),
      organizationId
    }

    this.broadcastUpdate(update)
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    const activeSubscriptions = this.getActiveSubscriptions()
    const totalQueuedUpdates = Array.from(this.updateQueue.values())
      .reduce((sum, queue) => sum + queue.length, 0)

    return {
      activeSubscriptions: activeSubscriptions.length,
      totalQueuedUpdates,
      subscriptionsByOrganization: activeSubscriptions.reduce((acc, sub) => {
        acc[sub.organizationId] = (acc[sub.organizationId] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }
}

// Export singleton instance
export const analyticsWebSocket = new AnalyticsWebSocketService()

// Start cleanup interval
setInterval(() => {
  analyticsWebSocket.cleanup()
}, 60000) // Every minute