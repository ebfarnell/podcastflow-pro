'use client'


import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material'
import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { CampaignTimeline } from '@/components/campaigns/CampaignTimeline'
import { CampaignApprovalButton } from '@/components/campaigns/CampaignApprovalButton'
import { CampaignScheduleTab } from '@/components/campaigns/CampaignScheduleTab'
import { CampaignPreBill } from '@/components/campaigns/CampaignPreBill'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'

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

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false)

  const campaignId = params.id as string

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignApi.get(campaignId),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => campaignApi.update(campaignId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const duplicateCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaign) throw new Error('No campaign to duplicate')
      
      // Create duplicate campaign with modified data
      const duplicateData = {
        name: `${campaign.name} (Copy)`,
        advertiserId: campaign.advertiserId,
        agencyId: campaign.agencyId,
        organizationId: campaign.organizationId,
        budget: campaign.budget,
        targetImpressions: campaign.targetImpressions,
        targetAudience: campaign.targetAudience,
        startDate: new Date().toISOString().split('T')[0], // Start today
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // End in 30 days
        status: 'draft', // Always start as draft
        // Reset performance metrics
        spent: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0
      }
      
      return campaignApi.create(duplicateData)
    },
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      router.push(`/campaigns/${newCampaign.id}`)
    },
    onError: (error: any) => {
      console.error('Failed to duplicate campaign:', error)
    }
  })

  const handleDuplicateCampaign = () => {
    if (campaign) {
      duplicateCampaignMutation.mutate()
    }
  }

  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Requesting deletion for campaign:', { 
        id: campaignId, 
        name: campaign?.name,
        entityType: 'campaign'
      })
      
      // Validate we have the required campaign data
      if (!campaign?.name) {
        throw new Error('Campaign data not loaded')
      }
      
      const payload = {
        entityType: 'campaign',
        entityId: campaignId,
        entityName: campaign.name,
        reason: 'User requested deletion from campaign details page'
      }
      
      console.log('📤 Sending deletion request payload:', payload)
      
      const response = await fetch('/api/deletion-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      const responseData = await response.json()
      
      if (!response.ok) {
        console.error('❌ Deletion request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        })
        throw new Error(responseData.error || 'Failed to request deletion')
      }
      
      console.log('✅ Deletion request created successfully:', responseData)
      return responseData
    },
    onSuccess: (data) => {
      console.log('✅ Deletion request mutation success:', data)
      // Invalidate both the individual campaign and the campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['pre-sale-dashboard'] })
      setDeleteDialogOpen(false)
      // Redirect to Pre-Sale Management campaigns tab
      router.push('/presale?tab=campaigns')
    },
    onError: (error: any) => {
      console.error('❌ Failed to request deletion:', error)
      alert(`Failed to request deletion: ${error.message}`)
    }
  })

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => campaignApi.update(campaignId, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      setArchiveDialogOpen(false)
      setUnarchiveDialogOpen(false)
    },
  })

  const handleRequestDeletion = () => {
    setDeleteDialogOpen(true)
  }

  const handleArchiveToggle = (archive: boolean) => {
    if (archive) {
      setArchiveDialogOpen(true)
    } else {
      setUnarchiveDialogOpen(true)
    }
  }

  const confirmRequestDeletion = () => {
    requestDeletionMutation.mutate()
  }

  const confirmArchive = () => {
    archiveMutation.mutate(true)
  }

  const confirmUnarchive = () => {
    archiveMutation.mutate(false)
  }


  if (isLoading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
        <DashboardLayout>
          <LinearProgress />
        </DashboardLayout>
      </RouteProtection>
    )
  }

  if (!campaign) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
        <DashboardLayout>
          <Typography>Campaign not found</Typography>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  const spentPercentage = (campaign.spent / campaign.budget) * 100

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {campaign.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="textSecondary">
                {campaign.client}
              </Typography>
              <Chip
                label={campaign.hasPendingDeletion ? 'Pending Deletion' : campaign.status}
                color={
                  campaign.hasPendingDeletion ? 'error' :
                  campaign.status === 'active' ? 'success' :
                  campaign.status === 'paused' ? 'warning' :
                  campaign.status === 'completed' ? 'default' : 'info'
                }
                size="small"
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <CampaignApprovalButton campaign={campaign} />
            {campaign.status === 'active' ? (
              <Button
                startIcon={<PauseIcon />}
                onClick={() => updateStatusMutation.mutate('paused')}
              >
                Pause
              </Button>
            ) : campaign.status === 'paused' ? (
              <Button
                startIcon={<PlayIcon />}
                onClick={() => updateStatusMutation.mutate('active')}
              >
                Resume
              </Button>
            ) : null}
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => router.push(`/campaigns/${campaignId}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRequestDeletion}
              disabled={campaign.hasPendingDeletion}
            >
              {campaign.hasPendingDeletion ? 'Deletion Pending' : 'Request Deletion'}
            </Button>
            <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="textSecondary" gutterBottom>
                  Budget
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(campaign.budget)}
                </Typography>
                <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <LinearProgress
                    variant="determinate"
                    value={spentPercentage}
                    color={spentPercentage > 90 ? 'error' : 'primary'}
                  />
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                    {formatCurrency(campaign.spent)} spent ({formatPercentage(spentPercentage, 1)})
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="textSecondary" gutterBottom>
                  Impressions
                </Typography>
                <Typography variant="h5">
                  {formatNumber(campaign.impressions)}
                </Typography>
                <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <Box sx={{ height: '4px', mb: 0.5 }} /> {/* Spacer to match LinearProgress height */}
                  <Typography variant="caption" color="textSecondary">
                    Target: {campaign.targetImpressions ? formatNumber(campaign.targetImpressions) : 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="textSecondary" gutterBottom>
                  CTR
                </Typography>
                <Typography variant="h5">
                  {campaign.clicks && campaign.impressions
                    ? formatPercentage((campaign.clicks / campaign.impressions) * 100)
                    : '0.00%'}
                </Typography>
                <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <Box sx={{ height: '4px', mb: 0.5 }} /> {/* Spacer to match LinearProgress height */}
                  <Typography variant="caption" color="textSecondary">
                    {formatNumber(campaign.clicks || 0)} clicks
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="textSecondary" gutterBottom>
                  Conversions
                </Typography>
                <Typography variant="h5">
                  {formatNumber(campaign.conversions || 0)}
                </Typography>
                <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <Box sx={{ height: '4px', mb: 0.5 }} /> {/* Spacer to match LinearProgress height */}
                  <Typography variant="caption" color="textSecondary">
                    {campaign.conversions && campaign.clicks
                      ? formatPercentage((campaign.conversions / campaign.clicks) * 100, 1)
                      : '0.0%'} conversion rate
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Card>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Timeline" />
            <Tab label="Schedule Summary" />
            <Tab label="Pre-Bill" />
          </Tabs>
          <Divider />
          <CardContent>
            <TabPanel value={activeTab} index={0}>
              <CampaignTimeline campaignId={campaignId} />
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <CampaignScheduleTab campaignId={campaignId} campaign={campaign} />
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <CampaignPreBill campaignId={campaignId} campaign={campaign} />
            </TabPanel>
          </CardContent>
        </Card>
      </Box>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setMenuAnchorEl(null)
          handleDuplicateCampaign()
        }}>
          <CopyIcon sx={{ mr: 1 }} fontSize="small" />
          Duplicate Campaign
        </MenuItem>
        {user?.role === 'admin' && (
          <>
            {campaign.archived ? (
              <MenuItem onClick={() => {
                setMenuAnchorEl(null)
                handleArchiveToggle(false)
              }}>
                <UnarchiveIcon sx={{ mr: 1 }} fontSize="small" />
                Unarchive Campaign
              </MenuItem>
            ) : (
              <MenuItem onClick={() => {
                setMenuAnchorEl(null)
                handleArchiveToggle(true)
              }}>
                <ArchiveIcon sx={{ mr: 1 }} fontSize="small" />
                Archive Campaign
              </MenuItem>
            )}
          </>
        )}
      </Menu>

      {/* Confirmation Dialogs */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Request Campaign Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to request deletion of campaign "{campaign?.name}"? 
            This will submit a deletion request that requires admin approval before the campaign is permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmRequestDeletion} 
            color="error" 
            variant="contained"
            disabled={requestDeletionMutation.isPending}
          >
            {requestDeletionMutation.isPending ? 'Submitting...' : 'Request Deletion'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Archive Campaign</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to archive campaign "{campaign?.name}"? 
            Archived campaigns will be hidden from regular views but can be restored later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmArchive} 
            color="warning" 
            variant="contained"
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? 'Archiving...' : 'Archive Campaign'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={unarchiveDialogOpen}
        onClose={() => setUnarchiveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Unarchive Campaign</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to unarchive campaign "{campaign?.name}"? 
            This will restore the campaign to regular views and make it active again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnarchiveDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmUnarchive} 
            color="primary" 
            variant="contained"
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? 'Unarchiving...' : 'Unarchive Campaign'}
          </Button>
        </DialogActions>
      </Dialog>
      </DashboardLayout>
    </RouteProtection>
  )
}