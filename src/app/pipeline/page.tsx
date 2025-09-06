'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  ListItemText,
  OutlinedInput,
  InputAdornment,
} from '@mui/material'
import {
  TrendingUp,
  AttachMoney,
  Assessment,
  Schedule,
  FilterList,
  Refresh,
  Launch,
  DateRange,
  Close,
  Search,
  CheckCircle,
  CalendarToday,
  Cancel,
  Visibility,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Campaign {
  id: string
  name: string
  advertiser: string
  advertiserName: string
  seller: string
  sellerId: string
  budget: number
  probability: number
  startDate: string
  endDate: string
  status: string
  createdAt: string
  daysInPipeline: number
}

interface PipelineGroup {
  label: string
  campaigns: Campaign[]
  totalValue: number
  weightedValue: number
}

interface PipelineData {
  groups: Record<string, PipelineGroup>
  summary: {
    totalCampaigns: number
    totalPipelineValue: number
    weightedPipelineValue: number
    averageDealSize: number
    conversionRate: number
    averageCycleTime: number
    bookedThisWeek: number
    bookedThisWeekCount: number
    bookedLastYearSameWeek: number
    bookedLastYearCount: number
    actualRevenue: number
    revenuePacing: number
    lastYearRevenue: number
    lastYearFinal: number
    forecastTarget: number
    forecastGap: number
    budgetTarget: number
    budgetGap: number
  }
  projections: {
    optimistic: number
    realistic: number
    conservative: number
  }
  filters: {
    sellers: Array<{ id: string; name: string }>
    shows: Array<{ id: string; name: string }>
  }
}

const fetchPipelineData = async (filters: Record<string, any>): Promise<PipelineData> => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      params.append(key, value.join(','))
    } else if (value && !Array.isArray(value)) {
      params.append(key, value)
    }
  })
  
  const response = await fetch(`/api/pipeline?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch pipeline data')
  }
  const data = await response.json()
  return data.pipeline
}

interface LostCampaign {
  id: string
  name: string
  advertiser: string
  advertiserName: string
  seller: string
  sellerId: string
  budget: number
  probability: number
  startDate: string
  endDate: string
  status: string
  createdAt: string
  updatedAt: string
  daysInPipeline: number
  lostDate: string
}

interface LostCampaignsData {
  lostCampaigns: LostCampaign[]
  summary: {
    totalLostCampaigns: number
    totalLostValue: number
    averageLostDealSize: number
    averageTimeInPipeline: number
  }
  filters: {
    sellers: Array<{ id: string; name: string }>
  }
}

const fetchLostCampaigns = async (filters: Record<string, any>): Promise<LostCampaignsData> => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value && !Array.isArray(value)) {
      params.append(key, value)
    }
  })
  
  const response = await fetch(`/api/campaigns/lost?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch lost campaigns')
  }
  const data = await response.json()
  return data
}

const stageOptions = [
  { value: '10', label: 'Initial Contact (10%)', icon: '📞' },
  { value: '35', label: 'Qualified Lead (35%)', icon: '✅' },
  { value: '65', label: 'Proposal Sent (65%)', icon: '📄' },
  { value: '90', label: 'Verbal Agreement (90%)', icon: '🤝' },
  { value: '100', label: 'Signed Contract (100%)', icon: '✍️' },
]

