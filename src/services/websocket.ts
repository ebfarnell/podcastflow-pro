// We'll get the token from the Auth context when needed

type MessageHandler = (data: any) => void
type ConnectionStateHandler = (connected: boolean) => void

interface Subscription {
  channel: string
  entityType: string
  entityId?: string
  handler: MessageHandler
}

class WebSocketService {
  private ws: WebSocket | null = null
  private subscriptions: Map<string, Subscription[]> = new Map()
  private connectionStateHandlers: ConnectionStateHandler[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isConnecting = false
  private messageQueue: any[] = []

  constructor() {
    // Don't auto-connect in constructor - only connect when needed
  }

  private getWebSocketUrl(): string {
    // Get WebSocket URL from environment or use default
    const wsEndpoint = process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT
    if (!wsEndpoint) {
      console.warn('WebSocket endpoint not configured')
      return ''
    }
    return wsEndpoint
  }

  private connect() {
    // Only connect in browser environment and if WebSocket is supported
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      return
    }

    // For development, disable WebSocket connections to prevent errors
    // Check NODE_ENV first, then check if we're truly in development
    if (process.env.NODE_ENV === 'development') {
      return
    }
    
    // If no WebSocket endpoint is configured, disable WebSocket
    if (!process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT) {
      return
    }

    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    const wsUrl = this.getWebSocketUrl()
    if (!wsUrl) {
      console.warn('WebSocket URL not configured - real-time updates disabled')
      return
    }

    this.isConnecting = true

    try {
      // For now, connect without token - auth will be handled by the WebSocket Lambda
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.notifyConnectionState(true)
        this.startHeartbeat()
        this.resubscribeAll()
        this.flushMessageQueue()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        this.isConnecting = false
        this.notifyConnectionState(false)
        this.stopHeartbeat()
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    
    setTimeout(() => {
      this.connect()
    }, delay)
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: 'ping' })
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleMessage(data: any) {
    const { action, channel, entityType, entityId, eventType, payload } = data

    switch (action) {
      case 'pong':
        // Heartbeat response
        break
      
      case 'subscribed':
        break
      
      case 'unsubscribed':
        break
      
      case 'update':
        this.notifySubscribers(channel, entityType, entityId, eventType, payload)
        break
      
      default:
        console.warn('Unknown WebSocket action:', action)
    }
  }

  private notifySubscribers(
    channel: string, 
    entityType: string, 
    entityId: string | undefined,
    eventType: string,
    payload: any
  ) {
    const key = this.getSubscriptionKey(channel, entityType, entityId)
    const subscriptions = this.subscriptions.get(key) || []
    
    // Also notify general entity type subscribers
    if (entityId) {
      const generalKey = this.getSubscriptionKey(channel, entityType)
      const generalSubs = this.subscriptions.get(generalKey) || []
      subscriptions.push(...generalSubs)
    }
    
    subscriptions.forEach(sub => {
      try {
        sub.handler({
          channel,
          entityType,
          entityId,
          eventType,
          payload,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Subscription handler error:', error)
      }
    })
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(connected)
      } catch (error) {
        console.error('Connection state handler error:', error)
      }
    })
  }

  private getSubscriptionKey(channel: string, entityType: string, entityId?: string): string {
    return entityId ? `${channel}:${entityType}:${entityId}` : `${channel}:${entityType}`
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      // Queue message for later
      this.messageQueue.push(data)
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  private resubscribeAll() {
    // Re-subscribe to all active subscriptions
    const uniqueSubscriptions = new Map<string, Subscription>()
    
    this.subscriptions.forEach((subs, key) => {
      subs.forEach(sub => {
        const subKey = `${sub.channel}:${sub.entityType}:${sub.entityId || ''}`
        if (!uniqueSubscriptions.has(subKey)) {
          uniqueSubscriptions.set(subKey, sub)
        }
      })
    })
    
    uniqueSubscriptions.forEach(sub => {
      this.send({
        action: 'subscribe',
        channel: sub.channel,
        entityType: sub.entityType,
        entityId: sub.entityId
      })
    })
  }

  // Public API
  subscribe(
    channel: string,
    entityType: string,
    entityId: string | undefined,
    handler: MessageHandler
  ): () => void {
    const key = this.getSubscriptionKey(channel, entityType, entityId)
    const subscription: Subscription = {
      channel,
      entityType,
      entityId,
      handler
    }
    
    // Add to subscriptions
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, [])
    }
    this.subscriptions.get(key)!.push(subscription)
    
    // Connect WebSocket if not already connected (lazy connection)
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect()
    }
    
    // Send subscribe message if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: 'subscribe',
        channel,
        entityType,
        entityId
      })
    }
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, entityType, entityId, handler)
    }
  }

  unsubscribe(
    channel: string,
    entityType: string,
    entityId: string | undefined,
    handler: MessageHandler
  ) {
    const key = this.getSubscriptionKey(channel, entityType, entityId)
    const subscriptions = this.subscriptions.get(key) || []
    
    // Remove handler
    const filtered = subscriptions.filter(sub => sub.handler !== handler)
    
    if (filtered.length === 0) {
      this.subscriptions.delete(key)
      
      // Send unsubscribe message if connected
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          action: 'unsubscribe',
          channel,
          entityType,
          entityId
        })
      }
    } else {
      this.subscriptions.set(key, filtered)
    }
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.push(handler)
    
    // Notify current state
    handler(this.ws?.readyState === WebSocket.OPEN)
    
    // Return unsubscribe function
    return () => {
      this.connectionStateHandlers = this.connectionStateHandlers.filter(h => h !== handler)
    }
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.subscriptions.clear()
    this.connectionStateHandlers = []
    this.messageQueue = []
  }

  // Singleton instance
  private static instance: WebSocketService | null = null

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }
}

// Export singleton instance
export const websocketService = WebSocketService.getInstance()

// React hook for WebSocket subscriptions
import { useEffect, useState } from 'react'

export function useWebSocket(
  channel: string,
  entityType: string,
  entityId?: string,
  enabled = true
) {
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<any>(null)

  useEffect(() => {
    if (!enabled) return

    // Subscribe to connection state
    const unsubscribeConnection = websocketService.onConnectionStateChange(setConnected)

    // Subscribe to updates
    const unsubscribeUpdates = websocketService.subscribe(
      channel,
      entityType,
      entityId,
      (data) => {
        setLastUpdate(data)
      }
    )

    return () => {
      unsubscribeConnection()
      unsubscribeUpdates()
    }
  }, [channel, entityType, entityId, enabled])

  return { connected, lastUpdate }
}