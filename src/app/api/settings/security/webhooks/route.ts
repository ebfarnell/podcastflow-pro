import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { createAuditLog } from '@/lib/audit/audit-logger'
import { SecurityEventType } from '@/types/security'
import crypto from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Webhook signing key schema
const WebhookSigningSchema = z.object({
  signingEnabled: z.boolean(),
  verifySSL: z.boolean().optional(),
  rotateAfterDays: z.number().min(1).max(365).optional(),
})

// Generate secure signing key
function generateSigningKey(): { keyId: string; secret: string } {
  const keyId = `whk_${crypto.randomBytes(8).toString('hex')}`
  const secret = crypto.randomBytes(32).toString('base64')
  return { keyId, secret }
}

// Calculate webhook signature
export function calculateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signaturePayload = `${timestamp}.${payload}`
  return crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex')
}

// GET /api/settings/security/webhooks - Get webhook signing configuration
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can manage webhook security
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization settings
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Extract webhook security settings
    const securitySettings = (org.settings as any)?.security || {}
    const webhookSecurity = securitySettings.webhookSecurity || {
      signingEnabled: false,
      verifySSL: true,
      rotateAfterDays: 30,
    }

    // Don't return the actual secret, just metadata
    const sanitizedWebhookSecurity = {
      ...webhookSecurity,
      hasSigningKey: !!webhookSecurity.signingKeyId,
      signingKeyId: webhookSecurity.signingKeyId,
      keyCreatedAt: webhookSecurity.keyCreatedAt,
      keyRotatedAt: webhookSecurity.keyRotatedAt,
      nextRotation: webhookSecurity.keyCreatedAt ? 
        new Date(new Date(webhookSecurity.keyCreatedAt).getTime() + (webhookSecurity.rotateAfterDays || 30) * 24 * 60 * 60 * 1000).toISOString() :
        null,
    }

    // Remove the actual secret
    delete sanitizedWebhookSecurity.signingSecret

    return NextResponse.json({
      webhookSecurity: sanitizedWebhookSecurity,
      endpoints: webhookSecurity.endpoints || [],
    })

  } catch (error) {
    console.error('❌ Webhook Security GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook security settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/security/webhooks - Update webhook signing configuration
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can update webhook security
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate request
    const body = await request.json()
    const validation = WebhookSigningSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updates = validation.data

    // Get current organization settings
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const currentSettings = (org.settings as any) || {}
    const securitySettings = currentSettings.security || {}
    const currentWebhookSecurity = securitySettings.webhookSecurity || {}

    // Prepare updated webhook security settings
    let updatedWebhookSecurity = {
      ...currentWebhookSecurity,
      ...updates,
    }

    // If enabling signing and no key exists, generate one
    if (updates.signingEnabled && !currentWebhookSecurity.signingKeyId) {
      const { keyId, secret } = generateSigningKey()
      updatedWebhookSecurity = {
        ...updatedWebhookSecurity,
        signingKeyId: keyId,
        signingSecret: secret,
        keyCreatedAt: new Date().toISOString(),
        keyRotatedAt: null,
      }
    }

    // Update organization settings
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        settings: {
          ...currentSettings,
          security: {
            ...securitySettings,
            webhookSecurity: updatedWebhookSecurity,
          }
        }
      }
    })

    // Create audit log
    await createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: SecurityEventType.SECURITY_SETTINGS_UPDATED,
      resource: 'webhook_security',
      resourceId: session.organizationId,
      changes: {
        before: currentWebhookSecurity,
        after: {
          ...updatedWebhookSecurity,
          signingSecret: '[REDACTED]', // Don't log the actual secret
        }
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    // Return sanitized response
    const response = {
      ...updatedWebhookSecurity,
      hasSigningKey: !!updatedWebhookSecurity.signingKeyId,
      nextRotation: updatedWebhookSecurity.keyCreatedAt ? 
        new Date(new Date(updatedWebhookSecurity.keyCreatedAt).getTime() + (updatedWebhookSecurity.rotateAfterDays || 30) * 24 * 60 * 60 * 1000).toISOString() :
        null,
    }
    delete response.signingSecret

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Webhook Security PUT Error:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook security settings' },
      { status: 500 }
    )
  }
}

// POST /api/settings/security/webhooks/rotate - Rotate signing key
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can rotate keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current organization settings
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const currentSettings = (org.settings as any) || {}
    const securitySettings = currentSettings.security || {}
    const webhookSecurity = securitySettings.webhookSecurity || {}

    if (!webhookSecurity.signingEnabled) {
      return NextResponse.json(
        { error: 'Webhook signing is not enabled' },
        { status: 400 }
      )
    }

    // Generate new signing key
    const { keyId, secret } = generateSigningKey()
    
    // Store old key for grace period (optional - could maintain a list)
    const oldKeys = webhookSecurity.oldKeys || []
    if (webhookSecurity.signingKeyId && webhookSecurity.signingSecret) {
      oldKeys.push({
        keyId: webhookSecurity.signingKeyId,
        secret: webhookSecurity.signingSecret,
        rotatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour grace period
      })
    }

    // Update with new key
    const updatedWebhookSecurity = {
      ...webhookSecurity,
      signingKeyId: keyId,
      signingSecret: secret,
      keyRotatedAt: new Date().toISOString(),
      oldKeys: oldKeys.filter((key: any) => new Date(key.expiresAt) > new Date()), // Remove expired old keys
    }

    // Update organization settings
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        settings: {
          ...currentSettings,
          security: {
            ...securitySettings,
            webhookSecurity: updatedWebhookSecurity,
          }
        }
      }
    })

    // Create audit log
    await createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: SecurityEventType.API_KEY_ROTATED,
      resource: 'webhook_signing_key',
      resourceId: keyId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook signing key rotated successfully',
      keyId,
      rotatedAt: updatedWebhookSecurity.keyRotatedAt,
      nextRotation: new Date(
        new Date(updatedWebhookSecurity.keyRotatedAt).getTime() + 
        (webhookSecurity.rotateAfterDays || 30) * 24 * 60 * 60 * 1000
      ).toISOString(),
    })

  } catch (error) {
    console.error('❌ Webhook Key Rotation Error:', error)
    return NextResponse.json(
      { error: 'Failed to rotate webhook signing key' },
      { status: 500 }
    )
  }
}