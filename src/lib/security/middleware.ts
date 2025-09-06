import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { OrgSecuritySettings, DEFAULT_SECURITY_SETTINGS } from '@/types/security'
import { createSecurityAuditLog } from './audit'
import { RateLimiter } from './rate-limiter'
import { ipMatchesCIDR, parseIPFromRequest } from './ip-utils'

// Cache for org security settings (60 second TTL)
const settingsCache = new Map<string, { settings: OrgSecuritySettings; timestamp: number }>()
const CACHE_TTL = 60000 // 60 seconds

// Rate limiters by endpoint type
const rateLimiters = {
  auth: new RateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 attempts per 15 minutes
  api: new RateLimiter({ windowMs: 60 * 1000, max: 100 }), // 100 requests per minute
  sensitive: new RateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 requests per minute for sensitive ops
}

export interface SecurityContext {
  organizationId: string
  userId?: string
  userEmail?: string
  ipAddress: string
  userAgent: string
  settings: OrgSecuritySettings
  session?: any
}

/**
 * Get cached or fresh organization security settings
 */
async function getOrgSecuritySettings(organizationId: string): Promise<OrgSecuritySettings> {
  // Check cache
  const cached = settingsCache.get(organizationId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.settings
  }

  // Fetch fresh settings
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true }
    })

    const settings = {
      ...DEFAULT_SECURITY_SETTINGS,
      ...(org?.settings as any)?.security || {}
    }

    // Update cache
    settingsCache.set(organizationId, {
      settings,
      timestamp: Date.now()
    })

    return settings
  } catch (error) {
    console.error('Failed to fetch org security settings:', error)
    return DEFAULT_SECURITY_SETTINGS
  }
}

/**
 * Main security enforcement middleware
 */
export async function enforceOrgSecurity(
  request: NextRequest,
  options: {
    requireAuth?: boolean
    requireAdmin?: boolean
    requireMFA?: boolean
    sensitiveAction?: boolean
    apiKey?: string
  } = {}
): Promise<SecurityContext | NextResponse> {
  const ipAddress = parseIPFromRequest(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const path = request.nextUrl.pathname

  // Skip enforcement for health checks and auth callbacks
  if (path === '/api/health' || path.includes('/api/auth/callback')) {
    return {
      organizationId: 'system',
      ipAddress,
      userAgent,
      settings: DEFAULT_SECURITY_SETTINGS
    }
  }

  // Get session if auth is required
  let session = null
  let organizationId = null
  
  if (options.requireAuth || options.apiKey) {
    if (options.apiKey) {
      // Validate API key
      const apiKeyResult = await validateApiKey(options.apiKey, path)
      if (apiKeyResult instanceof NextResponse) return apiKeyResult
      
      organizationId = apiKeyResult.organizationId
      // Create pseudo-session from API key
      session = {
        userId: apiKeyResult.userId,
        email: apiKeyResult.userEmail,
        role: 'api',
        organizationId: apiKeyResult.organizationId
      }
    } else {
      session = await getSessionFromCookie(request)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      organizationId = session.organizationId
    }
  }

  if (!organizationId) {
    // Try to get org from request context or headers
    organizationId = request.headers.get('x-organization-id') || 'default'
  }

  // Get organization security settings
  const settings = await getOrgSecuritySettings(organizationId)

  // Create security context
  const context: SecurityContext = {
    organizationId,
    userId: session?.userId,
    userEmail: session?.email,
    ipAddress,
    userAgent,
    settings,
    session
  }

  // 1. Check rate limiting
  const rateLimitKey = `${ipAddress}:${session?.userId || 'anonymous'}`
  const limiterType = path.includes('/auth') ? 'auth' : 
                     options.sensitiveAction ? 'sensitive' : 'api'
  
  const rateLimitResult = await rateLimiters[limiterType].check(rateLimitKey)
  if (!rateLimitResult.allowed) {
    await createSecurityAuditLog({
      organizationId,
      userId: session?.userId,
      userEmail: session?.email,
      action: 'RATE_LIMIT_EXCEEDED',
      resource: path,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: `Rate limit exceeded: ${rateLimitResult.remaining}/${rateLimitResult.limit}`
    })
    
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimitResult.resetIn },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimitResult.resetIn / 1000)),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': new Date(Date.now() + rateLimitResult.resetIn).toISOString()
        }
      }
    )
  }

  // 2. Check IP restrictions
  if (settings.ipRestrictions?.enabled) {
    const ipAllowed = await checkIPRestrictions(
      ipAddress,
      settings.ipRestrictions,
      session?.role === 'admin' || session?.role === 'master'
    )
    
    if (!ipAllowed) {
      await createSecurityAuditLog({
        organizationId,
        userId: session?.userId,
        userEmail: session?.email,
        action: 'IP_BLOCKED',
        resource: path,
        ipAddress,
        userAgent,
        success: false,
        errorMessage: `IP address ${ipAddress} is not allowed`
      })
      
      return NextResponse.json(
        { error: 'Access denied from this IP address' },
        { status: 403 }
      )
    }
  }

  // 3. Check if user account is locked
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { lockedUntil: true }
    })
    
    if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return NextResponse.json(
        { error: 'Account is locked', lockedUntil: user.lockedUntil },
        { status: 423 } // Locked
      )
    }
  }

  // 4. Check MFA requirement
  if (settings.mfaRequired || options.requireMFA) {
    if (session && !session.mfaVerified) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { twoFactorEnabled: true, mfaEnrolledAt: true }
      })
      
      if (!user?.twoFactorEnabled) {
        // Check grace period
        const gracePeriodEnd = user?.mfaEnrolledAt ? 
          new Date(user.mfaEnrolledAt.getTime() + (settings.mfaGracePeriodDays || 7) * 24 * 60 * 60 * 1000) :
          null
        
        if (!gracePeriodEnd || gracePeriodEnd < new Date()) {
          return NextResponse.json(
            { error: 'MFA enrollment required', requireMFA: true },
            { status: 403 }
          )
        }
      } else if (options.sensitiveAction) {
        // Require step-up authentication for sensitive actions
        return NextResponse.json(
          { error: 'MFA verification required for this action', requireStepUp: true },
          { status: 403 }
        )
      }
    }
  }

  // 5. Check admin requirement
  if (options.requireAdmin && session) {
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
  }

  // 6. Check SSO enforcement
  if (settings.sso?.enabled && settings.sso?.enforceForNonAdmins) {
    if (session && session.authMethod === 'password' && 
        !['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'SSO authentication required', requireSSO: true },
        { status: 403 }
      )
    }
  }

  return context
}

