/**
 * Rate limiting middleware for multi-tenant API
 * Implements per-tenant rate limiting with Redis backend
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from 'ioredis'
import { UserService } from '@/lib/auth/user-service'

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
  maxRequestsPerTenant?: number  // Higher limit for tenant
  burstAllowance?: number  // Allow burst requests
  skipAuth?: boolean  // Skip auth endpoints
  keyGenerator?: (req: NextRequest, userId?: string, orgId?: string) => string
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Default configuration
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: parseInt(process.env.API_RATE_WINDOW || '900000'), // 15 minutes
  maxRequests: parseInt(process.env.API_RATE_LIMIT || '100'),
  maxRequestsPerTenant: parseInt(process.env.API_RATE_LIMIT_PER_TENANT || '1000'),
  burstAllowance: parseInt(process.env.API_RATE_BURST || '20')
}

// Redis client (singleton)
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    })
    
    redisClient.on('error', (err) => {
      console.error('Redis rate limit error:', err)
    })
  }
  
  return redisClient
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private config: RateLimitConfig
  private redis: Redis
  
  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.redis = getRedisClient()
  }
  
  /**
   * Generate rate limit key
   */
  private generateKey(req: NextRequest, userId?: string, orgId?: string): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req, userId, orgId)
    }
    
    // Default: per-tenant + endpoint rate limiting
    const endpoint = req.nextUrl.pathname
    const method = req.method
    
    if (orgId) {
      return `rate_limit:tenant:${orgId}:${method}:${endpoint}`
    } else if (userId) {
      return `rate_limit:user:${userId}:${method}:${endpoint}`
    } else {
      // IP-based for unauthenticated requests
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      return `rate_limit:ip:${ip}:${method}:${endpoint}`
    }
  }
  
  /**
   * Check if request is allowed
   */
  async checkLimit(req: NextRequest, userId?: string, orgId?: string): Promise<RateLimitResult> {
    const key = this.generateKey(req, userId, orgId)
    const now = Date.now()
    const windowStart = now - this.config.windowMs
    
    // Determine limit based on tenant
    const limit = orgId && this.config.maxRequestsPerTenant 
      ? this.config.maxRequestsPerTenant 
      : this.config.maxRequests
    
    try {
      // Use Redis sorted set for sliding window
      const pipe = this.redis.pipeline()
      
      // Remove old entries
      pipe.zremrangebyscore(key, '-inf', windowStart)
      
      // Count current requests in window
      pipe.zcount(key, windowStart, '+inf')
      
      // Add current request
      pipe.zadd(key, now, `${now}-${Math.random()}`)
      
      // Set expiry
      pipe.expire(key, Math.ceil(this.config.windowMs / 1000))
      
      const results = await pipe.exec()
      
      if (!results) {
        throw new Error('Redis pipeline failed')
      }
      
      const count = (results[1][1] as number) || 0
      const allowed = count < limit + (this.config.burstAllowance || 0)
      
      // Calculate reset time
      const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES')
      const resetTime = oldestEntry.length > 1 
        ? new Date(parseInt(oldestEntry[1]) + this.config.windowMs)
        : new Date(now + this.config.windowMs)
      
      return {
        allowed,
        limit,
        remaining: Math.max(0, limit - count),
        reset: resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime.getTime() - now) / 1000)
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      
      // Fail open in case of Redis failure
      return {
        allowed: true,
        limit,
        remaining: limit,
        reset: new Date(now + this.config.windowMs)
      }
    }
  }
  
  /**
   * Reset rate limit for a specific key
   */
  async reset(req: NextRequest, userId?: string, orgId?: string): Promise<void> {
    const key = this.generateKey(req, userId, orgId)
    await this.redis.del(key)
  }
}

/**
 * Rate limit middleware
 */
export async function withRateLimit(
  request: NextRequest,
  config?: Partial<RateLimitConfig>
): Promise<NextResponse | null> {
  // Skip rate limiting for certain paths
  const skipPaths = ['/api/health', '/api/auth/login', '/api/auth/logout']
  if (skipPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return null
  }
  
  const limiter = new RateLimiter(config)
  
  // Get user and organization from auth
  let userId: string | undefined
  let orgId: string | undefined
  
  const authToken = request.cookies.get('auth-token')
  if (authToken) {
    try {
      const user = await UserService.validateSession(authToken.value)
      if (user) {
        userId = user.id
        orgId = user.organizationId || undefined
      }
    } catch (error) {
      // Continue without user context
    }
  }
  
  // Check rate limit
  const result = await limiter.checkLimit(request, userId, orgId)
  
  // Add rate limit headers to response
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toISOString())
  
  if (!result.allowed) {
    headers.set('Retry-After', result.retryAfter!.toString())
    
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers
      }
    )
  }
  
  // Request allowed - return null to continue
  return null
}

/**
 * Rate limit decorator for API routes
 */
export function rateLimit(config?: Partial<RateLimitConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      const rateLimitResponse = await withRateLimit(request, config)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
      
      return originalMethod.call(this, request, ...args)
    }
    
    return descriptor
  }
}

/**
 * Express-style middleware for rate limiting
 */
export function createRateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const limiter = new RateLimiter(config)
  
  return async (req: NextRequest) => {
    return withRateLimit(req, config)
  }
}