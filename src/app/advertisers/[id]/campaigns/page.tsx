'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
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
  TextField,
  InputAdornment,
  FormControl,
  Select,
  SelectChangeEvent,
  LinearProgress,
  Avatar,
} from '@mui/material'
import {
  ArrowBack,
  Add,
  Search,
  MoreVert,
  Visibility,
  Edit,
  Pause,
  PlayArrow,
  Stop,
  Campaign,
  AttachMoney,
  TrendingUp,
  People,
  CalendarMonth,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface CampaignData {
  id: string
  name: string
  status: 'active' | 'completed' | 'paused' | 'draft'
  startDate: string
  endDate: string
  budget: number
  spent: number
  impressions: number
  targetImpressions: number
  ctr: number
  shows: string[]
  objectives: string[]
}

// Removed mock campaigns - now fetching from database

export default function AdvertiserCampaignsPage() {
  const params = useParams()
  const router = useRouter()
  const advertiserId = params.id as string
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null)

  // Fetch advertiser details
  const { data: advertiser, isLoading: advertiserLoading } = useQuery({
    queryKey: ['advertiser', advertiserId],
    queryFn: async () => {
      const response = await api.get(`/advertisers/${advertiserId}`)
      return response.data
    },
  })

  // Fetch campaigns for this advertiser
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', 'advertiser', advertiserId],
    queryFn: async () => {
      const response = await api.get('/campaigns', {
        params: { advertiserId }
      })
      return response.data
    },
  })

  const campaigns: CampaignData[] = (campaignsData?.campaigns || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    budget: c.budget || 0,
    spent: c.spent || 0,
    impressions: c.impressions || 0,
    targetImpressions: c.targetImpressions || 0,
    ctr: c.clicks && c.impressions ? (c.clicks / c.impressions * 100) : 0,
    shows: c.shows || [],
    objectives: c.targetAudience ? [c.targetAudience] : []
  }))

  const isLoading = advertiserLoading || campaignsLoading

  const advertiserName = advertiser?.name || 'Loading...'

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, campaign: CampaignData) => {
    setAnchorEl(event.currentTarget)
    setSelectedCampaign(campaign)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = 
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.objectives.some(obj => obj.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'completed': return 'info'
      case 'paused': return 'warning'
      case 'draft': return 'default'
      default: return 'default'
    }
  }

  const getProgressPercentage = (spent: number, budget: number) => {
    return Math.round((spent / budget) * 100)
  }

  const getImpressionProgress = (impressions: number, target: number) => {
    return Math.round((impressions / target) * 100)
  }

  const getTotalStats = () => {
    return {
      totalBudget: campaigns.reduce((sum, c) => sum + c.budget, 0),
      totalSpent: campaigns.reduce((sum, c) => sum + c.spent, 0),
      totalImpressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
      activeCampaigns: campaigns.filter(c => c.status === 'active').length
    }
  }

  const stats = getTotalStats()

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Typography>Loading campaigns...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.push(`/advertisers/${advertiserId}`)}
              sx={{ mb: 2 }}
            >
              Back to Advertiser
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
              {advertiserName} - Campaigns
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track all advertising campaigns for this advertiser
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push('/campaigns/new')}
          >
            Create Campaign
          </Button>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Campaign color="primary" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Campaigns
                    </Typography>
                    <Typography variant="h6">
                      {stats.activeCampaigns}
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
                  <AttachMoney color="success" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Budget
                    </Typography>
                    <Typography variant="h6">
                      ${stats.totalBudget.toLocaleString()}
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
                  <TrendingUp color="warning" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Spent
                    </Typography>
                    <Typography variant="h6">
                      ${stats.totalSpent.toLocaleString()}
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
                  <People color="info" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Impressions
                    </Typography>
                    <Typography variant="h6">
                      {(stats.totalImpressions / 1000000).toFixed(1)}M
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={statusFilter}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* Campaigns Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campaign</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Budget Progress</TableCell>
                <TableCell>Impression Progress</TableCell>
                <TableCell>CTR</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const budgetProgress = getProgressPercentage(campaign.spent, campaign.budget)
                const impressionProgress = getImpressionProgress(campaign.impressions, campaign.targetImpressions)
                
                return (
                  <TableRow 
                    key={campaign.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          <Campaign fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{campaign.name}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            {campaign.objectives.slice(0, 2).map((objective, index) => (
                              <Chip 
                                key={index}
                                label={objective} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(campaign.startDate).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        to {new Date(campaign.endDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption">{budgetProgress}%</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ${campaign.spent.toLocaleString()} / ${campaign.budget.toLocaleString()}
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={budgetProgress} 
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption">{impressionProgress}%</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(campaign.impressions / 1000).toFixed(0)}K / {(campaign.targetImpressions / 1000).toFixed(0)}K
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={impressionProgress} 
                          color={impressionProgress >= 100 ? 'success' : 'primary'}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {campaign.ctr > 0 ? `${campaign.ctr}%` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        color={getStatusColor(campaign.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMenuOpen(e, campaign)
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            router.push(`/campaigns/${selectedCampaign?.id}`)
            handleMenuClose()
          }}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/campaigns/${selectedCampaign?.id}/edit`)
            handleMenuClose()
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Campaign
          </MenuItem>
          {selectedCampaign?.status === 'active' && (
            <MenuItem onClick={handleMenuClose}>
              <Pause fontSize="small" sx={{ mr: 1 }} />
              Pause Campaign
            </MenuItem>
          )}
          {selectedCampaign?.status === 'paused' && (
            <MenuItem onClick={handleMenuClose}>
              <PlayArrow fontSize="small" sx={{ mr: 1 }} />
              Resume Campaign
            </MenuItem>
          )}
          {(selectedCampaign?.status === 'active' || selectedCampaign?.status === 'paused') && (
            <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
              <Stop fontSize="small" sx={{ mr: 1 }} />
              Stop Campaign
            </MenuItem>
          )}
        </Menu>
      </Box>
    </DashboardLayout>
  )
}