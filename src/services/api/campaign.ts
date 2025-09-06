import { apiClient } from './client'

export interface Campaign {
  id: string
  name: string
  advertiserName?: string
  advertiserId?: string
  status: string
  startDate: string
  endDate: string
  budget: number
  probability?: number
  spent?: number
  impressions?: number
  clicks?: number
  conversions?: number
  createdAt: string
  updatedAt: string
}

export interface CampaignFilters {
  status?: string
  advertiserId?: string
  showId?: string
  startDate?: string
  endDate?: string
}

export const campaignApi = {
  list: async (filters?: CampaignFilters): Promise<Campaign[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.advertiserId) params.append('advertiserId', filters.advertiserId)
    if (filters?.showId) params.append('showId', filters.showId)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    
    const response = await apiClient.get(`/campaigns?${params.toString()}`)
    // Handle the response structure from the API
    return response.campaigns || response || []
  },

  get: async (id: string): Promise<Campaign> => {
    return apiClient.get(`/campaigns/${id}`)
  },

  create: async (data: Partial<Campaign>): Promise<Campaign> => {
    return apiClient.post('/campaigns', data)
  },

  update: async (id: string, data: Partial<Campaign>): Promise<Campaign> => {
    return apiClient.put(`/campaigns/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/campaigns/${id}`)
  },

  getAnalytics: async (id: string): Promise<any> => {
    return apiClient.get(`/campaigns/${id}/analytics`)
  },

  getSchedule: async (id: string): Promise<any> => {
    return apiClient.get(`/campaigns/${id}/schedule`)
  },

  updateSchedule: async (id: string, schedule: any): Promise<any> => {
    return apiClient.put(`/campaigns/${id}/schedule`, schedule)
  }
}