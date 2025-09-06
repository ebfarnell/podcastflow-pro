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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
  Stepper,
  Step,
  StepLabel,
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
  AudioFile,
  VideoFile,
  Description,
  PlayCircle,
  Download,
  TrendingUp,
  Visibility,
  CheckCircle,
  Schedule,
  Warning,
  Person,
  History,
  ThumbUp,
  ThumbDown,
  Comment,
  Task,
  Assignment,
  Add,
  Edit,
  Cancel,
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

const formatIcons = {
  audio: <AudioFile />,
  video: <VideoFile />,
  script: <Description />,
}

interface Creative {
  id: string
  name: string
  description?: string
  type: string
  format: string
  duration: number
  status: string
  impressions: number
  clicks: number
  conversions: number
  advertiser?: {
    id: string
    name: string
  }
  campaign?: {
    id: string
    name: string
  }
  createdAt: string
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

interface AdRequest {
  id: string
  campaign: string
  show: string
  advertiser: string
  type: string
  priority: 'low' | 'medium' | 'high'
  assignedTo: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  dueDate: string
  createdAt: string
  description: string
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CreativeManagementSection() {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedApproval, setSelectedApproval] = useState<AdApproval | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  // Fetch creatives data
  const { data: creativesData, isLoading: creativesLoading, error: creativesError } = useQuery({
    queryKey: ['post-sale-creatives', searchQuery, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
        includePerformance: 'true'
      })
      if (searchQuery) params.append('search', searchQuery)
      if (typeFilter) params.append('type', typeFilter)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/creatives?${params}`)
      if (!response.ok) throw new Error('Failed to fetch creatives')
      return response.json()
    },
  })

  // Fetch approvals data
  const { data: approvalsData, isLoading: approvalsLoading, error: approvalsError } = useQuery({
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

  // Fetch ad requests data (mock for now)
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['post-sale-ad-requests'],
    queryFn: async () => {
      // Mock data for ad requests - replace with real API call
      return {
        requests: [
          {
            id: '1',
            campaign: 'Summer Tech Sale',
            show: 'The Morning Show',
            advertiser: 'Tech Corp',
            type: 'Host Read',
            priority: 'high',
            assignedTo: 'John Producer',
            status: 'in_progress',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            description: 'Create 30-second host-read ad for tech product launch'
          },
          {
            id: '2',
            campaign: 'Holiday Campaign',
            show: 'Daily Podcast',
            advertiser: 'Retail Plus',
            type: 'Produced Spot',
            priority: 'medium',
            assignedTo: 'Sarah Audio',
            status: 'pending',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            description: 'Produce 15-second holiday promotional spot'
          }
        ] as AdRequest[]
      }
    }
  })

  const creatives = creativesData?.creatives || []
  const approvals = approvalsData?.approvals || []
  const requests = requestsData?.requests || []

  const getStatusColor = (status: string, type: 'creative' | 'approval' | 'request' = 'creative') => {
    if (type === 'approval') {
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
    } else if (type === 'request') {
      switch (status) {
        case 'pending': return 'warning'
        case 'in_progress': return 'info'
        case 'completed': return 'success'
        case 'cancelled': return 'error'
        default: return 'default'
      }
    } else {
      switch (status) {
        case 'active': return 'success'
        case 'inactive': return 'warning'
        case 'pending_approval': return 'info'
        case 'archived': return 'default'
        default: return 'default'
      }
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

  const getStatusIcon = (status: string, type: 'creative' | 'approval' | 'request' = 'creative') => {
    if (type === 'request') {
      switch (status) {
        case 'pending': return <Schedule fontSize="small" />
        case 'in_progress': return <Task fontSize="small" />
        case 'completed': return <CheckCircle fontSize="small" />
        case 'cancelled': return <Cancel fontSize="small" />
        default: return null
      }
    } else {
      switch (status) {
        case 'active': 
        case 'approved':
        case 'delivered': return <CheckCircle fontSize="small" />
        case 'inactive': 
        case 'in_revision': return <Warning fontSize="small" />
        case 'pending_approval':
        case 'pending':
        case 'submitted': return <Schedule fontSize="small" />
        default: return null
      }
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}` : `${minutes}:00`
  }

