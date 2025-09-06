/**
 * In-memory rate limiter for API endpoints
 * In production, consider using Redis for distributed rate limiting
 */

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  max: number // Max requests per window
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout

  constructor(private options: RateLimitOptions) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  async check(key: string): Promise<{
    allowed: boolean
    limit: number
    remaining: number
    resetIn: number
  }> {
    const now = Date.now()
    const entry = this.limits.get(key)

    // If no entry or window expired, create new
    if (!entry || entry.resetAt <= now) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.options.windowMs
      })
      
      return {
        allowed: true,
        limit: this.options.max,
        remaining: this.options.max - 1,
        resetIn: this.options.windowMs
      }
    }

    // Check if limit exceeded
    if (entry.count >= this.options.max) {
      return {
        allowed: false,
        limit: this.options.max,
        remaining: 0,
        resetIn: entry.resetAt - now
      }
    }

    // Increment counter
    entry.count++
    
    return {
      allowed: true,
      limit: this.options.max,
      remaining: this.options.max - entry.count,
      resetIn: entry.resetAt - now
    }
  }

  reset(key: string): void {
    this.limits.delete(key)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetAt <= now) {
        this.limits.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.limits.clear()
  }
}