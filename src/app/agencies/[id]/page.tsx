'use client'


import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
} from '@mui/material'
import {
  ArrowBack,
  Edit,
  MoreVert,
  Business,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  Campaign,
  TrendingUp,
  Store,
  Public,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { format } from 'date-fns'
import { queryKeys } from '@/config/queryClient'
import { AgencyReportModal } from '@/components/reports/AgencyReportModal'

interface Agency {
  id: string
  agencyId: string
  name: string
  email: string
  phone: string
  contactEmail: string
  contactPhone: string
  website?: string
  address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  status: 'active' | 'inactive'
  advertisers: Array<{
    id: string
    name: string
    campaignCount?: number
  }>
  advertiserCount: number
  totalSpend: number
  createdAt: string
  updatedAt: string
}

export default function AgencyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agencyId = params.id as string

  const [selectedTab, setSelectedTab] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Fetch agency details
  const { data: agency, isLoading, error } = useQuery({
    queryKey: queryKeys.agencies.detail(agencyId),
    queryFn: async () => {
      const response = await axios.get(`/api/agencies/${agencyId}`)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch campaigns for this agency's advertisers
  const { data: campaigns = [] } = useQuery({
    queryKey: queryKeys.campaigns.byAgency(agencyId),
    queryFn: async () => {
      if (!agency?.advertisers?.length) return []
      
      // Get campaigns for all advertisers under this agency
      const campaignPromises = agency.advertisers.map(async (advertiser: any) => {
        try {
          const response = await axios.get(`/api/campaigns?advertiserId=${advertiser.id}`)
          return response.data.campaigns || []
        } catch (error) {
          console.error(`Error fetching campaigns for advertiser ${advertiser.id}:`, error)
          return []
        }
      })
      
      const allCampaigns = await Promise.all(campaignPromises)
      return allCampaigns.flat()
    },
    enabled: !!agency?.advertisers?.length,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  if (isLoading) {
    return (
    <RouteProtection requiredPermission={PERMISSIONS.AGENCIES_VIEW}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    </RouteProtection>
    )
  }

  if (error || !agency) {
    return (
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/agencies')}
            sx={{ mb: 2 }}
          >
            Back to Agencies
          </Button>
          <Typography variant="h5" color="error">
            {error ? 'Error loading agency details' : 'Agency not found'}
          </Typography>
        </Box>
      </DashboardLayout>
    )
  }

  // Calculate metrics
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length
  const totalBudget = campaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0)

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/agencies')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" component="h1">
                {agency.name}
              </Typography>
              <Chip
                label={agency.status}
                color={agency.status === 'active' ? 'success' : 'default'}
                size="small"
              />
            </Box>
            <Typography variant="body1" color="text.secondary">
              Agency Partner • {agency.advertiserCount} Advertiser{agency.advertiserCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => router.push(`/agencies/${agencyId}/edit`)}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Advertisers
                    </Typography>
                    <Typography variant="h5">
                      {agency.advertiserCount}
                    </Typography>
                  </Box>
                  <Store color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Campaigns
                    </Typography>
                    <Typography variant="h5">
                      {campaigns.length}
                    </Typography>
                  </Box>
                  <Campaign color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Campaigns
                    </Typography>
                    <Typography variant="h5">
                      {activeCampaigns}
                    </Typography>
                  </Box>
                  <TrendingUp color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Budget
                    </Typography>
                    <Typography variant="h5">
                      ${totalBudget.toLocaleString()}
                    </Typography>
                  </Box>
                  <AttachMoney color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(e, value) => setSelectedTab(value)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Overview" />
            <Tab label="Advertisers" />
            <Tab label="Campaigns" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {selectedTab === 0 && (
          <Grid container spacing={3}>
            {/* Contact Information */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Contact Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {agency.contactEmail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.light' }}>
                          <Email />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Email
                          </Typography>
                          <Typography>{agency.contactEmail}</Typography>
                        </Box>
                      </Box>
                    )}
                    {agency.contactPhone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'success.light' }}>
                          <Phone />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Phone
                          </Typography>
                          <Typography>{agency.contactPhone}</Typography>
                        </Box>
                      </Box>
                    )}
                    {agency.website && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'info.light' }}>
                          <Public />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Website
                          </Typography>
                          <Typography>
                            <a href={agency.website} target="_blank" rel="noopener noreferrer">
                              {agency.website}
                            </a>
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    {(agency.address.street || agency.address.city) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'warning.light' }}>
                          <LocationOn />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Address
                          </Typography>
                          <Typography>
                            {agency.address.street && `${agency.address.street}, `}
                            {agency.address.city && `${agency.address.city}, `}
                            {agency.address.state} {agency.address.zip}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Agency Details */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Agency Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={agency.status}
                        color={agency.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Created
                      </Typography>
                      <Typography>
                        {format(new Date(agency.createdAt), 'MMMM d, yyyy')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Last Updated
                      </Typography>
                      <Typography>
                        {format(new Date(agency.updatedAt), 'MMMM d, yyyy')}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {selectedTab === 1 && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Advertiser Name</TableCell>
                    <TableCell>Campaigns</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agency.advertisers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          No advertisers assigned to this agency
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    agency.advertisers.map((advertiser) => (
                      <TableRow key={advertiser.id} hover>
                        <TableCell>{advertiser.name}</TableCell>
                        <TableCell>
                          {campaigns.filter((c: any) => c.advertiserId === advertiser.id).length}
                        </TableCell>
                        <TableCell>
                          <Chip label="Active" color="success" size="small" />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => router.push(`/advertisers/${advertiser.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {selectedTab === 2 && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign Name</TableCell>
                    <TableCell>Advertiser</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Budget</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          No campaigns found for this agency's advertisers
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign: any) => (
                      <TableRow key={campaign.id} hover>
                        <TableCell>{campaign.name}</TableCell>
                        <TableCell>{campaign.advertiserName}</TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.status}
                            size="small"
                            color={
                              campaign.status === 'active' ? 'success' :
                              campaign.status === 'completed' ? 'default' : 'warning'
                            }
                          />
                        </TableCell>
                        <TableCell>${(campaign.budget || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {format(new Date(campaign.startDate), 'MMM d')} - 
                          {format(new Date(campaign.endDate), 'MMM d, yyyy')}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            handleMenuClose()
            router.push(`/agencies/${agencyId}/campaigns`)
          }}>
            View All Campaigns
          </MenuItem>
          <MenuItem onClick={() => {
            handleMenuClose()
            setReportModalOpen(true)
          }}>
            Generate Report
          </MenuItem>
        </Menu>

        {/* Report Generation Modal */}
        {agency && (
          <AgencyReportModal
            open={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            agencyId={agencyId}
            agencyName={agency.name}
          />
        )}
      </Box>
    </DashboardLayout>
  )
}