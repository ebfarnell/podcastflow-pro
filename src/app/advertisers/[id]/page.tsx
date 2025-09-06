'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material'
import {
  ArrowBack,
  Store,
  Edit,
  Email,
  Phone,
  LocationOn,
  Campaign,
  AttachMoney,
  TrendingUp,
  CalendarMonth,
  MoreVert,
  Visibility,
  Delete,
  Block,
  CheckCircle,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { advertiserApi, campaignApi } from '@/services/api'

interface AdvertiserDetail {
  advertiserId: string
  name: string
  industry: string
  contactName: string
  contactEmail: string
  contactPhone: string
  city: string
  state: string
  country: string
  status: 'active' | 'inactive' | 'prospect'
  website?: string
  description?: string
  createdAt: string
  updatedAt: string
}

interface Campaign {
  id: string
  name: string
  status: 'active' | 'completed' | 'paused'
  startDate: string
  endDate: string
  budget: number
  spent: number
  impressions: number
}

export default function AdvertiserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const advertiserId = params.id as string

  // Fetch advertiser details
  const { data: advertiser, isLoading: advertiserLoading, error: advertiserError } = useQuery({
    queryKey: ['advertiser', advertiserId],
    queryFn: () => advertiserApi.get(advertiserId),
  })

  // Fetch campaigns for this advertiser
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', 'advertiser', advertiserId],
    queryFn: () => campaignApi.list({ advertiserId }),
    enabled: !!advertiser
  })

  const campaigns = campaignsData?.campaigns || []
  const isLoading = advertiserLoading || campaignsLoading

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'error'
      case 'prospect': return 'warning'
      default: return 'default'
    }
  }

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'completed': return 'info'
      case 'paused': return 'warning'
      default: return 'default'
    }
  }

  const getProgressPercentage = (spent: number, budget: number) => {
    return Math.round((spent / budget) * 100)
  }

  if (isLoading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.ADVERTISERS_VIEW}>
        <DashboardLayout>
          <LoadingState 
            message="Loading advertiser details..." 
            variant="detailed" 
            height="50vh"
          />
        </DashboardLayout>
      </RouteProtection>
    )
  }

  if (advertiserError || !advertiser) {
    const errorMessage = advertiserError?.response?.status === 404 
      ? "Advertiser not found. It may have been deleted or you may not have permission to view it."
      : "Unable to load advertiser details. Please try again later."
      
    return (
      <RouteProtection requiredPermission={PERMISSIONS.ADVERTISERS_VIEW}>
        <DashboardLayout>
          <ErrorState
            title="Advertiser Not Available"
            message={errorMessage}
            backUrl="/advertisers"
            onRetry={() => window.location.reload()}
            height="50vh"
          />
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ADVERTISERS_VIEW}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.push('/advertisers')}
            >
              Back to Advertisers
            </Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => router.push(`/advertisers/${advertiserId}/edit`)}
              >
                Edit Advertiser
              </Button>
              <IconButton onClick={handleMenuOpen}>
                <MoreVert />
              </IconButton>
            </Box>
          </Box>

          {/* Header */}
          <Paper sx={{ p: 4, mb: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item>
                <Avatar sx={{ bgcolor: 'primary.main', width: 80, height: 80, fontSize: '2rem' }}>
                  {advertiser.name[0]}
                </Avatar>
              </Grid>
              <Grid item xs>
                <Typography variant="h4" component="h1" gutterBottom>
                  {advertiser.name}
                </Typography>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {advertiser.industry || 'Not specified'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip 
                    label={advertiser.status || 'active'} 
                    color={getStatusColor(advertiser.status || 'active')} 
                  />
                  <Chip label={`${campaigns.filter(c => c.status === 'active').length} Active Campaigns`} variant="outlined" />
                </Box>
                <Typography variant="body1" color="text.secondary">
                  {advertiser.description || 'No description available'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AttachMoney color="primary" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Total Spend
                      </Typography>
                      <Typography variant="h6">
                        ${campaigns.reduce((sum, c) => sum + (c.spent || 0), 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TrendingUp color="success" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Active Campaigns
                      </Typography>
                      <Typography variant="h6">
                        {campaigns.filter(c => c.status === 'active').length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Campaign color="info" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Total Campaigns
                      </Typography>
                      <Typography variant="h6">
                        {campaigns.length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CalendarMonth color="warning" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Avg Budget
                      </Typography>
                      <Typography variant="h6">
                        ${campaigns.length > 0 ? Math.round(campaigns.reduce((sum, c) => sum + (c.budget || 0), 0) / campaigns.length).toLocaleString() : 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Contact Information */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Contact Information
                </Typography>
                <List>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.200' }}>
                        <Email />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={advertiser.contactEmail || 'Not provided'}
                      secondary="Email"
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.200' }}>
                        <Phone />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={advertiser.contactPhone || 'Not provided'}
                      secondary="Phone"
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.200' }}>
                        <LocationOn />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${advertiser.city || ''} ${advertiser.state || ''} ${advertiser.country || ''}`.trim() || 'Not provided'}
                      secondary="Location"
                    />
                  </ListItem>
                </List>
              </Paper>

              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Account Details
                </Typography>
                <List dense>
                  <ListItem disableGutters>
                    <ListItemText primary="Contact Person" secondary={advertiser.contactName || 'Not specified'} />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Industry" secondary={advertiser.industry || 'Not specified'} />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Created Date" secondary={new Date(advertiser.createdAt).toLocaleDateString()} />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Last Updated" secondary={new Date(advertiser.updatedAt).toLocaleDateString()} />
                  </ListItem>
                  {advertiser.website && (
                    <ListItem disableGutters>
                      <ListItemText 
                        primary="Website" 
                        secondary={
                          <a href={advertiser.website} target="_blank" rel="noopener noreferrer">
                            {advertiser.website}
                          </a>
                        } 
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Campaign Performance */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">
                    Campaign Performance
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => router.push(`/advertisers/${advertiserId}/campaigns`)}
                  >
                    View All Campaigns
                  </Button>
                </Box>
                
                {campaigns.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Campaign</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Budget</TableCell>
                          <TableCell>Progress</TableCell>
                          <TableCell>Impressions</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {campaigns.slice(0, 5).map((campaign) => {
                          const progress = getProgressPercentage(campaign.spent || 0, campaign.budget || 1)
                          return (
                            <TableRow key={campaign.id} hover>
                              <TableCell>
                                <Typography variant="subtitle2">{campaign.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(campaign.startDate || Date.now()).toLocaleDateString()} - {new Date(campaign.endDate || Date.now()).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={campaign.status}
                                  size="small"
                                  color={getCampaignStatusColor(campaign.status)}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  ${(campaign.budget || 0).toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ${(campaign.spent || 0).toLocaleString()} spent
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                                  <Box sx={{ width: '100%' }}>
                                    <Typography variant="caption">{Math.min(progress, 100)}%</Typography>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={Math.min(progress, 100)} 
                                      sx={{ height: 6, borderRadius: 1 }}
                                    />
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {(campaign.impressions || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  onClick={() => router.push(`/campaigns/${campaign.id}`)}
                                >
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No campaigns found for this advertiser
                    </Typography>
                    <Button variant="outlined" sx={{ mt: 2 }}>
                      Create Campaign
                    </Button>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => {
              router.push(`/advertisers/${advertiserId}/campaigns`)
              handleMenuClose()
            }}>
              <Campaign fontSize="small" sx={{ mr: 1 }} />
              View All Campaigns
            </MenuItem>
            <MenuItem onClick={() => {
              if (advertiser.contactEmail && typeof window !== 'undefined') {
                window.location.href = `mailto:${advertiser.contactEmail}`
              }
              handleMenuClose()
            }}>
              <Email fontSize="small" sx={{ mr: 1 }} />
              Send Email
            </MenuItem>
            <MenuItem onClick={() => {
              if (advertiser.contactPhone && typeof window !== 'undefined') {
                window.location.href = `tel:${advertiser.contactPhone}`
              }
              handleMenuClose()
            }}>
              <Phone fontSize="small" sx={{ mr: 1 }} />
              Call
            </MenuItem>
            <Divider />
            {(advertiser.status || 'active') === 'prospect' && (
              <MenuItem onClick={handleMenuClose}>
                <CheckCircle fontSize="small" sx={{ mr: 1 }} />
                Activate Advertiser
              </MenuItem>
            )}
            {(advertiser.status || 'active') === 'active' && (
              <MenuItem onClick={handleMenuClose}>
                <Block fontSize="small" sx={{ mr: 1 }} />
                Deactivate Advertiser
              </MenuItem>
            )}
            <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} />
              Delete Advertiser
            </MenuItem>
          </Menu>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}