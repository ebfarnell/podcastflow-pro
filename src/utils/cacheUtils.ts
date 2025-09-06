import { QueryClient } from '@tanstack/react-query'

/**
 * Centralized cache invalidation utilities for maintaining data consistency
 */
export class CacheManager {
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Invalidate all campaign-related data including dashboard metrics
   * Use this when any campaign is created, updated, deleted, or status changes
   */
  invalidateCampaignData = async () => {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
      this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      // Also invalidate any individual campaign queries
      this.queryClient.invalidateQueries({ queryKey: ['campaign'] }),
    ])
  }

  /**
   * Invalidate specific campaign data
   */
  invalidateCampaign = async (campaignId: string) => {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
      this.queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
      this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  /**
   * Invalidate dashboard data only
   */
  invalidateDashboard = async () => {
    await this.queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  /**
   * Invalidate all related data when shows/episodes change
   */
  invalidateShowData = async () => {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['shows'] }),
      this.queryClient.invalidateQueries({ queryKey: ['episodes'] }),
      this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  /**
   * Force refresh all data
   */
  refreshAllData = async () => {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
      this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      this.queryClient.invalidateQueries({ queryKey: ['shows'] }),
      this.queryClient.invalidateQueries({ queryKey: ['episodes'] }),
    ])
  }
}

/**
 * Hook to get cache manager instance
 */
export const useCacheManager = (queryClient: QueryClient) => {
  return new CacheManager(queryClient)
}