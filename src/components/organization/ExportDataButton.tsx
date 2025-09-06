'use client'

import React, { useState } from 'react'
import { Button } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'

interface ExportDataButtonProps {
  organizationId?: string
  organizationName?: string
}

export default function ExportDataButton({ 
  organizationId, 
  organizationName 
}: ExportDataButtonProps) {
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use current user's org if not specified
  const orgId = organizationId || user?.organizationId
  const orgName = organizationName || user?.organization?.name || 'organization'

  const handleExport = async () => {
    if (!orgId) {
      setError('No organization ID available')
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${orgId}/export`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Export failed')
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `${orgName}-export.tar.gz`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log(`Successfully exported data for ${orgName}`)
    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Only show for admin and master users
  if (!user || !['admin', 'master'].includes(user.role)) {
    return null
  }

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        startIcon={<DownloadIcon />}
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export Organization Data'}
      </Button>
      {error && (
        <div style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>
          Error: {error}
        </div>
      )}
    </>
  )
}