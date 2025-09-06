'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  MenuItem,
  Grid,
  InputAdornment,
  LinearProgress,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { showsApi } from '@/services/api'
import { toast } from '@/lib/toast'

interface InventoryItem {
  id: string
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  showId: string
  showName: string
  showCategory: string
  airDate: string
  totalSlots: number
  totalAvailable: number
  totalReserved: number
  totalBooked: number
  preRollAvailable: number
  preRollPrice: number
  midRollAvailable: number
  midRollPrice: number
  postRollAvailable: number
  postRollPrice: number
  estimatedImpressions: number
}

export default function InventoryPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedShow, setSelectedShow] = useState('')
  const [dateRange, setDateRange] = useState('30days')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch shows for filter
  const { data: shows = [] } = useQuery({
    queryKey: ['shows'],
    queryFn: () => showsApi.list()
  })

  useEffect(() => {
    fetchInventory()
  }, [selectedShow, dateRange, availableOnly])

  const fetchInventory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedShow) params.append('showId', selectedShow)
      if (availableOnly) params.append('availableOnly', 'true')
      
      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      let endDate = new Date()
      
      switch (dateRange) {
        case '7days':
          endDate.setDate(now.getDate() + 7)
          break
        case '30days':
          endDate.setDate(now.getDate() + 30)
          break
        case '90days':
          endDate.setDate(now.getDate() + 90)
          break
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          break
        case 'nextMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0)
          break
      }
      
      params.append('startDate', startDate.toISOString())
      params.append('endDate', endDate.toISOString())

      const response = await fetch(`/api/inventory?${params}`)
      if (response.ok) {
        const data = await response.json()
        setInventory(data.inventory || [])
        setSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const getUtilizationColor = (available: number, total: number) => {
    if (total === 0) return 'default'
    const utilization = ((total - available) / total) * 100
    if (utilization >= 80) return 'error'
    if (utilization >= 60) return 'warning'
    if (utilization >= 40) return 'primary'
    return 'success'
  }

  const filteredInventory = inventory.filter(item =>
    item.episodeTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.showName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Use API summary for performance when available, fallback to client-side calculation for filtered data
  const totalStats = searchTerm || selectedShow || availableOnly || summary === null
    ? filteredInventory.reduce((acc, item) => ({
        totalSlots: acc.totalSlots + item.totalSlots,
        totalAvailable: acc.totalAvailable + item.totalAvailable,
        totalReserved: acc.totalReserved + item.totalReserved,
        totalBooked: acc.totalBooked + item.totalBooked,
        potentialRevenue: acc.potentialRevenue + 
          (item.preRollAvailable * item.preRollPrice) +
          (item.midRollAvailable * item.midRollPrice) +
          (item.postRollAvailable * item.postRollPrice)
      }), {
        totalSlots: 0,
        totalAvailable: 0,
        totalReserved: 0,
        totalBooked: 0,
        potentialRevenue: 0
      })
    : {
        totalSlots: parseInt(summary.totalSlots) || 0,
        totalAvailable: parseInt(summary.totalAvailable) || 0,
        totalReserved: parseInt(summary.totalReserved) || 0,
        totalBooked: parseInt(summary.totalBooked) || 0,
        potentialRevenue: filteredInventory.reduce((sum, item) => sum + 
          (item.preRollAvailable * item.preRollPrice) +
          (item.midRollAvailable * item.midRollPrice) +
          (item.postRollAvailable * item.postRollPrice), 0)
      }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <Box>
          {/* Header */}
          <Box mb={3}>
            <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
              <InventoryIcon fontSize="large" />
              Inventory Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage ad inventory across all episodes
            </Typography>
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    Total Slots
                  </Typography>
                  <Typography variant="h4">
                    {totalStats.totalSlots.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    Available
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {totalStats.totalAvailable.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    Reserved/Booked
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {(totalStats.totalReserved + totalStats.totalBooked).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    Potential Revenue
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    ${totalStats.potentialRevenue.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    placeholder="Search episodes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    label="Show"
                    value={selectedShow}
                    onChange={(e) => setSelectedShow(e.target.value)}
                  >
                    <MenuItem value="">All Shows</MenuItem>
                    {shows.map(show => (
                      <MenuItem key={show.id} value={show.id}>
                        {show.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    label="Date Range"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                  >
                    <MenuItem value="7days">Next 7 Days</MenuItem>
                    <MenuItem value="30days">Next 30 Days</MenuItem>
                    <MenuItem value="90days">Next 90 Days</MenuItem>
                    <MenuItem value="thisMonth">This Month</MenuItem>
                    <MenuItem value="nextMonth">Next Month</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={availableOnly}
                        onChange={(e) => setAvailableOnly(e.target.checked)}
                      />
                    }
                    label="Available Only"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Inventory Table */}
          <Card>
            <CardContent>
              {loading ? (
                <LinearProgress />
              ) : (
                <TableContainer component={Paper} elevation={0}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Episode</TableCell>
                        <TableCell>Show</TableCell>
                        <TableCell>Air Date</TableCell>
                        <TableCell align="center">Pre-roll</TableCell>
                        <TableCell align="center">Mid-roll</TableCell>
                        <TableCell align="center">Post-roll</TableCell>
                        <TableCell align="center">Total Available</TableCell>
                        <TableCell align="center">Est. Impressions</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInventory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            <Typography color="text.secondary" py={3}>
                              No inventory found matching your criteria
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInventory.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                #{item.episodeNumber} - {item.episodeTitle}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={item.showName} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.airDate), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell align="center">
                              <Box>
                                <Typography variant="body2">
                                  {item.preRollAvailable} available
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ${item.preRollPrice}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Box>
                                <Typography variant="body2">
                                  {item.midRollAvailable} available
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ${item.midRollPrice}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Box>
                                <Typography variant="body2">
                                  {item.postRollAvailable} available
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ${item.postRollPrice}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${item.totalAvailable} / ${item.totalSlots}`}
                                size="small"
                                color={getUtilizationColor(item.totalAvailable, item.totalSlots)}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {item.estimatedImpressions?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="View Episode">
                                <IconButton
                                  size="small"
                                  onClick={() => router.push(`/episodes/${item.episodeId}`)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}