/**
 * Check if IP address is allowed based on restrictions
 */
async function checkIPRestrictions(
  ipAddress: string,
  restrictions: any,
  isAdmin: boolean
): Promise<boolean> {
  // Skip for admins if configured
  if (isAdmin && !restrictions.enforceForAdmins) {
    return true
  }

  // Check blocklist first
  if (restrictions.blocklist?.length > 0) {
    for (const cidr of restrictions.blocklist) {
      if (ipMatchesCIDR(ipAddress, cidr)) {
        return false // IP is blocked
      }
    }
  }

  // Check allowlist if configured
  if (restrictions.allowlist?.length > 0) {
    for (const cidr of restrictions.allowlist) {
      if (ipMatchesCIDR(ipAddress, cidr)) {
        return true // IP is explicitly allowed
      }
    }
    // If allowlist exists but IP doesn't match, deny
    return false
  }

  // No restrictions or only blocklist - allow by default
  return true
}

/**
 * Validate API key and return context or error
 */
async function validateApiKey(
  apiKey: string,
  path: string
): Promise<any | NextResponse> {
  try {
    // Extract key from Bearer token if needed
    const key = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey
    
    // Hash the key for lookup
    const crypto = require('crypto')
    const keyHash = crypto.createHash('sha256').update(key).digest('hex')
    
    // Find API key
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: true,
        organization: true
      }
    })
    
    if (!apiKeyRecord) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }
    
    // Check scopes if path requires specific scope
    const requiredScope = getRequiredScope(path)
    if (requiredScope && !apiKeyRecord.scopes.includes(requiredScope)) {
      return NextResponse.json(
        { error: 'Insufficient API key scope', required: requiredScope },
        { status: 403 }
      )
    }
    
    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: apiKey
      }
    })
    
    return {
      organizationId: apiKeyRecord.organizationId,
      userId: apiKeyRecord.userId,
      userEmail: apiKeyRecord.user.email,
      scopes: apiKeyRecord.scopes
    }
  } catch (error) {
    console.error('API key validation error:', error)
    return NextResponse.json(
      { error: 'API key validation failed' },
      { status: 500 }
    )
  }
}

/**
 * Get required scope for a given path
 */
function getRequiredScope(path: string): string | null {
  if (path.includes('/api/campaigns')) return 'campaigns'
  if (path.includes('/api/shows')) return 'shows'
  if (path.includes('/api/analytics')) return 'analytics'
  if (path.includes('/api/financials')) return 'financials'
  if (path.includes('/api/settings')) return 'settings'
  if (path.includes('/api/master')) return 'master'
  return null
}

/**
 * Record failed login attempt
 */
export async function recordFailedLogin(
  email: string,
  ipAddress: string,
  reason: string
): Promise<void> {
  try {
    // Record the attempt
    await prisma.loginAttempt.create({
      data: {
        email,
        ipAddress,
        success: false,
        failureReason: reason,
        userAgent: 'unknown'
      }
    })
    
    // Check if user should be locked
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (user) {
      const recentFailures = await prisma.loginAttempt.count({
        where: {
          email,
          success: false,
          attemptedAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
          }
        }
      })
      
      // Get org settings for lockout threshold
      const org = await prisma.organization.findFirst({
        where: {
          users: { some: { id: user.id } }
        }
      })
      
      const settings = (org?.settings as any)?.security || DEFAULT_SECURITY_SETTINGS
      const maxAttempts = settings.passwordPolicy?.maxAttempts || 5
      const lockoutMinutes = settings.passwordPolicy?.lockoutDurationMinutes || 30
      
      if (recentFailures >= maxAttempts) {
        // Lock the account
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000),
            failedLoginAttempts: recentFailures
          }
        })
        
        // Create audit log
        await createSecurityAuditLog({
          organizationId: org?.id || 'system',
          userId: user.id,
          userEmail: user.email,
          action: 'ACCOUNT_LOCKED',
          resource: 'user',
          resourceId: user.id,
          ipAddress,
          userAgent: 'unknown',
          success: true,
          changes: { reason: `${recentFailures} failed login attempts` }
        })
      }
    }
  } catch (error) {
    console.error('Failed to record login attempt:', error)
  }
}

/**
 * Clear failed login attempts after successful login
 */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    })
    
    if (user) {
      // Clear failed attempts count
      await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      })
      
      // Record successful login
      await prisma.loginAttempt.create({
        data: {
          email: user.email,
          ipAddress: 'unknown',
          success: true,
          userAgent: 'unknown'
        }
      })
    }
  } catch (error) {
    console.error('Failed to clear login attempts:', error)
  }
}