import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// Generate a secure API key
function generateApiKey(): { key: string; keyHash: string; lastFourChars: string } {
  const prefix = 'pk_live_'
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const key = prefix + randomBytes
  const keyHash = bcrypt.hashSync(key, 10)
  const lastFourChars = key.slice(-4)
  
  return { key, keyHash, lastFourChars }
}

// GET /api/api-keys - List all API keys for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: session.organizationId,
        userId: session.userId,
      },
      select: {
        id: true,
        name: true,
        lastFourChars: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format API keys for display
    const formattedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      key: `pk_live_${'*'.repeat(60)}${key.lastFourChars}`,
      created: key.createdAt.toISOString(),
      lastUsed: key.lastUsedAt?.toISOString(),
      permissions: key.scopes,
      isActive: key.isActive,
      expiresAt: key.expiresAt?.toISOString(),
      createdBy: key.user.name || key.user.email,
    }))

    return NextResponse.json({ apiKeys: formattedKeys })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

// POST /api/api-keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and master users can create API keys
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, permissions = ['read'], expiresIn } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate the API key
    const { key, keyHash, lastFourChars } = generateApiKey()

    // Calculate expiration date if specified
    let expiresAt = null
    if (expiresIn) {
      const days = parseInt(expiresIn)
      if (!isNaN(days) && days > 0) {
        expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + days)
      }
    }

    // Create the API key in the database
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        name,
        keyHash,
        lastFourChars,
        scopes: permissions,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        lastFourChars: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Return the full key only once (during creation)
    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Full key returned only on creation
        permissions: apiKey.scopes,
        expiresAt: apiKey.expiresAt?.toISOString(),
        created: apiKey.createdAt.toISOString(),
      },
      message: 'API key created successfully. Please copy the key now as it will not be shown again.',
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

// DELETE /api/api-keys - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // Check if the key belongs to the user's organization
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        organizationId: session.organizationId,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Only the key owner or admins can revoke keys
    if (apiKey.userId !== session.userId && !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete - mark as revoked
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: session.userId,
        revokedReason: 'User requested revocation',
      },
    })

    return NextResponse.json({ message: 'API key revoked successfully' })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}