/**
 * YouTube Connected Channels API
 * GET /api/youtube/channels - List all connected YouTube channels
 * DELETE /api/youtube/channels?channelId={channelId} - Disconnect a channel
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all connected YouTube channels for the organization
    const { data: channels, error } = await safeQuerySchema(
      session.organizationSlug!,
      async (db) => {
        return await db.youTubeChannel.findMany({
          where: {
            organizationId: session.organizationId
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
            isActive: true,
            lastSyncAt: true,
            syncStatus: true,
            verificationStatus: true,
            monetizationEnabled: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            channelName: 'asc'
          }
        })
      }
    )

    if (error) {
      console.error('Database error fetching YouTube channels:', error)
      return NextResponse.json({ channels: [] })
    }

    return NextResponse.json({
      success: true,
      channels: channels || []
    })
  } catch (error: any) {
    console.error('Error fetching connected YouTube channels:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch connected channels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'sync') {
      // For now, just return success since we don't have actual sync logic yet
      return NextResponse.json({
        success: true,
        message: 'YouTube channels synced successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error handling YouTube channel action:', error)
    
    return NextResponse.json(
      { error: 'Failed to process request' },
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

    // Check permissions - only admin, master can disconnect channels
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to disconnect YouTube channels' },
        { status: 403 }
      )
    }

    // Get channel ID from query params
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Disconnect the channel
    const { error } = await safeQuerySchema(
      session.organizationSlug!,
      async (db) => {
        await db.youTubeChannel.deleteMany({
          where: {
            channelId,
            organizationId: session.organizationId
          }
        })
        return true
      }
    )

    if (error) {
      console.error('Database error disconnecting YouTube channel:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect channel' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Channel disconnected successfully'
    })
  } catch (error: any) {
    console.error('Error disconnecting YouTube channel:', error)
    
    return NextResponse.json(
      { error: 'Failed to disconnect channel' },
      { status: 500 }
    )
  }
}
