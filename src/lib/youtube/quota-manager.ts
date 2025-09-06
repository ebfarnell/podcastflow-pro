/**
 * YouTube API Quota Manager
 * 
 * Enforces organization-scoped YouTube API quota limits with:
 * - Accurate cost tracking for each API endpoint
 * - Daily limit enforcement (default 10,000 units)
 * - Threshold alerts at 80% and 100%
 * - Org-local midnight reset
 * - Multi-tenant isolation
 */

import prisma from '@/lib/db/prisma'
import { querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

// YouTube API Cost Units (based on official Google documentation)
export const YOUTUBE_API_COSTS = {
  // Videos
  'videos.list': 1,           // per part (snippet=1, statistics=1, contentDetails=1)
  'videos.insert': 1600,       // Upload
  'videos.update': 50,         // Update metadata
  'videos.delete': 50,
  'videos.rate': 50,           // Like/dislike
  'videos.reportAbuse': 50,
  
  // Channels
  'channels.list': 1,          // per part
  'channels.update': 50,
  
  // Search
  'search.list': 100,          // Most expensive read operation
  
  // Playlists
  'playlists.list': 1,         // per part
  'playlists.insert': 50,
  'playlists.update': 50,
  'playlists.delete': 50,
  
  // Playlist Items
  'playlistItems.list': 1,     // per part
  'playlistItems.insert': 50,
  'playlistItems.update': 50,
  'playlistItems.delete': 50,
  
  // Comments
  'commentThreads.list': 1,    // per part
  'commentThreads.insert': 50,
  'comments.list': 1,
  'comments.insert': 50,
  
  // Subscriptions
  'subscriptions.list': 1,     // per part
  'subscriptions.insert': 50,
  'subscriptions.delete': 50,
  
  // Activities
  'activities.list': 1,        // per part
  
  // Captions
  'captions.list': 50,
  'captions.insert': 400,
  'captions.update': 450,
  'captions.delete': 50,
  
  // Channel Sections
  'channelSections.list': 1,
  'channelSections.insert': 50,
  'channelSections.update': 50,
  'channelSections.delete': 50,
  
  // Analytics (YouTube Analytics API v2)
  'reports.query': 1,          // Analytics queries
  
  // Thumbnails
  'thumbnails.set': 50,
  
  // Video Categories
  'videoCategories.list': 1,
  
  // Members
  'members.list': 1,
  'membershipsLevels.list': 1,
} as const

export type YouTubeEndpoint = keyof typeof YOUTUBE_API_COSTS

export interface QuotaCheckResult {
  allowed: boolean
  currentUsage: number
  dailyLimit: number
  remainingQuota: number
  percentageUsed: number
  willExceedAfter: boolean
  resetAt: Date
  message?: string
}

export interface QuotaUsageUpdate {
  success: boolean
  newUsage: number
  remainingQuota: number
  thresholdCrossed?: 80 | 100
}

export class QuotaExceededError extends Error {
  constructor(
    public currentUsage: number,
    public dailyLimit: number,
    public resetAt: Date
  ) {
    super(`YouTube API quota exceeded: ${currentUsage}/${dailyLimit} units used. Resets at ${resetAt.toISOString()}`)
    this.name = 'QuotaExceededError'
  }
}

export class YouTubeQuotaManager {
  private static instance: YouTubeQuotaManager
  private featureFlagEnabled: boolean
  
  private constructor() {
    this.featureFlagEnabled = process.env.YOUTUBE_QUOTA_ENFORCEMENT === 'true'
  }
  
  static getInstance(): YouTubeQuotaManager {
    if (!YouTubeQuotaManager.instance) {
      YouTubeQuotaManager.instance = new YouTubeQuotaManager()
    }
    return YouTubeQuotaManager.instance
  }
  
  /**
   * Get the organization's local date based on timezone
   */
  private async getOrgLocalDate(organizationId: string): Promise<Date> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true }
    })
    
    const timezone = org?.timezone || 'UTC'
    const now = new Date()
    
    // Convert to org's local midnight for next reset
    const localDateStr = now.toLocaleDateString('en-US', { timeZone: timezone })
    const [month, day, year] = localDateStr.split('/')
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`)
  }
  
  /**
   * Get or create quota usage record for today
   */
  private async getOrCreateQuotaUsage(organizationId: string, orgSlug: string): Promise<any> {
    const today = await this.getOrgLocalDate(organizationId)
    const todayStr = today.toISOString().split('T')[0]
    
    // Check if usage record exists for today
    const checkQuery = `
      SELECT * FROM "youtube_quota_usage"
      WHERE "org_id" = $1 AND "usage_date" = $2
      LIMIT 1
    `
    
    const { data: existing } = await safeQuerySchema(orgSlug, checkQuery, [organizationId, todayStr])
    
    if (existing && existing.length > 0) {
      return existing[0]
    }
    
    // Create new usage record for today
    const createQuery = `
      INSERT INTO "youtube_quota_usage" (id, org_id, usage_date, used_units)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (org_id, usage_date) DO NOTHING
      RETURNING *
    `
    
    const { data: created } = await safeQuerySchema(orgSlug, createQuery, [
      uuidv4(),
      organizationId,
      todayStr
    ])
    
    return created?.[0] || { org_id: organizationId, usage_date: todayStr, used_units: 0 }
  }
  
  /**
   * Calculate the cost for an API call
   */
  calculateCost(
    endpoint: YouTubeEndpoint,
    params?: {
      parts?: string[]
      count?: number
      customCost?: number
    }
  ): number {
    // Allow custom cost override
    if (params?.customCost !== undefined) {
      return params.customCost
    }
    
    const baseCost = YOUTUBE_API_COSTS[endpoint] || 1
    
    // For list operations with 'part' parameter, multiply by number of parts
    if (endpoint.includes('.list') && params?.parts) {
      // Some endpoints charge per part
      if (['videos.list', 'channels.list'].includes(endpoint)) {
        return baseCost * params.parts.length
      }
    }
    
    // Multiply by count if provided (e.g., batch operations)
    if (params?.count) {
      return baseCost * params.count
    }
    
    return baseCost
  }
  
  /**
   * Check if an API call is allowed based on quota
   */
  async checkQuota(
    organizationId: string,
    endpoint: YouTubeEndpoint,
    cost?: number
  ): Promise<QuotaCheckResult> {
    // If feature flag is disabled, always allow
    if (!this.featureFlagEnabled) {
      return {
        allowed: true,
        currentUsage: 0,
        dailyLimit: 1000000,
        remainingQuota: 1000000,
        percentageUsed: 0,
        willExceedAfter: false,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    }
    
    // Get organization configuration
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId }
    })
    
    if (!config) {
      throw new Error('YouTube API not configured for this organization')
    }
    
    const dailyLimit = config.quotaLimit || 10000
    const orgSlug = await this.getOrgSlug(organizationId)
    
    // Get current usage
    const usage = await this.getOrCreateQuotaUsage(organizationId, orgSlug)
    const currentUsage = usage.used_units || 0
    const callCost = cost ?? this.calculateCost(endpoint)
    
    // Calculate next reset time (org-local midnight)
    const tomorrow = new Date(usage.usage_date)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const remainingQuota = Math.max(0, dailyLimit - currentUsage)
    const willExceedAfter = currentUsage + callCost > dailyLimit
    const percentageUsed = (currentUsage / dailyLimit) * 100
    
    return {
      allowed: !willExceedAfter,
      currentUsage,
      dailyLimit,
      remainingQuota,
      percentageUsed,
      willExceedAfter,
      resetAt: tomorrow,
      message: willExceedAfter 
        ? `This operation would exceed daily quota (${currentUsage + callCost}/${dailyLimit})`
        : undefined
    }
  }
  
  /**
   * Record quota usage after a successful API call
   */
  async recordUsage(
    organizationId: string,
    endpoint: YouTubeEndpoint,
    cost?: number
  ): Promise<QuotaUsageUpdate> {
    // If feature flag is disabled, skip recording
    if (!this.featureFlagEnabled) {
      return {
        success: true,
        newUsage: 0,
        remainingQuota: 1000000
      }
    }
    
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId }
    })
    
    if (!config) {
      throw new Error('YouTube API not configured')
    }
    
    const dailyLimit = config.quotaLimit || 10000
    const orgSlug = await this.getOrgSlug(organizationId)
    const usage = await this.getOrCreateQuotaUsage(organizationId, orgSlug)
    const callCost = cost ?? this.calculateCost(endpoint)
    
    // Atomically increment usage
    const updateQuery = `
      UPDATE "youtube_quota_usage"
      SET used_units = used_units + $1
      WHERE org_id = $2 AND usage_date = $3
      RETURNING used_units
    `
    
    const { data: updated } = await safeQuerySchema(orgSlug, updateQuery, [
      callCost,
      organizationId,
      usage.usage_date
    ])
    
    const newUsage = updated?.[0]?.used_units || (usage.used_units + callCost)
    const remainingQuota = Math.max(0, dailyLimit - newUsage)
    const percentageUsed = (newUsage / dailyLimit) * 100
    
    // Check for threshold crossings
    const oldPercentage = ((usage.used_units || 0) / dailyLimit) * 100
    let thresholdCrossed: 80 | 100 | undefined
    
    if (oldPercentage < 80 && percentageUsed >= 80) {
      thresholdCrossed = 80
      await this.sendThresholdAlert(organizationId, 80, newUsage, dailyLimit)
    } else if (oldPercentage < 100 && percentageUsed >= 100) {
      thresholdCrossed = 100
      await this.sendThresholdAlert(organizationId, 100, newUsage, dailyLimit)
      await this.pauseSync(organizationId, orgSlug)
    }
    
    // Also update the legacy quota tracking in YouTubeApiConfig
    await prisma.youTubeApiConfig.update({
      where: { organizationId },
      data: { quotaUsed: newUsage }
    })
    
    return {
      success: true,
      newUsage,
      remainingQuota,
      thresholdCrossed
    }
  }
  
  /**
   * Perform an API call with quota checking and recording
   */
  async executeWithQuota<T>(
    organizationId: string,
    endpoint: YouTubeEndpoint,
    apiCall: () => Promise<T>,
    options?: {
      cost?: number
      skipIfExceeded?: boolean
    }
  ): Promise<T> {
    // Check quota before making the call
    const quotaCheck = await this.checkQuota(organizationId, endpoint, options?.cost)
    
    if (!quotaCheck.allowed) {
      if (options?.skipIfExceeded) {
        console.log(`Skipping ${endpoint} due to quota limit`)
        throw new QuotaExceededError(
          quotaCheck.currentUsage,
          quotaCheck.dailyLimit,
          quotaCheck.resetAt
        )
      }
      
      throw new QuotaExceededError(
        quotaCheck.currentUsage,
        quotaCheck.dailyLimit,
        quotaCheck.resetAt
      )
    }
    
    try {
      // Execute the API call
      const result = await apiCall()
      
      // Record usage on success
      await this.recordUsage(organizationId, endpoint, options?.cost)
      
      return result
    } catch (error) {
      // Don't record usage if the API call failed
      console.error(`YouTube API call failed for ${endpoint}:`, error)
      throw error
    }
  }
  
  /**
   * Send threshold alert notification
   */
  private async sendThresholdAlert(
    organizationId: string,
    threshold: 80 | 100,
    used: number,
    limit: number
  ): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true }
    })
    
    if (!org) return
    
    const message = threshold === 80
      ? `YouTube API quota at 80% for ${org.name}: ${used.toLocaleString()}/${limit.toLocaleString()} units used`
      : `YouTube API quota EXCEEDED for ${org.name}: ${used.toLocaleString()}/${limit.toLocaleString()} units. Sync paused until midnight.`
    
    // Create in-app notification
    const notificationQuery = `
      INSERT INTO "Notification" (
        id, "organizationId", type, title, message, 
        severity, "isRead", metadata, "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW())
    `
    
    await safeQuerySchema(org.slug, notificationQuery, [
      uuidv4(),
      organizationId,
      'youtube_quota_alert',
      threshold === 80 ? 'YouTube Quota Warning' : 'YouTube Quota Exceeded',
      message,
      threshold === 80 ? 'warning' : 'error',
      JSON.stringify({
        threshold,
        used,
        limit,
        percentageUsed: (used / limit) * 100
      })
    ])
    
    // Log to monitoring
    console.warn(`[YOUTUBE_QUOTA] ${message}`)
    
    // TODO: Send email notification to org admins if email is configured
  }
  
  /**
   * Pause YouTube sync for the organization
   */
  private async pauseSync(organizationId: string, orgSlug: string): Promise<void> {
    // Update sync settings to pause
    const pauseQuery = `
      UPDATE "YouTubeSyncSettings"
      SET 
        "syncEnabled" = false,
        "syncPausedReason" = 'QUOTA',
        "syncPausedAt" = NOW()
      WHERE "organizationId" = $1
    `
    
    await safeQuerySchema(orgSlug, pauseQuery, [organizationId])
    
    // Also update any active connections
    const pauseConnectionsQuery = `
      UPDATE "YouTubeConnection"
      SET "syncEnabled" = false
      WHERE "organizationId" = $1
    `
    
    await safeQuerySchema(orgSlug, pauseConnectionsQuery, [organizationId])
  }
  
  /**
   * Reset daily quota (called by cron job at org-local midnight)
   */
  async resetDailyQuota(organizationId: string): Promise<void> {
    const orgSlug = await this.getOrgSlug(organizationId)
    const today = await this.getOrgLocalDate(organizationId)
    const todayStr = today.toISOString().split('T')[0]
    
    // Create new usage record for today (if not exists)
    await this.getOrCreateQuotaUsage(organizationId, orgSlug)
    
    // Clear sync paused status if it was due to quota
    const clearPauseQuery = `
      UPDATE "YouTubeSyncSettings"
      SET 
        "syncEnabled" = true,
        "syncPausedReason" = NULL,
        "syncPausedAt" = NULL
      WHERE "organizationId" = $1 AND "syncPausedReason" = 'QUOTA'
    `
    
    await safeQuerySchema(orgSlug, clearPauseQuery, [organizationId])
    
    // Re-enable connections that were paused
    const enableConnectionsQuery = `
      UPDATE "YouTubeConnection"
      SET "syncEnabled" = true
      WHERE "organizationId" = $1 
        AND id IN (
          SELECT id FROM "YouTubeConnection" 
          WHERE "organizationId" = $1 
            AND "syncEnabled" = false
            AND "updatedAt" > NOW() - INTERVAL '25 hours'
        )
    `
    
    await safeQuerySchema(orgSlug, enableConnectionsQuery, [organizationId])
    
    // Update legacy quota tracking
    await prisma.youTubeApiConfig.update({
      where: { organizationId },
      data: {
        quotaUsed: 0,
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })
    
    console.log(`[YOUTUBE_QUOTA] Reset daily quota for org ${organizationId}`)
  }
  
  /**
   * Get current quota status for UI display
   */
  async getQuotaStatus(organizationId: string): Promise<{
    used: number
    limit: number
    percentage: number
    resetAt: Date
    isPaused: boolean
    canSync: boolean
  }> {
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId }
    })
    
    if (!config) {
      return {
        used: 0,
        limit: 10000,
        percentage: 0,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isPaused: false,
        canSync: false
      }
    }
    
    const orgSlug = await this.getOrgSlug(organizationId)
    const usage = await this.getOrCreateQuotaUsage(organizationId, orgSlug)
    const used = usage.used_units || 0
    const limit = config.quotaLimit || 10000
    const percentage = (used / limit) * 100
    
    // Check if sync is paused
    const syncSettingsQuery = `
      SELECT "syncEnabled", "syncPausedReason"
      FROM "YouTubeSyncSettings"
      WHERE "organizationId" = $1
      LIMIT 1
    `
    
    const { data: syncSettings } = await safeQuerySchema(orgSlug, syncSettingsQuery, [organizationId])
    const isPaused = syncSettings?.[0]?.syncPausedReason === 'QUOTA'
    
    const tomorrow = new Date(usage.usage_date)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return {
      used,
      limit,
      percentage,
      resetAt: tomorrow,
      isPaused,
      canSync: percentage < 100 && !isPaused
    }
  }
  
  /**
   * Helper: Get organization slug
   */
  private async getOrgSlug(organizationId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true }
    })
    
    if (!org) throw new Error('Organization not found')
    return org.slug
  }
}

// Export singleton instance
export const quotaManager = YouTubeQuotaManager.getInstance()