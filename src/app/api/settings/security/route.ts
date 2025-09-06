import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { OrgSecuritySettings, DEFAULT_SECURITY_SETTINGS, SecurityEventType } from '@/types/security'
import { createAuditLog } from '@/lib/audit/audit-logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schema for security settings
const SecuritySettingsSchema = z.object({
  mfaRequired: z.boolean().optional(),
  mfaGracePeriodDays: z.number().min(0).max(30).optional(),
  
  sso: z.object({
    enabled: z.boolean(),
    provider: z.enum(['oidc', 'saml', 'google', 'microsoft']).nullable().optional(),
    config: z.object({
      issuerUrl: z.string().url().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      metadataUrl: z.string().url().optional(),
      certificate: z.string().optional(),
      callbackUrl: z.string().url().optional(),
      allowedDomains: z.array(z.string()).optional(),
    }).optional(),
    enforceForNonAdmins: z.boolean().optional(),
  }).optional(),
  
  passwordPolicy: z.object({
    minLength: z.number().min(6).max(128),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumbers: z.boolean(),
    requireSymbols: z.boolean(),
    expiryDays: z.number().min(0).max(365).optional(),
    historyCount: z.number().min(0).max(24).optional(),
    maxAttempts: z.number().min(3).max(10).optional(),
    lockoutDurationMinutes: z.number().min(5).max(1440).optional(),
  }).optional(),
  
  session: z.object({
    idleTimeoutMinutes: z.number().min(5).max(10080), // Max 1 week
    absoluteTimeoutHours: z.number().min(1).max(720), // Max 30 days
    refreshRotation: z.enum(['rotate', 'static']),
    maxConcurrentSessions: z.number().min(1).max(10).optional(),
    requireReauthForSensitive: z.boolean().optional(),
  }).optional(),
  
  ipRestrictions: z.object({
    enabled: z.boolean(),
    allowlist: z.array(z.string()).optional(), // Should validate CIDR format
    blocklist: z.array(z.string()).optional(),
    enforceForAdmins: z.boolean().optional(),
  }).optional(),
  
  exportPolicy: z.object({
    requireApproval: z.boolean(),
    allowedRoles: z.array(z.string()),
    watermarkExports: z.boolean().optional(),
    maxRecordsPerExport: z.number().min(100).max(1000000).optional(),
    auditAllExports: z.boolean(),
  }).optional(),
  
  apiKeys: z.object({
    enabled: z.boolean(),
    maxKeysPerUser: z.number().min(1).max(20).optional(),
    requireExpiry: z.boolean().optional(),
    defaultExpiryDays: z.number().min(1).max(365).optional(),
    allowedScopes: z.array(z.string()).optional(),
  }).optional(),
  
  webhookSecurity: z.object({
    signingEnabled: z.boolean(),
    signingKeyId: z.string().optional(),
    rotateAfterDays: z.number().min(1).max(365).optional(),
    verifySSL: z.boolean().optional(),
  }).optional(),
  
  auditSettings: z.object({
    retentionDays: z.number().min(7).max(2555), // Max 7 years
    logLevel: z.enum(['minimal', 'standard', 'detailed', 'verbose']),
    logSensitiveActions: z.boolean(),
    requireReasonForDeletion: z.boolean().optional(),
  }).optional(),
  
  categoryExclusivity: z.object({
    enforced: z.boolean(),
    exclusivityWindowDays: z.number().min(1).max(365).optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
  
  version: z.number().optional(),
})

// Helper to validate CIDR notation
function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(cidr)) return false
  
  const [ip, prefix] = cidr.split('/')
  const parts = ip.split('.')
  
  // Validate IP parts
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (num < 0 || num > 255) return false
  }
  
  // Validate prefix
  const prefixNum = parseInt(prefix, 10)
  return prefixNum >= 0 && prefixNum <= 32
}

