/**
 * Simple in-memory cache for API responses
 * In production, this would be Redis or similar
 */

interface CacheEntry {
  data: any
  expiry: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry> = new Map()

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  async set(key: string, value: any, ttlSeconds: number = 900): Promise<void> {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + (ttlSeconds * 1000)
    })
    
    // Clean up expired entries periodically
    this.cleanupExpired()
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async flush(): Promise<void> {
    this.cache.clear()
  }

  private cleanupExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

export const cache = new SimpleCache()