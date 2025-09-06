'use client'

import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Avatar,
  Divider,
} from '@mui/material'
import {
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as PendingIcon,
  Send as SendIcon,
  ThumbUp as ApproveIcon,
  ThumbDown as RejectIcon,
  Comment as CommentIcon,
  History as HistoryIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

interface ProposalApprovalPanelProps {
  proposal: any
  currentUser: any
  onStatusChange: () => void
}

const REQUIRED_CHANGES_OPTIONS = [
  'Budget adjustment needed',
  'Timeline modification required',
  'Creative changes requested',
  'Additional information needed',
  'Target audience clarification',
  'Compliance review required',
  'Legal review needed',
  'Pricing adjustment required',
]

export function ProposalApprovalPanel({ 
  proposal, 
  currentUser, 
  onStatusChange 
}: ProposalApprovalPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [approveComments, setApproveComments] = useState('')
  const [rejectComments, setRejectComments] = useState('')
  const [requiredChanges, setRequiredChanges] = useState<string[]>([])

  const canSubmitForApproval = 
    proposal.createdBy === currentUser.id && 
    ['draft', 'rejected'].includes(proposal.approvalStatus)

  const canApprove = 
    ['admin', 'master'].includes(currentUser.role) &&
    proposal.currentApproverId === currentUser.id &&
    proposal.approvalStatus === 'pending_approval'

  const handleSubmitForApproval = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/submit-for-approval`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for approval')
      }

      toast.success('Proposal submitted for approval')
      onStatusChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: approveComments,
          approvalLevel: 1, // TODO: Get from workflow
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve proposal')
      }

      const result = await response.json()
      toast.success(result.message)
      setApproveDialogOpen(false)
      setApproveComments('')
      onStatusChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectComments.trim()) {
      toast.error('Please provide comments for rejection')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: rejectComments,
          requiredChanges: requiredChanges.length > 0 ? requiredChanges : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject proposal')
      }

      toast.success('Proposal rejected with feedback')
      setRejectDialogOpen(false)
      setRejectComments('')
      setRequiredChanges([])
      onStatusChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'rejected':
        return 'error'
      case 'pending_approval':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <ApprovedIcon />
      case 'rejected':
        return <RejectedIcon />
      case 'pending':
      case 'pending_approval':
        return <PendingIcon />
      default:
        return <HistoryIcon />
    }
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Approval Status
        </Typography>
        <Chip
          label={proposal.approvalStatus.replace('_', ' ').toUpperCase()}
          color={getStatusColor(proposal.approvalStatus)}
          icon={getStatusIcon(proposal.approvalStatus)}
        />
      </Box>

      {/* Current Status Info */}
      {proposal.approvalStatus === 'pending_approval' && proposal.currentApproverName && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Awaiting approval from {proposal.currentApproverName}
        </Alert>
      )}

      {proposal.approvalStatus === 'rejected' && proposal.approvalNotes && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Rejection Reason:
          </Typography>
          <Typography variant="body2">
            {proposal.approvalNotes}
          </Typography>
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {canSubmitForApproval && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSubmitForApproval}
            disabled={submitting}
          >
            Submit for Approval
          </Button>
        )}

        {canApprove && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setApproveDialogOpen(true)}
              disabled={submitting}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => setRejectDialogOpen(true)}
              disabled={submitting}
            >
              Reject
            </Button>
          </>
        )}
      </Box>

      {/* Approval History */}
      {proposal.approvalHistory && proposal.approvalHistory.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" gutterBottom>
            Approval History
          </Typography>
          <Timeline>
            {proposal.approvalHistory.map((item: any, index: number) => (
              <TimelineItem key={item.id}>
                <TimelineOppositeContent color="text.secondary">
                  {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color={getStatusColor(item.status)}>
                    {getStatusIcon(item.status)}
                  </TimelineDot>
                  {index < proposal.approvalHistory.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar sx={{ width: 24, height: 24 }}>
                      <PersonIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                    <Typography variant="subtitle2">
                      {item.approverName}
                    </Typography>
                    <Chip
                      label={item.status}
                      size="small"
                      color={getStatusColor(item.status)}
                    />
                  </Box>
                  {item.comments && (
                    <Typography variant="body2" color="text.secondary">
                      {item.comments}
                    </Typography>
                  )}
                  {item.requiredChanges && item.requiredChanges.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {item.requiredChanges.map((change: string, idx: number) => (
                        <Chip
                          key={idx}
                          label={change}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Proposal</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments (Optional)"
            value={approveComments}
            onChange={(e) => setApproveComments(e.target.value)}
            placeholder="Add any comments about this approval..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <ApproveIcon />}
          >
            Approve Proposal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Proposal</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Comments"
            value={rejectComments}
            onChange={(e) => setRejectComments(e.target.value)}
            placeholder="Explain why this proposal is being rejected..."
            required
            sx={{ mt: 2, mb: 3 }}
          />
          
          <Typography variant="subtitle2" gutterBottom>
            Required Changes (Optional)
          </Typography>
          <FormGroup>
            {REQUIRED_CHANGES_OPTIONS.map((option) => (
              <FormControlLabel
                key={option}
                control={
                  <Checkbox
                    checked={requiredChanges.includes(option)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRequiredChanges([...requiredChanges, option])
                      } else {
                        setRequiredChanges(requiredChanges.filter(c => c !== option))
                      }
                    }}
                  />
                }
                label={option}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={submitting || !rejectComments.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : <RejectIcon />}
          >
            Reject Proposal
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}