export default function PipelinePage() {
  const router = useRouter()
  const [filters, setFilters] = useState({
    sellerIds: [] as string[],
    showIds: [] as string[],
    stages: [] as string[],
    startDate: '',
    endDate: ''
  })
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [customDateDialog, setCustomDateDialog] = useState(false)
  const [customDateType, setCustomDateType] = useState<'month' | 'quarter' | 'range'>('range')
  const [customYear, setCustomYear] = useState(new Date().getFullYear())
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1)
  const [customQuarter, setCustomQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [sellerSearch, setSellerSearch] = useState('')
  const [showSearch, setShowSearch] = useState('')
  const [showLostCampaigns, setShowLostCampaigns] = useState(false)

  const { data: pipelineData, isLoading, refetch } = useQuery({
    queryKey: ['pipeline', filters],
    queryFn: () => fetchPipelineData(filters),
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })

  const { data: lostCampaignsData, isLoading: isLoadingLost, refetch: refetchLost } = useQuery({
    queryKey: ['lostCampaigns', { sellerId: filters.sellerIds[0], startDate: filters.startDate, endDate: filters.endDate }],
    queryFn: () => fetchLostCampaigns({ 
      sellerId: filters.sellerIds[0], 
      startDate: filters.startDate, 
      endDate: filters.endDate 
    }),
    enabled: showLostCampaigns,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({
      sellerIds: [],
      showIds: [],
      stages: [],
      startDate: '',
      endDate: ''
    })
    setSelectedPreset(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusColor = (probability: number) => {
    switch (probability) {
      case 10: return '#f44336' // Red
      case 35: return '#ff9800' // Orange
      case 65: return '#2196f3' // Blue
      case 90: return '#4caf50' // Green
      case 100: return '#8bc34a' // Light Green
      default: return '#9e9e9e' // Grey
    }
  }

  const getProbabilityIcon = (probability: number) => {
    if (probability >= 90) return '🤝'
    if (probability >= 65) return '📄'
    if (probability >= 35) return '✅'
    return '📞'
  }

  const getDateRange = (type: string) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    switch (type) {
      case 'thisMonth':
        return {
          startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          endDate: `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
        }
      case 'nextMonth':
        const nextMonth = month + 1
        const nextYear = nextMonth > 11 ? year + 1 : year
        const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
        return {
          startDate: `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`,
          endDate: `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${new Date(nextYear, adjustedMonth + 1, 0).getDate()}`
        }
      case 'thisQuarter':
        const currentQuarter = Math.floor(month / 3)
        const quarterStart = currentQuarter * 3
        return {
          startDate: `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`,
          endDate: `${year}-${String(quarterStart + 3).padStart(2, '0')}-${new Date(year, quarterStart + 3, 0).getDate()}`
        }
      case 'nextQuarter':
        const nextQuarter = Math.floor(month / 3) + 1
        const nextQuarterYear = nextQuarter > 3 ? year + 1 : year
        const adjustedQuarter = nextQuarter > 3 ? 0 : nextQuarter
        const nextQuarterStart = adjustedQuarter * 3
        return {
          startDate: `${nextQuarterYear}-${String(nextQuarterStart + 1).padStart(2, '0')}-01`,
          endDate: `${nextQuarterYear}-${String(nextQuarterStart + 3).padStart(2, '0')}-${new Date(nextQuarterYear, nextQuarterStart + 3, 0).getDate()}`
        }
      case 'thisYear':
        return {
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`
        }
      case 'nextYear':
        return {
          startDate: `${year + 1}-01-01`,
          endDate: `${year + 1}-12-31`
        }
      default:
        return { startDate: '', endDate: '' }
    }
  }

  const applyDatePreset = (type: string) => {
    const dateRange = getDateRange(type)
    setFilters(prev => ({
      ...prev,
      ...dateRange
    }))
    setSelectedPreset(type)
  }

  const applyCustomDate = () => {
    let startDate = ''
    let endDate = ''
    
    switch (customDateType) {
      case 'month':
        startDate = `${customYear}-${String(customMonth).padStart(2, '0')}-01`
        endDate = `${customYear}-${String(customMonth).padStart(2, '0')}-${new Date(customYear, customMonth, 0).getDate()}`
        break
      case 'quarter':
        const quarterStart = (customQuarter - 1) * 3
        startDate = `${customYear}-${String(quarterStart + 1).padStart(2, '0')}-01`
        endDate = `${customYear}-${String(quarterStart + 3).padStart(2, '0')}-${new Date(customYear, quarterStart + 3, 0).getDate()}`
        break
      case 'range':
        // Keep existing manual date range
        return
    }
    
    setFilters(prev => ({ ...prev, startDate, endDate }))
    setSelectedPreset(null)
    setCustomDateDialog(false)
  }

  const markCampaignAsLost = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to mark "${campaignName}" as Lost? This will remove it from the forecast and set its probability to 0%.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'lost'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark campaign as lost')
      }

      // Refresh the data
      refetch()
      
      // Show success message (you could use a toast library here)
      alert(`Campaign "${campaignName}" has been marked as Lost and removed from the forecast.`)
    } catch (error) {
      console.error('Error marking campaign as lost:', error)
      alert('Failed to mark campaign as lost. Please try again.')
    }
  }

  const getDateRangeLabel = () => {
    // Check preset selections first
    if (selectedPreset) {
      switch (selectedPreset) {
        case 'today':
          return '(Today)'
        case 'thisWeek':
          return '(This Week)'
        case 'lastWeek':
          return '(Last Week)'
        case 'thisMonth':
          return '(This Month)'
        case 'nextMonth':
          return '(Next Month)'
        case 'lastMonth':
          return '(Last Month)'
        case 'thisQuarter':
          return '(This Quarter)'
        case 'nextQuarter':
          return '(Next Quarter)'
        case 'lastQuarter':
          return '(Last Quarter)'
        case 'thisYear':
          return '(This Year)'
        case 'nextYear':
          return '(Next Year)'
        case 'lastYear':
          return '(Last Year)'
        case 'custom':
          if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate)
            const end = new Date(filters.endDate)
            const diffTime = Math.abs(end.getTime() - start.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            
            // Check if it's approximately a month
            if (diffDays >= 28 && diffDays <= 31) {
              const monthName = start.toLocaleDateString('default', { month: 'long', year: 'numeric' })
              return `(${monthName})`
            }
            // Check if it's approximately a quarter
            else if (diffDays >= 89 && diffDays <= 92) {
              const quarter = Math.floor(start.getMonth() / 3) + 1
              return `(Q${quarter} ${start.getFullYear()})`
            }
            // Otherwise show the date range
            else {
              const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric' })
              const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
              return `(${startStr} - ${endStr})`
            }
          } else if (filters.startDate) {
            const start = new Date(filters.startDate)
            const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
            return `(From ${startStr})`
          } else if (filters.endDate) {
            const end = new Date(filters.endDate)
            const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
            return `(Through ${endStr})`
          }
          break
      }
    }
    
    // Check if date filters are applied without a preset
    if (filters.startDate || filters.endDate) {
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate)
        const end = new Date(filters.endDate)
        const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
        return `(${startStr} - ${endStr})`
      } else if (filters.startDate) {
        const start = new Date(filters.startDate)
        const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
        return `(From ${startStr})`
      } else if (filters.endDate) {
        const end = new Date(filters.endDate)
        const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
        return `(Through ${endStr})`
      }
    }
    
    // Default if no filters applied
    return '(Next 30 Days)'
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Sales Pipeline
          </Typography>
          <LinearProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (!pipelineData) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Sales Pipeline
          </Typography>
          <Typography color="error">Failed to load pipeline data</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  const probabilityOrder = [10, 35, 65, 90, 100]

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Sales Pipeline
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={showLostCampaigns ? "contained" : "outlined"}
              startIcon={showLostCampaigns ? <Visibility /> : <Cancel />}
              onClick={() => setShowLostCampaigns(!showLostCampaigns)}
              color={showLostCampaigns ? "error" : "inherit"}
            >
              {showLostCampaigns ? "View Active Pipeline" : "View Lost Campaigns"}
            </Button>
            <IconButton onClick={() => showLostCampaigns ? refetchLost() : refetch()} color="primary">
              <Refresh />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={clearFilters}
              disabled={!Object.values(filters).some(v => v)}
            >
              Clear Filters
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle color="success" />
                  <Box>
                    <Typography variant="h4">
                      {formatCurrency(pipelineData.summary.bookedThisWeek)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Booked This Week
                    </Typography>
                    {pipelineData.summary.bookedThisWeekCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {pipelineData.summary.bookedThisWeekCount} deal{pipelineData.summary.bookedThisWeekCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AttachMoney color="success" />
                  <Box>
                    <Typography variant="h4">
                      {formatCurrency(pipelineData.summary.totalPipelineValue)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Total Pipeline Value
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUp color="warning" />
                  <Box>
                    <Typography variant="h4">
                      {formatCurrency(pipelineData.summary.weightedPipelineValue)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Weighted Forecast
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CalendarToday color="info" />
                  <Box>
                    <Typography variant="h4">
                      {formatCurrency(pipelineData.summary.bookedLastYearSameWeek)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Same Week Last Year
                    </Typography>
                    {pipelineData.summary.bookedLastYearCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {pipelineData.summary.bookedLastYearCount} deal{pipelineData.summary.bookedLastYearCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Revenue Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ pb: 1 }}>
                <Typography color="text.secondary" variant="body2" gutterBottom noWrap>
                  Revenue {!filters.startDate && !filters.endDate ? '(YTD)' : getDateRangeLabel()}
                </Typography>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  {formatCurrency(pipelineData.summary.actualRevenue || 0)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Chip
                    label={`${pipelineData.summary.revenuePacing || 0}% PY`}
                    size="small"
                    color={(pipelineData.summary.revenuePacing || 0) >= 100 ? "success" : "warning"}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ pb: 1 }}>
                <Typography color="text.secondary" variant="body2" gutterBottom noWrap>
                  Revenue + Pipeline
                </Typography>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  {formatCurrency((pipelineData.summary.actualRevenue || 0) + pipelineData.summary.weightedPipelineValue)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Chip
                    label={`${formatCurrency(pipelineData.summary.lastYearFinal || 0)} PY`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ pb: 1 }}>
                <Typography color="text.secondary" variant="body2" gutterBottom noWrap>
                  Forecast
                </Typography>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  {formatCurrency(pipelineData.summary.forecastTarget || 0)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Chip
                    label={`${(pipelineData.summary.forecastGap || 0) < 0 ? '+' : '-'}${formatCurrency(Math.abs(pipelineData.summary.forecastGap || 0))}`}
                    size="small"
                    color={(pipelineData.summary.forecastGap || 0) < 0 ? "success" : "error"}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ pb: 1 }}>
                <Typography color="text.secondary" variant="body2" gutterBottom noWrap>
                  Goal
                </Typography>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  {formatCurrency(pipelineData.summary.budgetTarget || 0)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Chip
                    label={`${(pipelineData.summary.budgetGap || 0) < 0 ? '+' : '-'}${formatCurrency(Math.abs(pipelineData.summary.budgetGap || 0))}`}
                    size="small"
                    color={(pipelineData.summary.budgetGap || 0) < 0 ? "success" : "error"}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
            
            {/* Basic Filters */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Sellers</InputLabel>
                  <Select
                    multiple
                    value={filters.sellerIds}
                    onChange={(e) => setFilters(prev => ({ ...prev, sellerIds: e.target.value as string[] }))}
                    input={<OutlinedInput label="Sellers" />}
                    renderValue={(selected) => `${selected.length} selected`}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                      <MenuItem onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          placeholder="Search sellers..."
                          value={sellerSearch}
                          onChange={(e) => {
                            e.stopPropagation()
                            setSellerSearch(e.target.value)
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search />
                              </InputAdornment>
                            ),
                          }}
                          fullWidth
                        />
                      </MenuItem>
                      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1 }}>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            const allSellerIds = pipelineData.filters.sellers.map(s => s.id)
                            setFilters(prev => ({ ...prev, sellerIds: allSellerIds }))
                          }}
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilters(prev => ({ ...prev, sellerIds: [] }))
                          }}
                        >
                          Select None
                        </Button>
                      </Box>
                      <Divider />
                    </Box>
                    {pipelineData.filters.sellers
                      .filter(seller => seller.name.toLowerCase().includes(sellerSearch.toLowerCase()))
                      .map((seller) => (
                        <MenuItem key={seller.id} value={seller.id}>
                          <Checkbox checked={filters.sellerIds.includes(seller.id)} />
                          <ListItemText primary={seller.name} />
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Shows</InputLabel>
                  <Select
                    multiple
                    value={filters.showIds}
                    onChange={(e) => setFilters(prev => ({ ...prev, showIds: e.target.value as string[] }))}
                    input={<OutlinedInput label="Shows" />}
                    renderValue={(selected) => `${selected.length} selected`}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                      <MenuItem onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          placeholder="Search shows..."
                          value={showSearch}
                          onChange={(e) => {
                            e.stopPropagation()
                            setShowSearch(e.target.value)
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search />
                              </InputAdornment>
                            ),
                          }}
                          fullWidth
                        />
                      </MenuItem>
                      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1 }}>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            const allShowIds = pipelineData.filters.shows.map(s => s.id)
                            setFilters(prev => ({ ...prev, showIds: allShowIds }))
                          }}
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilters(prev => ({ ...prev, showIds: [] }))
                          }}
                        >
                          Select None
                        </Button>
                      </Box>
                      <Divider />
                    </Box>
                    {pipelineData.filters.shows
                      .filter(show => show.name.toLowerCase().includes(showSearch.toLowerCase()))
                      .map((show) => (
                        <MenuItem key={show.id} value={show.id}>
                          <Checkbox checked={filters.showIds.includes(show.id)} />
                          <ListItemText primary={show.name} />
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Stage</InputLabel>
                  <Select
                    multiple
                    value={filters.stages}
                    onChange={(e) => setFilters(prev => ({ ...prev, stages: e.target.value as string[] }))}
                    input={<OutlinedInput label="Stage" />}
                    renderValue={(selected) => `${selected.length} selected`}
                  >
                    <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1 }}>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            const allStages = stageOptions.map(s => s.value)
                            setFilters(prev => ({ ...prev, stages: allStages }))
                          }}
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilters(prev => ({ ...prev, stages: [] }))
                          }}
                        >
                          Select None
                        </Button>
                      </Box>
                      <Divider />
                    </Box>
                    {stageOptions.map((stage) => (
                      <MenuItem key={stage.value} value={stage.value}>
                        <Checkbox checked={filters.stages.includes(stage.value)} />
                        <ListItemText primary={`${stage.icon} ${stage.label}`} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Date Preset Buttons */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                Quick Date Filters
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Button 
                  size="small" 
                  variant={selectedPreset === 'thisMonth' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('thisMonth')}
                >
                  This Month
                </Button>
                <Button 
                  size="small" 
                  variant={selectedPreset === 'nextMonth' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('nextMonth')}
                >
                  Next Month
                </Button>
                <Button 
                  size="small" 
                  variant={selectedPreset === 'thisQuarter' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('thisQuarter')}
                >
                  This Quarter
                </Button>
                <Button 
                  size="small" 
                  variant={selectedPreset === 'nextQuarter' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('nextQuarter')}
                >
                  Next Quarter
                </Button>
                <Button 
                  size="small" 
                  variant={selectedPreset === 'thisYear' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('thisYear')}
                >
                  This Year
                </Button>
                <Button 
                  size="small" 
                  variant={selectedPreset === 'nextYear' ? 'contained' : 'outlined'}
                  onClick={() => applyDatePreset('nextYear')}
                >
                  Next Year
                </Button>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DateRange />}
                  onClick={() => setCustomDateDialog(true)}
                >
                  Custom Dates
                </Button>
                {(filters.startDate || filters.endDate) && (
                  <IconButton 
                    onClick={() => {
                      setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
                      setSelectedPreset(null)
                    }}
                    size="small"
                    color="error"
                  >
                    <Close />
                  </IconButton>
                )}
              </Stack>
            </Box>

            {/* Current Date Range Display */}
            {(filters.startDate || filters.endDate) && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Date Range:</strong> {filters.startDate || 'No start date'} to {filters.endDate || 'No end date'}
                </Typography>
              </Box>
            )}

            {/* Results Summary */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {pipelineData.summary.totalCampaigns} campaigns • {formatCurrency(pipelineData.summary.averageDealSize)} avg deal
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Revenue Projections */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Revenue Projections {getDateRangeLabel()}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="error">
                    {formatCurrency(pipelineData.projections.conservative)}
                  </Typography>
                  <Tooltip title="80% of Weighted" arrow>
                    <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>
                      Conservative
                    </Typography>
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="primary">
                    {formatCurrency(pipelineData.projections.realistic)}
                  </Typography>
                  <Tooltip title="Weighted by Probability" arrow>
                    <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>
                      Realistic
                    </Typography>
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(pipelineData.projections.optimistic)}
                  </Typography>
                  <Tooltip title="Full Pipeline Value" arrow>
                    <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>
                      Optimistic
                    </Typography>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {!showLostCampaigns && (
          /* Pipeline by Probability */
          <Grid container spacing={3}>
            {probabilityOrder.map((probability) => {
              const group = pipelineData.groups[probability.toString()]
              if (!group || group.campaigns.length === 0) return null

              return (
                <Grid item xs={12} key={probability}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="h6">
                            {getProbabilityIcon(probability)} {group.label}
                          </Typography>
                          <Chip
                            label={`${group.campaigns.length} campaigns`}
                            size="small"
                            style={{ backgroundColor: getStatusColor(probability), color: 'white' }}
                          />
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h6">
                            {formatCurrency(group.totalValue)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Weighted: {formatCurrency(group.weightedValue)}
                          </Typography>
                        </Box>
                      </Box>

                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Campaign</TableCell>
                              <TableCell>Advertiser</TableCell>
                              <TableCell>Seller</TableCell>
                              <TableCell align="right">Budget</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="right">Days in Pipeline</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {group.campaigns.map((campaign) => (
                              <TableRow key={campaign.id} hover>
                                <TableCell>
                                  <Tooltip title={campaign.name}>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                      {campaign.name}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                                <TableCell>{campaign.advertiser}</TableCell>
                                <TableCell>{campaign.seller}</TableCell>
                                <TableCell align="right">{formatCurrency(campaign.budget)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={campaign.status}
                                    size="small"
                                    color={campaign.status === 'active' ? 'success' : 'default'}
                                  />
                                </TableCell>
                                <TableCell align="right">{campaign.daysInPipeline}</TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                    <IconButton
                                      component={Link}
                                      href={`/campaigns/${campaign.id}`}
                                      size="small"
                                      color="primary"
                                    >
                                      <Launch />
                                    </IconButton>
                                    <Tooltip title="Mark as Lost">
                                      <IconButton
                                        onClick={() => markCampaignAsLost(campaign.id, campaign.name)}
                                        size="small"
                                        color="error"
                                      >
                                        <Cancel />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}

        {showLostCampaigns && (
          /* Lost Campaigns Section */
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6">
                        🚫 Lost Campaigns
                      </Typography>
                      {lostCampaignsData && (
                        <Chip
                          label={`${lostCampaignsData.summary.totalLostCampaigns} campaigns`}
                          size="small"
                          color="error"
                        />
                      )}
                    </Box>
                    {lostCampaignsData && (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h6" color="error">
                          {formatCurrency(lostCampaignsData.summary.totalLostValue)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Avg Deal: {formatCurrency(lostCampaignsData.summary.averageLostDealSize)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {isLoadingLost && (
                    <LinearProgress />
                  )}

                  {lostCampaignsData && lostCampaignsData.lostCampaigns.length > 0 && (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Advertiser</TableCell>
                            <TableCell>Seller</TableCell>
                            <TableCell align="right">Budget</TableCell>
                            <TableCell align="right">Days in Pipeline</TableCell>
                            <TableCell>Lost Date</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lostCampaignsData.lostCampaigns.map((campaign) => (
                            <TableRow key={campaign.id} hover>
                              <TableCell>
                                <Tooltip title={campaign.name}>
                                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                    {campaign.name}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                              <TableCell>{campaign.advertiser}</TableCell>
                              <TableCell>{campaign.seller}</TableCell>
                              <TableCell align="right">{formatCurrency(campaign.budget)}</TableCell>
                              <TableCell align="right">{campaign.daysInPipeline}</TableCell>
                              <TableCell>
                                {new Date(campaign.lostDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  component={Link}
                                  href={`/campaigns/${campaign.id}`}
                                  size="small"
                                  color="primary"
                                >
                                  <Launch />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {lostCampaignsData && lostCampaignsData.lostCampaigns.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Cancel sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        No lost campaigns found
                      </Typography>
                      <Typography color="text.secondary">
                        No campaigns have been marked as lost yet
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {pipelineData.summary.totalCampaigns === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No campaigns in pipeline
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Start by creating some campaigns to see your sales pipeline here
              </Typography>
              <Button
                variant="contained"
                component={Link}
                href="/campaigns/new"
                startIcon={<TrendingUp />}
              >
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Custom Date Dialog */}
        <Dialog 
          open={customDateDialog} 
          onClose={() => setCustomDateDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Custom Date Filter
              <IconButton onClick={() => setCustomDateDialog(false)}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Filter Type
              </Typography>
              <ToggleButtonGroup
                value={customDateType}
                exclusive
                onChange={(e, value) => value && setCustomDateType(value)}
                size="small"
                fullWidth
              >
                <ToggleButton value="month">Specific Month</ToggleButton>
                <ToggleButton value="quarter">Specific Quarter</ToggleButton>
                <ToggleButton value="range">Date Range</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {customDateType === 'month' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={customYear}
                      onChange={(e) => setCustomYear(Number(e.target.value))}
                      label="Year"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={customMonth}
                      onChange={(e) => setCustomMonth(Number(e.target.value))}
                      label="Month"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <MenuItem key={month} value={month}>
                          {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            {customDateType === 'quarter' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={customYear}
                      onChange={(e) => setCustomYear(Number(e.target.value))}
                      label="Year"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Quarter</InputLabel>
                    <Select
                      value={customQuarter}
                      onChange={(e) => setCustomQuarter(Number(e.target.value))}
                      label="Quarter"
                    >
                      <MenuItem value={1}>Q1 (Jan-Mar)</MenuItem>
                      <MenuItem value={2}>Q2 (Apr-Jun)</MenuItem>
                      <MenuItem value={3}>Q3 (Jul-Sep)</MenuItem>
                      <MenuItem value={4}>Q4 (Oct-Dec)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            {customDateType === 'range' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    type="date"
                    fullWidth
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="date"
                    fullWidth
                    label="End Date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCustomDateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={applyCustomDate} 
              variant="contained"
              disabled={customDateType === 'range' && !filters.startDate && !filters.endDate}
            >
              Apply Filter
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}