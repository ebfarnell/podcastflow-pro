'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Paper,
  Divider,
  LinearProgress
} from '@mui/material'
import {
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Feedback as FeedbackIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { CreativeRequest, SubmittedAsset } from '@/types/workflow'
import { useAuth } from '@/lib/auth/client'

interface CreativeAssetsDialogProps {
  open: boolean
  onClose: () => void
  creativeRequest: CreativeRequest
  onUpdate: () => void
}

export default function CreativeAssetsDialog({
  open,
  onClose,
  creativeRequest,
  onUpdate
}: CreativeAssetsDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [uploadingAssets, setUploadingAssets] = useState<File[]>([])

  const isAssignee = user?.id === creativeRequest.assignedToId
  const isAdmin = user?.role === 'admin' || user?.role === 'master'
  const canSubmit = isAssignee && ['pending', 'in_progress', 'revision_needed'].includes(creativeRequest.status)
  const canApprove = isAdmin && creativeRequest.status === 'submitted'

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadingAssets(files)
  }

  const handleSubmitAssets = async () => {
    try {
      setLoading(true)
      setError('')

      // In a real implementation, you would upload files to S3 or similar
      // For now, we'll simulate by creating asset metadata
      const submittedAssets: SubmittedAsset[] = uploadingAssets.map(file => ({
        type: getAssetType(file),
        name: file.name,
        url: `/uploads/${Date.now()}_${file.name}`, // Simulated URL
        uploadedAt: new Date().toISOString(),
        uploadedBy: user!.id,
        fileSize: file.size,
        mimeType: file.type
      }))

      const response = await fetch(`/api/creative-requests/${creativeRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          submittedAssets: [
            ...(creativeRequest.submittedAssets || []),
            ...submittedAssets
          ],
          submittedAt: new Date()
        })
      })

      if (!response.ok) throw new Error('Failed to submit assets')
      
      onUpdate()
      setUploadingAssets([])
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/creative-requests/${creativeRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: user!.id
        })
      })

      if (!response.ok) throw new Error('Failed to approve')
      
      onUpdate()
      onClose()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestRevision = async () => {
    try {
      setLoading(true)
      if (!feedback.trim()) {
        setError('Please provide feedback for the revision request')
        return
      }

      const response = await fetch(`/api/creative-requests/${creativeRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'revision_needed',
          feedbackHistory: feedback.trim()
        })
      })

      if (!response.ok) throw new Error('Failed to request revision')
      
      onUpdate()
      setFeedback('')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getAssetType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'artwork'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.includes('pdf') || file.type.includes('document')) return 'guidelines'
    return 'script'
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'audio':
      case 'video':
      case 'artwork':
      case 'guidelines':
      case 'script':
      default:
        return <AttachFileIcon />
    }
  }

  const submittedCount = creativeRequest.submittedAssets?.length || 0
  const requiredCount = creativeRequest.requiredAssets?.filter(a => a.required).length || 0
  const progress = requiredCount > 0 ? (submittedCount / requiredCount) * 100 : 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Creative Assets - {creativeRequest.title}
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Progress */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Asset Submission Progress
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 10, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {submittedCount} of {requiredCount} required assets submitted
            </Typography>
          </Box>

          {/* Required Assets */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Required Assets
            </Typography>
            <List dense>
              {creativeRequest.requiredAssets?.map((asset, index) => {
                const isSubmitted = creativeRequest.submittedAssets?.some(s => s.type === asset.type)
                return (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getAssetIcon(asset.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
                          {asset.required && (
                            <Chip label="Required" size="small" color="error" />
                          )}
                          {isSubmitted && (
                            <CheckIcon color="success" fontSize="small" />
                          )}
                        </Box>
                      }
                      secondary={asset.description}
                    />
                  </ListItem>
                )
              })}
            </List>
          </Box>

          <Divider />

          {/* Submitted Assets */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Submitted Assets
            </Typography>
            {creativeRequest.submittedAssets && creativeRequest.submittedAssets.length > 0 ? (
              <List>
                {creativeRequest.submittedAssets.map((asset, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getAssetIcon(asset.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={asset.name}
                      secondary={`Uploaded ${format(new Date(asset.uploadedAt), 'MMM d, yyyy h:mm a')}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton size="small" href={asset.url} target="_blank">
                        <DownloadIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No assets submitted yet
              </Typography>
            )}
          </Box>

          {/* Upload New Assets */}
          {canSubmit && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Upload Assets
                </Typography>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="asset-upload"
                />
                <label htmlFor="asset-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                  >
                    Select Files
                  </Button>
                </label>
                {uploadingAssets.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Selected files:
                    </Typography>
                    <List dense>
                      {uploadingAssets.map((file, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={file.name}
                            secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            </>
          )}

          {/* Feedback History */}
          {creativeRequest.feedbackHistory && creativeRequest.feedbackHistory.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Feedback History
                </Typography>
                <Stack spacing={2}>
                  {creativeRequest.feedbackHistory.map((entry, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2">
                        {entry.feedback}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        {entry.userName} • {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Add Feedback */}
          {canApprove && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Add Feedback
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback for revision..."
                />
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        
        {canSubmit && uploadingAssets.length > 0 && (
          <Button
            onClick={handleSubmitAssets}
            variant="contained"
            disabled={loading}
            startIcon={<UploadIcon />}
          >
            Submit Assets
          </Button>
        )}

        {canApprove && (
          <>
            <Button
              onClick={handleRequestRevision}
              variant="outlined"
              color="error"
              disabled={loading || !feedback.trim()}
            >
              Request Revision
            </Button>
            <Button
              onClick={handleApprove}
              variant="contained"
              color="success"
              disabled={loading}
            >
              Approve Assets
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}