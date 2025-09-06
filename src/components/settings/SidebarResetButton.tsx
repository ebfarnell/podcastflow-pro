'use client'

import { useState } from 'react'
import { Button, CircularProgress, Alert, Snackbar } from '@mui/material'
import { RestartAlt } from '@mui/icons-material'

export function SidebarResetButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)

  const handleReset = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/clear-sidebar', {
        method: 'POST',
      })

      if (response.ok) {
        setMessage({ text: 'Sidebar reset successfully. Refreshing...', severity: 'success' })
        // Reload page after a short delay
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }, 1500)
      } else {
        setMessage({ text: 'Failed to reset sidebar', severity: 'error' })
      }
    } catch (error) {
      console.error('Error resetting sidebar:', error)
      setMessage({ text: 'Error resetting sidebar', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={loading ? <CircularProgress size={20} /> : <RestartAlt />}
        onClick={handleReset}
        disabled={loading}
        size="small"
      >
        Reset Sidebar to Default
      </Button>
      
      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {message && (
          <Alert severity={message.severity} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
      </Snackbar>
    </>
  )
}