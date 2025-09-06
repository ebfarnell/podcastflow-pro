import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'

// POST /api/youtube/connections/assign
// Assign shows to a YouTube connection
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - admin, master, or sales can assign shows
    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { connectionId, showIds } = await request.json()

    if (!connectionId || !showIds || !Array.isArray(showIds)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Verify the connection exists and belongs to this organization
    const connection = await prisma.youTubeConnection.findFirst({
      where: {
        id: connectionId,
        organizationId: session.organizationId!
      }
    })

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Update shows in the organization schema
    const orgSlug = session.organization?.slug
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization slug not found' },
        { status: 400 }
      )
    }

    // Remove existing connections for these shows first
    await safeQuerySchema(
      orgSlug,
      async (db) => {
        // Delete existing connections for these shows
        await db.showYouTubeConnection.deleteMany({
          where: {
            showId: { in: showIds }
          }
        })

        // Create new connections
        const connections = showIds.map(showId => ({
          showId,
          connectionId,
          organizationId: session.organizationId!
        }))

        await db.showYouTubeConnection.createMany({
          data: connections
        })

        return { success: true }
      },
      {}
    )

    // Update show count on the connection
    const showCount = await safeQuerySchema(
      orgSlug,
      async (db) => {
        const count = await db.showYouTubeConnection.count({
          where: { connectionId }
        })
        return count
      },
      {}
    )

    await prisma.youTubeConnection.update({
      where: { id: connectionId },
      data: { showCount: showCount.data || 0 }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${showIds.length} show(s) to the connection`
    })
  } catch (error: any) {
    console.error('Error assigning shows to connection:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign shows' },
      { status: 500 }
    )
  }
}

// GET /api/youtube/connections/assign
// Get show assignments for all connections
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = session.organization?.slug
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization slug not found' },
        { status: 400 }
      )
    }

    // Get all connections for this organization
    const connections = await prisma.youTubeConnection.findMany({
      where: {
        organizationId: session.organizationId!
      }
    })

    // Get show assignments from organization schema
    const assignments = await safeQuerySchema(
      orgSlug,
      async (db) => {
        const showConnections = await db.showYouTubeConnection.findMany({
          include: {
            show: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })

        return showConnections
      },
      {}
    )

    // Group assignments by connection
    const connectionMap = new Map()
    connections.forEach(conn => {
      connectionMap.set(conn.id, {
        ...conn,
        shows: []
      })
    })

    if (assignments.data) {
      assignments.data.forEach((assignment: any) => {
        const conn = connectionMap.get(assignment.connectionId)
        if (conn) {
          conn.shows.push(assignment.show)
        }
      })
    }

    return NextResponse.json({
      connections: Array.from(connectionMap.values())
    })
  } catch (error: any) {
    console.error('Error fetching show assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}