  const handleViewHistory = (approval: AdApproval) => {
    setSelectedApproval(approval)
    setHistoryDialogOpen(true)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Creative Management
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setActiveView('library')} // TODO: Open upload dialog
          >
            Upload Creative
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Creative Assets" icon={<VideoFile />} iconPosition="start" />
          <Tab label="Ad Approvals" icon={<CheckCircle />} iconPosition="start" />
          <Tab label="Ad Requests" icon={<Task />} iconPosition="start" />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          {/* Creative Assets Tab */}
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                size="small"
                placeholder="Search creatives..."
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
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  label="Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="pre-roll">Pre-Roll</MenuItem>
                  <MenuItem value="mid-roll">Mid-Roll</MenuItem>
                  <MenuItem value="post-roll">Post-Roll</MenuItem>
                  <MenuItem value="host-read">Host Read</MenuItem>
                  <MenuItem value="produced">Produced</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending_approval">Pending Approval</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {creativesError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load creatives. Please try refreshing.
            </Alert>
          )}

          {/* Creatives Grid */}
          {creativesLoading ? (
            <LinearProgress />
          ) : creatives.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <VideoFile sx={{ fontSize: 64, color: 'text.secondary' }} />
              <Typography variant="h6" gutterBottom>
                No creatives found
              </Typography>
              <Typography color="textSecondary" sx={{ mb: 2 }}>
                Upload your first creative asset to get started.
              </Typography>
              <Button variant="contained" startIcon={<Add />}>
                Upload Creative
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {creatives.map((creative: Creative) => (
                <Grid item xs={12} sm={6} md={4} key={creative.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {formatIcons[creative.format as keyof typeof formatIcons] || <Description />}
                        </Avatar>
                        <Chip
                          icon={getStatusIcon(creative.status)}
                          label={creative.status.replace('_', ' ')}
                          size="small"
                          color={getStatusColor(creative.status)}
                        />
                      </Box>
                      
                      <Typography variant="h6" gutterBottom noWrap>
                        {creative.name}
                      </Typography>
                      
                      {creative.description && (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2, height: 40, overflow: 'hidden' }}>
                          {creative.description}
                        </Typography>
                      )}
                      
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="textSecondary">Type:</Typography>
                          <Typography variant="caption">{creative.type.replace('-', ' ')}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="textSecondary">Duration:</Typography>
                          <Typography variant="caption">{formatDuration(creative.duration)}</Typography>
                        </Box>
                        {creative.advertiser && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="textSecondary">Advertiser:</Typography>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 120 }}>
                              {creative.advertiser.name}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                      
                      {/* Performance Metrics */}
                      {creative.impressions > 0 && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Typography variant="subtitle2" gutterBottom>Performance</Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={4}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" color="primary">
                                  {creative.impressions > 1000 ? `${(creative.impressions / 1000).toFixed(1)}k` : creative.impressions}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">Impressions</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={4}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                  {creative.impressions > 0 ? `${(creative.clicks / creative.impressions * 100).toFixed(1)}%` : '0%'}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">CTR</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={4}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" color="info.main">
                                  {creative.conversions}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">Conversions</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </CardContent>
                    
                    <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        {format(new Date(creative.createdAt), 'MMM d, yyyy')}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {creative.format !== 'script' && (
                          <Tooltip title="Preview">
                            <IconButton size="small">
                              <PlayCircle />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => router.push(`/creatives/${creative.id}`)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          {/* Ad Approvals Tab */}
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
            <Typography variant="subtitle2" gutterBottom>Approval Workflow</Typography>
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

          {approvalsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load approvals. Please try refreshing.
            </Alert>
          )}

          {/* Approvals Table */}
          {approvalsLoading ? (
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
                        <CheckCircle sx={{ fontSize: 64, color: 'text.secondary' }} />
                        <Typography variant="h6" gutterBottom>
                          No approvals pending
                        </Typography>
                        <Typography color="textSecondary">
                          All creatives are approved and ready for delivery.
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
                              color={getStatusColor(approval.status, 'approval')}
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
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          {/* Ad Requests Tab */}
          {requestsLoading ? (
            <LinearProgress />
          ) : requests.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Task sx={{ fontSize: 64, color: 'text.secondary' }} />
              <Typography variant="h6" gutterBottom>
                No ad requests found
              </Typography>
              <Typography color="textSecondary" sx={{ mb: 2 }}>
                Ad requests will automatically be created when orders are approved.
              </Typography>
              <Button variant="contained" startIcon={<Add />}>
                Create Manual Request
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign / Show</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request: AdRequest) => (
                    <TableRow key={request.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">{request.campaign}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {request.show} • {request.advertiser}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{request.type}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24 }}>
                            <Person sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Typography variant="body2">{request.assignedTo}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={request.priority}
                          size="small"
                          color={getPriorityColor(request.priority)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(request.status, 'request')}
                          label={request.status.replace('_', ' ')}
                          size="small"
                          color={getStatusColor(request.status, 'request')}
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {format(new Date(request.dueDate), 'MMM d')}
                          </Typography>
                          <Typography variant="caption" color={
                            new Date(request.dueDate) < new Date() ? 'error' : 'textSecondary'
                          }>
                            {(() => {
                              const daysUntil = Math.ceil((new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                              if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`
                              if (daysUntil === 0) return 'Due today'
                              return `${daysUntil}d left`
                            })()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small">
                              <Edit />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>

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