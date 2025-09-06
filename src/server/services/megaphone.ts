/**
 * Megaphone Service Layer
 * 
 * Provides unified access to Megaphone Podcast API with:
 * - Organization-scoped credentials
 * - Rate limiting and retry logic
 * - Caching for expensive operations
 * - Multi-tenant isolation
 */

import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
import { addHours, subDays, format } from 'date-fns'

// Cache durations
const CACHE_DURATIONS = {
  SHOW_INFO: 6 * 60 * 60 * 1000,    // 6 hours
  EPISODE_INFO: 1 * 60 * 60 * 1000, // 1 hour
  DAILY_STATS: 30 * 60 * 1000,      // 30 minutes
  RECENT_STATS: 10 * 60 * 1000,     // 10 minutes
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  initialDelay: 1000,
  maxDelay: 5000,
  jitterFactor: 0.3,
}

export interface MegaphoneCredentials {
  apiKey?: string
  apiSecret?: string
  networkId?: string
  podcastId?: string
  baseUrl?: string
}

export interface ShowDownloads {
  showId: string
  date: string
  downloads: number
  uniqueListeners: number
  averageListenTime?: number // in seconds
  completionRate?: number // percentage
  geography?: Record<string, number> // country code -> downloads
}

export interface EpisodeDownloads {
  episodeId: string
  date: string
  downloads: number
  uniqueListeners: number
  firstWeekDownloads?: number
  firstMonthDownloads?: number
  averageListenTime?: number
  completionRate?: number
  dropOffPoints?: Array<{ time: number; percentage: number }>
}

export interface MegaphoneShow {
  id: string
  title: string
  description?: string
  imageUrl?: string
  episodeCount: number
  totalDownloads: number
  averageDownloadsPerEpisode: number
  createdAt: Date
  updatedAt: Date
}

export interface MegaphoneEpisode {
  id: string
  showId: string
  title: string
  description?: string
  publishedAt: Date
  duration: number // seconds
  audioUrl?: string
  totalDownloads: number
  uniqueListeners: number
}

export class MegaphoneService {
  private orgId: string
  private orgSlug: string
  private credentials?: MegaphoneCredentials
  private cache: Map<string, { data: any; expiresAt: number }> = new Map()
  private rateLimitReset?: Date
  private requestCount: number = 0
  private readonly MAX_REQUESTS_PER_HOUR = 1000 // Megaphone typical limit

  constructor(orgId: string, orgSlug: string) {
    this.orgId = orgId
    this.orgSlug = orgSlug
  }

  /**
   * Initialize the service with organization credentials
   */
  async initialize(): Promise<void> {
    // Fetch organization Megaphone credentials
    const credQuery = `
      SELECT 
        "megaphoneApiKey",
        "megaphoneApiSecret",
        "megaphoneNetworkId",
        "megaphonePodcastId",
        "megaphoneBaseUrl"
      FROM "Organization"
      WHERE id = $1
    `
    
    const { data: credResult } = await safeQuerySchema(
      this.orgSlug,
      credQuery,
      [this.orgId]
    )

    if (!credResult?.[0]) {
      throw new Error('Organization credentials not found')
    }

    const creds = credResult[0]
    this.credentials = {
      apiKey: creds.megaphoneApiKey,
      apiSecret: creds.megaphoneApiSecret,
      networkId: creds.megaphoneNetworkId,
      podcastId: creds.megaphonePodcastId,
      baseUrl: creds.megaphoneBaseUrl || 'https://cms.megaphone.fm/api',
    }

    // Initialize rate limit reset time
    this.rateLimitReset = new Date()
    this.rateLimitReset.setHours(this.rateLimitReset.getHours() + 1)
  }

