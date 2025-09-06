import crypto from 'crypto'
import prisma from '@/lib/db/prisma'

interface TrackingData {
  emailLogId: string
  recipientEmail: string
  campaignId?: string
  emailType: string
}

export class EmailTracker {
  private static readonly TRACKING_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly SECRET_KEY = crypto.scryptSync(
    process.env.EMAIL_TRACKING_SECRET || 'default-secret-key-for-email-tracking',
    'salt',
    32
  )
  
  /**
   * Generate a unique tracking ID
   */
  static generateTrackingId(data: TrackingData): string {
    const payload = JSON.stringify(data)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.SECRET_KEY, iv)
    
    let encrypted = cipher.update(payload, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Combine iv, authTag, and encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')])
    return combined.toString('base64url')
  }
  
  /**
   * Decode a tracking ID back to data
   */
  static decodeTrackingId(trackingId: string): TrackingData | null {
    try {
      const combined = Buffer.from(trackingId, 'base64url')
      
      // Extract components
      const iv = combined.slice(0, 16)
      const authTag = combined.slice(16, 32)
      const encrypted = combined.slice(32).toString('hex')
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.SECRET_KEY, iv)
      decipher.setAuthTag(authTag)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return JSON.parse(decrypted)
    } catch (error) {
      console.error('Failed to decode tracking ID:', error)
      return null
    }
  }
  
  /**
   * Generate an open tracking pixel URL
   */
  static getOpenTrackingPixel(data: TrackingData): string {
    const trackingId = this.generateTrackingId(data)
    return `${this.TRACKING_DOMAIN}/api/email/track/open/${trackingId}`
  }
  
  /**
   * Generate a click tracking URL
   */
  static getClickTrackingUrl(originalUrl: string, data: TrackingData): string {
    const trackingId = this.generateTrackingId(data)
    const encodedUrl = encodeURIComponent(originalUrl)
    return `${this.TRACKING_DOMAIN}/api/email/track/click/${trackingId}?url=${encodedUrl}`
  }
  
  /**
   * Inject tracking pixel into HTML content
   */
  static injectOpenTracking(htmlContent: string, data: TrackingData): string {
    const pixelUrl = this.getOpenTrackingPixel(data)
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`
    
    // Insert before closing body tag if it exists, otherwise append to end
    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${trackingPixel}</body>`)
    }
    return htmlContent + trackingPixel
  }
  
  /**
   * Replace all links in HTML with tracking links
   */
  static injectClickTracking(htmlContent: string, data: TrackingData): string {
    // Match all href attributes except unsubscribe links
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    
    return htmlContent.replace(linkRegex, (match, url) => {
      // Don't track unsubscribe links or anchor links
      if (url.includes('unsubscribe') || url.startsWith('#') || url.startsWith('mailto:')) {
        return match
      }
      
      const trackingUrl = this.getClickTrackingUrl(url, data)
      return match.replace(url, trackingUrl)
    })
  }
  
  /**
   * Record an email open event
   */
  static async recordOpen(trackingId: string, userAgent?: string, ipAddress?: string): Promise<void> {
    const data = this.decodeTrackingId(trackingId)
    if (!data) return
    
    try {
      // Update email log
      await prisma.emailLog.update({
        where: { id: data.emailLogId },
        data: {
          openedAt: new Date(),
          openCount: { increment: 1 },
          lastOpenedAt: new Date()
        }
      })
      
      // Create tracking event
      await prisma.emailTrackingEvent.create({
        data: {
          emailLogId: data.emailLogId,
          eventType: 'open',
          timestamp: new Date(),
          userAgent,
          ipAddress,
          metadata: {}
        }
      })
    } catch (error) {
      console.error('Failed to record email open:', error)
    }
  }
  
  /**
   * Record an email click event
   */
  static async recordClick(trackingId: string, url: string, userAgent?: string, ipAddress?: string): Promise<void> {
    const data = this.decodeTrackingId(trackingId)
    if (!data) return
    
    try {
      // Update email log
      await prisma.emailLog.update({
        where: { id: data.emailLogId },
        data: {
          clickedAt: new Date(),
          clickCount: { increment: 1 },
          lastClickedAt: new Date()
        }
      })
      
      // Create tracking event
      await prisma.emailTrackingEvent.create({
        data: {
          emailLogId: data.emailLogId,
          eventType: 'click',
          timestamp: new Date(),
          userAgent,
          ipAddress,
          metadata: { url }
        }
      })
    } catch (error) {
      console.error('Failed to record email click:', error)
    }
  }
  
  /**
   * Get analytics for an email
   */
  static async getEmailAnalytics(emailLogId: string) {
    const [log, events] = await Promise.all([
      prisma.emailLog.findUnique({
        where: { id: emailLogId }
      }),
      prisma.emailTrackingEvent.findMany({
        where: { emailLogId },
        orderBy: { timestamp: 'desc' }
      })
    ])
    
    if (!log) return null
    
    const opens = events.filter(e => e.eventType === 'open')
    const clicks = events.filter(e => e.eventType === 'click')
    const uniqueClicks = new Set(clicks.map(c => c.metadata?.url)).size
    
    return {
      sent: log.sentAt,
      delivered: log.deliveredAt,
      opened: log.openedAt,
      clicked: log.clickedAt,
      bounced: log.bouncedAt,
      complained: log.complainedAt,
      openCount: log.openCount || 0,
      clickCount: log.clickCount || 0,
      uniqueClickCount: uniqueClicks,
      events: events.map(e => ({
        type: e.eventType,
        timestamp: e.timestamp,
        url: e.metadata?.url,
        userAgent: e.userAgent,
        ipAddress: e.ipAddress
      }))
    }
  }
}