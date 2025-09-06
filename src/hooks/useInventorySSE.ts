'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'

interface InventoryUpdate {
  type: string
  showId?: string
  update?: any
  timestamp?: string
}

export function useInventorySSE(showIds: string[], onUpdate: (update: InventoryUpdate) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (showIds.length === 0) return

    const connect = () => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // Create new EventSource
      const showIdsParam = showIds.join(',')
      const eventSource = new EventSource(`/api/inventory/subscribe?shows=${showIdsParam}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('📡 Connected to inventory updates')
        setIsConnected(true)
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const data: InventoryUpdate = JSON.parse(event.data)
          
          if (data.type === 'connected') {
            console.log('📡 SSE connection established')
          } else if (data.type === 'inventory:update') {
            onUpdate(data)
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setIsConnected(false)
        eventSource.close()

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('📡 Attempting to reconnect...')
          connect()
        }, 5000)
      }
    }

    // Initial connection
    connect()

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      setIsConnected(false)
    }
  }, [showIds.join(',')]) // Reconnect when show IDs change

  return { isConnected }
}