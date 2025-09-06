'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
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
  Select,
  MenuItem,
  TablePagination,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  ArrowBack,
  Search,
  FilterList,
  Download,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery } from '@tanstack/react-query'
import { campaignApi, agencyApi } from '@/services/api'
import { queryKeys } from '@/config/queryClient'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  advertiserId: string
  advertiserName?: string
  agencyId?: string
  status: string
  budget: number
  spent?: number
  impressions?: number
  clicks?: number
  ctr?: number
  startDate: string | Date
  endDate: string | Date
  performance?: number
  probability?: number
}

export default function AgencyCampaignsPage() {
  const router = useRouter()
  const params = useParams()
  const agencyId = params.id as string

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Fetch agency details
  const { data: agency, isLoading: agencyLoading } = useQuery({
    queryKey: queryKeys.agencies.detail(agencyId),
    queryFn: () => agencyApi.get(agencyId),
    enabled: !!agencyId,
  })

  // Fetch campaigns for this agency
  const { data: campaignsData = [], isLoading: campaignsLoading, error } = useQuery({
    queryKey: ['campaigns', 'agency', agencyId],
    queryFn: async () => {
      try {
        // Get all campaigns
        const allCampaigns = await campaignApi.list()
        
        // Filter campaigns that belong to advertisers of this agency
        // First, get advertisers for this agency
        const advertisersResponse = await fetch(`/api/advertisers?agencyId=${agencyId}`)
        const advertisers = await advertisersResponse.json()
        const advertiserIds = Array.isArray(advertisers) ? advertisers.map(a => a.id) : []
        
        // Filter campaigns by advertiser IDs
        const agencyCampaigns = Array.isArray(allCampaigns) 
          ? allCampaigns.filter(campaign => 
              advertiserIds.includes(campaign.advertiserId) || 
              campaign.agencyId === agencyId
            )
          : []
        
        return agencyCampaigns
      } catch (error) {
        console.error('Error fetching campaigns:', error)
        return []
      }
    },
    enabled: !!agencyId,
  })

  const campaigns = campaignsData as Campaign[]
  const agencyName = agency?.name || 'Agency'
  const isLoading = agencyLoading || campaignsLoading

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = 
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (campaign.advertiserName || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const totalBudget = filteredCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0)
  const totalSpent = filteredCampaigns.reduce((sum, c) => sum + (c.spent || 0), 0)
  const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)
  const avgCTR = filteredCampaigns.length > 0 
    ? filteredCampaigns.reduce((sum, c) => sum + (c.ctr || 0), 0) / filteredCampaigns.length 
    : 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'approved': return 'success'
      case 'completed': return 'default'
      case 'paused': return 'warning'
      case 'pending': return 'warning'
      case 'draft': return 'info'
      case 'proposal': return 'info'
      case 'cancelled': return 'error'
      case 'lost': return 'error'
      default: return 'default'
    }
  }

  const handleExport = () => {
    // TODO: Implement actual export functionality
    const csvContent = [
      ['Campaign Name', 'Advertiser', 'Status', 'Budget', 'Start Date', 'End Date'],
      ...filteredCampaigns.map(c => [
        c.name,
        c.advertiserName || '',
        c.status,
        c.budget,
        c.startDate,
        c.endDate
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agencyName}-campaigns-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading campaigns. Please try again later.
        </Alert>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/agencies/${agencyId}`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {agencyName} - Campaigns
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {campaigns.length > 0 
                ? `Managing ${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`
                : 'No campaigns found for this agency'
              }
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
            disabled={campaigns.length === 0}
          >
            Export
          </Button>
        </Box>

        {/* Summary Cards */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Campaigns
              </Typography>
              <Typography variant="h5">
                {filteredCampaigns.length}
              </Typography>
              <Chip 
                label={`${filteredCampaigns.filter(c => c.status === 'active').length} active`} 
                size="small" 
                color="success" 
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Budget
              </Typography>
              <Typography variant="h5">
                ${totalBudget.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ${totalSpent.toLocaleString()} spent ({((totalSpent / totalBudget) * 100).toFixed(1)}%)
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Impressions
              </Typography>
              <Typography variant="h5">
                {(totalImpressions / 1000000).toFixed(1)}M
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across all campaigns
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Average CTR
              </Typography>
              <Typography variant="h5">
                {avgCTR.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click-through rate
              </Typography>
            </Box>
          </Box>
        </Paper>

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
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
            >
              More Filters
            </Button>
          </Box>
        </Paper>

        {/* Campaigns Table */}
        {campaigns.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No campaigns found for this agency
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Campaigns will appear here once advertisers associated with this agency create them.
            </Typography>
          </Paper>
        ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campaign Name</TableCell>
                <TableCell>Advertiser</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Budget</TableCell>
                <TableCell>Probability</TableCell>
                <TableCell>Impressions</TableCell>
                <TableCell>CTR</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCampaigns
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((campaign) => (
                  <TableRow key={campaign.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {campaign.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{campaign.advertiserName || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status}
                        size="small"
                        color={getStatusColor(campaign.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(campaign.startDate)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        to {formatDate(campaign.endDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatCurrency(campaign.budget || 0)}
                      </Typography>
                      {campaign.spent !== undefined && campaign.spent > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((campaign.spent / campaign.budget) * 100, 100)}
                            sx={{ width: 60, height: 4 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {Math.min(((campaign.spent / campaign.budget) * 100), 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.probability !== undefined ? (
                        <Chip 
                          label={`${campaign.probability}%`}
                          size="small"
                          style={{ 
                            backgroundColor: 
                              campaign.probability >= 90 ? '#4caf50' :
                              campaign.probability >= 65 ? '#2196f3' :
                              campaign.probability >= 35 ? '#ff9800' :
                              '#f44336',
                            color: 'white'
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.impressions ? (
                        campaign.impressions >= 1000000 
                          ? `${(campaign.impressions / 1000000).toFixed(1)}M`
                          : campaign.impressions >= 1000
                          ? `${(campaign.impressions / 1000).toFixed(0)}K`
                          : campaign.impressions
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {campaign.ctr !== undefined ? (
                        <Typography variant="body2" color={campaign.ctr >= 3.5 ? 'success.main' : 'text.primary'}>
                          {campaign.ctr.toFixed(1)}%
                        </Typography>
                      ) : '-'}
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
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredCampaigns.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
          />
        </TableContainer>
        )}
      </Box>
    </DashboardLayout>
  )
}