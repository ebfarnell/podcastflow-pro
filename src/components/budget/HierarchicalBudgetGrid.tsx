'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Collapse,
  Tooltip,
  Switch,
  FormControlLabel,
  Paper,
  Tabs,
  Tab
} from '@mui/material'
import {
  ExpandMore,
  ChevronRight,
  Edit,
  Save,
  Cancel,
  Add,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Business,
  Person,
  Refresh,
  Compare,
  FileDownload
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface HierarchicalBudget {
  id: string
  entityType: 'advertiser' | 'agency' | 'seller'
  entityId: string
  entityName: string
  year: number
  month: number
  budgetAmount: number
  actualAmount: number
  previousYearActual: number
  sellerId: string
  sellerName: string
  agencyId?: string
  agencyName?: string
  variance: number
  variancePercent: number
  yearOverYearGrowth: number
  notes?: string
  entityActive: boolean
}

interface SellerTotal {
  sellerName: string
  sellerEmail: string
  totalBudget: number
  totalActual: number
  advertiserBudget: number
  agencyBudget: number
  sellerBudget: number
  variance: number
  yearOverYearGrowth: number
  isOnTarget: boolean
  periods: any[]
}

interface BudgetData {
  budgets: HierarchicalBudget[]
  rollups: {
    sellerTotals: Record<string, SellerTotal>
    grandTotals: {
      totalBudget: number
      totalActual: number
      variance: number
      variancePercent: number
    }
  }
  metadata: {
    year: number
    month?: number
    totalSellers: number
    totalEntities: number
    lastCacheUpdate: string
  }
}

interface HierarchicalBudgetGridProps {
  year: number
  onYearChange: (year: number) => void
}

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
      id={`budget-tabpanel-${index}`}
      aria-labelledby={`budget-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export function HierarchicalBudgetGrid({ year, onYearChange }: HierarchicalBudgetGridProps) {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedBudgets, setEditedBudgets] = useState<Record<string, Partial<HierarchicalBudget>>>({})
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set())
  const [showComparison, setShowComparison] = useState(false)
  const [tabValue, setTabValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch hierarchical budget data
  const { data: budgetData, isLoading, error: fetchError } = useQuery<BudgetData>({
    queryKey: ['hierarchical-budgets', year, month],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        ...(month && { month: month.toString() })
      })
      const response = await fetch(`/api/budget/hierarchical?${params}`)
      if (!response.ok) throw new Error('Failed to fetch budget data')
      return response.json()
    },
  })

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string } & Partial<HierarchicalBudget>>) => {
      const response = await fetch('/api/budget/hierarchical/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!response.ok) throw new Error('Failed to update budgets')
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-budgets'] })
      setEditMode(false)
      setEditedBudgets({})
      setSuccess(`Successfully updated ${result.success} budget entries`)
      if (result.errors > 0) {
        setError(`${result.errors} updates failed`)
      }
      setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update budgets')
    },
  })

  // Refresh cache mutation
  const refreshCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/budget/rollups/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      if (!response.ok) throw new Error('Failed to refresh cache')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-budgets'] })
      setSuccess('Cache refreshed successfully')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to refresh cache')
    },
  })

  // Group budgets by seller and create hierarchy
  const groupedBudgets = useMemo(() => {
    if (!budgetData?.budgets) return {}

    const grouped: Record<string, {
      seller: { id: string; name: string; budgets: HierarchicalBudget[] }
      agencies: Record<string, { info: any; budgets: HierarchicalBudget[]; advertisers: HierarchicalBudget[] }>
      directAdvertisers: HierarchicalBudget[]
    }> = {}

    budgetData.budgets.forEach(budget => {
      if (!grouped[budget.sellerId]) {
        grouped[budget.sellerId] = {
          seller: { id: budget.sellerId, name: budget.sellerName, budgets: [] },
          agencies: {},
          directAdvertisers: []
        }
      }

      const sellerGroup = grouped[budget.sellerId]

      if (budget.entityType === 'seller') {
        sellerGroup.seller.budgets.push(budget)
      } else if (budget.entityType === 'agency') {
        if (!sellerGroup.agencies[budget.entityId]) {
          sellerGroup.agencies[budget.entityId] = {
            info: budget,
            budgets: [],
            advertisers: []
          }
        }
        sellerGroup.agencies[budget.entityId].budgets.push(budget)
      } else if (budget.entityType === 'advertiser') {
        if (budget.agencyId) {
          if (!sellerGroup.agencies[budget.agencyId]) {
            sellerGroup.agencies[budget.agencyId] = {
              info: { entityId: budget.agencyId, entityName: budget.agencyName },
              budgets: [],
              advertisers: []
            }
          }
          sellerGroup.agencies[budget.agencyId].advertisers.push(budget)
        } else {
          sellerGroup.directAdvertisers.push(budget)
        }
      }
    })

    return grouped
  }, [budgetData])

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

  const getVarianceColor = (variance: number, budget: number) => {
    if (budget === 0) return 'default'
    const percent = Math.abs(variance / budget) * 100
    if (percent < 10) return 'success'
    if (percent < 20) return 'warning'
    return 'error'
  }

  const handleCellEdit = (budgetId: string, field: keyof HierarchicalBudget, value: any) => {
    setEditedBudgets(prev => ({
      ...prev,
      [budgetId]: {
        ...prev[budgetId],
        [field]: value
      }
    }))
  }

  const handleSaveAll = () => {
    const updates = Object.entries(editedBudgets).map(([id, changes]) => ({
      id,
      ...changes
    }))
    
    if (updates.length > 0) {
      batchUpdateMutation.mutate(updates)
    }
  }

  const toggleSellerExpanded = (sellerId: string) => {
    setExpandedSellers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sellerId)) {
        newSet.delete(sellerId)
      } else {
        newSet.add(sellerId)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (fetchError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load budget data: {fetchError.message}
      </Alert>
    )
  }

  return (
    <Box>
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header Controls */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select
                value={year}
                onChange={(e) => onYearChange(e.target.value as number)}
                label="Year"
              >
                {[2023, 2024, 2025, 2026, 2027].map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Month</InputLabel>
              <Select
                value={month || ''}
                onChange={(e) => setMonth(e.target.value ? e.target.value as number : null)}
                label="Month"
              >
                <MenuItem value="">All Months</MenuItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                />
              }
              label="Show Previous Year"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                startIcon={<Refresh />}
                onClick={() => refreshCacheMutation.mutate()}
                disabled={refreshCacheMutation.isPending}
                size="small"
              >
                Refresh
              </Button>
              
              {!editMode && (
                <Button
                  variant="contained"
                  startIcon={<Edit />}
                  onClick={() => setEditMode(true)}
                  size="small"
                >
                  Edit Budgets
                </Button>
              )}
              
              {editMode && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<Save />}
                    onClick={handleSaveAll}
                    disabled={batchUpdateMutation.isPending || Object.keys(editedBudgets).length === 0}
                    size="small"
                  >
                    Save All
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => {
                      setEditMode(false)
                      setEditedBudgets({})
                    }}
                    size="small"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Seller Summary Cards */}
      {budgetData?.rollups?.sellerTotals && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Object.entries(budgetData.rollups.sellerTotals).map(([sellerId, seller]) => (
            <Grid item xs={12} md={4} key={sellerId}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" color="primary">
                        {seller.sellerName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Budget: {formatCurrency(seller.totalBudget)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Actual: {formatCurrency(seller.totalActual)}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color={seller.variance >= 0 ? 'success.main' : 'error.main'}
                      >
                        Variance: {formatCurrency(seller.variance)} ({formatPercent(seller.variance / seller.totalBudget * 100)})
                      </Typography>
                      {showComparison && (
                        <Typography variant="body2" color="info.main">
                          YoY Growth: {formatPercent(seller.yearOverYearGrowth)}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={seller.isOnTarget ? 'On Target' : 'Off Target'}
                      color={seller.isOnTarget ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Hierarchical Budget Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Hierarchical Budget Management ({year})
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  {showComparison && <TableCell align="right">Prev Year</TableCell>}
                  {showComparison && <TableCell align="right">YoY Growth</TableCell>}
                  <TableCell align="right">Status</TableCell>
                  {!editMode && <TableCell align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(groupedBudgets).map(([sellerId, sellerData]) => (
                  <React.Fragment key={sellerId}>
                    {/* Seller Row */}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => toggleSellerExpanded(sellerId)}
                          >
                            {expandedSellers.has(sellerId) ? <ExpandMore /> : <ChevronRight />}
                          </IconButton>
                          <Person sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="subtitle2" fontWeight="bold">
                            {sellerData.seller.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label="Seller" color="primary" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(budgetData?.rollups?.sellerTotals[sellerId]?.totalBudget || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(budgetData?.rollups?.sellerTotals[sellerId]?.totalActual || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={formatCurrency(budgetData?.rollups?.sellerTotals[sellerId]?.variance || 0)}
                          color={getVarianceColor(
                            budgetData?.rollups?.sellerTotals[sellerId]?.variance || 0,
                            budgetData?.rollups?.sellerTotals[sellerId]?.totalBudget || 0
                          )}
                          size="small"
                        />
                      </TableCell>
                      {showComparison && (
                        <TableCell align="right">-</TableCell>
                      )}
                      {showComparison && (
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {(budgetData?.rollups?.sellerTotals[sellerId]?.yearOverYearGrowth || 0) >= 0 ? (
                              <TrendingUp color="success" sx={{ mr: 0.5 }} />
                            ) : (
                              <TrendingDown color="error" sx={{ mr: 0.5 }} />
                            )}
                            <Typography variant="body2">
                              {formatPercent(budgetData?.rollups?.sellerTotals[sellerId]?.yearOverYearGrowth || 0)}
                            </Typography>
                          </Box>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Chip
                          label={budgetData?.rollups?.sellerTotals[sellerId]?.isOnTarget ? 'On Target' : 'Off Target'}
                          color={budgetData?.rollups?.sellerTotals[sellerId]?.isOnTarget ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      {!editMode && (
                        <TableCell align="center">-</TableCell>
                      )}
                    </TableRow>

                    {/* Expanded Seller Content */}
                    <TableRow>
                      <TableCell colSpan={showComparison ? 8 : 6} sx={{ p: 0, border: 0 }}>
                        <Collapse in={expandedSellers.has(sellerId)} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            {/* Agencies */}
                            {Object.entries(sellerData.agencies).map(([agencyId, agency]) => (
                              <Box key={agencyId} sx={{ mb: 2 }}>
                                {/* Agency Header */}
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, pl: 2 }}>
                                  <Business sx={{ mr: 1, color: 'secondary.main' }} />
                                  <Typography variant="subtitle2" color="secondary.main">
                                    {agency.info.entityName || 'Unknown Agency'}
                                  </Typography>
                                </Box>
                                
                                {/* Agency Advertisers */}
                                {agency.advertisers.map(advertiser => (
                                  <Box key={advertiser.id} sx={{ pl: 4, mb: 1 }}>
                                    <Grid container spacing={1} alignItems="center">
                                      <Grid item xs={3}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          <AccountBalance sx={{ mr: 1, fontSize: 16 }} />
                                          <Typography variant="body2">
                                            {advertiser.entityName}
                                          </Typography>
                                        </Box>
                                      </Grid>
                                      <Grid item xs={2}>
                                        {editMode ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            value={editedBudgets[advertiser.id]?.budgetAmount ?? advertiser.budgetAmount}
                                            onChange={(e) => handleCellEdit(advertiser.id, 'budgetAmount', parseFloat(e.target.value) || 0)}
                                            sx={{ width: 100 }}
                                          />
                                        ) : (
                                          <Typography variant="body2">
                                            {formatCurrency(advertiser.budgetAmount)}
                                          </Typography>
                                        )}
                                      </Grid>
                                      <Grid item xs={2}>
                                        {editMode ? (
                                          <TextField
                                            size="small"
                                            type="number"
                                            value={editedBudgets[advertiser.id]?.actualAmount ?? advertiser.actualAmount}
                                            onChange={(e) => handleCellEdit(advertiser.id, 'actualAmount', parseFloat(e.target.value) || 0)}
                                            sx={{ width: 100 }}
                                          />
                                        ) : (
                                          <Typography variant="body2">
                                            {formatCurrency(advertiser.actualAmount)}
                                          </Typography>
                                        )}
                                      </Grid>
                                      <Grid item xs={2}>
                                        <Typography variant="body2">
                                          {formatCurrency(advertiser.variance)}
                                        </Typography>
                                      </Grid>
                                      {showComparison && (
                                        <Grid item xs={2}>
                                          <Typography variant="body2">
                                            {formatCurrency(advertiser.previousYearActual)}
                                          </Typography>
                                        </Grid>
                                      )}
                                      <Grid item xs={1}>
                                        <Chip
                                          label={Math.abs(advertiser.variancePercent) < 10 ? 'On Track' : 'Off Track'}
                                          color={Math.abs(advertiser.variancePercent) < 10 ? 'success' : 'warning'}
                                          size="small"
                                        />
                                      </Grid>
                                    </Grid>
                                  </Box>
                                ))}
                              </Box>
                            ))}

                            {/* Direct Advertisers */}
                            {sellerData.directAdvertisers.map(advertiser => (
                              <Box key={advertiser.id} sx={{ pl: 2, mb: 1 }}>
                                <Grid container spacing={1} alignItems="center">
                                  <Grid item xs={3}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      <AccountBalance sx={{ mr: 1, fontSize: 16 }} />
                                      <Typography variant="body2">
                                        {advertiser.entityName} (Direct)
                                      </Typography>
                                    </Box>
                                  </Grid>
                                  <Grid item xs={2}>
                                    {editMode ? (
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={editedBudgets[advertiser.id]?.budgetAmount ?? advertiser.budgetAmount}
                                        onChange={(e) => handleCellEdit(advertiser.id, 'budgetAmount', parseFloat(e.target.value) || 0)}
                                        sx={{ width: 100 }}
                                      />
                                    ) : (
                                      <Typography variant="body2">
                                        {formatCurrency(advertiser.budgetAmount)}
                                      </Typography>
                                    )}
                                  </Grid>
                                  <Grid item xs={2}>
                                    {editMode ? (
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={editedBudgets[advertiser.id]?.actualAmount ?? advertiser.actualAmount}
                                        onChange={(e) => handleCellEdit(advertiser.id, 'actualAmount', parseFloat(e.target.value) || 0)}
                                        sx={{ width: 100 }}
                                      />
                                    ) : (
                                      <Typography variant="body2">
                                        {formatCurrency(advertiser.actualAmount)}
                                      </Typography>
                                    )}
                                  </Grid>
                                  <Grid item xs={2}>
                                    <Typography variant="body2">
                                      {formatCurrency(advertiser.variance)}
                                    </Typography>
                                  </Grid>
                                  {showComparison && (
                                    <Grid item xs={2}>
                                      <Typography variant="body2">
                                        {formatCurrency(advertiser.previousYearActual)}
                                      </Typography>
                                    </Grid>
                                  )}
                                  <Grid item xs={1}>
                                    <Chip
                                      label={Math.abs(advertiser.variancePercent) < 10 ? 'On Track' : 'Off Track'}
                                      color={Math.abs(advertiser.variancePercent) < 10 ? 'success' : 'warning'}
                                      size="small"
                                    />
                                  </Grid>
                                </Grid>
                              </Box>
                            ))}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}