import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/config/queryClient'
import { agencyApi, advertiserApi, campaignApi } from '@/services/api'
import { dashboardApi } from '@/services/dashboardApi'

/**
 * Prefetch commonly accessed data to improve perceived performance
 * Call this on app initialization or on specific page loads
 */
export async function prefetchCommonData(queryClient: QueryClient) {
  // Prefetch in parallel for better performance
  await Promise.all([
    // Prefetch agencies and advertisers (commonly used in dropdowns)
    queryClient.prefetchQuery({
      queryKey: queryKeys.composite.agenciesAndAdvertisers,
      queryFn: async () => {
        const [agencies, advertisers] = await Promise.all([
          agencyApi.list({ limit: 1000 }),
          advertiserApi.list({ limit: 1000 }),
        ])
        return {
          agencies: agencies.agencies || agencies,
          advertisers: advertisers.advertisers || advertisers,
        }
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    }),

    // Prefetch dashboard metrics
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.metrics(),
      queryFn: () => dashboardApi.getDashboardData('thisMonth'),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  ])
}

/**
 * Prefetch data for a specific page
 */
export const pagePrefetchers = {
  campaigns: async (queryClient: QueryClient) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.campaigns.list(),
      queryFn: () => campaignApi.getAll({ limit: 50 }),
      staleTime: 2 * 60 * 1000, // 2 minutes
    })
  },

  agencies: async (queryClient: QueryClient) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.agencies.list(),
      queryFn: () => agencyApi.list(),
      staleTime: 10 * 60 * 1000, // 10 minutes
    })
  },

  advertisers: async (queryClient: QueryClient) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.advertisers.list(),
      queryFn: () => advertiserApi.list(),
      staleTime: 10 * 60 * 1000, // 10 minutes
    })
  },

  agencyDetail: async (queryClient: QueryClient, agencyId: string) => {
    await Promise.all([
      // Prefetch agency details
      queryClient.prefetchQuery({
        queryKey: queryKeys.agencies.detail(agencyId),
        queryFn: () => fetch(`/api/agencies/${agencyId}`).then(res => res.json()),
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),
      
      // Prefetch campaigns for this agency
      queryClient.prefetchQuery({
        queryKey: queryKeys.campaigns.byAgency(agencyId),
        queryFn: () => campaignApi.getAll({ agencyId }),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),
    ])
  },

  advertiserDetail: async (queryClient: QueryClient, advertiserId: string) => {
    await Promise.all([
      // Prefetch advertiser details
      queryClient.prefetchQuery({
        queryKey: queryKeys.advertisers.detail(advertiserId),
        queryFn: () => fetch(`/api/advertisers/${advertiserId}`).then(res => res.json()),
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),
      
      // Prefetch campaigns for this advertiser
      queryClient.prefetchQuery({
        queryKey: queryKeys.campaigns.byAdvertiser(advertiserId),
        queryFn: () => campaignApi.getAll({ advertiserId }),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),
    ])
  },
}

/**
 * Warm up the cache with essential data after login
 */
export async function warmUpCache(queryClient: QueryClient, userRole: string) {
  try {
    // Common data for all users
    await prefetchCommonData(queryClient)

    // Role-specific prefetching
    switch (userRole) {
      case 'admin':
      case 'master':
        // Admins need more data upfront
        await Promise.all([
          pagePrefetchers.campaigns(queryClient),
          pagePrefetchers.agencies(queryClient),
          pagePrefetchers.advertisers(queryClient),
        ])
        break
        
      case 'sales':
        // Sales team mainly needs campaign and client data
        await Promise.all([
          pagePrefetchers.campaigns(queryClient),
          pagePrefetchers.advertisers(queryClient),
        ])
        break
        
      // Other roles can prefetch as needed
    }
  } catch (error) {
    // Don't block app initialization if prefetching fails
    console.error('Cache warm-up failed:', error)
  }
}