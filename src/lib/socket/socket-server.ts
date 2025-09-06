import { Server as HTTPServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'

interface SocketData {
  userId: string
  orgSlug: string
  role: string
}

let io: SocketServer | null = null

export function initializeSocketServer(httpServer: HTTPServer) {
  if (io) return io

  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro',
      credentials: true
    },
    path: '/api/socket'
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication required'))
      }

      const user = await UserService.validateSession(token)
      if (!user) {
        return next(new Error('Invalid session'))
      }

      const orgSlug = await getUserOrgSlug(user.id)
      if (!orgSlug) {
        return next(new Error('Organization not found'))
      }

      // Store user data in socket
      const socketData: SocketData = {
        userId: user.id,
        orgSlug,
        role: user.role
      }
      socket.data = socketData

      next()
    } catch (error) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    const { userId, orgSlug, role } = socket.data as SocketData
    console.log(`🔌 User connected: ${userId} (${role}) from ${orgSlug}`)

    // Join organization room
    socket.join(`org:${orgSlug}`)

    // Join role-specific rooms
    socket.join(`role:${role}`)

    // Subscribe to inventory updates for specific shows
    socket.on('subscribe:inventory', (showIds: string[]) => {
      showIds.forEach(showId => {
        socket.join(`inventory:${orgSlug}:${showId}`)
      })
      console.log(`📊 User ${userId} subscribed to inventory updates for ${showIds.length} shows`)
    })

    // Unsubscribe from inventory updates
    socket.on('unsubscribe:inventory', (showIds: string[]) => {
      showIds.forEach(showId => {
        socket.leave(`inventory:${orgSlug}:${showId}`)
      })
    })

    // Subscribe to proposal updates
    socket.on('subscribe:proposal', (proposalId: string) => {
      socket.join(`proposal:${orgSlug}:${proposalId}`)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId}`)
    })
  })

  return io
}

export function getSocketServer(): SocketServer | null {
  return io
}

// Emit inventory update to all connected clients watching a specific show
export function emitInventoryUpdate(orgSlug: string, showId: string, update: any) {
  if (!io) return

  io.to(`inventory:${orgSlug}:${showId}`).emit('inventory:update', {
    showId,
    update,
    timestamp: new Date().toISOString()
  })
}

// Emit proposal update to all connected clients watching a specific proposal
export function emitProposalUpdate(orgSlug: string, proposalId: string, update: any) {
  if (!io) return

  io.to(`proposal:${orgSlug}:${proposalId}`).emit('proposal:update', {
    proposalId,
    update,
    timestamp: new Date().toISOString()
  })
}

// Emit slot reservation/booking update
export function emitSlotUpdate(orgSlug: string, slotData: {
  episodeId: string
  showId: string
  placementType: string
  action: 'reserved' | 'booked' | 'released'
  quantity: number
}) {
  if (!io) return

  // Emit to all users watching this show's inventory
  io.to(`inventory:${orgSlug}:${slotData.showId}`).emit('slot:update', {
    ...slotData,
    timestamp: new Date().toISOString()
  })

  // Also emit to organization room for dashboard updates
  io.to(`org:${orgSlug}`).emit('inventory:changed', {
    showId: slotData.showId,
    timestamp: new Date().toISOString()
  })
}