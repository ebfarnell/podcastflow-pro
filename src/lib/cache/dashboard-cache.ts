import NodeCache from 'node-cache'

// Cache configuration
const CACHE_TTL = 60 // 60 seconds
const CHECK_PERIOD = 120 // Check for expired cache every 2 minutes

// Create cache instances
const dashboardCache = new NodeCache({ 
  stdTTL: CACHE_TTL, 
  checkperiod: CHECK_PERIOD,
  useClones: false // For better performance with large objects
})

const queryCache = new NodeCache({ 
  stdTTL: CACHE_TTL * 2, // Longer TTL for heavy queries
  checkperiod: CHECK_PERIOD,
  useClones: false
})

// Cache key generators
export const cacheKeys = {
  dashboard: (orgSlug: string, dateFrom: string, dateTo: string) => 
    `dashboard:${orgSlug}:${dateFrom}:${dateTo}`,
  
  ordersSummary: (orgSlug: string, dateFrom: string, dateTo: string) => 
    `orders:${orgSlug}:${dateFrom}:${dateTo}`,
  
  contractsSummary: (orgSlug: string) => 
    `contracts:${orgSlug}`,
  
  creativesSummary: (orgSlug: string) => 
    `creatives:${orgSlug}`,
  
  approvalsSummary: (orgSlug: string) => 
    `approvals:${orgSlug}`,
  
  tasksSummary: (orgSlug: string, userId: string) => 
    `tasks:${orgSlug}:${userId}`,
  
  recentActivity: (orgSlug: string, limit: number) => 
    `activity:${orgSlug}:${limit}`
}

// Cache operations
export const cache = {
  // Get from cache
  get: <T>(key: string): T | undefined => {
    return dashboardCache.get<T>(key)
  },

  // Set in cache
  set: <T>(key: string, value: T, ttl?: number): boolean => {
    return dashboardCache.set(key, value, ttl || CACHE_TTL)
  },

  // Delete from cache
  del: (key: string): number => {
    return dashboardCache.del(key)
  },

  // Clear all cache
  flush: (): void => {
    dashboardCache.flushAll()
    queryCache.flushAll()
  },

  // Get cache stats
  stats: () => {
    return {
      dashboard: dashboardCache.getStats(),
      query: queryCache.getStats()
    }
  }
}

// Query cache operations (for heavy queries)
export const queryResultCache = {
  get: <T>(key: string): T | undefined => {
    return queryCache.get<T>(key)
  },

  set: <T>(key: string, value: T, ttl?: number): boolean => {
    return queryCache.set(key, value, ttl || CACHE_TTL * 2)
  },

  del: (key: string): number => {
    return queryCache.del(key)
  }
}

// Cache wrapper for async functions
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number,
  useQueryCache: boolean = false
): Promise<T> {
  const cacheInstance = useQueryCache ? queryResultCache : cache
  
  // Try to get from cache
  const cached = cacheInstance.get<T>(key)
  if (cached !== undefined) {
    return cached
  }

  // Fetch fresh data
  const fresh = await fetchFn()
  
  // Store in cache
  cacheInstance.set(key, fresh, ttl)
  
  return fresh
}

// Invalidation helpers
export const invalidateCache = {
  // Invalidate all dashboard data for an organization
  organization: (orgSlug: string) => {
    const keys = dashboardCache.keys()
    keys.forEach(key => {
      if (key.includes(orgSlug)) {
        dashboardCache.del(key)
      }
    })
  },

  // Invalidate specific summary type
  summaryType: (type: 'orders' | 'contracts' | 'creatives' | 'approvals', orgSlug?: string) => {
    const keys = dashboardCache.keys()
    keys.forEach(key => {
      if (key.startsWith(type) && (!orgSlug || key.includes(orgSlug))) {
        dashboardCache.del(key)
      }
    })
  },

  // Invalidate user-specific data
  userTasks: (userId: string) => {
    const keys = dashboardCache.keys()
    keys.forEach(key => {
      if (key.includes(`tasks:`) && key.includes(userId)) {
        dashboardCache.del(key)
      }
    })
  }
}