  /**
   * Get show-level download statistics
   */
  async getShowDownloads(
    showExternalId: string,
    startDate: string,
    endDate: string
  ): Promise<ShowDownloads[]> {
    const cacheKey = `show-downloads:${showExternalId}:${startDate}:${endDate}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!this.isConnected()) {
      console.warn('Megaphone not connected - no credentials configured')
      return []
    }

    try {
      await this.checkRateLimit()

      // Make API request to Megaphone
      const response = await this.retryWithJitter(async () => {
        return this.makeApiRequest('GET', `/podcasts/${showExternalId}/downloads`, {
          start_date: startDate,
          end_date: endDate,
          interval: 'day',
        })
      })

      // Transform response to our format
      const downloads: ShowDownloads[] = response.data?.map((item: any) => ({
        showId: showExternalId,
        date: item.date,
        downloads: item.downloads || 0,
        uniqueListeners: item.unique_listeners || 0,
        averageListenTime: item.average_listen_time,
        completionRate: item.completion_rate,
        geography: item.geography,
      })) || []

      // Cache based on date range
      const cacheDuration = this.getCacheDuration(startDate, endDate)
      this.setCache(cacheKey, downloads, cacheDuration)

      return downloads
    } catch (error) {
      console.error('Failed to fetch show downloads:', error)
      return []
    }
  }

  /**
   * Get episode-level download statistics
   */
  async getEpisodeDownloads(
    episodeExternalId: string,
    startDate: string,
    endDate: string
  ): Promise<EpisodeDownloads[]> {
    const cacheKey = `episode-downloads:${episodeExternalId}:${startDate}:${endDate}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!this.isConnected()) {
      console.warn('Megaphone not connected - no credentials configured')
      return []
    }

