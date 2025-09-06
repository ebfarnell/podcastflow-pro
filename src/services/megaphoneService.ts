import { api } from '@/lib/api'

export interface SyncOptions {
  syncType: 'full' | 'incremental' | 'podcast' | 'episode' | 'manual'
  forceRefresh?: boolean
  podcastIds?: string[]
}

export interface SyncResult {
  success: boolean
  syncLogId: string
  itemsProcessed: number
  itemsFailed: number
  errors: string[]
  duration: number
}

export interface MegaphoneIntegration {
  id: string
  organizationId: string
  isActive: boolean
  syncStatus: 'idle' | 'syncing' | 'error' | 'success'
  lastSyncAt?: string
  lastError?: string
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly'
  settings: {
    autoSync?: boolean
    includeDrafts?: boolean
    syncHistoricalData?: boolean
  }
  networks?: Array<{
    id: string
    name: string
    podcastCount: number
  }>
  podcasts?: Array<{
    id: string
    title: string
    episodesCount: number
    lastSyncAt: string
  }>
  syncLogs?: Array<{
    id: string
    syncType: string
    status: string
    itemsProcessed: number
    itemsFailed: number
    startedAt: string
    completedAt?: string
    errors?: string[]
  }>
}

export class MegaphoneService {
  /**
   * Get current organization's Megaphone integration
   */
  static async getIntegration(): Promise<MegaphoneIntegration | null> {
    try {
      const response = await api.get('/megaphone/integration')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Setup or update Megaphone integration
   */
  static async setupIntegration(
    apiToken: string,
    settings: {
      syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly'
      autoSync?: boolean
      includeDrafts?: boolean
      syncHistoricalData?: boolean
    }
  ): Promise<{ success: boolean; integration?: MegaphoneIntegration; error?: string }> {
    try {
      const response = await api.post('/megaphone/integration', {
        apiToken,
        settings
      })
      return { success: true, integration: response.data }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to setup integration'
      }
    }
  }

  /**
   * Test API connection
   */
  static async testConnection(apiToken: string): Promise<{ success: boolean; networkCount: number }> {
    try {
      const response = await api.post('/megaphone/test-connection', { apiToken })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Connection test failed')
    }
  }

  /**
   * Sync data from Megaphone
   */
  static async syncData(options: SyncOptions): Promise<SyncResult> {
    try {
      const response = await api.post('/megaphone/sync', options)
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Sync failed')
    }
  }

  /**
   * Delete integration and all associated data
   */
  static async deleteIntegration(): Promise<void> {
    await api.delete('/megaphone/integration')
  }

  /**
   * Get sync status
   */
  static async getSyncStatus() {
    const response = await api.get('/megaphone/sync-status')
    return response.data
  }

  /**
   * Get networks
   */
  static async getNetworks() {
    const response = await api.get('/megaphone/networks')
    return response.data
  }

  /**
   * Get podcasts
   */
  static async getPodcasts(networkId?: string) {
    const url = networkId ? `/megaphone/networks/${networkId}/podcasts` : '/megaphone/podcasts'
    const response = await api.get(url)
    return response.data
  }

  /**
   * Get episodes
   */
  static async getEpisodes(podcastId: string) {
    const response = await api.get(`/megaphone/podcasts/${podcastId}/episodes`)
    return response.data
  }
}