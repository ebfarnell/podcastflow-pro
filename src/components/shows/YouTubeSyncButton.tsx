'use client'

import { useState } from 'react'
import { Button, CircularProgress, Tooltip } from '@mui/material'
import { Sync as SyncIcon, YouTube as YouTubeIcon } from '@mui/icons-material'
import { api } from '@/lib/api'

interface YouTubeSyncButtonProps {
  showId: string
  showName: string
  onSyncComplete?: () => void
}

export function YouTubeSyncButton({ showId, showName, onSyncComplete }: YouTubeSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handleSync = async () => {
    try {
      setSyncing(true)
      setStatus('Starting sync...')

      const response = await api.post(`/api/youtube/sync/${showId}`)
      
      if (response.data.success) {
        const { stats } = response.data
        setStatus(
          `Sync complete! Created: ${stats.episodesCreated}, Updated: ${stats.episodesUpdated}, Total: ${stats.totalVideos}`
        )
        
        // Refresh the page or call callback after 2 seconds
        setTimeout(() => {
          if (onSyncComplete) {
            onSyncComplete()
          } else {
            window.location.reload()
          }
        }, 2000)
      } else {
        setStatus('Sync failed')
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      setStatus(error.response?.data?.error || 'Sync failed')
    } finally {
      setSyncing(false)
      // Clear status after 5 seconds
      setTimeout(() => setStatus(null), 5000)
    }
  }

  return (
    <Tooltip title={status || `Sync YouTube episodes for ${showName}`}>
      <span>
        <Button
          onClick={handleSync}
          disabled={syncing}
          startIcon={syncing ? <CircularProgress size={16} /> : <YouTubeIcon />}
          endIcon={!syncing && <SyncIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#FF0000',
            color: '#FF0000',
            '&:hover': {
              borderColor: '#CC0000',
              backgroundColor: 'rgba(255, 0, 0, 0.04)'
            }
          }}
        >
          {syncing ? 'Syncing...' : 'YouTube Sync'}
        </Button>
      </span>
    </Tooltip>
  )
}