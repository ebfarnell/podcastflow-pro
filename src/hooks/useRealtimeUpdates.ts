import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '@/services/websocket'
import { useAuth } from '@/contexts/AuthContext'

interface RealtimeUpdateOptions {
  channel?: string
  entityType: string
  entityId?: string
  queryKey?: any[]
  enabled?: boolean
  onUpdate?: (data: any) => void
}

export function useRealtimeUpdates({
  channel = 'main',
  entityType,
  entityId,
  queryKey,
  enabled = true,
  onUpdate
}: RealtimeUpdateOptions) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { connected, lastUpdate } = useWebSocket(
    channel,
    entityType,
    entityId,
    enabled && !!user
  )

  const handleUpdate = useCallback((update: any) => {
    if (!update) return

    const { eventType, payload } = update

    // Custom update handler
    if (onUpdate) {
      onUpdate(update)
    }

    // Invalidate relevant queries
    if (queryKey) {
      queryClient.invalidateQueries({ queryKey })
    } else {
      // Invalidate based on entity type
      switch (entityType) {
        case 'campaign':
          queryClient.invalidateQueries({ queryKey: ['campaigns'] })
          if (entityId) {
            queryClient.invalidateQueries({ queryKey: ['campaign', entityId] })
          }
          break
        case 'show':
          queryClient.invalidateQueries({ queryKey: ['shows'] })
          if (entityId) {
            queryClient.invalidateQueries({ queryKey: ['show', entityId] })
          }
          break
        case 'episode':
          queryClient.invalidateQueries({ queryKey: ['episodes'] })
          if (entityId) {
            queryClient.invalidateQueries({ queryKey: ['episode', entityId] })
          }
          break
        case 'client':
          queryClient.invalidateQueries({ queryKey: ['clients'] })
          if (entityId) {
            queryClient.invalidateQueries({ queryKey: ['client', entityId] })
          }
          break
        case 'notification':
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          break
        case 'activity':
          queryClient.invalidateQueries({ queryKey: ['activities'] })
          break
        default:
          // Generic invalidation
          queryClient.invalidateQueries({ queryKey: [entityType] })
      }
    }

    // Show notification for certain events
    if (eventType === 'created' || eventType === 'updated' || eventType === 'deleted') {
      // Could integrate with a notification system here
      console.log(`${entityType} ${eventType}:`, payload)
    }
  }, [queryClient, queryKey, entityType, entityId, onUpdate])

  useEffect(() => {
    if (lastUpdate) {
      handleUpdate(lastUpdate)
    }
  }, [lastUpdate, handleUpdate])

  return { connected, lastUpdate }
}

// Hook for subscribing to multiple entity types
export function useMultipleRealtimeUpdates(
  subscriptions: RealtimeUpdateOptions[]
) {
  const results = subscriptions.map(sub => useRealtimeUpdates(sub))
  
  return {
    connected: results.some(r => r.connected),
    updates: results.map(r => r.lastUpdate).filter(Boolean)
  }
}

// Specific hooks for common use cases
export function useCampaignUpdates(campaignId?: string, enabled = true) {
  return useRealtimeUpdates({
    entityType: 'campaign',
    entityId: campaignId,
    queryKey: campaignId ? ['campaign', campaignId] : ['campaigns'],
    enabled
  })
}

export function useShowUpdates(showId?: string, enabled = true) {
  return useRealtimeUpdates({
    entityType: 'show',
    entityId: showId,
    queryKey: showId ? ['show', showId] : ['shows'],
    enabled
  })
}

export function useEpisodeUpdates(episodeId?: string, enabled = true) {
  return useRealtimeUpdates({
    entityType: 'episode',
    entityId: episodeId,
    queryKey: episodeId ? ['episode', episodeId] : ['episodes'],
    enabled
  })
}

export function useClientUpdates(clientId?: string, enabled = true) {
  return useRealtimeUpdates({
    entityType: 'client',
    entityId: clientId,
    queryKey: clientId ? ['client', clientId] : ['clients'],
    enabled
  })
}

export function useNotificationUpdates(enabled = true) {
  return useRealtimeUpdates({
    entityType: 'notification',
    queryKey: ['notifications'],
    enabled
  })
}

export function useActivityUpdates(enabled = true) {
  return useRealtimeUpdates({
    entityType: 'activity',
    queryKey: ['activities'],
    enabled
  })
}