// GET /api/settings/security - Get organization security settings
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can view security settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization ID from session
    if (!session.organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    console.log('🔐 Security Settings API: Fetching for org:', session.organizationId)

    // Get organization with current settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        settings: true,
        updatedAt: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Extract security settings from organization settings
    const currentSettings = (organization.settings as any)?.security || {}
    
    // Merge with defaults to ensure all fields are present
    const securitySettings: OrgSecuritySettings = {
      ...DEFAULT_SECURITY_SETTINGS,
      ...currentSettings,
      version: currentSettings.version || 1,
      lastUpdatedAt: currentSettings.lastUpdatedAt || organization.updatedAt.toISOString(),
      lastUpdatedBy: currentSettings.lastUpdatedBy || 'system',
    }

    // Add ETag for optimistic concurrency
    const etag = `"${securitySettings.version}-${new Date(securitySettings.lastUpdatedAt).getTime()}"`
    
    return NextResponse.json(securitySettings, {
      headers: {
        'ETag': etag,
        'Cache-Control': 'private, no-cache',
      }
    })

  } catch (error) {
    console.error('❌ Security Settings GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch security settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/security - Update organization security settings
export async function PUT(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can update security settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization ID from session
    if (!session.organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = SecuritySettingsSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid security settings', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updates = validation.data

    // Validate CIDR blocks if IP restrictions are provided
    if (updates.ipRestrictions) {
      const allCIDRs = [
        ...(updates.ipRestrictions.allowlist || []),
        ...(updates.ipRestrictions.blocklist || [])
      ]
      
      for (const cidr of allCIDRs) {
        if (!isValidCIDR(cidr)) {
          return NextResponse.json(
            { error: `Invalid CIDR notation: ${cidr}` },
            { status: 400 }
          )
        }
      }
    }

    // Check If-Match header for optimistic concurrency
    const ifMatch = request.headers.get('If-Match')
    const expectedVersion = body.version || 1

    console.log('🔐 Security Settings API: Updating for org:', session.organizationId)

    // Get current organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        settings: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const currentSettings = (organization.settings as any) || {}
    const currentSecuritySettings = currentSettings.security || {}
    const currentVersion = currentSecuritySettings.version || 1

    // Check version mismatch
    if (ifMatch || expectedVersion > 1) {
      if (currentVersion !== expectedVersion) {
        return NextResponse.json(
          { 
            error: 'Version mismatch. Another admin may have updated the settings.',
            currentVersion,
            expectedVersion,
          },
          { status: 409 } // Conflict
        )
      }
    }

    // Prepare updated security settings
    const updatedSecuritySettings: OrgSecuritySettings = {
      ...DEFAULT_SECURITY_SETTINGS,
      ...currentSecuritySettings,
      ...updates,
      version: currentVersion + 1,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: session.email,
    }

    // Update organization settings
    const updatedOrg = await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        settings: {
          ...currentSettings,
          security: updatedSecuritySettings,
        },
        updatedAt: new Date(),
      },
    })

    // Create audit log entry
    await createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: SecurityEventType.SECURITY_SETTINGS_UPDATED,
      resource: 'security_settings',
      resourceId: session.organizationId,
      changes: {
        before: currentSecuritySettings,
        after: updatedSecuritySettings,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    // Return updated settings with new ETag
    const newEtag = `"${updatedSecuritySettings.version}-${new Date(updatedSecuritySettings.lastUpdatedAt).getTime()}"`
    
    return NextResponse.json(updatedSecuritySettings, {
      headers: {
        'ETag': newEtag,
        'Cache-Control': 'private, no-cache',
      }
    })

  } catch (error) {
    console.error('❌ Security Settings PUT Error:', error)
    
    // Log failed update attempt
    try {
      const session = await getSessionFromCookie(request)
      if (session && session.organizationId) {
        await createAuditLog({
          organizationId: session.organizationId,
          userId: session.userId,
          userEmail: session.email,
          action: SecurityEventType.SECURITY_SETTINGS_UPDATED,
          resource: 'security_settings',
          resourceId: session.organizationId,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
    }
    
    return NextResponse.json(
      { error: 'Failed to update security settings' },
      { status: 500 }
    )
  }
}