    try {
      await this.checkRateLimit()

      const response = await this.retryWithJitter(async () => {
        return this.makeApiRequest('GET', `/episodes/${episodeExternalId}/downloads`, {
          start_date: startDate,
          end_date: endDate,
          interval: 'day',
        })
      })

      const downloads: EpisodeDownloads[] = response.data?.map((item: any) => ({
        episodeId: episodeExternalId,
        date: item.date,
        downloads: item.downloads || 0,
        uniqueListeners: item.unique_listeners || 0,
        firstWeekDownloads: item.first_week_downloads,
        firstMonthDownloads: item.first_month_downloads,
        averageListenTime: item.average_listen_time,
        completionRate: item.completion_rate,
        dropOffPoints: item.drop_off_points,
      })) || []

      const cacheDuration = this.getCacheDuration(startDate, endDate)
      this.setCache(cacheKey, downloads, cacheDuration)

      return downloads
    } catch (error) {
      console.error('Failed to fetch episode downloads:', error)
      return []
    }
  }

  /**
   * Get listen-through rates for episodes
   */
  async getListenThroughRates(
    episodeIds: string[]
  ): Promise<Record<string, number>> {
    if (!this.isConnected() || episodeIds.length === 0) {
      return {}
    }

    const rates: Record<string, number> = {}

    try {
      await this.checkRateLimit()

      // Batch request if API supports it, otherwise individual requests
      for (const episodeId of episodeIds) {
        const cacheKey = `ltr:${episodeId}`
        const cached = this.getFromCache(cacheKey)
        
        if (cached) {
          rates[episodeId] = cached
          continue
        }

        const response = await this.retryWithJitter(async () => {
          return this.makeApiRequest('GET', `/episodes/${episodeId}/metrics`, {
            metric: 'listen_through_rate',
          })
        })

        const ltr = response.data?.listen_through_rate || 0
        rates[episodeId] = ltr
        this.setCache(cacheKey, ltr, CACHE_DURATIONS.RECENT_STATS)
      }

      return rates
    } catch (error) {
      console.error('Failed to fetch listen-through rates:', error)
      return rates
    }
  }

  /**
   * Get show information from Megaphone
   */
  async getShowInfo(showExternalId: string): Promise<MegaphoneShow | null> {
    const cacheKey = `show-info:${showExternalId}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!this.isConnected()) {
      return null
    }

    try {
      await this.checkRateLimit()

      const response = await this.retryWithJitter(async () => {
        return this.makeApiRequest('GET', `/podcasts/${showExternalId}`)
      })

      if (!response.data) {
        return null
      }

      const show: MegaphoneShow = {
        id: response.data.id,
        title: response.data.title,
        description: response.data.description,
        imageUrl: response.data.image_url,
        episodeCount: response.data.episode_count || 0,
        totalDownloads: response.data.total_downloads || 0,
        averageDownloadsPerEpisode: response.data.average_downloads || 0,
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at),
      }

      this.setCache(cacheKey, show, CACHE_DURATIONS.SHOW_INFO)
      return show
    } catch (error) {
      console.error('Failed to fetch show info:', error)
      return null
    }
  }

  /**
   * Make API request to Megaphone
   */
  private async makeApiRequest(
    method: string,
    endpoint: string,
    params?: Record<string, any>
  ): Promise<any> {
    if (!this.credentials?.apiKey) {
      throw new Error('Megaphone API key not configured')
    }

    const url = new URL(`${this.credentials.baseUrl}${endpoint}`)
    
    if (params && method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.credentials.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    if (this.credentials.apiSecret) {
      headers['X-API-Secret'] = this.credentials.apiSecret
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (params && method !== 'GET') {
      options.body = JSON.stringify(params)
    }

    const response = await fetch(url.toString(), options)
    
    this.requestCount++

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - extract reset time if provided
        const resetHeader = response.headers.get('X-RateLimit-Reset')
        if (resetHeader) {
          this.rateLimitReset = new Date(parseInt(resetHeader) * 1000)
        }
        throw new Error(`Rate limited. Resets at ${this.rateLimitReset}`)
      }
      
      const error = await response.text()
      throw new Error(`Megaphone API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Check rate limits before making requests
   */
  private async checkRateLimit(): Promise<void> {
    // Reset counter if past reset time
    if (this.rateLimitReset && new Date() > this.rateLimitReset) {
      this.requestCount = 0
      this.rateLimitReset = new Date()
      this.rateLimitReset.setHours(this.rateLimitReset.getHours() + 1)
    }

    // Check if we're approaching limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR * 0.9) {
      throw new Error(`Approaching Megaphone rate limit (${this.requestCount}/${this.MAX_REQUESTS_PER_HOUR})`)
    }
  }

  /**
   * Helper: Retry with exponential backoff and jitter
   */
  private async retryWithJitter<T>(
    fn: () => Promise<T>,
    retries = RETRY_CONFIG.maxRetries
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Don't retry on auth errors
        if (error.message?.includes('401') || error.message?.includes('403')) {
          throw error
        }
        
        // Retry on rate limit or server errors
        if (i < retries && (error.message?.includes('429') || error.message?.includes('5'))) {
          const baseDelay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, i),
            RETRY_CONFIG.maxDelay
          )
          const jitter = baseDelay * RETRY_CONFIG.jitterFactor * Math.random()
          const delay = baseDelay + jitter
          
          console.log(`Retrying Megaphone request after ${delay}ms (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          throw error
        }
      }
    }
    
    throw lastError
  }

  /**
   * Determine cache duration based on date range
   */
  private getCacheDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()
    
    // If end date is today or future, use short cache
    if (end >= now) {
      return CACHE_DURATIONS.RECENT_STATS
    }
    
    // If date range is entirely in the past (historical data), use longer cache
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= 7) {
      return CACHE_DURATIONS.RECENT_STATS
    } else {
      return CACHE_DURATIONS.DAILY_STATS
    }
  }

  /**
   * Cache helpers
   */
  private getFromCache(key: string): any {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  private setCache(key: string, data: any, duration: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + duration,
    })
  }

  /**
   * Check if Megaphone is connected (has credentials)
   */
  isConnected(): boolean {
    return !!(this.credentials?.apiKey)
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }
}