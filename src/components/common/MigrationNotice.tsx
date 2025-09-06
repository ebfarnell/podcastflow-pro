'use client'

import { Alert, AlertTitle, Button, Box, Collapse } from '@mui/material'
import { InfoOutlined, ArrowForward } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { shouldShowMigrationNotice } from '@/lib/feature-flags'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface MigrationNoticeProps {
  targetTab: string
  pageName: string
}

export function MigrationNotice({ targetTab, pageName }: MigrationNoticeProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [showNotice, setShowNotice] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if user should see migration notice
    if (user && shouldShowMigrationNotice(user.role, user.id)) {
      // Check if user has dismissed this notice before
      const dismissedKey = `migration-notice-dismissed-${pageName}`
      const isDismissed = localStorage.getItem(dismissedKey) === 'true'
      
      if (!isDismissed) {
        setShowNotice(true)
      }
    }
  }, [user, pageName])

  const handleDismiss = () => {
    const dismissedKey = `migration-notice-dismissed-${pageName}`
    localStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
  }

  const handleNavigate = () => {
    router.push(`/post-sale?tab=${targetTab}`)
  }

  if (!showNotice || dismissed) {
    return null
  }

  return (
    <Collapse in={!dismissed}>
      <Alert 
        severity="info" 
        icon={<InfoOutlined />}
        onClose={handleDismiss}
        sx={{ mb: 3 }}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={handleNavigate}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Try New Interface
            </Button>
          </Box>
        }
      >
        <AlertTitle>New Post-Sale Management Dashboard Available</AlertTitle>
        We've introduced a unified Post-Sale Management dashboard that consolidates {pageName} with orders, contracts, and approvals in one place for improved workflow efficiency.
      </Alert>
    </Collapse>
  )
}