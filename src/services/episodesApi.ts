import { api } from './api'
import { imageService } from './imageService'

export interface Episode {
  id: string
  title: string
  description?: string
  show: string
  showId: string
  showLogo: string
  publishDate: string
  scheduledDate?: string
  duration: string
  status: 'published' | 'scheduled' | 'draft' | 'recording' | 'editing'
  downloads: number
  adSlots: number
  filledSlots: number
  revenue: number
  audioUrl?: string
  transcriptUrl?: string
  season?: number
  episodeNumber?: number
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface EpisodeStats {
  totalEpisodes: number
  publishedEpisodes: number
  scheduledEpisodes: number
  draftEpisodes: number
  totalDownloads: number
  totalRevenue: number
  averageRevenue: number
  topEpisode?: {
    id: string
    title: string
    downloads: number
  }
}

export interface CreateEpisodeRequest {
  title: string
  description?: string
  showId: string
  publishDate?: string
  scheduledDate?: string
  duration?: string
  adSlots?: number
  season?: number
  episodeNumber?: number
  tags?: string[]
  audioUrl?: string
  transcriptUrl?: string
}

export interface UpdateEpisodeRequest extends Partial<CreateEpisodeRequest> {
  status?: Episode['status']
}

class EpisodesApi {
  async getEpisodes(params?: {
    showId?: string
    status?: string
    search?: string
    page?: number
    limit?: number
    sort?: string
  }): Promise<{
    episodes: Episode[]
    total: number
    page: number
    limit: number
  }> {
    try {
      const response = await api.get<any>('/episodes', { params })
      
      // Transform the response to match our interface
      const episodes = (response.Items || response.episodes || []).map((item: any) => ({
        id: item.id || item.SK?.replace('EPISODE#', ''),
        title: item.title,
        description: item.description,
        show: item.showName || item.show,
        showId: item.showId || item.PK?.replace('SHOW#', ''),
        showLogo: item.showLogo 
          ? imageService.getOptimizedUrl(item.showLogo, { width: 40, height: 40, quality: 85 })
          : imageService.generateCoverImage(item.showName || item.show, { width: 40, height: 40 }),
        publishDate: item.publishDate,
        scheduledDate: item.scheduledDate,
        duration: item.duration || '00:00',
        status: item.status || 'draft',
        downloads: item.downloads || 0,
        adSlots: item.adSlots || 0,
        filledSlots: item.filledSlots || 0,
        revenue: item.revenue || 0,
        audioUrl: item.audioUrl,
        transcriptUrl: item.transcriptUrl,
        season: item.season,
        episodeNumber: item.episodeNumber,
        tags: item.tags || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
      
      return {
        episodes,
        total: response.Count || episodes.length,
        page: params?.page || 1,
        limit: params?.limit || 20
      }
    } catch (error) {
      console.error('Error fetching episodes:', error)
      return {
        episodes: [],
        total: 0,
        page: 1,
        limit: 20
      }
    }
  }

  async getEpisode(episodeId: string): Promise<any> {
    try {
      console.log('📡 EpisodesApi.getEpisode - Fetching episode:', episodeId)
      const response = await api.get<any>(`/episodes/${episodeId}`)
      console.log('📡 EpisodesApi.getEpisode - Response received:', response)
      
      // Return the full response to preserve all fields including YouTube data
      const episode = {
        id: response.id || response.episodeId,
        episodeId: response.episodeId || response.id,
        title: response.title,
        description: response.description,
        show: response.showName || response.show?.name || response.show,
        showName: response.showName || response.show?.name || response.show,
        showId: response.showId,
        showLogo: response.showLogo 
          ? imageService.getOptimizedUrl(response.showLogo, { width: 40, height: 40, quality: 85 })
          : imageService.generateCoverImage(response.showName || response.show?.name || response.show, { width: 40, height: 40 }),
        publishDate: response.airDate || response.releaseDate || response.publishDate,
        airDate: response.airDate,
        releaseDate: response.releaseDate || response.airDate || response.publishDate,
        scheduledDate: response.scheduledDate,
        duration: response.duration || '00:00',
        status: response.status || 'draft',
        downloads: response.downloads || 0,
        adSlots: response.adSlots || 0,
        filledSlots: response.filledSlots || 0,
        revenue: response.revenue || 0,
        audioUrl: response.audioUrl,
        transcriptUrl: response.transcriptUrl,
        season: response.season,
        episodeNumber: response.episodeNumber,
        tags: response.tags || [],
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        // YouTube fields - preserve them from the API response
        youtubeVideoId: response.youtubeVideoId,
        youtubeUrl: response.youtubeUrl,
        youtubeViewCount: response.youtubeViewCount,
        youtubeLikeCount: response.youtubeLikeCount,
        youtubeCommentCount: response.youtubeCommentCount,
        youtubeThumbnailUrl: response.youtubeThumbnailUrl,
        youtubePublishedAt: response.youtubePublishedAt,
        youtubeDuration: response.youtubeDuration,
        // Megaphone fields
        megaphoneId: response.megaphoneId,
        megaphoneDownloads: response.megaphoneDownloads,
        megaphoneUniqueListeners: response.megaphoneUniqueListeners,
        megaphoneCompletionRate: response.megaphoneCompletionRate,
        // Pass through any other fields
        ...response
      }
      console.log('📡 EpisodesApi.getEpisode - Transformed episode with YouTube data:', episode)
      return episode
    } catch (error) {
      console.error('📡 EpisodesApi.getEpisode - Error fetching episode:', error)
      throw error // Re-throw to trigger error handling in the component
    }
  }

  async createEpisode(data: CreateEpisodeRequest): Promise<Episode | null> {
    try {
      const episodeData = {
        ...data,
        status: 'draft',
        downloads: 0,
        adSlots: data.adSlots || 0,
        filledSlots: 0,
        revenue: 0,
        tags: data.tags || []
      }
      
      const response = await api.post<any>('/episodes', episodeData)
      
      return {
        id: response.id,
        title: response.title,
        description: response.description,
        show: response.showName || response.show,
        showId: response.showId,
        showLogo: response.showLogo 
          ? imageService.getOptimizedUrl(response.showLogo, { width: 40, height: 40, quality: 85 })
          : imageService.generateCoverImage(response.showName || response.show, { width: 40, height: 40 }),
        publishDate: response.publishDate,
        scheduledDate: response.scheduledDate,
        duration: response.duration || '00:00',
        status: response.status,
        downloads: response.downloads || 0,
        adSlots: response.adSlots || 0,
        filledSlots: response.filledSlots || 0,
        revenue: response.revenue || 0,
        audioUrl: response.audioUrl,
        transcriptUrl: response.transcriptUrl,
        season: response.season,
        episodeNumber: response.episodeNumber,
        tags: response.tags || [],
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      }
    } catch (error) {
      console.error('Error creating episode:', error)
      return null
    }
  }

  async updateEpisode(episodeId: string, data: UpdateEpisodeRequest): Promise<Episode | null> {
    try {
      const response = await api.put<any>(`/episodes/${episodeId}`, data)
      return response
    } catch (error) {
      console.error('Error updating episode:', error)
      return null
    }
  }

  async deleteEpisode(episodeId: string): Promise<boolean> {
    try {
      await api.delete(`/episodes/${episodeId}`)
      return true
    } catch (error) {
      console.error('Error deleting episode:', error)
      return false
    }
  }

  async publishEpisode(episodeId: string, publishDate?: string): Promise<boolean> {
    try {
      await api.put(`/episodes/${episodeId}/publish`, {
        publishDate: publishDate || new Date().toISOString()
      })
      return true
    } catch (error) {
      console.error('Error publishing episode:', error)
      return false
    }
  }

  async scheduleEpisode(episodeId: string, scheduledDate: string): Promise<boolean> {
    try {
      await api.put(`/episodes/${episodeId}/schedule`, {
        scheduledDate,
        status: 'scheduled'
      })
      return true
    } catch (error) {
      console.error('Error scheduling episode:', error)
      return false
    }
  }

  async getEpisodeStats(params?: {
    showId?: string
    dateRange?: string
  }): Promise<EpisodeStats> {
    try {
      const response = await api.get<any>('/episodes/stats', { params })
      
      return {
        totalEpisodes: response.totalEpisodes || 0,
        publishedEpisodes: response.publishedEpisodes || 0,
        scheduledEpisodes: response.scheduledEpisodes || 0,
        draftEpisodes: response.draftEpisodes || 0,
        totalDownloads: response.totalDownloads || 0,
        totalRevenue: response.totalRevenue || 0,
        averageRevenue: response.averageRevenue || 0,
        topEpisode: response.topEpisode
      }
    } catch (error) {
      console.error('Error fetching episode stats:', error)
      return {
        totalEpisodes: 0,
        publishedEpisodes: 0,
        scheduledEpisodes: 0,
        draftEpisodes: 0,
        totalDownloads: 0,
        totalRevenue: 0,
        averageRevenue: 0
      }
    }
  }

  async uploadAudio(episodeId: string, audioFile: File): Promise<{
    success: boolean
    audioUrl?: string
    duration?: string
    error?: string
  }> {
    try {
      const formData = new FormData()
      formData.append('audio', audioFile)
      
      const response = await fetch(`/episodes/${episodeId}/audio`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload audio')
      }
      
      const result = await response.json()
      return {
        success: true,
        audioUrl: result.audioUrl,
        duration: result.duration
      }
    } catch (error) {
      console.error('Error uploading audio:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  async getShowEpisodes(showId: string, params?: {
    status?: string
    limit?: number
    sort?: string
  }): Promise<Episode[]> {
    try {
      const response = await this.getEpisodes({
        showId,
        ...params
      })
      return response.episodes
    } catch (error) {
      console.error('Error fetching show episodes:', error)
      return []
    }
  }

  async list(params?: {
    showId?: string
    status?: string
    search?: string
    page?: number
    limit?: number
    sort?: string
  }): Promise<{
    episodes: any[]
    total: number
    page: number
    limit: number
  }> {
    try {
      // Call the show's episodes endpoint which includes YouTube data
      const response = await api.get<any>(`/shows/${params?.showId}/episodes`, { 
        params: {
          ...params,
          youtube: true // Include YouTube analytics
        }
      })
      
      // Transform the response to include all YouTube and Megaphone fields
      const episodes = (response.data || []).map((item: any) => ({
        episodeId: item.id,
        episodeNumber: item.episodeNumber,
        title: item.title,
        airDate: item.airDate,
        duration: item.duration || '0',
        durationSeconds: item.durationSeconds || item.duration,
        status: item.status || 'draft',
        audioUrl: item.audioUrl,
        // YouTube analytics fields (Video)
        youtubeVideoId: item.youtubeVideoId,
        youtubeViewCount: item.youtubeViewCount,
        youtubeLikeCount: item.youtubeLikeCount,
        youtubeCommentCount: item.youtubeCommentCount,
        youtubeUrl: item.youtubeUrl,
        thumbnailUrl: item.thumbnailUrl,
        // Megaphone analytics fields (Audio)
        megaphoneId: item.megaphoneId,
        megaphoneDownloads: item.megaphoneDownloads,
        megaphoneImpressions: item.megaphoneImpressions,
        megaphoneUniqueListeners: item.megaphoneUniqueListeners,
        megaphoneAvgListenTime: item.megaphoneAvgListenTime,
        megaphoneCompletionRate: item.megaphoneCompletionRate,
        megaphoneUrl: item.megaphoneUrl,
      }))
      
      return {
        episodes,
        total: response.meta?.total || episodes.length,
        page: params?.page || 1,
        limit: params?.limit || 50
      }
    } catch (error) {
      console.error('Error fetching episodes list:', error)
      return {
        episodes: [],
        total: 0,
        page: 1,
        limit: 50
      }
    }
  }
}

export const episodesApi = new EpisodesApi()