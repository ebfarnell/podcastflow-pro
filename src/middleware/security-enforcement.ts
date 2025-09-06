import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { OrgSecuritySettings } from '@/types/security'
import { createAuditLog } from '@/lib/audit/audit-logger'
import { SecurityEventType } from '@/types/security'

// Check if IP is in CIDR range
function isIpInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/')
  const mask = ~(2 ** (32 - parseInt(bits)) - 1)
  
  const ipNum = ip.split('.').reduce((sum, octet) => (sum << 8) + parseInt(octet), 0)
  const rangeNum = range.split('.').reduce((sum, octet) => (sum << 8) + parseInt(octet), 0)
  
  return (ipNum & mask) === (rangeNum & mask)
}

// Get client IP from request
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  return ip.trim()
}

// Check IP restrictions
export async function checkIpRestrictions(
  request: NextRequest,
  settings: OrgSecuritySettings,
  session: any
): Promise<NextResponse | null> {
  if (!settings.ipRestrictions?.enabled) {
    return null // No restrictions
  }

  // Check if admin exemption applies
  if (settings.ipRestrictions.enforceForAdmins === false && ['admin', 'master'].includes(session.role)) {
    return null // Admins exempt
  }

  const clientIp = getClientIp(request)
  
  // Check blocklist first
  if (settings.ipRestrictions.blocklist?.length) {
    for (const blockedRange of settings.ipRestrictions.blocklist) {
      if (isIpInRange(clientIp, blockedRange)) {
        // Log violation
        await createAuditLog({
          organizationId: session.organizationId,
          userId: session.userId,
          userEmail: session.email,
          action: SecurityEventType.IP_RESTRICTION_VIOLATION,
          resource: 'api_access',
          ipAddress: clientIp,
          userAgent: request.headers.get('user-agent') || 'unknown',
          success: false,
          errorMessage: `Blocked IP ${clientIp} attempted access`,
        })
        
        return NextResponse.json(
          { error: 'Access denied from this network location' },
          { status: 403 }
        )
      }
    }
  }

  // Check allowlist
  if (settings.ipRestrictions.allowlist?.length) {
    let allowed = false
    for (const allowedRange of settings.ipRestrictions.allowlist) {
      if (isIpInRange(clientIp, allowedRange)) {
        allowed = true
        break
      }
    }
    
    if (!allowed) {
      // Log violation
      await createAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        userEmail: session.email,
        action: SecurityEventType.IP_RESTRICTION_VIOLATION,
        resource: 'api_access',
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: false,
        errorMessage: `Non-allowlisted IP ${clientIp} attempted access`,
      })
      
      return NextResponse.json(
        { error: 'Access denied from this network location' },
        { status: 403 }
      )
    }
  }

  return null // Access allowed
}

// Check session security settings
export async function checkSessionSecurity(
  request: NextRequest,
  settings: OrgSecuritySettings,
  session: any
): Promise<NextResponse | null> {
  if (!settings.session) {
    return null
  }

  const now = new Date()
  const sessionCreated = new Date(session.createdAt)
  const lastAccessed = new Date(session.lastAccessedAt)
  
  // Check absolute timeout
  if (settings.session.absoluteTimeoutHours) {
    const absoluteTimeout = settings.session.absoluteTimeoutHours * 60 * 60 * 1000
    if (now.getTime() - sessionCreated.getTime() > absoluteTimeout) {
      // Delete expired session
      await prisma.session.delete({
        where: { id: session.id }
      })
      
      return NextResponse.json(
        { error: 'Session expired. Please login again.' },
        { status: 401 }
      )
    }
  }

  // Check idle timeout
  if (settings.session.idleTimeoutMinutes) {
    const idleTimeout = settings.session.idleTimeoutMinutes * 60 * 1000
    if (now.getTime() - lastAccessed.getTime() > idleTimeout) {
      // Delete idle session
      await prisma.session.delete({
        where: { id: session.id }
      })
      
      return NextResponse.json(
        { error: 'Session timed out due to inactivity. Please login again.' },
        { status: 401 }
      )
    }
  }

  // Update last accessed time
  await prisma.session.update({
    where: { id: session.id },
    data: { lastAccessedAt: now }
  })

  return null // Session valid
}

