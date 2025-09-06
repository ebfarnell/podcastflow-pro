'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Avatar,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as PendingIcon,
  Description as ProposalIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'

interface Proposal {
  id: string
  name: string
  campaignName?: string
  advertiserName?: string
  status: string
  approvalStatus: string
  totalValue: number
  slotCount: number
  createdByName: string
  currentApproverName?: string
  createdAt: string
  updatedAt: string
  approvalHistory?: any[]
}

export default function ProposalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all')

  useEffect(() => {
    fetchProposals()
  }, [])

  const fetchProposals = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/proposals')
      if (!response.ok) {
        throw new Error('Failed to fetch proposals')
      }
      const data = await response.json()
      setProposals(data.proposals || [])
    } catch (error) {
      console.error('Error fetching proposals:', error)
      toast.error('Failed to load proposals')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (proposalId: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) {
      return
    }

    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete proposal')
      }

      toast.success('Proposal deleted successfully')
      fetchProposals()
    } catch (error) {
      console.error('Error deleting proposal:', error)
      toast.error('Failed to delete proposal')
    }
  }

  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <ApprovedIcon />
      case 'rejected':
        return <RejectedIcon />
      case 'pending_approval':
        return <PendingIcon />
      default:
        return <ProposalIcon />
    }
  }

  const getApprovalStatusColor = (status: string): any => {
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

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'sent':
        return 'primary'
      case 'viewed':
        return 'info'
      case 'accepted':
        return 'success'
      case 'declined':
        return 'error'
      default:
        return 'default'
    }
  }

  // Filter proposals
  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = 
      proposal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.campaignName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.advertiserName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter
    const matchesApprovalStatus = approvalStatusFilter === 'all' || proposal.approvalStatus === approvalStatusFilter

    return matchesSearch && matchesStatus && matchesApprovalStatus
  })

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" display="flex" alignItems="center" gap={1}>
              <ProposalIcon fontSize="large" />
              Proposals
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/schedule-builder')}
            >
              Create Proposal
            </Button>
          </Box>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search proposals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="sent">Sent</MenuItem>
                    <MenuItem value="viewed">Viewed</MenuItem>
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="declined">Declined</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Approval Status</InputLabel>
                  <Select
                    value={approvalStatusFilter}
                    onChange={(e) => setApprovalStatusFilter(e.target.value)}
                    label="Approval Status"
                  >
                    <MenuItem value="all">All Approvals</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="pending_approval">Pending Approval</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Proposals Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Proposal</TableCell>
                  <TableCell>Campaign/Advertiser</TableCell>
                  <TableCell align="center">Value</TableCell>
                  <TableCell align="center">Slots</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Approval</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredProposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No proposals found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {proposal.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {proposal.campaignName || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {proposal.advertiserName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          ${(proposal.totalValue || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={proposal.slotCount || 0} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={proposal.status}
                          size="small"
                          color={getStatusColor(proposal.status)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <Chip
                            icon={getApprovalStatusIcon(proposal.approvalStatus)}
                            label={proposal.approvalStatus.replace('_', ' ')}
                            size="small"
                            color={getApprovalStatusColor(proposal.approvalStatus)}
                          />
                        </Box>
                        {proposal.currentApproverName && proposal.approvalStatus === 'pending_approval' && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Awaiting: {proposal.currentApproverName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {proposal.createdByName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(proposal.createdAt), 'MMM dd, yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={() => router.push(`/proposals/${proposal.id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {proposal.approvalStatus === 'draft' && (
                            <Tooltip title="Submit for Approval">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/proposals/${proposal.id}/submit-for-approval`, {
                                      method: 'POST',
                                    })
                                    if (!response.ok) {
                                      throw new Error('Failed to submit for approval')
                                    }
                                    toast.success('Proposal submitted for approval')
                                    fetchProposals()
                                  } catch (error) {
                                    toast.error('Failed to submit for approval')
                                  }
                                }}
                              >
                                <SendIcon />
                              </IconButton>
                            </Tooltip>
                          )}

                          {(proposal.approvalStatus === 'draft' || proposal.approvalStatus === 'rejected') && (
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/proposals/${proposal.id}/edit`)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}

                          {user?.role === 'admin' && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(proposal.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Container>
      </DashboardLayout>
    </RouteProtection>
  )
}