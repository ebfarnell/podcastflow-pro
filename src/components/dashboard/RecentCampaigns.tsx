import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Box,
} from '@mui/material'
import { MoreVert } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { campaignApi } from '@/services/api'
import { queryKeys } from '@/config/queryClient'

interface Campaign {
  id: string
  name: string
  advertiser?: {
    id: string
    name: string
  }
  advertiserId?: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  budget: number
  spend: number
  startDate: string
}

interface RecentCampaignsProps {
  limit?: number
  onCampaignChange?: () => void
  dateRange?: string
}

export function RecentCampaigns({ limit = 5, onCampaignChange, dateRange }: RecentCampaignsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Use React Query to fetch campaigns with optimized caching
  const { data: campaigns = [], isLoading: loading } = useQuery({
    queryKey: [...queryKeys.campaigns.list({ limit, sort: 'createdAt:desc' }), 'recent', dateRange || 'thisMonth'],
    queryFn: async () => {
      const params: any = { limit, sort: 'createdAt:desc' }
      if (dateRange) {
        params.dateRange = dateRange
      }
      const response = await campaignApi.getAll(params)
      return response.data?.campaigns || []
    },
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
    // Share cache with main campaigns list if limit and sort match
  })

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, campaignId: string) => {
    setAnchorEl(event.currentTarget)
    setSelectedCampaign(campaignId)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedCampaign(null)
  }

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'paused':
        return 'warning'
      case 'completed':
        return 'default'
      case 'draft':
        return 'info'
      default:
        return 'default'
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (campaignId: string) => campaignApi.delete(campaignId),
    onSuccess: async () => {
      // Invalidate all campaign queries
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      // Also invalidate dashboard metrics since campaign count might change
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      onCampaignChange?.() // Notify parent component of changes
      setNotification({
        open: true,
        message: 'Campaign deleted successfully',
        severity: 'success'
      })
    },
    onError: () => {
      setNotification({
        open: true,
        message: 'Failed to delete campaign',
        severity: 'error'
      })
    }
  })

  const duplicateMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const campaign = campaigns.find(c => c.id === campaignId)
      if (!campaign) throw new Error('Campaign not found')
      
      const newCampaign = {
        ...campaign,
        name: `${campaign.name} (Copy)`,
        status: 'draft' as const,
        spend: 0,
      }
      
      return campaignApi.create(newCampaign)
    },
    onSuccess: async (data) => {
      // Invalidate all campaign queries
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      onCampaignChange?.() // Notify parent component of changes
      setNotification({
        open: true,
        message: 'Campaign duplicated successfully',
        severity: 'success'
      })
      // Navigate to the new campaign
      router.push(`/campaigns/${data.id}`)
    },
    onError: () => {
      setNotification({
        open: true,
        message: 'Failed to duplicate campaign',
        severity: 'error'
      })
    }
  })

  const handleDelete = () => {
    if (selectedCampaign) {
      deleteMutation.mutate(selectedCampaign)
      setDeleteDialogOpen(false)
      handleMenuClose()
    }
  }

  const handleDuplicate = () => {
    if (selectedCampaign) {
      duplicateMutation.mutate(selectedCampaign)
      handleMenuClose()
    }
  }

  if (loading) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom>
            Recent Campaigns
          </Typography>
          <Box sx={{ flex: 1 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
            ))}
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (!campaigns.length) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom>
            Recent Campaigns
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert severity="info">
              No campaigns found. Create your first campaign to get started.
            </Alert>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom>
            Recent Campaigns
          </Typography>
          <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
            <Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '35%' }}>Campaign</TableCell>
                  <TableCell sx={{ width: '25%' }}>Client</TableCell>
                  <TableCell sx={{ width: '15%', textAlign: 'center' }}>Status</TableCell>
                  <TableCell sx={{ width: '12%', textAlign: 'right' }}>Budget</TableCell>
                  <TableCell sx={{ width: '12%', textAlign: 'right' }}>Spend</TableCell>
                  <TableCell sx={{ width: '1%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} hover>
                    <TableCell sx={{ maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {campaign.name}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {campaign.advertiser?.name || 'No Client'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip
                        label={campaign.status}
                        color={getStatusColor(campaign.status)}
                        size="small"
                        sx={{ minWidth: 60, height: 20 }}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      ${(campaign.budget || 0).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      ${(campaign.spend || 0).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ p: 0 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, campaign.id)}
                        sx={{ p: 0.5 }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => router.push(`/campaigns/${selectedCampaign}`)}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => router.push(`/campaigns/${selectedCampaign}/edit`)}>
          Edit Campaign
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => setDeleteDialogOpen(true)}>
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Campaign?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this campaign? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  )
}