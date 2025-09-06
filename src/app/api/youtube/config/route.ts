/**
 * YouTube API Configuration
 * GET /api/youtube/config - Get current configuration
 * PUT /api/youtube/config - Update configuration
 * 
 * Manages YouTube API key and OAuth settings for the organization.
 * Only accessible by admin and master roles.
 */

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c'
const IV_LENGTH = 16

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get configuration from public schema
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId }
    })

    // Get connected channels from organization schema
    const { data: channels, error: channelsError } = await safeQuerySchema(
      session.organizationSlug!,
      async (db) => {
        return await db.youTubeChannel.findMany({
          where: {
            organizationId: session.organizationId,
            isActive: true
          },
          select: {
            id: true,
            channelId: true,
            channelName: true,
            channelTitle: true,
            description: true,
            subscriberCount: true,
            videoCount: true,
            viewCount: true,
            verificationStatus: true,
            monetizationEnabled: true,
            lastSyncAt: true,
            createdAt: true
          },
          orderBy: {
            channelName: 'asc'
          }
        })
      }
    )

    if (channelsError) {
      console.log('Could not fetch YouTube channels:', channelsError)
    }

    if (!config) {
      return NextResponse.json({
        isConnected: false,
        isConfigured: false,
        hasApiKey: false,
        hasOAuth: false,
        channels: [],
        quotaLimit: 10000,
        quotaUsed: 0,
        quotaResetAt: null
      })
    }

    return NextResponse.json({
      isConnected: (channels && channels.length > 0),
      isConfigured: true,
      hasApiKey: !!config.apiKey,
      hasOAuth: !!config.clientId && !!config.clientSecret,
      apiKey: config.apiKey ? (() => {
        try {
          const decrypted = decrypt(config.apiKey)
          return '••••••••' + decrypted.slice(-4)
        } catch (error) {
          console.log('Could not decrypt API key for display:', error)
          return '••••••••'
        }
      })() : null,
      clientId: config.clientId,
      redirectUri: config.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/auth/callback`,
      quotaLimit: config.quotaLimit,
      quotaUsed: config.quotaUsed,
      quotaResetAt: config.quotaResetAt,
      isActive: config.isActive,
      syncFrequency: config.syncFrequency || 'daily',
      channels: channels || []
    })
  } catch (error: any) {
    console.error('Error fetching YouTube config:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      console.log('YouTube config PUT: No session or organizationId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('YouTube config PUT: Session user:', session.userId, 'Org:', session.organizationId)

    // Check permissions
    if (!['admin', 'master'].includes(session.role)) {
      console.log('YouTube config PUT: Insufficient permissions, role:', session.role)
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('YouTube config PUT: Request body:', { ...body, apiKey: body.apiKey ? '[REDACTED]' : undefined })
    const { apiKey, clientId, clientSecret, redirectUri, quotaLimit, syncFrequency } = body

    // Validate inputs
    if (apiKey && !apiKey.match(/^AIza[0-9A-Za-z\-_]{35}$/)) {
      return NextResponse.json(
        { error: 'Invalid YouTube API key format' },
        { status: 400 }
      )
    }

    if (quotaLimit && (quotaLimit < 1000 || quotaLimit > 1000000)) {
      return NextResponse.json(
        { error: 'Quota limit must be between 1,000 and 1,000,000' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (apiKey !== undefined) {
      updateData.apiKey = apiKey ? encrypt(apiKey) : null
    }

    if (clientId !== undefined) {
      updateData.clientId = clientId
    }

    if (clientSecret !== undefined) {
      updateData.clientSecret = clientSecret ? encrypt(clientSecret) : null
    }

    if (redirectUri !== undefined) {
      updateData.redirectUri = redirectUri
    }

    if (quotaLimit !== undefined) {
      updateData.quotaLimit = quotaLimit
    }

    if (syncFrequency !== undefined) {
      updateData.syncFrequency = syncFrequency
    }

    // Check if config exists first
    const existingConfig = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId }
    })
    
    console.log('YouTube config PUT: Existing config?', !!existingConfig)
    
    // Update or create configuration
    let config
    if (existingConfig) {
      console.log('YouTube config PUT: Updating existing config')
      config = await prisma.youTubeApiConfig.update({
        where: { organizationId: session.organizationId },
        data: updateData
      })
    } else {
      console.log('YouTube config PUT: Creating new config')
      config = await prisma.youTubeApiConfig.create({
        data: {
          organizationId: session.organizationId,
          ...updateData,
          isActive: true,
          quotaUsed: 0
        }
      })
    }

    console.log('YouTube config PUT: Config saved, ID:', config.id)

    return NextResponse.json({
      success: true,
      message: 'YouTube API configuration updated successfully',
      configId: config.id
    })
  } catch (error: any) {
    console.error('Error updating YouTube config:', error)
    
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete config
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete configuration
    await prisma.youTubeApiConfig.deleteMany({
      where: { organizationId: session.organizationId }
    })

    // Also delete all connected channels from organization schema
    const { error: deleteError } = await safeQuerySchema(
      session.organizationSlug!,
      async (db) => {
        await db.youTubeChannel.deleteMany({
          where: { organizationId: session.organizationId }
        })
        return true
      }
    )

    if (deleteError) {
      console.log('Could not delete YouTube channels:', deleteError)
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube integration disconnected successfully'
    })
  } catch (error: any) {
    console.error('Error deleting YouTube config:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    )
  }
}
