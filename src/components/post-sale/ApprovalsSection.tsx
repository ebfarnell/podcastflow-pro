import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  LinearProgress,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
} from '@mui/material'
import {
  Search,
  Schedule,
  CheckCircle,
  Cancel,
  Comment,
  Visibility,
  PlayCircle,
  Download,
  History,
  Person,
  Warning,
  ThumbUp,
  ThumbDown,
  Edit,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

// Enhanced approval statuses with granular sub-statuses
const APPROVAL_STATUSES = {
  pending: 'Pending Creation',
  pending_talent_review: 'Pending Talent Review',
  pending_ae_review: 'Pending AE Review',
  submitted: 'Submitted for Approval',
  in_revision: 'In Revision',
  pending_final_review: 'Pending Final Review',
  approved: 'Approved',
  rejected: 'Rejected',
  delivered: 'Delivered',
}

interface AdApproval {
  id: string
  advertiser: string
  campaign: string
  show: string
  type: string
  submittedBy: string
  submittedDate: string
  status: keyof typeof APPROVAL_STATUSES
  priority: 'low' | 'medium' | 'high'
  duration: string
  deadline: string
  responsibleUser: string
  responsibleRole: string
  revisionCount: number
  approvalHistory?: Array<{
    id: string
    action: string
    user: string
    timestamp: string
    comment?: string
  }>
}

export default function ApprovalsSection() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedApproval, setSelectedApproval] = useState<AdApproval | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  // Fetch approvals data
  const { data, isLoading, error } = useQuery({
    queryKey: ['post-sale-approvals', searchQuery, statusFilter, priorityFilter],
    queryFn: async () => {
      const response = await fetch('/api/ad-approvals')
      if (!response.ok) throw new Error('Failed to fetch approvals')
      const result = await response.json()
      
      // Transform data to match our interface
      const approvals = (result.approvals || result.data || result || []).map((item: any) => ({
        ...item,
        status: item.status || 'pending',
        approvalHistory: item.approvalHistory || []
      }))
      
      return { approvals }
    },
  })

  const approvals = data?.approvals || []

  const getStatusColor = (status: keyof typeof APPROVAL_STATUSES) => {
    switch (status) {
      case 'pending':
      case 'pending_talent_review':
      case 'pending_ae_review':
        return 'warning'
      case 'submitted':
      case 'pending_final_review':
        return 'info'
      case 'in_revision':
        return 'warning'
      case 'approved':
      case 'delivered':
        return 'success'
      case 'rejected':
        return 'error'
      default:
        return 'default'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'default'
      default: return 'default'
    }
  }

  const getApprovalSteps = (status: keyof typeof APPROVAL_STATUSES) => {
    const steps = [
      'Creation',
      'Talent Review',
      'AE Review',
      'Final Approval',
      'Delivered'
    ]
    
    const stepIndex = {
      pending: 0,
      pending_talent_review: 1,
      pending_ae_review: 2,
      submitted: 3,
      in_revision: 2, // Goes back to review
      pending_final_review: 3,
      approved: 4,
      rejected: -1,
      delivered: 4,
    }
    
    return { steps, activeStep: stepIndex[status] || 0 }
  }

  const handleViewHistory = (approval: AdApproval) => {
    setSelectedApproval(approval)
    setHistoryDialogOpen(true)
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">Failed to load approvals. Please try again.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search approvals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              {Object.entries(APPROVAL_STATUSES).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Priority"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Status Overview */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Workflow Overview</Typography>
        <Stepper activeStep={1} alternativeLabel>
          <Step>
            <StepLabel>Creation</StepLabel>
          </Step>
          <Step>
            <StepLabel>Talent Review</StepLabel>
          </Step>
          <Step>
            <StepLabel>AE Review</StepLabel>
          </Step>
          <Step>
            <StepLabel>Final Approval</StepLabel>
          </Step>
          <Step>
            <StepLabel>Delivered</StepLabel>
          </Step>
        </Stepper>
      </Paper>

      {/* Approvals Table */}
      {isLoading ? (
        <LinearProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campaign / Show</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Responsible</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Deadline</TableCell>
                <TableCell>Revisions</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No approvals found. Adjust your filters or check back later.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                approvals.map((approval: AdApproval) => (
                  <TableRow key={approval.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">{approval.campaign}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {approval.show} • {approval.advertiser}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Chip
                          label={APPROVAL_STATUSES[approval.status] || approval.status}
                          size="small"
                          color={getStatusColor(approval.status)}
                        />
                        {approval.type && (
                          <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 0.5 }}>
                            {approval.type} • {approval.duration}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          <Person sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {approval.responsibleUser || 'Unassigned'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {approval.responsibleRole}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={approval.priority}
                        size="small"
                        color={getPriorityColor(approval.priority)}
                      />
                    </TableCell>
                    <TableCell>
                      {approval.deadline ? (
                        <Box>
                          <Typography variant="body2">
                            {format(new Date(approval.deadline), 'MMM d')}
                          </Typography>
                          <Typography variant="caption" color={
                            new Date(approval.deadline) < new Date() ? 'error' : 'textSecondary'
                          }>
                            {(() => {
                              const daysUntil = Math.ceil((new Date(approval.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                              if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`
                              if (daysUntil === 0) return 'Due today'
                              return `${daysUntil}d left`
                            })()}
                          </Typography>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {approval.revisionCount > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Edit sx={{ fontSize: 16, color: 'warning.main' }} />
                          <Typography variant="body2">
                            {approval.revisionCount}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">0</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/ad-approvals/${approval.id}`)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View History">
                          <IconButton
                            size="small"
                            onClick={() => handleViewHistory(approval)}
                          >
                            <History />
                          </IconButton>
                        </Tooltip>
                        {approval.type === 'audio' && (
                          <Tooltip title="Play Preview">
                            <IconButton size="small">
                              <PlayCircle />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approval History Dialog */}
      <Dialog 
        open={historyDialogOpen} 
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Approval History - {selectedApproval?.campaign}
        </DialogTitle>
        <DialogContent>
          {selectedApproval && (
            <Box sx={{ mt: 2 }}>
              <Timeline>
                <TimelineItem>
                  <TimelineOppositeContent color="textSecondary">
                    {format(new Date(selectedApproval.submittedDate), 'MMM d, h:mm a')}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color="primary" />
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography variant="subtitle2">Created</Typography>
                    <Typography variant="body2" color="textSecondary">
                      by {selectedApproval.submittedBy}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
                
                {selectedApproval.approvalHistory?.map((event, index) => (
                  <TimelineItem key={event.id}>
                    <TimelineOppositeContent color="textSecondary">
                      {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={
                        event.action === 'approved' ? 'success' :
                        event.action === 'rejected' ? 'error' :
                        event.action === 'revision_requested' ? 'warning' :
                        'grey'
                      }>
                        {event.action === 'approved' ? <ThumbUp /> :
                         event.action === 'rejected' ? <ThumbDown /> :
                         event.action === 'revision_requested' ? <Comment /> :
                         <Schedule />}
                      </TimelineDot>
                      {index < selectedApproval.approvalHistory!.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">
                        {event.action.replace('_', ' ').charAt(0).toUpperCase() + event.action.slice(1).replace('_', ' ')}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        by {event.user}
                      </Typography>
                      {event.comment && (
                        <Paper sx={{ p: 1, mt: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="caption">
                            {event.comment}
                          </Typography>
                        </Paper>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}