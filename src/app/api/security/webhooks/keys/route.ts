import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { createSecurityAuditLog } from '@/lib/security/audit'
import {
  createWebhookSigningKey,
  rotateWebhookSigningKey,
  getWebhookSigningKeys
} from '@/lib/security/webhook-signatures'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/security/webhooks/keys - Get webhook signing keys
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage webhook keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log('🔐 Webhook Keys API: Fetching webhook signing keys', { 
      organizationId: session.organizationId 
    })

    // Get all webhook signing keys for the organization
    const keys = await prisma.webhookSigningKey.findMany({
      where: {
        organizationId: session.organizationId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        algorithm: true,
        headerName: true,
        active: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        // Don't expose the actual secret in the list
        secret: false
      }
    })

    console.log('✅ Webhook Keys API: Returning webhook keys', { count: keys.length })
    return NextResponse.json(keys)

  } catch (error) {
    console.error('❌ Webhook Keys API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook keys' },
      { status: 500 }
    )
  }
}

// POST /api/security/webhooks/keys - Create new webhook signing key
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage webhook keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, algorithm = 'sha256', headerName = 'X-Webhook-Signature' } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Key name is required' },
        { status: 400 }
      )
    }

    if (!['sha256', 'sha512'].includes(algorithm)) {
      return NextResponse.json(
        { error: 'Invalid algorithm. Must be sha256 or sha512' },
        { status: 400 }
      )
    }

    console.log('🔐 Webhook Keys API: Creating new webhook signing key', { 
      organizationId: session.organizationId,
      name,
      algorithm 
    })

    // Create the webhook signing key
    const key = await createWebhookSigningKey(
      session.organizationId,
      name,
      algorithm as 'sha256' | 'sha512',
      headerName
    )

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'WEBHOOK_KEY_CREATED',
      resource: 'webhook_key',
      resourceId: key.id,
      changes: { name, algorithm, headerName },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ Webhook Keys API: Webhook key created successfully')
    
    // Return the key with the secret (only shown once)
    return NextResponse.json({
      id: key.id,
      name,
      secret: key.secret,
      algorithm: key.algorithm,
      headerName: key.header,
      message: 'Save this secret securely. It will not be shown again.'
    })

  } catch (error) {
    console.error('❌ Webhook Keys API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook key' },
      { status: 500 }
    )
  }
}

// PUT /api/security/webhooks/keys - Rotate webhook signing key
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage webhook keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { keyId } = body

    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400 }
      )
    }

    console.log('🔐 Webhook Keys API: Rotating webhook signing key', { 
      organizationId: session.organizationId,
      keyId 
    })

    // Rotate the key
    const newKey = await rotateWebhookSigningKey(keyId, session.organizationId)

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'WEBHOOK_KEY_ROTATED',
      resource: 'webhook_key',
      resourceId: keyId,
      changes: { newKeyId: newKey.id },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ Webhook Keys API: Webhook key rotated successfully')
    
    // Return the new key with the secret
    return NextResponse.json({
      id: newKey.id,
      secret: newKey.secret,
      algorithm: newKey.algorithm,
      headerName: newKey.header,
      message: 'Key rotated successfully. Save the new secret securely.'
    })

  } catch (error) {
    console.error('❌ Webhook Keys API Error:', error)
    return NextResponse.json(
      { error: 'Failed to rotate webhook key' },
      { status: 500 }
    )
  }
}

// DELETE /api/security/webhooks/keys - Revoke webhook signing key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage webhook keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400 }
      )
    }

    console.log('🔐 Webhook Keys API: Revoking webhook signing key', { 
      organizationId: session.organizationId,
      keyId 
    })

    // Verify the key belongs to the organization
    const key = await prisma.webhookSigningKey.findFirst({
      where: {
        id: keyId,
        organizationId: session.organizationId
      }
    })

    if (!key) {
      return NextResponse.json(
        { error: 'Webhook key not found' },
        { status: 404 }
      )
    }

    // Revoke the key
    await prisma.webhookSigningKey.update({
      where: { id: keyId },
      data: {
        active: false,
        revokedAt: new Date()
      }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'WEBHOOK_KEY_REVOKED',
      resource: 'webhook_key',
      resourceId: keyId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ Webhook Keys API: Webhook key revoked successfully')
    return NextResponse.json({
      message: 'Webhook key revoked successfully'
    })

  } catch (error) {
    console.error('❌ Webhook Keys API Error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke webhook key' },
      { status: 500 }
    )
  }
}