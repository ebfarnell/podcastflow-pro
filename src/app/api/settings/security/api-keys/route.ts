import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { createSecurityAuditLog } from '@/lib/security/audit'
import crypto from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// API Key creation schema
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()),
  expiresIn: z.number().min(1).max(365).optional(), // Days
  description: z.string().optional(),
})

// Generate secure API key
function generateApiKey(): { key: string; hash: string; lastFour: string } {
  // Generate a secure random key: prefix_randomBytes
  const prefix = 'pk_live' // Production key prefix
  const randomBytes = crypto.randomBytes(32).toString('base64url')
  const key = `${prefix}_${randomBytes}`
  
  // Hash the key for storage (using SHA256 for consistent hashing)
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  
  // Get last 4 chars for display
  const lastFour = key.slice(-4)
  
  return { key, hash, lastFour }
}

// GET /api/settings/security/api-keys - List API keys
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can manage API keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get API keys from database
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        lastFourChars: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get organization settings for API key configuration
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    const securitySettings = (org?.settings as any)?.security || {}

    // Format response
    const formattedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      displayKey: `••••••••${key.lastFourChars}`,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      createdBy: key.user.name || key.user.email,
      isExpired: key.expiresAt ? new Date(key.expiresAt) < new Date() : false,
      status: key.expiresAt && new Date(key.expiresAt) < new Date() ? 'expired' : 'active'
    }))

    return NextResponse.json({
      keys: formattedKeys,
      settings: {
        enabled: securitySettings.apiKeys?.enabled !== false, // Default to enabled
        maxKeysPerUser: securitySettings.apiKeys?.maxKeysPerUser || 10,
        requireExpiry: securitySettings.apiKeys?.requireExpiry || false,
        defaultExpiryDays: securitySettings.apiKeys?.defaultExpiryDays || 90,
        allowedScopes: securitySettings.apiKeys?.allowedScopes || [
          'read:campaigns',
          'write:campaigns',
          'read:shows',
          'write:shows',
          'read:analytics',
          'read:reports',
          'write:reports',
          'admin:all'
        ]
      }
    })

  } catch (error) {
    console.error('❌ API Keys GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

// POST /api/settings/security/api-keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can create API keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate request
    const body = await request.json()
    const validation = CreateApiKeySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, scopes, expiresIn } = validation.data

    // Get organization settings for limits
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    const securitySettings = (org?.settings as any)?.security || {}
    const apiKeySettings = securitySettings.apiKeys || {}

    // Check if API keys are enabled
    if (apiKeySettings.enabled === false) {
      return NextResponse.json(
        { error: 'API keys are not enabled for this organization' },
        { status: 400 }
      )
    }

    // Check max keys limit for user
    const existingKeysCount = await prisma.apiKey.count({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
        isActive: true
      }
    })

    const maxKeys = apiKeySettings.maxKeysPerUser || 10
    if (existingKeysCount >= maxKeys) {
      return NextResponse.json(
        { error: `Maximum API keys limit reached (${maxKeys})` },
        { status: 400 }
      )
    }

    // Generate the API key
    const { key, hash, lastFour } = generateApiKey()
    
    // Calculate expiry
    let expiresAt = null
    if (apiKeySettings.requireExpiry || expiresIn) {
      const days = expiresIn || apiKeySettings.defaultExpiryDays || 90
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + days)
    }

    // Create the API key in database
    const newApiKey = await prisma.apiKey.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        name,
        keyHash: hash,
        lastFourChars: lastFour,
        scopes,
        expiresAt,
        isActive: true
      }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'API_KEY_CREATED',
      resource: 'api_key',
      resourceId: newApiKey.id,
      changes: {
        name,
        scopes,
        expiresAt
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    // Return the key (only time it's visible)
    return NextResponse.json({
      id: newApiKey.id,
      name: newApiKey.name,
      key, // Only returned on creation
      displayKey: `••••••••${lastFour}`,
      scopes: newApiKey.scopes,
      expiresAt: newApiKey.expiresAt,
      createdAt: newApiKey.createdAt,
      message: 'API key created successfully. This is the only time the key will be shown. Please save it securely.'
    })

  } catch (error) {
    console.error('❌ API Keys POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/security/api-keys/[id] - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can revoke API keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get key ID from URL or query params
    const url = new URL(request.url)
    const keyId = url.searchParams.get('id') || url.pathname.split('/').pop()

    if (!keyId || keyId === 'api-keys') {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 })
    }

    // Find the key in database
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        organizationId: session.organizationId,
        isActive: true
      }
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Get reason from body if provided
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || 'Revoked by admin'

    // Revoke the key in database
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: session.userId,
        revokedReason: reason
      }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'API_KEY_REVOKED',
      resource: 'api_key',
      resourceId: keyId,
      changes: { reason },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    return NextResponse.json({ 
      success: true,
      message: 'API key revoked successfully' 
    })

  } catch (error) {
    console.error('❌ API Keys DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}