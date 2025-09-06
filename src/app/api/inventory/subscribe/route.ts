import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Store active connections
const clients = new Map<string, WritableStreamDefaultWriter>()

export async function GET(request: NextRequest) {
  // Verify authentication
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgSlug = await getUserOrgSlug(user.id)
  if (!orgSlug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Get show IDs from query params
  const url = new URL(request.url)
  const showIds = url.searchParams.get('shows')?.split(',') || []

  // Create a TransformStream for SSE
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Store the client connection
  const clientId = `${user.id}-${Date.now()}`
  clients.set(clientId, writer)

  // Send initial connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`))

  // Set up heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      writer.write(encoder.encode(': heartbeat\n\n'))
    } catch (error) {
      clearInterval(heartbeat)
      clients.delete(clientId)
    }
  }, 30000) // Every 30 seconds

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeat)
    clients.delete(clientId)
    writer.close()
  })

  // Return SSE response
  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// Function to broadcast inventory updates
export function broadcastInventoryUpdate(orgSlug: string, showId: string, update: any) {
  const message = JSON.stringify({
    type: 'inventory:update',
    showId,
    update,
    timestamp: new Date().toISOString()
  })

  const encoder = new TextEncoder()
  const data = encoder.encode(`data: ${message}\n\n`)

  // Send to all connected clients
  clients.forEach((writer, clientId) => {
    try {
      writer.write(data)
    } catch (error) {
      // Remove disconnected clients
      clients.delete(clientId)
    }
  })
}