// Check MFA requirements
export async function checkMfaRequirement(
  request: NextRequest,
  settings: OrgSecuritySettings,
  session: any
): Promise<NextResponse | null> {
  if (!settings.mfaRequired) {
    return null
  }

  // Get user's MFA status
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { twoFactorEnabled: true, createdAt: true }
  })

  if (!user?.twoFactorEnabled) {
    // Check grace period
    if (settings.mfaGracePeriodDays) {
      const gracePeriodEnd = new Date(user.createdAt)
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + settings.mfaGracePeriodDays)
      
      if (new Date() < gracePeriodEnd) {
        // Still in grace period, allow but warn
        console.warn(`User ${session.email} accessing without MFA (in grace period)`)
        return null
      }
    }

    // MFA required but not enabled
    return NextResponse.json(
      { 
        error: 'Multi-factor authentication is required',
        code: 'MFA_REQUIRED',
        setupUrl: '/settings?tab=security'
      },
      { status: 403 }
    )
  }

  return null // MFA check passed
}

// Check export permissions
export async function checkExportPermissions(
  request: NextRequest,
  settings: OrgSecuritySettings,
  session: any
): Promise<NextResponse | null> {
  // This would be called specifically from export endpoints
  if (!settings.exportPolicy) {
    return null
  }

  // Check if user's role is allowed to export
  if (!settings.exportPolicy.allowedRoles?.includes(session.role)) {
    await createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      resource: 'data_export',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: false,
      errorMessage: `Role ${session.role} not allowed to export data`,
    })
    
    return NextResponse.json(
      { error: 'You do not have permission to export data' },
      { status: 403 }
    )
  }

  // Check if approval is required
  if (settings.exportPolicy.requireApproval && session.role !== 'master') {
    // Would need to check for approval record
    return NextResponse.json(
      { 
        error: 'Data export requires approval',
        code: 'APPROVAL_REQUIRED'
      },
      { status: 403 }
    )
  }

  // Log the export
  if (settings.exportPolicy.auditAllExports) {
    await createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: SecurityEventType.DATA_EXPORTED,
      resource: request.nextUrl.pathname,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })
  }

  return null // Export allowed
}

// Main security enforcement function
export async function enforceSecurityPolicies(
  request: NextRequest,
  session: any
): Promise<NextResponse | null> {
  try {
    // Get organization security settings
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    if (!org) {
      return null // No org found, let request continue
    }

    const securitySettings = (org.settings as any)?.security as OrgSecuritySettings
    if (!securitySettings) {
      return null // No security settings configured
    }

    // Check IP restrictions
    const ipCheck = await checkIpRestrictions(request, securitySettings, session)
    if (ipCheck) return ipCheck

    // Check session security
    const sessionCheck = await checkSessionSecurity(request, securitySettings, session)
    if (sessionCheck) return sessionCheck

    // Check MFA requirements
    const mfaCheck = await checkMfaRequirement(request, securitySettings, session)
    if (mfaCheck) return mfaCheck

    // Check export permissions for export endpoints
    if (request.nextUrl.pathname.includes('/export') || 
        request.nextUrl.pathname.includes('/download')) {
      const exportCheck = await checkExportPermissions(request, securitySettings, session)
      if (exportCheck) return exportCheck
    }

    return null // All checks passed
  } catch (error) {
    console.error('Security enforcement error:', error)
    // Don't block on error, let request continue
    return null
  }
}

// Password validation against policy
export function validatePasswordPolicy(
  password: string,
  policy?: OrgSecuritySettings['passwordPolicy']
): { valid: boolean; errors: string[] } {
  if (!policy) {
    return { valid: true, errors: [] }
  }

  const errors: string[] = []

  if (password.length < (policy.minLength || 8)) {
    errors.push(`Password must be at least ${policy.minLength || 8} characters`)
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (policy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}