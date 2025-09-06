import { realTimeAnalytics, AnalyticsEvent } from './real-time-pipeline'

/**
 * Analytics event simulator for testing and demonstration
 * Generates realistic campaign analytics events
 */
export class AnalyticsEventSimulator {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  /**
   * Start simulating events for campaigns
   */
  async startSimulation(campaignIds: string[], organizationId: string, options: {
    eventsPerMinute?: number
    duration?: number // minutes
    impressionRate?: number
    clickRate?: number
    conversionRate?: number
  } = {}): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Simulation already running')
      return
    }

    const {
      eventsPerMinute = 60,
      duration = 60, // 1 hour
      impressionRate = 0.7, // 70% impressions
      clickRate = 0.25, // 25% clicks  
      conversionRate = 0.05 // 5% conversions
    } = options

    console.log('🎯 Starting analytics simulation:', {
      campaigns: campaignIds.length,
      eventsPerMinute,
      duration: `${duration} minutes`,
      rates: { impressionRate, clickRate, conversionRate }
    })

    this.isRunning = true
    const interval = 60000 / eventsPerMinute // milliseconds between events

    this.intervalId = setInterval(async () => {
      try {
        const event = this.generateRandomEvent(campaignIds, organizationId, {
          impressionRate,
          clickRate,
          conversionRate
        })

        await realTimeAnalytics.ingestEvent(event)

      } catch (error) {
        console.error('❌ Simulation event error:', error)
      }
    }, interval)

    // Stop after duration
    setTimeout(() => {
      this.stopSimulation()
    }, duration * 60 * 1000)
  }

  /**
   * Stop the simulation
   */
  stopSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Analytics simulation stopped')
  }

  /**
   * Generate a burst of events
   */
  async generateEventBurst(campaignIds: string[], organizationId: string, count: number = 100): Promise<void> {
    console.log('💥 Generating event burst:', count, 'events')

    const events: AnalyticsEvent[] = []

    for (let i = 0; i < count; i++) {
      const event = this.generateRandomEvent(campaignIds, organizationId)
      events.push(event)
    }

    await realTimeAnalytics.ingestBatch(events)
    console.log('✅ Event burst completed')
  }

  /**
   * Generate realistic user journey events
   */
  async simulateUserJourney(campaignId: string, organizationId: string): Promise<void> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const userAgent = this.getRandomUserAgent()
    const deviceType = this.getRandomDeviceType()
    const location = this.getRandomLocation()

    console.log('👤 Simulating user journey:', { campaignId, sessionId, deviceType })

    const events: AnalyticsEvent[] = []

    // 1. Impression
    events.push({
      eventType: 'impression',
      campaignId,
      organizationId,
      timestamp: new Date(),
      metadata: {
        sessionId,
        userAgent,
        deviceType,
        location
      }
    })

    // 2. Maybe click (30% chance)
    if (Math.random() < 0.3) {
      events.push({
        eventType: 'click',
        campaignId,
        organizationId,
        timestamp: new Date(Date.now() + 2000), // 2 seconds later
        metadata: {
          sessionId,
          userAgent,
          deviceType,
          location
        },
        value: this.getRandomCpc() // Cost per click
      })

      // 3. Maybe view ad (80% of clicks)
      if (Math.random() < 0.8) {
        const viewDuration = Math.floor(Math.random() * 30) + 5 // 5-35 seconds
        
        events.push({
          eventType: 'view',
          campaignId,
          organizationId,
          timestamp: new Date(Date.now() + 3000),
          metadata: {
            sessionId,
            userAgent,
            deviceType,
            location,
            duration: viewDuration
          }
        })

        // 4. Engagement events
        if (viewDuration > 10) {
          events.push({
            eventType: 'engagement',
            campaignId,
            organizationId,
            timestamp: new Date(Date.now() + 8000),
            metadata: {
              sessionId,
              userAgent,
              deviceType,
              location,
              position: Math.floor(viewDuration / 2)
            }
          })
        }

        // 5. Completion or skip
        if (viewDuration > 20) {
          events.push({
            eventType: 'completion',
            campaignId,
            organizationId,
            timestamp: new Date(Date.now() + 25000),
            metadata: {
              sessionId,
              userAgent,
              deviceType,
              location
            }
          })

          // 6. Maybe conversion (5% of completions)
          if (Math.random() < 0.05) {
            events.push({
              eventType: 'conversion',
              campaignId,
              organizationId,
              timestamp: new Date(Date.now() + 30000),
              metadata: {
                sessionId,
                userAgent,
                deviceType,
                location
              },
              value: this.getRandomConversionValue()
            })
          }
        } else {
          // Skip if not completed
          events.push({
            eventType: 'skip',
            campaignId,
            organizationId,
            timestamp: new Date(Date.now() + viewDuration * 1000),
            metadata: {
              sessionId,
              userAgent,
              deviceType,
              location,
              position: viewDuration
            }
          })
        }
      }
    }

    await realTimeAnalytics.ingestBatch(events)
  }

  /**
   * Generate a random analytics event
   */
  private generateRandomEvent(
    campaignIds: string[], 
    organizationId: string,
    rates: {
      impressionRate?: number
      clickRate?: number
      conversionRate?: number
    } = {}
  ): AnalyticsEvent {
    const { impressionRate = 0.7, clickRate = 0.25, conversionRate = 0.05 } = rates
    const campaignId = campaignIds[Math.floor(Math.random() * campaignIds.length)]

    // Determine event type based on rates
    const rand = Math.random()
    let eventType: AnalyticsEvent['eventType']
    let value: number | undefined

    if (rand < impressionRate) {
      eventType = 'impression'
    } else if (rand < impressionRate + clickRate) {
      eventType = 'click'
      value = this.getRandomCpc()
    } else if (rand < impressionRate + clickRate + conversionRate) {
      eventType = 'conversion'
      value = this.getRandomConversionValue()
    } else {
      // Other event types
      const otherTypes: AnalyticsEvent['eventType'][] = ['view', 'engagement', 'completion', 'skip']
      eventType = otherTypes[Math.floor(Math.random() * otherTypes.length)]
    }

    return {
      eventType,
      campaignId,
      organizationId,
      timestamp: new Date(),
      metadata: {
        sessionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userAgent: this.getRandomUserAgent(),
        deviceType: this.getRandomDeviceType(),
        location: this.getRandomLocation(),
        duration: eventType === 'view' ? Math.floor(Math.random() * 30) + 5 : undefined
      },
      value
    }
  }

  private getRandomCpc(): number {
    return Math.round((Math.random() * 2 + 0.5) * 100) / 100 // $0.50 - $2.50
  }

  private getRandomConversionValue(): number {
    return Math.round((Math.random() * 50 + 10) * 100) / 100 // $10 - $60
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0'
    ]
    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  private getRandomDeviceType(): string {
    const devices = ['desktop', 'mobile', 'tablet']
    const weights = [0.5, 0.4, 0.1] // Desktop 50%, Mobile 40%, Tablet 10%
    
    const rand = Math.random()
    let cumulative = 0
    
    for (let i = 0; i < devices.length; i++) {
      cumulative += weights[i]
      if (rand < cumulative) {
        return devices[i]
      }
    }
    
    return 'desktop'
  }

  private getRandomLocation(): string {
    const locations = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA',
      'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL'
    ]
    return locations[Math.floor(Math.random() * locations.length)]
  }

  /**
   * Get simulation status
   */
  getStatus(): { isRunning: boolean; intervalId: boolean } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null
    }
  }
}

// Export singleton instance
export const analyticsSimulator = new AnalyticsEventSimulator()