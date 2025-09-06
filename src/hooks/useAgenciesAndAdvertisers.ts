import { useQuery } from '@tanstack/react-query'
import { agencyApi, advertiserApi } from '@/services/api'
import { queryKeys } from '@/config/queryClient'

interface AgenciesAndAdvertisersData {
  agencies: any[]
  advertisers: any[]
}

export function useAgenciesAndAdvertisers() {
  return useQuery<AgenciesAndAdvertisersData>({
    queryKey: queryKeys.composite.agenciesAndAdvertisers,
    queryFn: async () => {
      // Batch both requests in parallel
      const [agenciesResponse, advertisersResponse] = await Promise.all([
        agencyApi.list({ limit: 1000 }), // Get all for selectors
        advertiserApi.list({ limit: 1000 }), // Get all for selectors
      ])
      
      return {
        agencies: agenciesResponse.agencies || agenciesResponse,
        advertisers: advertisersResponse.advertisers || advertisersResponse,
      }
    },
    // Keep this data fresh for longer since it doesn't change often
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Convenience hooks for accessing just agencies or advertisers from the composite query
export function useCachedAgencies() {
  const { data, ...rest } = useAgenciesAndAdvertisers()
  return {
    data: data?.agencies || [],
    ...rest,
  }
}

export function useCachedAdvertisers() {
  const { data, ...rest } = useAgenciesAndAdvertisers()
  return {
    data: data?.advertisers || [],
    ...rest,
  }
}