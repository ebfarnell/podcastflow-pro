import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/youtube/connections - Get all YouTube connections for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connections = await prisma.youTubeConnection.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true
      },
      select: {
        id: true,
        connectionName: true,
        accountEmail: true,
        channelId: true,
        channelTitle: true,
        channelDescription: true,
        channelThumbnail: true,
        isPrimary: true,
        lastSync: true,
        connectedBy: true,
        createdAt: true,
        showYouTubeConnections: {
          select: {
            showId: true,
            playlistId: true,
            isDefault: true
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Get user names for connectedBy
    const userIds = connections.map(c => c.connectedBy)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))

    // Enhance connections with user names
    const enhancedConnections = connections.map(conn => ({
      ...conn,
      connectedByName: userMap[conn.connectedBy] || 'Unknown',
      showCount: conn.showYouTubeConnections.length
    }))

    return NextResponse.json({
      connections: enhancedConnections,
      total: enhancedConnections.length
    })

  } catch (error) {
    console.error('Error fetching YouTube connections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch YouTube connections' },
      { status: 500 }
    )
  }
}

// POST /api/youtube/connections - Create a new YouTube connection (start OAuth flow)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { connectionName } = body

    if (!connectionName) {
      return NextResponse.json({ error: 'Connection name is required' }, { status: 400 })
    }

    // Check if OAuth is configured
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId },
      select: {
        clientId: true,
        clientSecret: true,
        redirectUri: true
      }
    })

    if (!config?.clientId || !config?.clientSecret) {
      return NextResponse.json(
        { error: 'YouTube OAuth is not configured. Please configure OAuth credentials first.' },
        { status: 400 }
      )
    }

    // Store connection name in session for OAuth callback
    await prisma.session.update({
      where: { token: request.cookies.get('auth-token')?.value },
      data: {
        metadata: {
          pendingYouTubeConnection: connectionName
        }
      }
    })

    // Generate OAuth URL
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    oauthUrl.searchParams.append('client_id', config.clientId)
    oauthUrl.searchParams.append('redirect_uri', config.redirectUri || 'https://app.podcastflow.pro/api/youtube/auth/callback')
    oauthUrl.searchParams.append('response_type', 'code')
    oauthUrl.searchParams.append('scope', [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '))
    oauthUrl.searchParams.append('access_type', 'offline')
    oauthUrl.searchParams.append('prompt', 'consent')
    oauthUrl.searchParams.append('state', session.organizationId)

    return NextResponse.json({
      oauthUrl: oauthUrl.toString(),
      message: 'Redirect user to OAuth URL to complete connection'
    })

  } catch (error) {
    console.error('Error creating YouTube connection:', error)
    return NextResponse.json(
      { error: 'Failed to create YouTube connection' },
      { status: 500 }
    )
  }
}

// PUT /api/youtube/connections/[id] - Update a YouTube connection
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')
    
    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { connectionName, isPrimary } = body

    // Verify connection belongs to organization
    const connection = await prisma.youTubeConnection.findFirst({
      where: {
        id: connectionId,
        organizationId: session.organizationId
      }
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // If setting as primary, unset other primary connections
    if (isPrimary) {
      await prisma.youTubeConnection.updateMany({
        where: {
          organizationId: session.organizationId,
          id: { not: connectionId }
        },
        data: { isPrimary: false }
      })
    }

    // Update connection
    const updated = await prisma.youTubeConnection.update({
      where: { id: connectionId },
      data: {
        connectionName: connectionName || connection.connectionName,
        isPrimary: isPrimary !== undefined ? isPrimary : connection.isPrimary,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'Connection updated successfully',
      connection: updated
    })

  } catch (error) {
    console.error('Error updating YouTube connection:', error)
    return NextResponse.json(
      { error: 'Failed to update YouTube connection' },
      { status: 500 }
    )
  }
}

// DELETE /api/youtube/connections/[id] - Delete a YouTube connection
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')
    
    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    // Verify connection belongs to organization
    const connection = await prisma.youTubeConnection.findFirst({
      where: {
        id: connectionId,
        organizationId: session.organizationId
      }
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.youTubeConnection.update({
      where: { id: connectionId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'Connection deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting YouTube connection:', error)
    return NextResponse.json(
      { error: 'Failed to delete YouTube connection' },
      { status: 500 }
    )
  }
}