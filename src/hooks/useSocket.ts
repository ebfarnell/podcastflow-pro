'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { getCookie } from '@/lib/utils/cookies'
import { toast } from '@/lib/toast'

interface UseSocketOptions {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

export function useSocket(options?: UseSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Get auth token from cookies
    const authToken = getCookie('auth-token')
    if (!authToken) {
      console.warn('No auth token found, skipping socket connection')
      return
    }

    // Initialize socket connection
    const socket = io({
      path: '/api/socket',
      auth: {
        token: authToken
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketRef.current = socket

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 Connected to real-time server')
      setIsConnected(true)
      options?.onConnect?.()
    })

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from real-time server')
      setIsConnected(false)
      options?.onDisconnect?.()
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      options?.onError?.(error)
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
    }
  }, [])

  return {
    socket: socketRef.current,
    isConnected
  }
}

// Hook for inventory updates
export function useInventoryUpdates(showIds: string[], onUpdate: (update: any) => void) {
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected || showIds.length === 0) return

    // Subscribe to inventory updates
    socket.emit('subscribe:inventory', showIds)

    // Listen for inventory updates
    socket.on('inventory:update', onUpdate)

    // Listen for slot-specific updates
    socket.on('slot:update', (data) => {
      console.log('📊 Slot update received:', data)
      onUpdate(data)
    })

    // Cleanup
    return () => {
      socket.emit('unsubscribe:inventory', showIds)
      socket.off('inventory:update', onUpdate)
      socket.off('slot:update')
    }
  }, [socket, isConnected, showIds.join(',')]) // Use joined string to detect changes
}

// Hook for proposal updates
export function useProposalUpdates(proposalId: string | null, onUpdate: (update: any) => void) {
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected || !proposalId) return

    // Subscribe to proposal updates
    socket.emit('subscribe:proposal', proposalId)

    // Listen for proposal updates
    socket.on('proposal:update', onUpdate)

    // Cleanup
    return () => {
      socket.off('proposal:update', onUpdate)
    }
  }, [socket, isConnected, proposalId])
}