'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Edit,
  Save,
  Cancel,
  TrendingUp,
  TrendingDown,
  AttachMoney,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

interface RevenueProjection {
  month: string
  projectedRevenue: number
  organizationProfit: number
  talentShare: number
  actualRevenue: number
  variance: number
  showCount: number
  forecast?: number
}

interface ProjectionSummary {
  totalProjectedRevenue: number
  totalOrganizationProfit: number
  totalTalentShare: number
  activeShows: number
  averageSelloutRate: number
}

export function RevenueProjections({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [editedForecasts, setEditedForecasts] = useState<Record<string, number>>({})
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch revenue projections
  const { data: projectionsData, isLoading } = useQuery({
    queryKey: ['revenue-projections', year],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/revenue-projections?year=${year}`)
      if (!response.ok) throw new Error('Failed to fetch projections')
      return response.json()
    },
  })

  // Fetch saved forecasts
  const { data: forecastsData } = useQuery({
    queryKey: ['revenue-forecasts', year],
    queryFn: async () => {
      const response = await fetch(`/api/budget/forecasts?year=${year}`)
      if (!response.ok) throw new Error('Failed to fetch forecasts')
      return response.json()
    },
  })

  // Save forecasts mutation
  const saveForecasts = useMutation({
    mutationFn: async (forecasts: Record<string, number>) => {
      const response = await fetch('/api/budget/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, forecasts }),
      })
      if (!response.ok) throw new Error('Failed to save forecasts')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-forecasts', year] })
      queryClient.invalidateQueries({ queryKey: ['revenue-projections', year] })
      setSuccess(true)
      setEditMode(false)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save forecasts')
    },
  })

  // Initialize edited forecasts when data loads
  useEffect(() => {
    if (forecastsData?.forecasts) {
      const forecastMap: Record<string, number> = {}
      forecastsData.forecasts.forEach((f: any) => {
        forecastMap[f.month] = f.forecastAmount
      })
      setEditedForecasts(forecastMap)
    }
  }, [forecastsData])

  const handleSave = () => {
    saveForecasts.mutate(editedForecasts)
  }

  const handleCancel = () => {
    // Reset to saved values
    if (forecastsData?.forecasts) {
      const forecastMap: Record<string, number> = {}
      forecastsData.forecasts.forEach((f: any) => {
        forecastMap[f.month] = f.forecastAmount
      })
      setEditedForecasts(forecastMap)
    }
    setEditMode(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  const projections: RevenueProjection[] = projectionsData?.projections || []
  const summary: ProjectionSummary = projectionsData?.summary || {
    totalProjectedRevenue: 0,
    totalOrganizationProfit: 0,
    totalTalentShare: 0,
    activeShows: 0,
    averageSelloutRate: 0,
  }

  return (
    <Box>
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Revenue forecasts updated successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        Revenue projections are calculated based on show sellout projections and estimated episode values. 
        Adjust the forecast column to set organizational targets.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Projected Revenue
              </Typography>
              <Typography variant="h4" color="success.main">
                {formatCurrency(summary.totalProjectedRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {year} Projection
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Organization Profit
              </Typography>
              <Typography variant="h4" color="primary.main">
                {formatCurrency(summary.totalOrganizationProfit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                After Talent Share
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Shows
              </Typography>
              <Typography variant="h4">
                {summary.activeShows}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg {summary.averageSelloutRate}% Sellout
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Forecast
              </Typography>
              <Typography variant="h4" color="info.main">
                {formatCurrency(
                  Object.values(editedForecasts).reduce((sum, val) => sum + (val || 0), 0)
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Organizational Target
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        {!editMode && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => setEditMode(true)}
          >
            Adjust Forecasts
          </Button>
        )}
        {editMode && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saveForecasts.isPending}
            >
              Save Forecasts
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleCancel}
              disabled={saveForecasts.isPending}
            >
              Cancel
            </Button>
          </>
        )}
      </Box>

      {/* Projections Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Monthly Revenue Projections & Forecasts
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Projected Revenue</TableCell>
                  <TableCell align="right">Organizational Forecast</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="right">Organization Profit</TableCell>
                  <TableCell align="right">Talent Share</TableCell>
                  <TableCell align="right">Actual Revenue</TableCell>
                  <TableCell align="right">Performance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projections.map((projection) => {
                  const forecast = editedForecasts[projection.month] || projection.projectedRevenue
                  const forecastVariance = ((projection.projectedRevenue - forecast) / forecast) * 100
                  
                  return (
                    <TableRow key={projection.month}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {projection.month}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(projection.projectedRevenue)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {editMode ? (
                          <TextField
                            type="number"
                            value={editedForecasts[projection.month] || projection.projectedRevenue}
                            onChange={(e) => {
                              setEditedForecasts({
                                ...editedForecasts,
                                [projection.month]: parseFloat(e.target.value) || 0,
                              })
                            }}
                            size="small"
                            sx={{ width: 120 }}
                            InputProps={{
                              startAdornment: '$',
                            }}
                          />
                        ) : (
                          <Typography variant="body2" color="info.main" fontWeight="bold">
                            {formatCurrency(forecast)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={formatPercent(forecastVariance)}
                          size="small"
                          color={Math.abs(forecastVariance) < 10 ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(projection.organizationProfit)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(projection.talentShare)}
                      </TableCell>
                      <TableCell align="right">
                        {projection.actualRevenue > 0 ? (
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(projection.actualRevenue)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {projection.actualRevenue > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {projection.variance >= 0 ? (
                              <TrendingUp color="success" sx={{ mr: 1 }} />
                            ) : (
                              <TrendingDown color="error" sx={{ mr: 1 }} />
                            )}
                            <Typography
                              variant="body2"
                              color={projection.variance >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatPercent(projection.variance)}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}