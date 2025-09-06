import { QueryClient, QueryCache } from '@tanstack/react-query'

// Create a query client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000,
      // Don't refetch on window focus to reduce API calls
      refetchOnWindowFocus: false,
      // Only retry failed requests once (not 401s)
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false
        return failureCount < 1
      },
      // Prevent aggressive refetching
      refetchInterval: false,
      refetchIntervalInBackground: false,
    },
    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 1
      },
    },
  },
  // Global error handling
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      // Only show errors for user-initiated queries, not background refetches
      if (query.state.data !== undefined) {
        return
      }
      
      const message = error?.response?.data?.error || error?.message || 'An error occurred'
      
      // Don't show auth errors (handled by auth context)
      if (error?.response?.status !== 401) {
        console.error('Query error:', message)
      }
    },
  }),
})

// Query key factory for consistent keys across the app
export const queryKeys = {
  // Agencies
  agencies: {
    all: ['agencies'] as const,
    lists: () => [...queryKeys.agencies.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.agencies.lists(), filters] as const,
    details: () => [...queryKeys.agencies.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.agencies.details(), id] as const,
  },
  
  // Advertisers
  advertisers: {
    all: ['advertisers'] as const,
    lists: () => [...queryKeys.advertisers.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.advertisers.lists(), filters] as const,
    details: () => [...queryKeys.advertisers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.advertisers.details(), id] as const,
  },
  
  // Campaigns
  campaigns: {
    all: ['campaigns'] as const,
    lists: () => [...queryKeys.campaigns.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.campaigns.lists(), filters] as const,
    details: () => [...queryKeys.campaigns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.campaigns.details(), id] as const,
    byAdvertiser: (advertiserId: string) => [...queryKeys.campaigns.all, 'advertiser', advertiserId] as const,
    byAgency: (agencyId: string) => [...queryKeys.campaigns.all, 'agency', agencyId] as const,
  },
  
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    metrics: (dateRange?: string) => [...queryKeys.dashboard.all, 'metrics', dateRange || 'thisMonth'] as const,
    recentActivity: () => [...queryKeys.dashboard.all, 'recent-activity'] as const,
  },
  
  // Shows
  shows: {
    all: ['shows'] as const,
    lists: () => [...queryKeys.shows.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.shows.lists(), filters] as const,
    details: () => [...queryKeys.shows.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.shows.details(), id] as const,
  },
  
  // Episodes
  episodes: {
    all: ['episodes'] as const,
    lists: () => [...queryKeys.episodes.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.episodes.lists(), filters] as const,
    byShow: (showId: string) => [...queryKeys.episodes.all, 'show', showId] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.users.lists(), filters] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
  },
  
  // Organizations
  organizations: {
    all: ['organizations'] as const,
    current: () => [...queryKeys.organizations.all, 'current'] as const,
  },
  
  // Composite queries
  composite: {
    agenciesAndAdvertisers: ['composite', 'agencies-advertisers'] as const,
  },
}