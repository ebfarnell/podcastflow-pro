import { apiClient } from './client'

export interface InventoryItem {
  id: string
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  showId: string
  showName: string
  showCategory: string
  airDate: string
  episodeLength: number
  preRollSlots: number
  preRollAvailable: number
  preRollReserved: number
  preRollBooked: number
  preRollPrice: number
  midRollSlots: number
  midRollAvailable: number
  midRollReserved: number
  midRollBooked: number
  midRollPrice: number
  postRollSlots: number
  postRollAvailable: number
  postRollReserved: number
  postRollBooked: number
  postRollPrice: number
  estimatedImpressions: number
  totalSlots: number
  totalAvailable: number
  totalReserved: number
  totalBooked: number
}

export interface InventoryFilters {
  showId?: string
  startDate?: string
  endDate?: string
  placementType?: string
  availableOnly?: boolean
}

export interface InventoryResponse {
  inventory: InventoryItem[]
  summary: {
    totalEpisodes: number
    totalShows: number
    totalSlots: number
    totalAvailable: number
    totalReserved: number
    totalBooked: number
    avgPreRollPrice: number
    avgMidRollPrice: number
    avgPostRollPrice: number
  }
  filters: InventoryFilters
}

export const inventoryApi = {
  list: async (filters?: InventoryFilters): Promise<InventoryResponse> => {
    const params = new URLSearchParams()
    if (filters?.showId) params.append('showId', filters.showId)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (filters?.placementType) params.append('placementType', filters.placementType)
    if (filters?.availableOnly) params.append('availableOnly', filters.availableOnly.toString())
    
    return apiClient.get(`/inventory?${params.toString()}`)
  },

  getByEpisode: async (episodeId: string): Promise<InventoryItem> => {
    return apiClient.get(`/episodes/${episodeId}/inventory`)
  },

  update: async (episodeId: string, data: Partial<InventoryItem>): Promise<InventoryItem> => {
    return apiClient.put(`/episodes/${episodeId}/inventory`, data)
  },

  createBulk: async (episodeIds: string[], defaultPricing?: any): Promise<any> => {
    return apiClient.post('/inventory', { episodeIds, defaultPricing })
  },

  subscribe: async (callback: (data: any) => void): Promise<() => void> => {
    // WebSocket subscription for real-time updates (browser only)
    if (typeof window === 'undefined') {
      // Return a no-op function for server-side rendering
      return () => {}
    }
    
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/inventory/subscribe`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      callback(data)
    }
    
    return () => ws.close()
  }
}