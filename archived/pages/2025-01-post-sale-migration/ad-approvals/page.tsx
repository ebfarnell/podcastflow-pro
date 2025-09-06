'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsApi } from '@/services/api'
import { MigrationNotice } from '@/components/common/MigrationNotice'
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Badge,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Pending,
  PlayCircle,
  Comment,
  AttachFile,
  Download,
  Visibility,
  ThumbUp,
  ThumbDown,
  AccessTime,
  Person,
  Campaign,
  Add,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import AdSubmissionForm from '@/components/ad-approvals/AdSubmissionForm'

interface AdApproval {
  id: string
  advertiser: string
  campaign: string
  show: string
  type: 'script' | 'audio' | 'video' | 'host-read' | 'produced'
  submittedBy: string
  submittedDate: string
  status: 'pending' | 'approved' | 'rejected' | 'revision' | 'submitted'
  priority: 'low' | 'medium' | 'high'
  duration: string
  notes?: string
  revisionCount: number
  deadline: string
  responsibleUser: string
  responsibleRole: string
  script?: string
  spotAudioUrl?: string
  spotAudioFileInfo?: {
    fileName?: string
    fileSize?: number
    fileType?: string
    duration?: number | null
  }
  spotSubmittedAt?: string
  spotSubmittedBy?: string
}

