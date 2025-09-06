'use client'

import { useState, useEffect } from 'react'
import { Box, Paper, Typography, Button, Card, CardContent, Chip } from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function DebugLogsPage() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = () => {
    if (typeof window !== 'undefined') {
      const storedLogs = localStorage.getItem('podcastflow-debug-logs')
      if (storedLogs) {
        try {
          const parsedLogs = JSON.parse(storedLogs)
          setLogs(parsedLogs.reverse()) // Show newest first
        } catch (e) {
          console.error('Failed to parse logs:', e)
        }
      }
    }
  }

  const clearLogs = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('podcastflow-debug-logs')
      setLogs([])
    }
  }

  const getLogColor = (message: string) => {
    if (message.includes('❌') || message.includes('ERROR') || message.includes('🔴')) return 'error'
    if (message.includes('✅')) return 'success'
    if (message.includes('🚨')) return 'warning'
    return 'default'
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Debug Logs Viewer
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View persistent debug logs from episode navigation
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={loadLogs}>
              Refresh
            </Button>
            <Button variant="contained" color="error" onClick={clearLogs}>
              Clear Logs
            </Button>
          </Box>
        </Box>

        {logs.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No debug logs found. Try navigating to an episode from the calendar.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {logs.map((log, index) => (
              <Card key={index}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {log.timestamp}
                    </Typography>
                    <Chip 
                      label={log.page} 
                      size="small" 
                      color={getLogColor(log.message) as any}
                    />
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {log.message}
                  </Typography>
                  {log.data && (
                    <Box 
                      sx={{ 
                        backgroundColor: 'grey.100', 
                        p: 1, 
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        overflowX: 'auto'
                      }}
                    >
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(JSON.parse(log.data), null, 2)}
                      </pre>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    URL: {log.url}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </DashboardLayout>
  )
}