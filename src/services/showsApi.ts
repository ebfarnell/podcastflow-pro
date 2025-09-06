import { api } from './api'
import { imageService } from './imageService'

export interface Show {
  id: string
  name: string
  host: string
  category: string
  coverImage: string
  description: string
  subscribers: number
  avgDownloads: number
  episodes: number
  frequency: string
  rating: number
  revenue: number
  availableSlots: number
  nextEpisode: string
  status: 'active' | 'paused' | 'archived'
  createdAt?: string
  updatedAt?: string
}

export interface ShowsResponse {
  shows: Show[]
  total: number
  page: number
  limit: number
}

export interface CreateShowRequest {
  name: string
  host: string
  category: string
  description: string
  frequency: string
  coverImage?: string
}

export interface UpdateShowRequest extends Partial<CreateShowRequest> {
  status?: Show['status']
  availableSlots?: number
}

class ShowsApi {
  async getShows(params?: {
    page?: number
    limit?: number
    search?: string
    category?: string
    status?: string
    sort?: string
  }): Promise<ShowsResponse> {
    try {
      const response = await api.get<any>('/shows', { params })
      
      // Transform the response to match our interface
      const shows = (response.Items || response.shows || []).map((item: any) => ({
        id: item.id || item.SK?.replace('SHOW#', ''),
        name: item.name,
        host: item.host,
        category: item.category,
        coverImage: item.coverImage 
          ? imageService.getOptimizedUrl(item.coverImage, { width: 300, height: 300, quality: 85 })
          : imageService.generateCoverImage(item.name, { width: 300, height: 300 }),
        description: item.description || '',
        subscribers: item.subscribers || 0,
        avgDownloads: item.avgDownloads || 0,
        episodes: item.episodes || 0,
        frequency: item.frequency || 'Weekly',
        rating: item.rating || 0,
        revenue: item.revenue || 0,
        availableSlots: item.availableSlots || 0,
        nextEpisode: item.nextEpisode || '',
        status: item.status || 'active',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
      
      return {
        shows,
        total: response.Count || shows.length,
        page: params?.page || 1,
        limit: params?.limit || 20
      }
    } catch (error) {
      console.error('Error fetching shows:', error)
      // Return empty structure on error
      return {
        shows: [],
        total: 0,
        page: 1,
        limit: 20
      }
    }
  }

  async getShow(showId: string): Promise<Show | null> {
    try {
      const response = await api.get<any>(`/shows/${showId}`)
      
      return {
        id: response.id || response.SK?.replace('SHOW#', ''),
        name: response.name,
        host: response.host,
        category: response.category,
        coverImage: response.coverImage 
          ? imageService.getOptimizedUrl(response.coverImage, { width: 300, height: 300, quality: 85 })
          : imageService.generateCoverImage(response.name, { width: 300, height: 300 }),
        description: response.description || '',
        subscribers: response.subscribers || 0,
        avgDownloads: response.avgDownloads || 0,
        episodes: response.episodes || 0,
        frequency: response.frequency || 'Weekly',
        rating: response.rating || 0,
        revenue: response.revenue || 0,
        availableSlots: response.availableSlots || 0,
        nextEpisode: response.nextEpisode || '',
        status: response.status || 'active',
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      }
    } catch (error) {
      console.error('Error fetching show:', error)
      return null
    }
  }

  async createShow(data: CreateShowRequest): Promise<Show | null> {
    try {
      const showData = {
        ...data,
        coverImage: data.coverImage 
          ? imageService.getOptimizedUrl(data.coverImage, { width: 300, height: 300, quality: 85 })
          : imageService.generateCoverImage(data.name, { width: 300, height: 300 }),
        subscribers: 0,
        avgDownloads: 0,
        episodes: 0,
        rating: 0,
        revenue: 0,
        availableSlots: 0,
        nextEpisode: '',
        status: 'active'
      }
      
      const response = await api.post<any>('/shows', showData)
      
      return {
        id: response.id,
        ...showData,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      } as Show
    } catch (error) {
      console.error('Error creating show:', error)
      return null
    }
  }

  async updateShow(showId: string, data: UpdateShowRequest): Promise<Show | null> {
    try {
      const response = await api.put<any>(`/shows/${showId}`, data)
      return response
    } catch (error) {
      console.error('Error updating show:', error)
      return null
    }
  }

  async deleteShow(showId: string): Promise<boolean> {
    try {
      await api.delete(`/shows/${showId}`)
      return true
    } catch (error) {
      console.error('Error deleting show:', error)
      return false
    }
  }

  async updateShowStatus(showId: string, status: Show['status']): Promise<boolean> {
    try {
      await api.put(`/shows/${showId}/status`, { status })
      return true
    } catch (error) {
      console.error('Error updating show status:', error)
      return false
    }
  }

  async getShowStats(): Promise<{
    totalShows: number
    totalSubscribers: number
    totalDownloads: number
    monthlyRevenue: number
  }> {
    try {
      const response = await api.get<any>('/shows/stats')
      return {
        totalShows: response.totalShows || 0,
        totalSubscribers: response.totalSubscribers || 0,
        totalDownloads: response.totalDownloads || 0,
        monthlyRevenue: response.monthlyRevenue || 0,
      }
    } catch (error) {
      console.error('Error fetching show stats:', error)
      return {
        totalShows: 0,
        totalSubscribers: 0,
        totalDownloads: 0,
        monthlyRevenue: 0,
      }
    }
  }
}

export const showsApi = new ShowsApi()