export default function AdApprovalsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Fetch approvals from real API
  const { data: approvalsData = [], isLoading, error } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalsApi.list().then(res => {
      console.log('Ad approvals API response:', res)
      // Handle different response formats
      if (res.approvals) return res.approvals  // Our local API format
      if (res.data?.approvals) return res.data.approvals
      if (res.data?.Items) return res.data.Items  // AWS API format
      if (res.data) return res.data
      return []
    }),
  })
  
  // Transform API data to match interface
  const approvals = approvalsData.map((item: any) => ({
    id: item.id || item.SK?.replace('APPROVAL#', ''),
    advertiser: item.advertiserName || (typeof item.advertiser === 'string' ? item.advertiser : item.advertiser?.name) || '',
    campaign: item.title || (typeof item.campaign === 'string' ? item.campaign : item.campaign?.name) || '',
    show: item.showName || (typeof item.show === 'string' ? item.show : item.show?.name) || '',
    type: item.type || 'script',
    submittedBy: item.submittedBy || (typeof item.submitter === 'string' ? item.submitter : item.submitter?.name) || '',
    submittedDate: item.submittedDate || item.submittedAt || item.createdAt || '',
    status: item.status || 'pending',
    priority: item.priority || 'medium',
    duration: item.duration ? `${item.duration}s` : '',
    notes: item.notes || '',
    script: item.script || '',
    spotAudioUrl: item.spotAudioUrl || '',
    spotAudioFileInfo: item.spotAudioFileInfo || {},
    spotSubmittedAt: item.spotSubmittedAt || '',
    spotSubmittedBy: item.spotSubmittedBy || '',
    revisionCount: item.revisionCount || 0,
    deadline: item.deadline || '',
    responsibleUser: item.responsibleUser || '',
    responsibleRole: item.responsibleRole || '',
  }))
  
  // Mutations for approval actions
  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => approvalsApi.approve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setReviewDialog(false)
      setSelectedApproval(null)
      setFeedback('')
    },
  })
  
  const rejectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => approvalsApi.reject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setReviewDialog(false)
      setSelectedApproval(null)
      setFeedback('')
    },
  })
  
  const revisionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => approvalsApi.requestRevision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setReviewDialog(false)
      setSelectedApproval(null)
      setFeedback('')
    },
  })
  
  const [selectedTab, setSelectedTab] = useState(0)
  const [selectedApproval, setSelectedApproval] = useState<AdApproval | null>(null)
  const [reviewDialog, setReviewDialog] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)

  const pendingCount = approvals.filter(a => a.status === 'pending').length
  const submittedCount = approvals.filter(a => a.status === 'submitted').length
  const revisionCount = approvals.filter(a => a.status === 'revision').length

  const filteredApprovals = approvals.filter(approval => {
    if (selectedTab === 0) return approval.status === 'pending'
    if (selectedTab === 1) return approval.status === 'submitted'
    if (selectedTab === 2) return approval.status === 'revision'
    if (selectedTab === 3) return approval.status === 'approved'
    if (selectedTab === 4) return approval.status === 'rejected'
    return true
  })

  const getStatusColor = (status: AdApproval['status']) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'submitted': return 'info'
      case 'approved': return 'success'
      case 'rejected': return 'error'
      case 'revision': return 'warning'
      default: return 'default'
    }
  }

  const getPriorityColor = (priority: AdApproval['priority']) => {
    switch (priority) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'default'
      default: return 'default'
    }
  }

  const handleReview = (approval: AdApproval) => {
    setSelectedApproval(approval)
    setReviewDialog(true)
  }

  const handlePlayPreview = (approval: AdApproval) => {
    if (approval.type === 'audio') {
      alert(`Playing audio for: ${approval.campaign}\n(Audio playback functionality would be implemented here)`)
    }
  }

  const handleDownload = (approval: AdApproval) => {
    const content = `Ad Content: ${approval.campaign}\nAdvertiser: ${approval.advertiser}\nCampaign: ${approval.campaign}\nShow: ${approval.show}\nType: ${approval.type}\nDuration: ${approval.duration}\nStatus: ${approval.status}\nSubmitted: ${approval.submittedDate}\nNotes: ${approval.notes || 'None'}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ad-content-${approval.id}-${approval.campaign.replace(/\s+/g, '-')}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }
  
  const handleApprove = () => {
    if (selectedApproval) {
      approveMutation.mutate({
        id: selectedApproval.id,
        data: { feedback }
      })
    }
  }
  
  const handleReject = () => {
    if (selectedApproval) {
      rejectMutation.mutate({
        id: selectedApproval.id,
        data: { feedback }
      })
    }
  }
  
  const handleRequestRevision = () => {
    if (selectedApproval) {
      revisionMutation.mutate({
        id: selectedApproval.id,
        data: { feedback }
      })
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.APPROVALS_VIEW}>
      <DashboardLayout>
      <MigrationNotice targetTab="creative&view=approvals" pageName="Ad Approvals" />
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Ad Approvals
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Review and approve advertising content
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Badge badgeContent={pendingCount} color="warning">
              <Button 
                variant="outlined" 
                startIcon={<Pending />}
                onClick={() => setSelectedTab(0)}
              >
                Pending Tasks
              </Button>
            </Badge>
            <Badge badgeContent={submittedCount} color="info">
              <Button 
                variant="outlined" 
                startIcon={<CheckCircle />}
                onClick={() => setSelectedTab(1)}
              >
                Ready for Review
              </Button>
            </Badge>
            <Badge badgeContent={revisionCount} color="warning">
              <Button 
                variant="outlined" 
                startIcon={<Comment />}
                onClick={() => setSelectedTab(2)}
              >
                Revisions
              </Button>
            </Badge>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={() => setShowSubmissionForm(true)}
            >
              Submit New Ad
            </Button>
          </Box>
        </Box>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading approvals...</Typography>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography color="error">Error loading approvals. Please try again.</Typography>
          </Box>
        )}

        {!isLoading && !error && (
          <>
            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
              <Tabs
                value={selectedTab}
                onChange={(_, newValue) => setSelectedTab(newValue)}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label={`Pending (${approvals.filter(a => a.status === 'pending').length})`} />
                <Tab label={`Submitted (${approvals.filter(a => a.status === 'submitted').length})`} />
                <Tab label={`Revisions (${approvals.filter(a => a.status === 'revision').length})`} />
                <Tab label={`Approved (${approvals.filter(a => a.status === 'approved').length})`} />
                <Tab label={`Rejected (${approvals.filter(a => a.status === 'rejected').length})`} />
              </Tabs>
            </Paper>

            {/* Approval List */}
            <Paper>
              {/* List Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 3,
                  py: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                  gap: 3,
                }}
              >
                <Typography variant="subtitle2" sx={{ flex: '1 1 25%' }}>
                  Campaign / Advertiser
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: '1 1 20%' }}>
                  Show / Type
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: '1 1 15%' }}>
                  Due Date
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: '1 1 20%' }}>
                  Status / Responsible
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: '0 0 auto', minWidth: 200 }}>
                  Actions
                </Typography>
              </Box>
              
              <List sx={{ p: 0 }}>
                {filteredApprovals.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="body1" color="text.secondary">
                      No {
                        selectedTab === 0 ? 'pending' : 
                        selectedTab === 1 ? 'submitted' : 
                        selectedTab === 2 ? 'revision' : 
                        selectedTab === 3 ? 'approved' : 
                        'rejected'
                      } approvals
                    </Typography>
                  </Box>
                ) : (
                  filteredApprovals.map((approval, index) => (
                  <React.Fragment key={approval.id}>
                    <ListItem
                      sx={{
                        py: 2,
                        px: 3,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 3 }}>
                        {/* Campaign Info */}
                        <Box sx={{ flex: '1 1 25%', minWidth: 0 }}>
                          <Typography variant="subtitle1" noWrap>
                            {approval.campaign}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {approval.advertiser}
                          </Typography>
                        </Box>

                        {/* Show Info */}
                        <Box sx={{ flex: '1 1 20%', minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {approval.show}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {approval.type} • {approval.duration}
                          </Typography>
                        </Box>

                        {/* Due Date */}
                        <Box sx={{ flex: '1 1 15%', minWidth: 0 }}>
                          <Typography variant="body2" color={approval.deadline && new Date(approval.deadline) < new Date() ? 'error' : 'text.primary'}>
                            {approval.deadline ? new Date(approval.deadline).toLocaleDateString() : '-'}
                          </Typography>
                          {approval.deadline && (
                            <Typography variant="caption" color="text.secondary">
                              {(() => {
                                const daysUntil = Math.ceil((new Date(approval.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`
                                if (daysUntil === 0) return 'Due today'
                                if (daysUntil === 1) return 'Due tomorrow'
                                return `${daysUntil} days`
                              })()}
                            </Typography>
                          )}
                        </Box>

                        {/* Status and Responsible User */}
                        <Box sx={{ flex: '1 1 20%', minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip
                              label={approval.status}
                              size="small"
                              color={getStatusColor(approval.status)}
                            />
                            {approval.priority === 'high' && (
                              <Chip
                                label="High"
                                size="small"
                                color="error"
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {approval.responsibleUser || approval.responsibleRole || 'Unassigned'}
                          </Typography>
                        </Box>

                        {/* Actions */}
                        <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleReview(approval)}
                            color="primary"
                          >
                            <Visibility />
                          </IconButton>
                          {approval.type === 'audio' && (
                            <IconButton
                              size="small"
                              onClick={() => handlePlayPreview(approval)}
                            >
                              <PlayCircle />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(approval)}
                          >
                            <Download />
                          </IconButton>
                          {approval.status === 'pending' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => handleReview(approval)}
                            >
                              Review
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </ListItem>
                    {index < filteredApprovals.length - 1 && <Divider />}
                  </React.Fragment>
                )))}
              </List>
            </Paper>
          </>
        )}

        {/* Submission Form Dialog */}
        <Dialog 
          open={showSubmissionForm} 
          onClose={() => setShowSubmissionForm(false)} 
          maxWidth="lg" 
          fullWidth
          PaperProps={{
            sx: { maxHeight: '90vh' }
          }}
        >
          <DialogContent sx={{ p: 0 }}>
            <AdSubmissionForm onClose={() => {
              setShowSubmissionForm(false)
              queryClient.invalidateQueries({ queryKey: ['approvals'] })
            }} />
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Review Ad Content - {selectedApproval?.advertiser}
          </DialogTitle>
          <DialogContent>
            {selectedApproval && (
              <Box sx={{ pt: 2 }}>
                <Typography variant="h6" gutterBottom>{selectedApproval.campaign}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Show</Typography>
                    <Typography variant="body1">{selectedApproval.show}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Type</Typography>
                    <Typography variant="body1">{selectedApproval.type}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Duration</Typography>
                    <Typography variant="body1">{selectedApproval.duration}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Submitted By</Typography>
                    <Typography variant="body1">{selectedApproval.submittedBy}</Typography>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Ad Content Preview</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    {/* Show script if available */}
                    {selectedApproval.script && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Script:</Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedApproval.script}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Show audio player if spot has been submitted */}
                    {selectedApproval.spotAudioUrl && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Submitted Audio:</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                          <audio controls style={{ width: '100%' }}>
                            <source src={selectedApproval.spotAudioUrl} type={selectedApproval.spotAudioFileInfo?.fileType || 'audio/mpeg'} />
                            Your browser does not support the audio element.
                          </audio>
                        </Box>
                        {selectedApproval.spotAudioFileInfo?.fileName && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            File: {selectedApproval.spotAudioFileInfo.fileName} 
                            {selectedApproval.spotAudioFileInfo.fileSize && ` (${(selectedApproval.spotAudioFileInfo.fileSize / 1024 / 1024).toFixed(2)} MB)`}
                          </Typography>
                        )}
                        {selectedApproval.spotSubmittedAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Submitted by {selectedApproval.spotSubmittedBy || 'Producer/Talent'} on {new Date(selectedApproval.spotSubmittedAt).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    )}
                    
                    {/* Show message if no content available */}
                    {!selectedApproval.script && !selectedApproval.spotAudioUrl && (
                      <Typography variant="body1" color="text.secondary">
                        No content available yet. Waiting for producer/talent to submit.
                      </Typography>
                    )}
                  </Paper>
                </Box>
                
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Feedback / Comments"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback for the advertiser..."
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReviewDialog(false)}>Cancel</Button>
            {/* Only show action buttons if spot has been submitted */}
            {selectedApproval?.status === 'submitted' && (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<Comment />}
                  onClick={handleRequestRevision}
                  disabled={revisionMutation.isPending}
                >
                  Request Revision
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ThumbDown />}
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                >
                  Reject
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ThumbUp />}
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
    </RouteProtection>
  )
}