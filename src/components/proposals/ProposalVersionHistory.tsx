'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  History as HistoryIcon,
  RestorePage as RestoreIcon,
  Compare as CompareIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { useRouter } from 'next/navigation'

interface ProposalVersion {
  id: string
  proposalId: string
  version: number
  changes: any
  changedBy: string
  changedByName: string
  changedByEmail: string
  changeReason?: string
  createdAt: string
  proposalSnapshot?: any
}

interface ProposalVersionHistoryProps {
  proposalId: string
  currentVersion?: number
  onRestore?: (version: ProposalVersion) => void
}

export function ProposalVersionHistory({ 
  proposalId, 
  currentVersion = 1,
  onRestore 
}: ProposalVersionHistoryProps) {
  const router = useRouter()
  const [versions, setVersions] = useState<ProposalVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<ProposalVersion | null>(null)
  const [compareVersion, setCompareVersion] = useState<ProposalVersion | null>(null)
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    fetchVersions()
  }, [proposalId])

  const fetchVersions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/proposals/${proposalId}/versions`)
      if (!response.ok) {
        throw new Error('Failed to fetch versions')
      }
      const data = await response.json()
      setVersions(data.versions || [])
    } catch (error) {
      console.error('Error fetching versions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return <AddIcon fontSize="small" />
      case 'updated':
        return <EditIcon fontSize="small" />
      case 'deleted':
        return <RemoveIcon fontSize="small" />
      case 'status_changed':
        return <SwapIcon fontSize="small" />
      default:
        return <EditIcon fontSize="small" />
    }
  }

  const getChangeColor = (changeType: string): any => {
    switch (changeType) {
      case 'created':
        return 'success'
      case 'updated':
        return 'primary'
      case 'deleted':
        return 'error'
      case 'status_changed':
        return 'warning'
      default:
        return 'default'
    }
  }

  const formatChanges = (changes: any) => {
    if (typeof changes === 'string') {
      try {
        changes = JSON.parse(changes)
      } catch {
        return []
      }
    }

    if (!changes || typeof changes !== 'object') return []

    return Object.entries(changes).map(([field, data]: [string, any]) => ({
      field,
      type: data.type || 'updated',
      old: data.old,
      new: data.new,
      description: data.description
    }))
  }

  const renderChangeDescription = (change: any) => {
    const { field, type, old: oldValue, new: newValue, description } = change

    if (description) return description

    switch (type) {
      case 'created':
        return `Added ${field}: ${newValue}`
      case 'deleted':
        return `Removed ${field}: ${oldValue}`
      case 'updated':
        if (field === 'items') {
          return `Updated line items`
        }
        return `Changed ${field} from "${oldValue || 'empty'}" to "${newValue}"`
      default:
        return `Modified ${field}`
    }
  }

  const handleCompare = (version1: ProposalVersion, version2: ProposalVersion) => {
    setSelectedVersion(version1)
    setCompareVersion(version2)
    setShowCompareDialog(true)
  }

  const handleRestore = async (version: ProposalVersion) => {
    if (!confirm(`Are you sure you want to restore the proposal to version ${version.version}? This will create a new version with the content from version ${version.version}.`)) {
      return
    }

    setRestoring(true)
    try {
      const response = await fetch(`/api/proposals/${proposalId}/restore-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version: version.version }),
      })

      if (!response.ok) {
        throw new Error('Failed to restore version')
      }

      const data = await response.json()
      toast.success(data.message || 'Version restored successfully')
      
      // Refresh the page to show updated data
      router.refresh()
      fetchVersions()
      
      if (onRestore) {
        onRestore(version)
      }
    } catch (error) {
      console.error('Error restoring version:', error)
      toast.error('Failed to restore version')
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    )
  }

  if (versions.length === 0) {
    return (
      <Alert severity="info">
        No version history available yet. Changes will be tracked as you modify the proposal.
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h6" display="flex" alignItems="center" gap={1} gutterBottom>
        <HistoryIcon />
        Version History
        <Chip 
          label={`v${currentVersion}`} 
          size="small" 
          color="primary"
        />
      </Typography>

      <Timeline position="alternate">
        {versions.map((version, index) => {
          const changes = formatChanges(version.changes)
          const isCurrentVersion = version.version === currentVersion

          return (
            <TimelineItem key={version.id}>
              <TimelineOppositeContent
                sx={{ m: 'auto 0' }}
                align={index % 2 === 0 ? "right" : "left"}
                variant="body2"
                color="text.secondary"
              >
                {format(new Date(version.createdAt), 'MMM dd, yyyy HH:mm')}
              </TimelineOppositeContent>
              
              <TimelineSeparator>
                <TimelineConnector />
                <TimelineDot 
                  color={isCurrentVersion ? "primary" : "grey"}
                  variant={isCurrentVersion ? "filled" : "outlined"}
                >
                  <HistoryIcon />
                </TimelineDot>
                <TimelineConnector />
              </TimelineSeparator>
              
              <TimelineContent sx={{ py: '12px', px: 2 }}>
                <Paper elevation={isCurrentVersion ? 3 : 1} sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" component="span">
                        Version {version.version}
                      </Typography>
                      {isCurrentVersion && (
                        <Chip 
                          label="Current" 
                          size="small" 
                          color="primary" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                    <Box>
                      {!isCurrentVersion && (
                        <Tooltip title="Restore this version">
                          <IconButton 
                            size="small" 
                            onClick={() => handleRestore(version)}
                            disabled={restoring}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {index > 0 && (
                        <Tooltip title="Compare with previous version">
                          <IconButton 
                            size="small"
                            onClick={() => handleCompare(version, versions[index - 1])}
                          >
                            <CompareIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1} mt={1} mb={2}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {version.changedByName || version.changedByEmail}
                    </Typography>
                  </Box>

                  {version.changeReason && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Reason:</strong> {version.changeReason}
                      </Typography>
                    </Alert>
                  )}

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Changes:
                  </Typography>
                  
                  {changes.length > 0 ? (
                    <Box sx={{ ml: 1 }}>
                      {changes.map((change, changeIndex) => (
                        <Box 
                          key={changeIndex} 
                          display="flex" 
                          alignItems="center" 
                          gap={1} 
                          mb={0.5}
                        >
                          <Chip
                            icon={getChangeIcon(change.type)}
                            label={renderChangeDescription(change)}
                            size="small"
                            color={getChangeColor(change.type)}
                            variant="outlined"
                          />
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      No specific changes recorded
                    </Typography>
                  )}
                </Paper>
              </TimelineContent>
            </TimelineItem>
          )
        })}
      </Timeline>

      {/* Compare Dialog */}
      <Dialog 
        open={showCompareDialog} 
        onClose={() => setShowCompareDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Compare Versions
        </DialogTitle>
        <DialogContent>
          {selectedVersion && compareVersion && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Comparing Version {selectedVersion.version} with Version {compareVersion.version}
              </Typography>
              {/* Add detailed comparison UI here */}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompareDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}