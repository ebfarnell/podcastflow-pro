import { api } from './api'

export interface EpisodeAnalytics {
  id: string
  episodeId: string
  organizationId: string
  date: string
  downloads: number
  uniqueListeners: number
  completions: number
  avgListenTime: number
  spotifyListens: number
  appleListens: number
  googleListens: number
  otherListens: number
  shares: number
  likes: number
  comments: number
  adRevenue: number
  createdAt: string
  updatedAt: string
}

export interface EpisodeAnalyticsSummary {
  totalDownloads: number
  totalListeners: number
  totalCompletions: number
  avgCompletionRate: number
  totalRevenue: number
  platformBreakdown: {
    spotify: number
    apple: number
    google: number
    other: number
  }
  engagement: {
    totalShares: number
    totalLikes: number
    totalComments: number
    avgListenTime: number
  }
  trends: {
    downloadsChange: number
    listenersChange: number
    revenueChange: number
  }
}

export interface TrendDataPoint {
  date: string
  downloads: number
  listeners: number
  completions: number
  revenue: number
}

export interface AnalyticsTimeRange {
  period: '7d' | '30d' | '90d' | '1y'
  startDate?: string
  endDate?: string
}

/**
 * Analytics API Service for Episode Analytics
 */
export const analyticsApiService = {
  
  /**
   * Get analytics summary for an episode
   */
  getEpisodeAnalytics: async (
    episodeId: string, 
    timeRange: AnalyticsTimeRange = { period: '30d' }
  ): Promise<EpisodeAnalyticsSummary> => {
    const params = {
      period: timeRange.period,
      ...(timeRange.startDate && { startDate: timeRange.startDate }),
      ...(timeRange.endDate && { endDate: timeRange.endDate })
    }
    
    try {
      const response = await api.get<EpisodeAnalyticsSummary>(
        `/analytics/episodes/${episodeId}`, 
        { params }
      )
      return response
    } catch (error: any) {
      // Check if this is a YouTube episode (returns specific message from API)
      // Don't log errors for YouTube episodes as they don't have traditional analytics
      if (error?.response?.status === 401 && episodeId?.includes('youtube')) {
        // Silently return empty analytics for YouTube episodes
        return {
          totalDownloads: 0,
          totalListeners: 0,
          totalCompletions: 0,
          avgCompletionRate: 0,
          totalRevenue: 0,
          platformBreakdown: {
            spotify: 0,
            apple: 0,
            google: 0,
            other: 0,
            youtube: 0
          },
          engagement: {
            totalShares: 0,
            totalLikes: 0,
            totalComments: 0,
            avgListenTime: 0
          },
          trends: {
            downloadsChange: 0,
            listenersChange: 0,
            revenueChange: 0
          },
          isYouTubeEpisode: true
        }
      }
      
      // Only log non-YouTube episode errors
      if (!episodeId?.includes('youtube')) {
        console.error('Failed to fetch episode analytics:', error)
      }
      
      // Return default/empty analytics to prevent UI crashes
      return {
        totalDownloads: 0,
        totalListeners: 0,
        totalCompletions: 0,
        avgCompletionRate: 0,
        totalRevenue: 0,
        platformBreakdown: {
          spotify: 0,
          apple: 0,
          google: 0,
          other: 0
        },
        engagement: {
          totalShares: 0,
          totalLikes: 0,
          totalComments: 0,
          avgListenTime: 0
        },
        trends: {
          downloadsChange: 0,
          listenersChange: 0,
          revenueChange: 0
        }
      }
    }
  },

  /**
   * Get analytics trends for an episode
   */
  getEpisodeTrends: async (
    episodeId: string,
    timeRange: AnalyticsTimeRange = { period: '30d' }
  ): Promise<TrendDataPoint[]> => {
    const params = {
      period: timeRange.period,
      ...(timeRange.startDate && { startDate: timeRange.startDate }),
      ...(timeRange.endDate && { endDate: timeRange.endDate })
    }
    
    try {
      const response = await api.get<TrendDataPoint[]>(
        `/analytics/episodes/${episodeId}/trends`, 
        { params }
      )
      return response
    } catch (error) {
      console.error('Failed to fetch episode trends:', error)
      return []
    }
  },

  /**
   * Get analytics for a show (aggregated across episodes)
   */
  getShowAnalytics: async (
    showId: string,
    timeRange: AnalyticsTimeRange = { period: '30d' }
  ): Promise<EpisodeAnalyticsSummary> => {
    const params = {
      period: timeRange.period,
      ...(timeRange.startDate && { startDate: timeRange.startDate }),
      ...(timeRange.endDate && { endDate: timeRange.endDate })
    }
    
    try {
      const response = await api.get<EpisodeAnalyticsSummary>(
        `/analytics/shows/${showId}`, 
        { params }
      )
      return response
    } catch (error) {
      console.error('Failed to fetch show analytics:', error)
      return {
        totalDownloads: 0,
        totalListeners: 0,
        totalCompletions: 0,
        avgCompletionRate: 0,
        totalRevenue: 0,
        platformBreakdown: { spotify: 0, apple: 0, google: 0, other: 0 },
        engagement: { totalShares: 0, totalLikes: 0, totalComments: 0, avgListenTime: 0 },
        trends: { downloadsChange: 0, listenersChange: 0, revenueChange: 0 }
      }
    }
  },

  /**
   * Get show trends
   */
  getShowTrends: async (
    showId: string,
    timeRange: AnalyticsTimeRange = { period: '30d' }
  ): Promise<TrendDataPoint[]> => {
    const params = {
      period: timeRange.period,
      ...(timeRange.startDate && { startDate: timeRange.startDate }),
      ...(timeRange.endDate && { endDate: timeRange.endDate })
    }
    
    try {
      const response = await api.get<TrendDataPoint[]>(
        `/analytics/shows/${showId}/trends`, 
        { params }
      )
      return response
    } catch (error) {
      console.error('Failed to fetch show trends:', error)
      return []
    }
  },

  /**
   * Get detailed daily analytics for an episode
   */
  getEpisodeDailyAnalytics: async (
    episodeId: string,
    timeRange: AnalyticsTimeRange = { period: '30d' }
  ): Promise<EpisodeAnalytics[]> => {
    const params = {
      period: timeRange.period,
      ...(timeRange.startDate && { startDate: timeRange.startDate }),
      ...(timeRange.endDate && { endDate: timeRange.endDate })
    }
    
    try {
      const response = await api.get<EpisodeAnalytics[]>(
        `/analytics/episodes/${episodeId}/daily`, 
        { params }
      )
      return response
    } catch (error) {
      console.error('Failed to fetch daily analytics:', error)
      return []
    }
  },

  /**
   * Track analytics event (for real-time tracking)
   */
  trackEvent: async (event: {
    episodeId: string
    eventType: 'download' | 'stream' | 'listen_start' | 'listen_complete' | 'share' | 'rating'
    platform?: string
    deviceType?: string
    country?: string
    metadata?: any
  }): Promise<void> => {
    try {
      await api.post('/analytics/events', event)
    } catch (error) {
      console.error('Failed to track analytics event:', error)
      // Don't throw - analytics tracking shouldn't break user experience
    }
  },

  /**
   * Add episode rating
   */
  addEpisodeRating: async (episodeId: string, rating: {
    rating: number
    review?: string
    platform?: string
  }): Promise<void> => {
    try {
      await api.post(`/analytics/episodes/${episodeId}/ratings`, rating)
    } catch (error) {
      console.error('Failed to add episode rating:', error)
      throw error
    }
  },

  /**
   * Get episode ratings
   */
  getEpisodeRatings: async (episodeId: string): Promise<{
    averageRating: number
    totalRatings: number
    ratingDistribution: { [key: number]: number }
    recentReviews: Array<{
      rating: number
      review: string
      platform: string
      createdAt: string
    }>
  }> => {
    try {
      const response = await api.get(`/analytics/episodes/${episodeId}/ratings`)
      return response
    } catch (error) {
      console.error('Failed to fetch episode ratings:', error)
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: {},
        recentReviews: []
      }
    }
  }
}

// Export analytics API as part of the main API object
export const enhancedEpisodesApi = {
  ...api,
  
  /**
   * Get episode with analytics data
   */
  getWithAnalytics: async (episodeId: string, timeRange?: AnalyticsTimeRange) => {
    try {
      // Fetch episode data and analytics in parallel
      const [episodeData, analyticsData, ratingsData] = await Promise.all([
        api.get(`/episodes/${episodeId}`),
        analyticsApiService.getEpisodeAnalytics(episodeId, timeRange),
        analyticsApiService.getEpisodeRatings(episodeId)
      ])

      return {
        ...episodeData,
        analytics: analyticsData,
        ratings: ratingsData
      }
    } catch (error) {
      console.error('Failed to fetch episode with analytics:', error)
      throw error
    }
  }
}