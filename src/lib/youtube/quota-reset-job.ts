/**
 * YouTube Quota Reset Job
 * 
 * Resets quota daily at organization-local midnight
 */

import { CronJob } from 'cron'
import prisma from '@/lib/db/prisma'
import { quotaManager } from './quota-manager'

class YouTubeQuotaResetScheduler {
  private jobs: Map<string, CronJob> = new Map()
  private static instance: YouTubeQuotaResetScheduler
  
  private constructor() {}
  
  static getInstance(): YouTubeQuotaResetScheduler {
    if (!YouTubeQuotaResetScheduler.instance) {
      YouTubeQuotaResetScheduler.instance = new YouTubeQuotaResetScheduler()
    }
    return YouTubeQuotaResetScheduler.instance
  }
  
  /**
   * Initialize quota reset jobs for all organizations
   */
  async initialize() {
    console.log('[YouTube Quota Reset] Initializing daily reset jobs...')
    
    // Get all organizations with YouTube API configured
    const orgs = await prisma.organization.findMany({
      where: {
        youTubeApiConfig: {
          isNot: null
        }
      },
      include: {
        youTubeApiConfig: true
      }
    })
    
    for (const org of orgs) {
      if (org.youTubeApiConfig) {
        await this.scheduleOrgReset(org.id, org.timezone || 'America/New_York')
      }
    }
    
    console.log(`[YouTube Quota Reset] Scheduled ${orgs.length} organization reset jobs`)
  }
  
  /**
   * Schedule daily reset for a specific organization
   */
  async scheduleOrgReset(organizationId: string, timezone: string) {
    // Stop existing job if any
    this.stopOrgJob(organizationId)
    
    // Create cron pattern for midnight in org's timezone
    // Pattern: "0 0 * * *" = midnight every day
    const cronPattern = '0 0 * * *'
    
    const job = new CronJob(
      cronPattern,
      async () => {
        await this.resetOrgQuota(organizationId)
      },
      null, // onComplete
      true, // start immediately
      timezone // organization's timezone
    )
    
    this.jobs.set(organizationId, job)
    
    console.log(`[YouTube Quota Reset] Scheduled reset for org ${organizationId} at midnight ${timezone}`)
  }
  
  /**
   * Reset quota for an organization
   */
  async resetOrgQuota(organizationId: string) {
    try {
      console.log(`[YouTube Quota Reset] Resetting quota for org ${organizationId}`)
      
      // Use the quota manager's reset function
      await quotaManager.resetDailyQuota(organizationId)
      
      // Log successful reset
      console.log(`[YouTube Quota Reset] Successfully reset quota for org ${organizationId}`)
      
      // Optional: Send notification to org admins about reset
      await this.sendResetNotification(organizationId)
      
    } catch (error) {
      console.error(`[YouTube Quota Reset] Error resetting quota for org ${organizationId}:`, error)
    }
  }
  
  /**
   * Send notification about quota reset
   */
  private async sendResetNotification(organizationId: string) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, slug: true }
      })
      
      if (!org) return
      
      // Get yesterday's usage for the notification
      const config = await prisma.youTubeApiConfig.findUnique({
        where: { organizationId }
      })
      
      if (!config) return
      
      // Create notification in org schema
      const { querySchema } = await import('@/lib/db/schema-db')
      
      const notificationQuery = `
        INSERT INTO "Notification" (
          id, "organizationId", type, title, message, 
          severity, "isRead", metadata, "createdAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, false, $6, NOW()
        )
      `
      
      await querySchema(org.slug, notificationQuery, [
        organizationId,
        'youtube_quota_reset',
        'YouTube Quota Reset',
        `Daily YouTube API quota has been reset. You have ${(config.quotaLimit || 10000).toLocaleString()} units available for today.`,
        'info',
        JSON.stringify({
          previousUsage: config.quotaUsed,
          newLimit: config.quotaLimit || 10000,
          resetTime: new Date().toISOString()
        })
      ])
      
    } catch (error) {
      console.error(`[YouTube Quota Reset] Error sending reset notification:`, error)
    }
  }
  
  /**
   * Stop job for an organization
   */
  stopOrgJob(organizationId: string) {
    const job = this.jobs.get(organizationId)
    if (job) {
      job.stop()
      this.jobs.delete(organizationId)
      console.log(`[YouTube Quota Reset] Stopped job for org ${organizationId}`)
    }
  }
  
  /**
   * Stop all jobs
   */
  stopAll() {
    for (const [orgId, job] of this.jobs) {
      job.stop()
    }
    this.jobs.clear()
    console.log('[YouTube Quota Reset] All jobs stopped')
  }
  
  /**
   * Update organization timezone and reschedule
   */
  async updateOrgTimezone(organizationId: string, newTimezone: string) {
    await this.scheduleOrgReset(organizationId, newTimezone)
  }
  
  /**
   * Manual quota reset (for testing or emergency)
   */
  async manualReset(organizationId: string) {
    console.log(`[YouTube Quota Reset] Manual reset triggered for org ${organizationId}`)
    await this.resetOrgQuota(organizationId)
  }
}

// Export singleton instance
export const quotaResetScheduler = YouTubeQuotaResetScheduler.getInstance()

// Initialize on server startup (only in Node.js environment)
if (typeof window === 'undefined' && process.env.YOUTUBE_QUOTA_ENFORCEMENT === 'true') {
  // Initialize after a short delay to ensure DB is ready
  setTimeout(() => {
    quotaResetScheduler.initialize().catch(error => {
      console.error('[YouTube Quota Reset] Failed to initialize:', error)
    })
  }, 5000)
}