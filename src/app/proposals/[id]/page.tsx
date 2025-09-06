'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Send as SendIcon,
  FileDownload as DownloadIcon,
  Email as EmailIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as PendingIcon,
  Description as ProposalIcon,
  AttachMoney as MoneyIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { ProposalApprovalPanel } from '@/components/proposals/ProposalApprovalPanel'
import { ProposalVersionHistory } from '@/components/proposals/ProposalVersionHistory'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'

interface ProposalDetail {
  id: string
  name: string
  campaignId?: string
  campaignName?: string
  advertiserId?: string
  advertiserName?: string
  status: string
  approvalStatus: string
  totalValue: number
  notes?: string
  createdBy: string
  createdByName: string
  currentApproverId?: string
  currentApproverName?: string
  approvedBy?: string
  approvedAt?: string
  submittedForApprovalAt?: string
  createdAt: string
  updatedAt: string
  items?: any[]
  approvalHistory?: any[]
}

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [proposal, setProposal] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const proposalId = params.id as string

  useEffect(() => {
    if (proposalId) {
      fetchProposal()
    }
  }, [proposalId])

  const fetchProposal = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/proposals/${proposalId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch proposal')
      }
      const data = await response.json()
      setProposal(data)
    } catch (error) {
      console.error('Error fetching proposal:', error)
      toast.error('Failed to load proposal')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/export`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposal-${proposal?.name || proposalId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Failed to export PDF')
    }
  }

  const handleSendEmail = () => {
    router.push(`/proposals/${proposalId}/send`)
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

  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    )
  }

  if (!proposal) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">Proposal not found</Alert>
        </Container>
      </DashboardLayout>
    )
  }

  const canEdit = 
    (proposal.createdBy === user?.id || user?.role === 'admin') &&
    ['draft', 'rejected'].includes(proposal.approvalStatus)

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton onClick={() => router.push('/proposals')}>
                <BackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" display="flex" alignItems="center" gap={1}>
                  <ProposalIcon fontSize="large" />
                  {proposal.name}
                </Typography>
                <Box display="flex" gap={2} mt={1}>
                  <Chip
                    label={proposal.status}
                    size="small"
                    color={getStatusColor(proposal.status)}
                  />
                  <Chip
                    icon={getApprovalStatusIcon(proposal.approvalStatus)}
                    label={proposal.approvalStatus.replace('_', ' ')}
                    size="small"
                    color={getApprovalStatusColor(proposal.approvalStatus)}
                  />
                </Box>
              </Box>
            </Box>
            
            <Box display="flex" gap={1}>
              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => router.push(`/proposals/${proposalId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {proposal.approvalStatus === 'approved' && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportPDF}
                  >
                    Export PDF
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<EmailIcon />}
                    onClick={handleSendEmail}
                  >
                    Send Email
                  </Button>
                </>
              )}
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Left Column - Proposal Details */}
            <Grid item xs={12} md={8}>
              {/* Overview */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Campaign
                    </Typography>
                    <Typography variant="body1">
                      {proposal.campaignName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Advertiser
                    </Typography>
                    <Typography variant="body1">
                      {proposal.advertiserName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Value
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ${proposal.totalValue.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Created By
                    </Typography>
                    <Typography variant="body1">
                      {proposal.createdByName}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Created Date
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(proposal.createdAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(proposal.updatedAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </Grid>
                </Grid>
                
                {proposal.notes && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1">
                      {proposal.notes}
                    </Typography>
                  </>
                )}
              </Paper>

              {/* Line Items */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Line Items
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Show</TableCell>
                        <TableCell>Episode</TableCell>
                        <TableCell>Placement</TableCell>
                        <TableCell>Air Date</TableCell>
                        <TableCell align="center">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {proposal.items && proposal.items.length > 0 ? (
                        proposal.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.showName || 'N/A'}</TableCell>
                            <TableCell>{item.episodeName || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip
                                label={item.placementType}
                                size="small"
                                color={
                                  item.placementType === 'pre-roll' ? 'primary' :
                                  item.placementType === 'mid-roll' ? 'secondary' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {item.airDate ? format(new Date(item.airDate), 'MMM dd, yyyy') : 'TBD'}
                            </TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">${item.unitPrice}</TableCell>
                            <TableCell align="right">
                              ${(item.quantity * item.unitPrice).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            No line items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Version History */}
              <Paper sx={{ p: 3, mt: 3 }}>
                <ProposalVersionHistory 
                  proposalId={proposalId}
                  currentVersion={proposal.version || 1}
                />
              </Paper>
            </Grid>

            {/* Right Column - Approval Panel */}
            <Grid item xs={12} md={4}>
              <ProposalApprovalPanel
                proposal={proposal}
                currentUser={user}
                onStatusChange={fetchProposal}
              />
            </Grid>
          </Grid>
        </Container>
      </DashboardLayout>
    </RouteProtection>
  )
}