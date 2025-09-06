'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Stack,
  Tooltip
} from '@mui/material'
import {
  History,
  Add,
  Restore,
  Compare,
  CheckCircle,
  Schedule,
  Person,
  Edit,
  Visibility,
  ThumbUp,
  ArrowBack,
  Timeline,
  Comment,
  SwapHoriz
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CampaignVersionsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Data state
  const [versionData, setVersionData] = useState<any>(null)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<any>(null)

  // Dialog states
  const [createVersionDialogOpen, setCreateVersionDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<any>(null)

  // Form state
  const [versionComment, setVersionComment] = useState('')
  const [approvalComment, setApprovalComment] = useState('')

  const campaignId = params.id as string

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && campaignId) {
      fetchVersionData()
    }
  }, [user, campaignId])

  const fetchVersionData = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/versions`)
      if (!response.ok) throw new Error('Failed to fetch version data')
      
      const data = await response.json()
      setVersionData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching version data:', err)
      setError('Failed to load version data')
      setLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_version',
          comment: versionComment
        })
      })

      if (!response.ok) throw new Error('Failed to create version')

      const result = await response.json()
      setSuccess(result.message)
      setCreateVersionDialogOpen(false)
      setVersionComment('')
      fetchVersionData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRestoreVersion = async () => {
    if (!selectedVersion) return

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_version',
          versionId: selectedVersion.id,
          comment: versionComment
        })
      })

      if (!response.ok) throw new Error('Failed to restore version')

      const result = await response.json()
      setSuccess(result.message)
      setRestoreDialogOpen(false)
      setSelectedVersion(null)
      setVersionComment('')
      fetchVersionData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleApproveVersion = async () => {
    if (!selectedVersion) return

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_version',
          versionId: selectedVersion.id,
          comment: approvalComment
        })
      })

      if (!response.ok) throw new Error('Failed to approve version')

      const result = await response.json()
      setSuccess(result.message)
      setApproveDialogOpen(false)
      setSelectedVersion(null)
      setApprovalComment('')
      fetchVersionData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) {
      setError('Please select exactly 2 versions to compare')
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compare_versions',
          versionId1: selectedVersions[0],
          versionId2: selectedVersions[1]
        })
      })

      if (!response.ok) throw new Error('Failed to compare versions')

      const result = await response.json()
      setComparisonData(result)
      setCompareDialogOpen(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'version_created': return 'primary'
      case 'version_restored': return 'warning'
      case 'version_approved': return 'success'
      case 'field_changed': return 'info'
      default: return 'default'
    }
  }

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'version_created': return <Add />
      case 'version_restored': return <Restore />
      case 'version_approved': return <ThumbUp />
      case 'field_changed': return <Edit />
      default: return <History />
    }
  }

  const formatFieldValue = (value: any) => {
    if (value === null || value === undefined) return 'Not set'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toLocaleString()
    if (typeof value === 'string' && value.includes('T')) {
      // Assume it's a date
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return value
      }
    }
    return value.toString()
  }

  // Check if user can approve versions
  const canApprove = ['master', 'admin'].includes(user?.role || '')

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user || !versionData) return <DashboardLayout><Typography>Campaign not found</Typography></DashboardLayout>

  const { campaign, versions, currentVersion, changeHistory } = versionData

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push(`/campaigns/${campaignId}`)}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                Campaign Version Control
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {campaign.name} • {versions.length} versions
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Compare />}
              onClick={handleCompareVersions}
              disabled={selectedVersions.length !== 2}
            >
              Compare ({selectedVersions.length})
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateVersionDialogOpen(true)}
            >
              Create Version
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Current Version Card */}
        {currentVersion && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Current Version: v{currentVersion.version}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Created {new Date(currentVersion.createdAt).toLocaleDateString()} by {currentVersion.createdBy.name}
                  </Typography>
                  {currentVersion.isApproved && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="caption" color="success.main">
                        Approved by {currentVersion.approvedBy?.name} on {new Date(currentVersion.approvedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip label="Current" color="primary" />
                  {currentVersion.isApproved && <Chip label="Approved" color="success" />}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Versions" icon={<History />} iconPosition="start" />
            <Tab label="Change History" icon={<Timeline />} iconPosition="start" />
          </Tabs>
          <Divider />

          <TabPanel value={tabValue} index={0}>
            {/* Versions Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Typography variant="caption">Compare</Typography>
                    </TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Approved By</TableCell>
                    <TableCell>Changes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((version: any) => (
                    <TableRow key={version.id} hover>
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedVersions.includes(version.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedVersions.length < 2) {
                                setSelectedVersions([...selectedVersions, version.id])
                              }
                            } else {
                              setSelectedVersions(selectedVersions.filter(id => id !== version.id))
                            }
                          }}
                          disabled={selectedVersions.length >= 2 && !selectedVersions.includes(version.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            v{version.version}
                          </Typography>
                          {version.isCurrent && <Chip label="Current" size="small" color="primary" />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {version.isApproved ? (
                            <Chip label="Approved" size="small" color="success" />
                          ) : (
                            <Chip label="Pending" size="small" color="warning" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24 }}>
                            <Person />
                          </Avatar>
                          <Typography variant="body2">
                            {version.createdBy.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {version.approvedBy ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              <Person />
                            </Avatar>
                            <Typography variant="body2">
                              {version.approvedBy.name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Not approved
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {version.metadata?.comment && (
                          <Tooltip title={version.metadata.comment}>
                            <Typography variant="body2" sx={{ 
                              maxWidth: 200, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {version.metadata.comment}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedVersion(version)
                            setRestoreDialogOpen(true)
                          }}
                          disabled={version.isCurrent}
                        >
                          <Restore />
                        </IconButton>
                        {canApprove && !version.isApproved && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedVersion(version)
                              setApproveDialogOpen(true)
                            }}
                          >
                            <ThumbUp />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Change History */}
            <List>
              {changeHistory.map((change: any) => (
                <ListItem key={change.id} divider>
                  <ListItemIcon>
                    {getChangeTypeIcon(change.changeType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {change.changedBy.name}
                        </Typography>
                        <Chip 
                          label={change.changeType.replace('_', ' ')} 
                          size="small" 
                          color={getChangeTypeColor(change.changeType)}
                        />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(change.changedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        {change.fieldName && (
                          <Typography variant="body2">
                            <strong>{change.fieldName}:</strong> {change.oldValue} → {change.newValue}
                          </Typography>
                        )}
                        {change.comment && (
                          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                            "{change.comment}"
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {changeHistory.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Timeline sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Change History
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Changes will appear here as they are made
                </Typography>
              </Box>
            )}
          </TabPanel>
        </Paper>

        {/* Create Version Dialog */}
        <Dialog open={createVersionDialogOpen} onClose={() => setCreateVersionDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Version</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              This will create a new version of the campaign with the current data.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Version Comment"
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              margin="normal"
              placeholder="Describe what changed in this version..."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateVersionDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateVersion}>
              Create Version
            </Button>
          </DialogActions>
        </Dialog>

        {/* Restore Version Dialog */}
        <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Restore Version</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Are you sure you want to restore to version {selectedVersion?.version}? 
              This will overwrite the current campaign data.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Restore Comment"
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              margin="normal"
              placeholder="Explain why you're restoring this version..."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={handleRestoreVersion}>
              Restore Version
            </Button>
          </DialogActions>
        </Dialog>

        {/* Approve Version Dialog */}
        <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Approve Version</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Approve version {selectedVersion?.version}?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Approval Comment"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              margin="normal"
              placeholder="Add approval notes..."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="success" onClick={handleApproveVersion}>
              Approve Version
            </Button>
          </DialogActions>
        </Dialog>

        {/* Compare Versions Dialog */}
        <Dialog open={compareDialogOpen} onClose={() => setCompareDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Version Comparison</DialogTitle>
          <DialogContent>
            {comparisonData && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6">
                    v{comparisonData.version1.version} vs v{comparisonData.version2.version}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {comparisonData.differences.length} differences found
                  </Typography>
                </Box>

                {comparisonData.hasDifferences ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Field</TableCell>
                          <TableCell>v{comparisonData.version1.version}</TableCell>
                          <TableCell>v{comparisonData.version2.version}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparisonData.differences.map((diff: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>
                                {diff.field}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatFieldValue(diff.version1.value)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatFieldValue(diff.version2.value)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      No Differences Found
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      These versions are identical
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompareDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}