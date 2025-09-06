'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
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
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Business as BusinessIcon,
  Campaign as CampaignIcon,
  CalendarToday as CalendarIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SellerOnly } from '@/components/auth/RoleGuard'
import { useQuery } from '@tanstack/react-query'
import { campaignApi, advertiserApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface Deal {
  id: string
  clientName: string
  clientCompany: string
  contactEmail: string
  contactPhone: string
  campaignName: string
  estimatedValue: number
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  probability: number
  expectedCloseDate: string
  lastContact: string
  nextAction: string
  notes: string
  assignedTo: string
  tags: string[]
}

interface PipelineMetrics {
  totalDeals: number
  totalValue: number
  avgDealSize: number
  conversionRate: number
  dealsThisMonth: number
  valueThisMonth: number
}

const stageColors = {
  lead: 'info',
  qualified: 'primary',
  proposal: 'warning',
  negotiation: 'secondary',
  'closed-won': 'success',
  'closed-lost': 'error',
} as const

const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost']

export default function SellerPipelinePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [dealDialogOpen, setDealDialogOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  // Fetch campaigns data
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'pipeline'],
    queryFn: async () => {
      const response = await campaignApi.getAll({ limit: 1000 })
      return response
    }
  })

  // Fetch advertisers data
  const { data: advertisersData } = useQuery({
    queryKey: ['advertisers', 'pipeline'],
    queryFn: async () => {
      const response = await advertiserApi.list()
      return response.advertisers || []
    }
  })

  // Calculate pipeline metrics from real data
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['pipeline', 'metrics', campaignsData],
    queryFn: async (): Promise<PipelineMetrics> => {
      if (!campaignsData?.campaigns) {
        return {
          totalDeals: 0,
          totalValue: 0,
          avgDealSize: 0,
          conversionRate: 0,
          dealsThisMonth: 0,
          valueThisMonth: 0,
        }
      }

      const campaigns = campaignsData.campaigns
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()

      // Total deals = all campaigns
      const totalDeals = campaigns.length

      // Total value = sum of all campaign budgets
      const totalValue = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0)

      // Average deal size
      const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0

      // Conversion rate = completed campaigns / total campaigns
      const completedDeals = campaigns.filter(c => c.status === 'completed').length
      const conversionRate = totalDeals > 0 ? (completedDeals / totalDeals) * 100 : 0

      // Deals this month
      const dealsThisMonth = campaigns.filter(c => {
        const createdDate = new Date(c.createdAt)
        return createdDate.getMonth() === currentMonth && 
               createdDate.getFullYear() === currentYear
      }).length

      // Value this month
      const valueThisMonth = campaigns
        .filter(c => {
          const createdDate = new Date(c.createdAt)
          return createdDate.getMonth() === currentMonth && 
                 createdDate.getFullYear() === currentYear
        })
        .reduce((sum, c) => sum + (c.budget || 0), 0)

      return {
        totalDeals,
        totalValue,
        avgDealSize: Math.round(avgDealSize),
        conversionRate: Math.round(conversionRate * 10) / 10,
        dealsThisMonth,
        valueThisMonth,
      }
    },
    enabled: !!campaignsData
  })

  // Generate deals from campaigns data
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['pipeline', 'deals', campaignsData, advertisersData],
    queryFn: async (): Promise<Deal[]> => {
      if (!campaignsData?.campaigns || !advertisersData) {
        return []
      }

      // Map campaigns to deals format
      return campaignsData.campaigns.map((campaign) => {
        // Find advertiser for the campaign
        const advertiser = advertisersData.find(a => a.id === campaign.advertiserId)
        const advertiserName = advertiser?.name || 'Unknown Client'
        const contactEmail = advertiser?.contactEmail || advertiser?.email || 'no-email@example.com'
        const contactPhone = advertiser?.contactPhone || advertiser?.phone || ''

        // Map campaign status to pipeline stage
        let stage: Deal['stage'] = 'lead'
        let probability = 25
        
        switch (campaign.status) {
          case 'draft':
            stage = 'lead'
            probability = 25
            break
          case 'pending':
            stage = 'qualified'
            probability = 50
            break
          case 'active':
            stage = 'proposal'
            probability = 75
            break
          case 'paused':
            stage = 'negotiation'
            probability = 85
            break
          case 'completed':
            stage = 'closed-won'
            probability = 100
            break
          case 'cancelled':
            stage = 'closed-lost'
            probability = 0
            break
        }

        // Calculate expected close date (30 days from creation)
        const createdDate = new Date(campaign.createdAt)
        const expectedCloseDate = new Date(createdDate)
        expectedCloseDate.setDate(expectedCloseDate.getDate() + 30)

        // Generate next action based on stage
        let nextAction = 'Initial contact'
        switch (stage) {
          case 'lead':
            nextAction = 'Initial discovery call'
            break
          case 'qualified':
            nextAction = 'Send media kit and pricing'
            break
          case 'proposal':
            nextAction = 'Send revised proposal'
            break
          case 'negotiation':
            nextAction = 'Schedule contract review'
            break
          case 'closed-won':
            nextAction = 'Begin campaign execution'
            break
          case 'closed-lost':
            nextAction = 'Follow up in 3 months'
            break
        }

        // Generate tags based on campaign attributes
        const tags: string[] = []
        if (campaign.budget && campaign.budget > 10000) tags.push('high-value')
        if (campaign.budget && campaign.budget < 5000) tags.push('small-budget')
        if (campaign.type) tags.push(campaign.type)
        if (advertiser?.industry) tags.push(advertiser.industry.toLowerCase())

        return {
          id: campaign.id,
          clientName: advertiserName,
          clientCompany: advertiserName,
          contactEmail: contactEmail,
          contactPhone: contactPhone,
          campaignName: campaign.name,
          estimatedValue: campaign.budget || 0,
          stage: stage,
          probability: probability,
          expectedCloseDate: expectedCloseDate.toISOString().split('T')[0],
          lastContact: campaign.updatedAt.split('T')[0],
          nextAction: nextAction,
          notes: campaign.description || 'No notes available',
          assignedTo: user?.name || 'Unassigned',
          tags: tags,
        }
      }).sort((a, b) => {
        // Sort by stage order
        const aIndex = stageOrder.indexOf(a.stage)
        const bIndex = stageOrder.indexOf(b.stage)
        if (aIndex !== bIndex) return aIndex - bIndex
        // Then by value
        return b.estimatedValue - a.estimatedValue
      })
    },
    enabled: !!campaignsData && !!advertisersData
  })

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = searchTerm === '' || 
      deal.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.clientCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.campaignName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStage = stageFilter === 'all' || deal.stage === stageFilter
    
    return matchesSearch && matchesStage
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getStageProgress = (stage: Deal['stage']) => {
    const stageIndex = stageOrder.indexOf(stage)
    return ((stageIndex + 1) / (stageOrder.length - 2)) * 100 // Exclude closed stages from progress
  }

  const handleViewDeal = (deal: Deal) => {
    setSelectedDeal(deal)
    setDealDialogOpen(true)
  }

  if (metricsLoading || dealsLoading) {
    return (
      <SellerOnly>
        <DashboardLayout>
          <Box sx={{ width: '100%' }}>
            <LinearProgress />
          </Box>
        </DashboardLayout>
      </SellerOnly>
    )
  }

  return (
    <SellerOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Sales Pipeline
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Track your deals and manage your sales pipeline
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/campaigns/new')}
            >
              Add Deal
            </Button>
          </Box>

          {/* Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Total Pipeline Value
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.totalValue || 0)}
                      </Typography>
                    </Box>
                    <MoneyIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Active Deals
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.totalDeals || 0}
                      </Typography>
                    </Box>
                    <CampaignIcon color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Avg Deal Size
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.avgDealSize || 0)}
                      </Typography>
                    </Box>
                    <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Conversion Rate
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.conversionRate || 0}%
                      </Typography>
                    </Box>
                    <ScheduleIcon color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1, maxWidth: 400 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  label="Stage"
                >
                  <MenuItem value="all">All Stages</MenuItem>
                  <MenuItem value="lead">Lead</MenuItem>
                  <MenuItem value="qualified">Qualified</MenuItem>
                  <MenuItem value="proposal">Proposal</MenuItem>
                  <MenuItem value="negotiation">Negotiation</MenuItem>
                  <MenuItem value="closed-won">Closed Won</MenuItem>
                  <MenuItem value="closed-lost">Closed Lost</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Deals Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Probability</TableCell>
                  <TableCell>Close Date</TableCell>
                  <TableCell>Next Action</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDeals.map((deal) => (
                  <TableRow key={deal.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {deal.clientName.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {deal.clientName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {deal.clientCompany}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {deal.campaignName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(deal.estimatedValue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1).replace('-', ' ')}
                        size="small"
                        color={stageColors[deal.stage]}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={deal.probability}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption">
                          {deal.probability}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        {formatDate(deal.expectedCloseDate)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 150 }}>
                        {deal.nextAction}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewDeal(deal)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Deal">
                        <IconButton size="small" onClick={() => router.push(`/campaigns/${deal.id}/edit`)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Deal Details Dialog */}
          <Dialog
            open={dealDialogOpen}
            onClose={() => setDealDialogOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Deal Details: {selectedDeal?.campaignName}
            </DialogTitle>
            <DialogContent>
              {selectedDeal && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Client Information
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PersonIcon fontSize="small" />
                      <Typography>{selectedDeal.clientName}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BusinessIcon fontSize="small" />
                      <Typography>{selectedDeal.clientCompany}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <EmailIcon fontSize="small" />
                      <Typography>{selectedDeal.contactEmail}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <PhoneIcon fontSize="small" />
                      <Typography>{selectedDeal.contactPhone}</Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Deal Information
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Value
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(selectedDeal.estimatedValue)}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Stage
                      </Typography>
                      <Chip
                        label={selectedDeal.stage.charAt(0).toUpperCase() + selectedDeal.stage.slice(1).replace('-', ' ')}
                        color={stageColors[selectedDeal.stage]}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Probability
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={selectedDeal.probability}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="body2">
                          {selectedDeal.probability}%
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Notes & Actions
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Next Action
                      </Typography>
                      <Typography>{selectedDeal.nextAction}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography>{selectedDeal.notes}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedDeal.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDealDialogOpen(false)}>
                Close
              </Button>
              <Button variant="contained" onClick={() => {
                if (selectedDeal) {
                  router.push(`/campaigns/${selectedDeal.id}/edit`)
                }
              }}>
                Edit Deal
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </SellerOnly>
  )
}