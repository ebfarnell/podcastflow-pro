'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
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
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  Checkbox,
  FormLabel,
  Divider
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
  FileDownload,
  ViewList,
  Group,
  Store,
  Delete
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar } from 'recharts'

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

interface ComparisonData {
  period: string
  currentBudget: number
  currentActual: number
  previousActual: number
  budgetVariance: number
  budgetVariancePercent: number
  yearOverYearGrowth: number
  isOnTarget: boolean
  sellersOnTarget: number
  sellersOffTarget: number
}

interface ComparisonSummary {
  totalCurrentBudget: number
  totalCurrentActual: number
  totalPreviousActual: number
  overallVariance: number
  overallYoYGrowth: number
  sellersOnTarget: number
  sellersOffTarget: number
  periodsAnalyzed: number
  bestPeriod: ComparisonData | null
  worstPeriod: ComparisonData | null
}

interface UnifiedBudgetPlanningProps {
  year: number
  onYearChange: (year: number) => void
}

type ViewMode = 'seller' | 'agency' | 'advertiser'

export function UnifiedBudgetPlanning({ year, onYearChange }: UnifiedBudgetPlanningProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedBudgets, setEditedBudgets] = useState<Record<string, Partial<HierarchicalBudget>>>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  
  // Only admin and master roles can edit budgets
  const canEdit = user && ['admin', 'master'].includes(user.role)
  const showComparison = true
  const [viewMode, setViewMode] = useState<ViewMode>('seller')
  const [compareYear, setCompareYear] = useState(year - 1)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [developmentalDialog, setDevelopmentalDialog] = useState<{
    open: boolean
    sellerId: string
    sellerName: string
    monthlyAmount: string
    isAnnual: boolean
    selectedMonths: number[]
  }>({
    open: false,
    sellerId: '',
    sellerName: '',
    monthlyAmount: '833.33',
    isAnnual: false,
    selectedMonths: []
  })
  
  // State for managing selected developmental goals for batch operations
  const [selectedDevelopmentalGoals, setSelectedDevelopmentalGoals] = useState<Set<string>>(new Set())

  // Fetch hierarchical budget data - always fetch all months
  const { data: allBudgetData, isLoading, error: fetchError } = useQuery<BudgetData>({
    queryKey: ['hierarchical-budgets', year],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString()
      })
      const response = await fetch(`/api/budget/hierarchical?${params}`)
      if (!response.ok) throw new Error('Failed to fetch budget data')
      return response.json()
    },
  })

  // Filter budget data based on selected month/quarter
  const budgetData = useMemo(() => {
    if (!allBudgetData || !month) return allBudgetData

    const filteredBudgets = allBudgetData.budgets.filter(budget => {
      if (month > 0) {
        // Specific month
        return budget.month === month
      } else {
        // Quarter
        const quarterMonths: Record<number, number[]> = {
          [-1]: [1, 2, 3],    // Q1
          [-2]: [4, 5, 6],    // Q2
          [-3]: [7, 8, 9],    // Q3
          [-4]: [10, 11, 12]  // Q4
        }
        return quarterMonths[month]?.includes(budget.month) || false
      }
    })

    // Aggregate the filtered data
    const aggregatedByEntity: Record<string, HierarchicalBudget> = {}
    
    filteredBudgets.forEach(budget => {
      const key = `${budget.entityType}_${budget.entityId}`
      if (!aggregatedByEntity[key]) {
        aggregatedByEntity[key] = { ...budget, budgetAmount: 0, actualAmount: 0, previousYearActual: 0 }
      }
      aggregatedByEntity[key].budgetAmount += budget.budgetAmount
      aggregatedByEntity[key].actualAmount += budget.actualAmount
      aggregatedByEntity[key].previousYearActual += budget.previousYearActual
    })

    // Recalculate variance and percentages
    Object.values(aggregatedByEntity).forEach(entity => {
      entity.variance = entity.actualAmount - entity.budgetAmount
      entity.variancePercent = entity.budgetAmount > 0 
        ? ((entity.actualAmount - entity.budgetAmount) / entity.budgetAmount) * 100 
        : 0
      entity.yearOverYearGrowth = entity.previousYearActual > 0
        ? ((entity.actualAmount - entity.previousYearActual) / entity.previousYearActual) * 100
        : 0
    })

    return {
      ...allBudgetData,
      budgets: Object.values(aggregatedByEntity),
      metadata: {
        ...allBudgetData.metadata,
        month: month
      }
    }
  }, [allBudgetData, month])

  // Fetch comparison data for analytics
  const { data: comparisonData } = useQuery({
    queryKey: ['budget-comparison', year, compareYear, 'month'],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        compareYear: compareYear.toString(),
        groupBy: 'month'
      })
      const response = await fetch(`/api/budget/comparison?${params}`)
      if (!response.ok) throw new Error('Failed to fetch comparison data')
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
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to update budgets')
      }
      
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

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (budgetData: {
      entityType: 'advertiser' | 'agency' | 'seller'
      entityId: string
      year: number
      month: number
      budgetAmount: number
      notes?: string
    }) => {
      const response = await fetch('/api/budget/hierarchical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetData),
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to create budget')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-comparison'] })
      setSuccess('Budget entry created successfully')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create budget')
    },
  })

  // Batch delete mutation for developmental goals
  const deleteBudgetsMutation = useMutation({
    mutationFn: async (budgetIds: string[]) => {
      const response = await fetch('/api/budget/hierarchical/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetIds }),
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to delete budgets')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-comparison'] })
      setSelectedDevelopmentalGoals(new Set())
      setSuccess(`Successfully deleted ${data.deletedCount} developmental goal${data.deletedCount > 1 ? 's' : ''}`)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete budgets')
    },
  })

  // Handler for opening developmental goal dialog
  const handleAddDevelopmentalBudget = (sellerId: string) => {
    // Find the seller name from the budget data
    const seller = budgetData?.budgets.find(b => b.sellerId === sellerId)
    const sellerName = seller?.sellerName || 'Unknown Seller'
    
    setDevelopmentalDialog({
      open: true,
      sellerId,
      sellerName,
      monthlyAmount: '833.33',
      isAnnual: !month, // If month is null, we're in annual view
      selectedMonths: []
    })
  }

  // Handler for creating developmental goal after user input
  const handleCreateDevelopmentalGoal = async () => {
    const monthlyAmount = parseFloat(developmentalDialog.monthlyAmount)
    
    if (isNaN(monthlyAmount) || monthlyAmount <= 0) {
      setError('Please enter a valid goal amount')
      return
    }
    
    const targetMonths = developmentalDialog.isAnnual 
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : developmentalDialog.selectedMonths.length > 0 
        ? developmentalDialog.selectedMonths 
        : [month!]
    
    if (targetMonths.length === 0) {
      setError('Please select at least one month')
      return
    }

    try {
      // Create budgets sequentially to avoid race conditions
      for (const m of targetMonths) {
        await new Promise<void>((resolve, reject) => {
          createBudgetMutation.mutate({
            entityType: 'seller',
            entityId: developmentalDialog.sellerId,
            year: year,
            month: m,
            budgetAmount: monthlyAmount,
            notes: 'Developmental business goal - user defined'
          }, {
            onSuccess: () => resolve(),
            onError: (error) => {
              // Ignore "already exists" errors for developmental goals
              if (error.message?.includes('already exists')) {
                console.log(`Budget already exists for month ${m}, skipping...`)
                resolve()
              } else {
                reject(error)
              }
            }
          })
        })
      }
      
      setSuccess(`Developmental goals created for ${targetMonths.length} month${targetMonths.length > 1 ? 's' : ''}`)
      // Close dialog
      setDevelopmentalDialog({
        open: false,
        sellerId: '',
        sellerName: '',
        monthlyAmount: '833.33',
        isAnnual: false,
        selectedMonths: []
      })
    } catch (error: any) {
      setError(error.message || 'Failed to create developmental goals')
    }
  }

  // Helper functions for managing developmental goal selection
  const handleSelectDevelopmentalGoal = (budgetId: string, checked: boolean) => {
    const newSelection = new Set(selectedDevelopmentalGoals)
    if (checked) {
      newSelection.add(budgetId)
    } else {
      newSelection.delete(budgetId)
    }
    setSelectedDevelopmentalGoals(newSelection)
  }

  const handleSelectAllDevelopmentalGoals = (developmentalGoals: any[], checked: boolean) => {
    if (checked) {
      const allIds = new Set(developmentalGoals.map(goal => goal.id))
      setSelectedDevelopmentalGoals(allIds)
    } else {
      setSelectedDevelopmentalGoals(new Set())
    }
  }

  const handleBatchDeleteDevelopmentalGoals = () => {
    if (selectedDevelopmentalGoals.size === 0) return
    
    const budgetIds = Array.from(selectedDevelopmentalGoals)
    deleteBudgetsMutation.mutate(budgetIds)
  }

  // Group budgets based on selected view mode
  const groupedBudgets = useMemo(() => {
    if (!budgetData?.budgets) return {}

    console.log(`[DEBUG] Grouping ${budgetData.budgets.length} budgets by ${viewMode}`)
    
    let grouped = {}
    switch (viewMode) {
      case 'seller':
        grouped = groupBySeller(budgetData.budgets)
        break
      case 'agency':
        grouped = groupByAgency(budgetData.budgets)
        break
      case 'advertiser':
        grouped = groupByAdvertiser(budgetData.budgets)
        break
      default:
        grouped = groupBySeller(budgetData.budgets)
    }
    
    console.log(`[DEBUG] Grouped into ${Object.keys(grouped).length} ${viewMode} groups`)
    return grouped
  }, [budgetData, viewMode])

  const formatCurrency = (value: number, showSign: boolean = false) => {
    const absValue = Math.abs(value)
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absValue)
    
    if (showSign && value !== 0) {
      const result = value > 0 ? `+${formatted}` : `-${formatted}`
      return result
    }
    return value < 0 ? `-${formatted}` : formatted
  }

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0.0%'
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getVarianceColor = (variance: number, budget: number) => {
    if (budget === 0) return 'default'
    const percent = Math.abs(variance / budget) * 100
    if (percent < 10) return 'success'
    if (percent < 20) return 'warning'
    return 'error'
  }

  // Calculate pacing status based on budget performance vs time elapsed
  const getPacingStatus = (budgetAmount: number, actualAmount: number, year: number, month: number | null) => {
    if (budgetAmount === 0) return { label: 'No Budget', color: 'default' as const, percentage: 0 }
    
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed
    
    let expectedProgress: number
    
    if (month) {
      // For specific month budgets, we're either at the end of the month or past it
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        expectedProgress = 1.0 // Should be 100% complete
      } else if (year === currentYear && month === currentMonth) {
        // For current month, calculate based on days elapsed
        const daysInMonth = new Date(year, month, 0).getDate()
        const currentDay = now.getDate()
        expectedProgress = Math.min(currentDay / daysInMonth, 1.0)
      } else {
        expectedProgress = 0 // Future month
      }
    } else {
      // For annual budgets, calculate based on months elapsed
      if (year < currentYear) {
        expectedProgress = 1.0 // Should be 100% complete
      } else if (year === currentYear) {
        expectedProgress = Math.min((currentMonth - 1) / 12, 1.0) // -1 because we're partway through current month
      } else {
        expectedProgress = 0 // Future year
      }
    }
    
    const actualProgress = actualAmount / budgetAmount
    const pacingRatio = expectedProgress > 0 ? actualProgress / expectedProgress : 0
    const percentage = Math.round(pacingRatio * 100)
    
    // Determine pacing status with 5% tolerance bands for "On Pace"
    if (pacingRatio >= 1.05) {
      return { label: `${percentage}%`, color: 'success' as const, percentage }
    } else if (pacingRatio >= 0.95) {
      return { label: `${percentage}%`, color: 'info' as const, percentage }
    } else {
      return { label: `${percentage}%`, color: 'warning' as const, percentage }
    }
  }

  // Calculate pacing to goal (actual vs budget percentage)
  const getPacingToGoal = (budgetAmount: number, actualAmount: number) => {
    if (budgetAmount === 0) return { label: 'No Goal', color: 'default' as const, percentage: 0 }
    
    const percentage = Math.round((actualAmount / budgetAmount) * 100)
    
    // Color coding based on performance vs goal
    if (percentage >= 100) {
      return { label: `${percentage}%`, color: 'success' as const, percentage }
    } else if (percentage >= 90) {
      return { label: `${percentage}%`, color: 'info' as const, percentage }
    } else {
      return { label: `${percentage}%`, color: 'warning' as const, percentage }
    }
  }

  const getPacingAheadCount = (groupedData: any, viewMode: ViewMode) => {
    let pacingAheadCount = 0
    
    switch (viewMode) {
      case 'seller':
        Object.values(groupedData).forEach((sellerData: any) => {
          // Calculate aggregated totals for the seller
          const allManagedBudgets = [
            ...Object.values(sellerData.agencies).flatMap((agency: any) => agency.advertisers),
            ...sellerData.directAdvertisers,
            ...sellerData.seller.budgets
          ]
          const aggregatedTotals = allManagedBudgets.reduce((totals: any, budget: any) => ({
            budgetAmount: totals.budgetAmount + (budget.budgetAmount || 0),
            actualAmount: totals.actualAmount + (budget.actualAmount || 0)
          }), { budgetAmount: 0, actualAmount: 0 })
          
          const pacing = getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month)
          if (pacing.color === 'success') pacingAheadCount++
        })
        break
      case 'agency':
        Object.values(groupedData).forEach((agencyData: any) => {
          const agencyTotals = agencyData.advertisers.reduce((totals: any, advertiser: any) => ({
            budgetAmount: totals.budgetAmount + (advertiser.budgetAmount || 0),
            actualAmount: totals.actualAmount + (advertiser.actualAmount || 0)
          }), { budgetAmount: 0, actualAmount: 0 })
          
          const pacing = getPacingStatus(agencyTotals.budgetAmount, agencyTotals.actualAmount, year, month)
          if (pacing.color === 'success') pacingAheadCount++
        })
        break
      case 'advertiser':
        Object.values(groupedData).forEach((advertiserData: any) => {
          const advertiser = advertiserData.advertiser
          const pacing = getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month)
          if (pacing.color === 'success') pacingAheadCount++
        })
        break
    }
    
    return pacingAheadCount
  }

  const getPacingBehindCount = (groupedData: any, viewMode: ViewMode) => {
    let pacingBehindCount = 0
    
    switch (viewMode) {
      case 'seller':
        Object.values(groupedData).forEach((sellerData: any) => {
          // Calculate aggregated totals for the seller
          const allManagedBudgets = [
            ...Object.values(sellerData.agencies).flatMap((agency: any) => agency.advertisers),
            ...sellerData.directAdvertisers,
            ...sellerData.seller.budgets
          ]
          const aggregatedTotals = allManagedBudgets.reduce((totals: any, budget: any) => ({
            budgetAmount: totals.budgetAmount + (budget.budgetAmount || 0),
            actualAmount: totals.actualAmount + (budget.actualAmount || 0)
          }), { budgetAmount: 0, actualAmount: 0 })
          
          const pacing = getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month)
          if (pacing.color === 'warning') pacingBehindCount++
        })
        break
      case 'agency':
        Object.values(groupedData).forEach((agencyData: any) => {
          const agencyTotals = agencyData.advertisers.reduce((totals: any, advertiser: any) => ({
            budgetAmount: totals.budgetAmount + (advertiser.budgetAmount || 0),
            actualAmount: totals.actualAmount + (advertiser.actualAmount || 0)
          }), { budgetAmount: 0, actualAmount: 0 })
          
          const pacing = getPacingStatus(agencyTotals.budgetAmount, agencyTotals.actualAmount, year, month)
          if (pacing.color === 'warning') pacingBehindCount++
        })
        break
      case 'advertiser':
        Object.values(groupedData).forEach((advertiserData: any) => {
          const advertiser = advertiserData.advertiser
          const pacing = getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month)
          if (pacing.color === 'warning') pacingBehindCount++
        })
        break
    }
    
    return pacingBehindCount
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

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Helper functions for grouping data
  function groupBySeller(budgets: HierarchicalBudget[]) {
    const grouped: Record<string, {
      seller: { id: string; name: string; budgets: HierarchicalBudget[] }
      agencies: Record<string, { info: any; budgets: HierarchicalBudget[]; advertisers: HierarchicalBudget[] }>
      directAdvertisers: HierarchicalBudget[]
      developmentalBusiness: {
        goals: HierarchicalBudget[]
        totalBudget: number
        totalActual: number
        variance: number
        accountsWithBillingButNoGoals: HierarchicalBudget[]
      }
    }> = {}

    budgets.forEach(budget => {
      if (!grouped[budget.sellerId]) {
        grouped[budget.sellerId] = {
          seller: { id: budget.sellerId, name: budget.sellerName, budgets: [] },
          agencies: {},
          directAdvertisers: [],
          developmentalBusiness: {
            goals: [],
            totalBudget: 0,
            totalActual: 0,
            variance: 0,
            accountsWithBillingButNoGoals: []
          }
        }
      }

      const sellerGroup = grouped[budget.sellerId]

      if (budget.entityType === 'seller') {
        // Only process developmental business goals for sellers
        // Personal seller budgets (non-developmental) are being ignored per user feedback
        if (budget.notes?.toLowerCase().includes('developmental business')) {
          sellerGroup.developmentalBusiness.goals.push(budget)
          sellerGroup.developmentalBusiness.totalBudget += budget.budgetAmount || 0
          sellerGroup.developmentalBusiness.totalActual += budget.actualAmount || 0
          sellerGroup.developmentalBusiness.variance += budget.variance || 0
        }
        // Ignore non-developmental seller budgets entirely
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

    // Auto-move accounts with actual billing AND no existing goal to Developmental Business section
    Object.values(grouped).forEach(sellerGroup => {
      const { agencies, directAdvertisers, developmentalBusiness } = sellerGroup
      
      // Check agency advertisers
      Object.values(agencies).forEach(agency => {
        agency.advertisers = agency.advertisers.filter(advertiser => {
          // If advertiser has actual billing but no budget amount (no goal), move to developmental
          if (advertiser.actualAmount > 0 && advertiser.budgetAmount === 0) {
            developmentalBusiness.accountsWithBillingButNoGoals.push(advertiser)
            developmentalBusiness.totalActual += advertiser.actualAmount || 0
            return false // Remove from agency advertisers
          }
          // Filter out advertisers with neither goal nor actual spend (they shouldn't appear anywhere)
          if (advertiser.actualAmount === 0 && advertiser.budgetAmount === 0) {
            return false // Remove completely - don't show anywhere
          }
          return true // Keep in agency advertisers (has either goal or actual)
        })
      })
      
      // Check direct advertisers  
      sellerGroup.directAdvertisers = directAdvertisers.filter(advertiser => {
        // If advertiser has actual billing but no budget amount (no goal), move to developmental
        if (advertiser.actualAmount > 0 && advertiser.budgetAmount === 0) {
          developmentalBusiness.accountsWithBillingButNoGoals.push(advertiser)
          developmentalBusiness.totalActual += advertiser.actualAmount || 0
          return false // Remove from direct advertisers
        }
        // Filter out advertisers with neither goal nor actual spend (they shouldn't appear anywhere)
        if (advertiser.actualAmount === 0 && advertiser.budgetAmount === 0) {
          return false // Remove completely - don't show anywhere
        }
        return true // Keep in direct advertisers (has either goal or actual)
      })
    })

    return grouped
  }

  function groupByAgency(budgets: HierarchicalBudget[]) {
    const grouped: Record<string, {
      agency: { id: string; name: string; sellerId: string; sellerName: string; budgets: HierarchicalBudget[] }
      advertisers: HierarchicalBudget[]
    }> = {}

    // First, get all agency budgets
    const agencyBudgets = budgets.filter(b => b.entityType === 'agency')
    
    // Create groups for each agency
    agencyBudgets.forEach(budget => {
      if (!grouped[budget.entityId]) {
        grouped[budget.entityId] = {
          agency: { 
            id: budget.entityId, 
            name: budget.entityName, 
            sellerId: budget.sellerId,
            sellerName: budget.sellerName,
            budgets: [] 
          },
          advertisers: []
        }
      }
      grouped[budget.entityId].agency.budgets.push(budget)
    })

    // Now add advertisers to their respective agencies
    budgets.forEach(budget => {
      if (budget.entityType === 'advertiser' && budget.agencyId && grouped[budget.agencyId]) {
        grouped[budget.agencyId].advertisers.push(budget)
      }
    })

    return grouped
  }

  function groupByAdvertiser(budgets: HierarchicalBudget[]) {
    const grouped: Record<string, {
      advertiser: HierarchicalBudget
      seller: { id: string; name: string }
      agency?: { id: string; name: string }
    }> = {}

    budgets.forEach(budget => {
      if (budget.entityType === 'advertiser') {
        grouped[budget.entityId] = {
          advertiser: budget,
          seller: { id: budget.sellerId, name: budget.sellerName },
          agency: budget.agencyId ? { id: budget.agencyId, name: budget.agencyName! } : undefined
        }
      }
    })

    return grouped
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

  const summary: ComparisonSummary = comparisonData?.summary ? {
    totalCurrentBudget: comparisonData.summary.totalCurrentBudget ?? budgetData?.rollups?.grandTotals?.totalBudget ?? 0,
    totalCurrentActual: comparisonData.summary.totalCurrentActual ?? budgetData?.rollups?.grandTotals?.totalActual ?? 0,
    totalPreviousActual: comparisonData.summary.totalPreviousActual ?? 0,
    overallVariance: comparisonData.summary.overallVariance ?? budgetData?.rollups?.grandTotals?.variance ?? 0,
    overallYoYGrowth: comparisonData.summary.overallYoYGrowth ?? 0,
    sellersOnTarget: comparisonData.summary.sellersOnTarget ?? 0,
    sellersOffTarget: comparisonData.summary.sellersOffTarget ?? 0,
    periodsAnalyzed: comparisonData.summary.periodsAnalyzed ?? 0,
    bestPeriod: comparisonData.summary.bestPeriod ?? null,
    worstPeriod: comparisonData.summary.worstPeriod ?? null
  } : {
    totalCurrentBudget: budgetData?.rollups?.grandTotals?.totalBudget || 0,
    totalCurrentActual: budgetData?.rollups?.grandTotals?.totalActual || 0,
    totalPreviousActual: 0,
    overallVariance: budgetData?.rollups?.grandTotals?.variance || 0,
    overallYoYGrowth: 0,
    sellersOnTarget: 0,
    sellersOffTarget: 0,
    periodsAnalyzed: 0,
    bestPeriod: null,
    worstPeriod: null
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
              <InputLabel>Period</InputLabel>
              <Select
                value={month || ''}
                onChange={(e) => setMonth(e.target.value ? e.target.value as number : null)}
                label="Period"
              >
                <MenuItem value="">All Months</MenuItem>
                <MenuItem disabled sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  ─── Quarters ───
                </MenuItem>
                <MenuItem value={-1}>Q1 (Jan-Mar)</MenuItem>
                <MenuItem value={-2}>Q2 (Apr-Jun)</MenuItem>
                <MenuItem value={-3}>Q3 (Jul-Sep)</MenuItem>
                <MenuItem value={-4}>Q4 (Oct-Dec)</MenuItem>
                <MenuItem disabled sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  ─── Months ───
                </MenuItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newViewMode) => newViewMode && setViewMode(newViewMode)}
              size="small"
            >
              <ToggleButton value="seller">
                <Person sx={{ mr: 1 }} />
                Seller
              </ToggleButton>
              <ToggleButton value="agency">
                <Business sx={{ mr: 1 }} />
                Agency
              </ToggleButton>
              <ToggleButton value="advertiser">
                <AccountBalance sx={{ mr: 1 }} />
                Advertiser
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>


          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                startIcon={<Refresh />}
                onClick={() => refreshCacheMutation.mutate()}
                disabled={refreshCacheMutation.isPending}
                size="small"
              >
                Refresh
              </Button>
              
              {!editMode && canEdit && (
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

      {/* Analytics Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography color="textSecondary" gutterBottom>
                Current Year Performance
              </Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" color="primary.main">
                  {formatCurrency(summary.totalCurrentActual)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs {formatCurrency(summary.totalCurrentBudget)} budgeted
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {summary.overallVariance >= 0 ? (
                  <TrendingUp color="success" sx={{ mr: 0.5 }} />
                ) : (
                  <TrendingDown color="error" sx={{ mr: 0.5 }} />
                )}
                <Typography 
                  variant="body2" 
                  color={summary.overallVariance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(summary.overallVariance)} budget
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography color="textSecondary" gutterBottom>
                Year-over-Year Growth
              </Typography>
              <Box sx={{ flex: 1 }}>
                <Typography 
                  variant="h5" 
                  color={summary.overallYoYGrowth >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatPercent(summary.overallYoYGrowth)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs {formatCurrency(summary.totalPreviousActual)} in {compareYear}
                </Typography>
              </Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: (summary.totalCurrentActual - summary.totalPreviousActual) > 0 ? 'success.main' : 
                         (summary.totalCurrentActual - summary.totalPreviousActual) < 0 ? 'error.main' : 
                         'text.secondary' 
                }}
              >
                Growth: {formatCurrency(summary.totalCurrentActual - summary.totalPreviousActual)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography color="textSecondary" gutterBottom>
                {viewMode === 'seller' ? 'Seller' : viewMode === 'agency' ? 'Agency' : 'Advertiser'} Performance
              </Typography>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip 
                    label={`${getPacingAheadCount(groupedBudgets, viewMode)} Pacing Ahead`}
                    color="success" 
                    size="small" 
                  />
                  <Chip 
                    label={`${getPacingBehindCount(groupedBudgets, viewMode)} Pacing Behind`}
                    color="error" 
                    size="small" 
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total: {Object.keys(groupedBudgets).length} {viewMode}s
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Performance tracking for {year}{month ? (month > 0 ? ` - ${new Date(2024, month - 1).toLocaleString('default', { month: 'long' })}` : ` - Q${Math.abs(month)}`) : ''}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography color="textSecondary" gutterBottom>
                Budget Overview
              </Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" color="primary.main">
                  {formatCurrency(budgetData?.rollups?.grandTotals?.totalBudget || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Budget ({year})
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Last updated: {budgetData?.metadata?.lastCacheUpdate ? new Date(budgetData.metadata.lastCacheUpdate).toLocaleDateString() : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Budget Data Table */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Goal Planning - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View ({year})
          </Typography>

          <Box>
            {/* Custom header that matches Grid column widths */}
            <Box sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2, pr: 1 }}>
                <Grid item xs={2.5}>
                  <Typography variant="subtitle2" fontWeight="bold">Entity</Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="subtitle2" fontWeight="bold" align="center">Goal</Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="subtitle2" fontWeight="bold" align="center">Actual</Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="subtitle2" fontWeight="bold" align="center">Percent to Goal</Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="subtitle2" fontWeight="bold" align="center">Gap to Goal</Typography>
                </Grid>
                <Grid item xs={1.3}>
                  <Typography variant="subtitle2" fontWeight="bold" align="left">Pacing to Goal</Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="subtitle2" fontWeight="bold" align="center">Prev Year</Typography>
                </Grid>
                <Grid item xs={1.4}>
                  <Typography variant="subtitle2" fontWeight="bold" align="left">Pacing vs PY</Typography>
                </Grid>
              </Grid>
            </Box>
            
            {/* Table body */}
            <TableContainer>
              <Table>
                <TableBody>
                  {renderTableRows(groupedBudgets, viewMode, expandedItems, toggleItemExpanded, editMode, editedBudgets, handleCellEdit, showComparison, formatCurrency, formatPercent, getVarianceColor, getPacingStatus, getPacingToGoal, getPercentToGoal, year, month, handleAddDevelopmentalBudget, selectedDevelopmentalGoals, handleSelectDevelopmentalGoal, handleSelectAllDevelopmentalGoals, handleBatchDeleteDevelopmentalGoals, deleteBudgetsMutation.isPending)}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Developmental Goal Dialog */}
      <Dialog
        open={developmentalDialog.open}
        onClose={() => setDevelopmentalDialog({ ...developmentalDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Developmental Goal for {developmentalDialog.sellerName}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {developmentalDialog.isAnnual 
              ? `Enter the monthly goal amount. This will create goals for all 12 months of ${year}.`
              : developmentalDialog.selectedMonths.length > 0
                ? `Enter the goal amount for ${developmentalDialog.selectedMonths.length} selected month${developmentalDialog.selectedMonths.length > 1 ? 's' : ''}.`
                : `Enter the goal amount for ${month ? new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'the selected period'}.`
            }
          </Typography>
          
          <TextField
            autoFocus
            label="Monthly Goal Amount ($)"
            type="number"
            value={developmentalDialog.monthlyAmount}
            onChange={(e) => setDevelopmentalDialog({ 
              ...developmentalDialog, 
              monthlyAmount: e.target.value 
            })}
            fullWidth
            variant="outlined"
            inputProps={{
              min: 0,
              step: 0.01
            }}
            sx={{ mt: 1, mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={developmentalDialog.isAnnual}
                onChange={(e) => setDevelopmentalDialog({ 
                  ...developmentalDialog, 
                  isAnnual: e.target.checked,
                  selectedMonths: e.target.checked ? [] : developmentalDialog.selectedMonths
                })}
              />
            }
            label="Apply to entire year (all 12 months)"
            sx={{ mb: 2 }}
          />
          
          {!developmentalDialog.isAnnual && (
            <>
              <Divider sx={{ my: 2 }} />
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 'bold' }}>
                Select Months (leave empty to use current month only)
              </FormLabel>
              <FormGroup row>
                {[
                  { value: 1, label: 'Jan' },
                  { value: 2, label: 'Feb' },
                  { value: 3, label: 'Mar' },
                  { value: 4, label: 'Apr' },
                  { value: 5, label: 'May' },
                  { value: 6, label: 'Jun' },
                  { value: 7, label: 'Jul' },
                  { value: 8, label: 'Aug' },
                  { value: 9, label: 'Sep' },
                  { value: 10, label: 'Oct' },
                  { value: 11, label: 'Nov' },
                  { value: 12, label: 'Dec' }
                ].map((monthData) => (
                  <FormControlLabel
                    key={monthData.value}
                    control={
                      <Checkbox
                        checked={developmentalDialog.selectedMonths.includes(monthData.value)}
                        onChange={(e) => {
                          const newSelectedMonths = e.target.checked
                            ? [...developmentalDialog.selectedMonths, monthData.value]
                            : developmentalDialog.selectedMonths.filter(m => m !== monthData.value)
                          setDevelopmentalDialog({
                            ...developmentalDialog,
                            selectedMonths: newSelectedMonths.sort((a, b) => a - b)
                          })
                        }}
                        size="small"
                      />
                    }
                    label={monthData.label}
                    sx={{ minWidth: '80px' }}
                  />
                ))}
              </FormGroup>
            </>
          )}
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            {developmentalDialog.isAnnual ? (
              <>Annual total: ${(parseFloat(developmentalDialog.monthlyAmount || '0') * 12).toLocaleString()}</>
            ) : developmentalDialog.selectedMonths.length > 0 ? (
              <>Total for {developmentalDialog.selectedMonths.length} months: ${(parseFloat(developmentalDialog.monthlyAmount || '0') * developmentalDialog.selectedMonths.length).toLocaleString()}</>
            ) : (
              <>Amount for selected month: ${parseFloat(developmentalDialog.monthlyAmount || '0').toLocaleString()}</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDevelopmentalDialog({ ...developmentalDialog, open: false })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateDevelopmentalGoal}
            variant="contained"
            disabled={!developmentalDialog.monthlyAmount || parseFloat(developmentalDialog.monthlyAmount) <= 0}
          >
            Create Goal
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// Calculate simple percent to goal (actual / goal * 100)
function getPercentToGoal(budgetAmount: number, actualAmount: number) {
  if (budgetAmount === 0) return { label: '—', color: 'default' as const, percentage: 0 }
  
  const percentage = Math.round((actualAmount / budgetAmount) * 100)
  const cappedPercentage = Math.min(percentage, 999) // Cap at 999%
  
  // Color coding based on achievement level
  if (cappedPercentage >= 100) {
    return { label: `${cappedPercentage}%`, color: 'success' as const, percentage: cappedPercentage }
  } else if (cappedPercentage >= 80) {
    return { label: `${cappedPercentage}%`, color: 'info' as const, percentage: cappedPercentage }
  } else if (cappedPercentage >= 50) {
    return { label: `${cappedPercentage}%`, color: 'warning' as const, percentage: cappedPercentage }
  } else {
    return { label: `${cappedPercentage}%`, color: 'error' as const, percentage: cappedPercentage }
  }
}

// Helper function to render table rows based on view mode
function renderTableRows(groupedData: any, viewMode: ViewMode, expandedItems: Set<string>, toggleItemExpanded: (id: string) => void, editMode: boolean, editedBudgets: any, handleCellEdit: any, showComparison: boolean, formatCurrency: any, formatPercent: any, getVarianceColor: any, getPacingStatus: any, getPacingToGoal: any, getPercentToGoal: any, year: number, month: number | null, handleAddDevelopmentalBudget?: (sellerId: string) => void, selectedDevelopmentalGoals?: Set<string>, handleSelectDevelopmentalGoal?: (budgetId: string, checked: boolean) => void, handleSelectAllDevelopmentalGoals?: (goals: any[], checked: boolean) => void, handleBatchDeleteDevelopmentalGoals?: () => void, isDeleting?: boolean) {
  const rows: React.ReactNode[] = []

  switch (viewMode) {
    case 'seller':
      Object.entries(groupedData).forEach(([sellerId, sellerData]: [string, any]) => {
        rows.push(renderSellerRow(sellerId, sellerData, expandedItems, toggleItemExpanded, editMode, editedBudgets, handleCellEdit, showComparison, formatCurrency, formatPercent, getVarianceColor, getPacingStatus, getPacingToGoal, getPercentToGoal, year, month, handleAddDevelopmentalBudget!, selectedDevelopmentalGoals!, handleSelectDevelopmentalGoal!, handleSelectAllDevelopmentalGoals!, handleBatchDeleteDevelopmentalGoals!, isDeleting!))
      })
      break
    case 'agency':
      Object.entries(groupedData).forEach(([agencyId, agencyData]: [string, any]) => {
        rows.push(renderAgencyRow(agencyId, agencyData, expandedItems, toggleItemExpanded, editMode, editedBudgets, handleCellEdit, showComparison, formatCurrency, formatPercent, getVarianceColor, getPacingStatus, getPacingToGoal, getPercentToGoal, year, month))
      })
      break
    case 'advertiser':
      Object.entries(groupedData).forEach(([advertiserId, advertiserData]: [string, any]) => {
        rows.push(renderAdvertiserRow(advertiserId, advertiserData, editMode, editedBudgets, handleCellEdit, showComparison, formatCurrency, formatPercent, getVarianceColor, getPacingStatus, getPacingToGoal, getPercentToGoal, year, month))
      })
      break
  }

  return rows
}

function renderSellerRow(sellerId: string, sellerData: any, expandedItems: Set<string>, toggleItemExpanded: (id: string) => void, editMode: boolean, editedBudgets: any, handleCellEdit: any, showComparison: boolean, formatCurrency: any, formatPercent: any, getVarianceColor: any, getPacingStatus: any, getPacingToGoal: any, getPercentToGoal: any, year: number, month: number | null, handleAddDevelopmentalBudget: (sellerId: string) => void, selectedDevelopmentalGoals: Set<string>, handleSelectDevelopmentalGoal: (budgetId: string, checked: boolean) => void, handleSelectAllDevelopmentalGoals: (goals: any[], checked: boolean) => void, handleBatchDeleteDevelopmentalGoals: () => void, isDeleting: boolean) {
  const isExpanded = expandedItems.has(sellerId)
  
  // Calculate seller aggregated totals from all managed entities
  // Important: The data structure has agencies with "advertisers" array that contains agency budget data
  // We need to collect:
  // 1. Agency budgets (from agency.advertisers array - $122k + $98k = $220k)
  // 2. Direct advertiser budgets ($65k)
  // 3. Developmental budgets ($100k)
  // We should NOT include personal seller budgets ($15k) based on user requirement
  // Expected total: $220k + $65k + $100k = $385k
  
  let agencyBudgets: any[] = []
  Object.values(sellerData.agencies).forEach((agency: any) => {
    // The "advertisers" array in agency actually contains the agency's budget entries
    if (agency.advertisers && Array.isArray(agency.advertisers)) {
      agencyBudgets = [...agencyBudgets, ...agency.advertisers]
    }
  })
  
  const directAdvertiserBudgets = sellerData.directAdvertisers || []
  // Get developmental goals from the developmentalBusiness structure
  const developmentalBudgets = sellerData.developmentalBusiness?.goals || []
  
  // Debug logging to understand the totals
  console.log('Seller Budget Breakdown:', {
    sellerName: sellerData.seller.name,
    agencies: Object.entries(sellerData.agencies).map(([id, a]: [string, any]) => ({
      id,
      name: a.info?.entityName || a.name,
      advertisersCount: a.advertisers?.length || 0,
      total: (a.advertisers || []).reduce((sum: number, b: any) => sum + (Number(b.budgetAmount) || 0), 0)
    })),
    agencyBudgetTotal: agencyBudgets.reduce((sum: number, b: any) => sum + (Number(b.budgetAmount) || 0), 0),
    directAdvertiserTotal: directAdvertiserBudgets.reduce((sum: number, b: any) => sum + (Number(b.budgetAmount) || 0), 0),
    developmentalTotal: developmentalBudgets.reduce((sum: number, b: any) => sum + (Number(b.budgetAmount) || 0), 0),
    developmentalBusiness: sellerData.developmentalBusiness,
    personalSellerBudgets: sellerData.seller.budgets?.length || 0,
    personalSellerTotal: (sellerData.seller.budgets || []).reduce((sum: number, b: any) => sum + (Number(b.budgetAmount) || 0), 0)
  })
  
  // For rollup calculation, include only managed entity budgets, not personal seller budgets
  const allManagedBudgets = [
    ...agencyBudgets,
    ...directAdvertiserBudgets,
    ...developmentalBudgets
  ]
  
  const aggregatedTotals = allManagedBudgets.reduce((totals: any, budget: any) => ({
    budgetAmount: totals.budgetAmount + (Number(budget.budgetAmount) || 0),
    actualAmount: totals.actualAmount + (Number(budget.actualAmount) || 0),
    variance: totals.variance + ((Number(budget.actualAmount) || 0) - (Number(budget.budgetAmount) || 0)),
    previousYearActual: totals.previousYearActual + (Number(budget.previousYearActual) || 0)
  }), { 
    budgetAmount: 0, 
    actualAmount: 0, 
    variance: 0, 
    previousYearActual: 0 
  })
  
  return (
    <React.Fragment key={sellerId}>
      <TableRow sx={{ bgcolor: 'action.hover' }}>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Box sx={{ py: 1.5 }}>
            <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2, pr: 1 }}>
              <Grid item xs={2.5}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={() => toggleItemExpanded(sellerId)}
                  >
                    {isExpanded ? <ExpandMore /> : <ChevronRight />}
                  </IconButton>
                  <Person sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" fontWeight="bold">
                    {sellerData.seller.name}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={1.2}>
                <Tooltip title="Totals reflect the sum of all underlying accounts and developmental goals. To adjust, edit at the account level.">
                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(aggregatedTotals.budgetAmount)}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
              <Grid item xs={1.2}>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(aggregatedTotals.actualAmount)}
                </Typography>
              </Grid>
              <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPercentToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).label}
                  color={getPercentToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).color}
                  size="small"
                  variant="filled"
                />
              </Grid>
              <Grid item xs={1.2}>
                <Typography 
                  variant="body2"
                  fontWeight="bold"
                  sx={{ 
                    color: (aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount) < 0 ? 'success.main' : 
                           (aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount) > 0 ? 'error.main' : 
                           'text.primary' 
                  }}
                >
                  {formatCurrency(Math.abs(aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount))}
                </Typography>
              </Grid>
              <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPacingToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).label}
                  color={getPacingToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).color}
                  size="small"
                />
              </Grid>
              <Grid item xs={1.2}>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(aggregatedTotals.previousYearActual)}
                </Typography>
              </Grid>
              <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month).label}
                  color={getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month).color}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        </TableCell>
      </TableRow>
      
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              {/* Render agencies */}
              {Object.entries(sellerData.agencies).map(([agencyId, agency]: [string, any]) => {
                // Calculate agency totals
                const agencyTotals = agency.advertisers.reduce((totals: any, advertiser: any) => ({
                  budgetAmount: totals.budgetAmount + (advertiser.budgetAmount || 0),
                  actualAmount: totals.actualAmount + (advertiser.actualAmount || 0),
                  variance: totals.variance + ((advertiser.actualAmount || 0) - (advertiser.budgetAmount || 0))
                }), { budgetAmount: 0, actualAmount: 0, variance: 0 })
                
                return (
                  <Box key={agencyId} sx={{ mb: 1 }}>
                    <Grid container spacing={0.5} alignItems="center" sx={{ pl: 1, mb: 0.5 }}>
                      <Grid item xs={2.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Business sx={{ mr: 1, color: 'secondary.main' }} />
                          <Typography variant="subtitle2" color="secondary.main">
                            {agency.info.entityName || 'Unknown Agency'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={1.2}>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(agencyTotals.budgetAmount)}
                        </Typography>
                      </Grid>
                      <Grid item xs={1.2}>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(agencyTotals.actualAmount)}
                        </Typography>
                      </Grid>
                      <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip
                          label={getPercentToGoal(agencyTotals.budgetAmount, agencyTotals.actualAmount).label}
                          color={getPercentToGoal(agencyTotals.budgetAmount, agencyTotals.actualAmount).color}
                          size="small"
                          variant="filled"
                        />
                      </Grid>
                      <Grid item xs={1.2}>
                        <Typography 
                          variant="body2" 
                          fontWeight="medium"
                          sx={{ 
                            color: (agencyTotals.budgetAmount - agencyTotals.actualAmount) < 0 ? 'success.main' : 
                                   (agencyTotals.budgetAmount - agencyTotals.actualAmount) > 0 ? 'error.main' : 
                                   'text.primary' 
                          }}
                        >
                          {formatCurrency(Math.abs(agencyTotals.budgetAmount - agencyTotals.actualAmount))}
                        </Typography>
                      </Grid>
                      <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip
                          label={getPacingToGoal(agencyTotals.budgetAmount, agencyTotals.actualAmount).label}
                          color={getPacingToGoal(agencyTotals.budgetAmount, agencyTotals.actualAmount).color}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={1.2}>
                        <Typography variant="body2" fontWeight="medium">
                          {/* Add previous year actual if available */}
                          {formatCurrency(0)}
                        </Typography>
                      </Grid>
                      <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip
                          label={getPacingStatus(agencyTotals.budgetAmount, agencyTotals.actualAmount, year, month).label}
                          color={getPacingStatus(agencyTotals.budgetAmount, agencyTotals.actualAmount, year, month).color}
                          size="small"
                        />
                      </Grid>
                    </Grid>
                  
                  {/* Agency Advertisers */}
                  {agency.advertisers.map((advertiser: any) => (
                    <Box key={advertiser.id} sx={{ mb: 0.5 }}>
                      <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2 }}>
                        <Grid item xs={2.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccountBalance sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {advertiser.entityName}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={1.2}>
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
                        <Grid item xs={1.2}>
                          <Typography variant="body2">
                            {formatCurrency(advertiser.actualAmount)}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                            color={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                            size="small"
                            variant="filled"
                          />
                        </Grid>
                        <Grid item xs={1.2}>
                          <Typography 
                            variant="body2"
                            sx={{ 
                              color: (advertiser.budgetAmount - advertiser.actualAmount) < 0 ? 'success.main' : 
                                     (advertiser.budgetAmount - advertiser.actualAmount) > 0 ? 'error.main' : 
                                     'text.primary' 
                            }}
                          >
                            {formatCurrency(Math.abs(advertiser.budgetAmount - advertiser.actualAmount))}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                            color={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={1.2}>
                          <Typography variant="body2">
                            {formatCurrency(advertiser.previousYearActual)}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).label}
                            color={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).color}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                  </Box>
                )
              })}

              {/* Direct Advertisers */}
              {sellerData.directAdvertisers.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, pl: 2 }}>
                    Direct Advertisers
                  </Typography>
                  {sellerData.directAdvertisers.map((advertiser: any) => (
                    <Box key={advertiser.id} sx={{ mb: 0.5 }}>
                      <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2 }}>
                        <Grid item xs={2.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccountBalance sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {advertiser.entityName} (Direct)
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={1.2}>
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
                        <Grid item xs={1.2}>
                          <Typography variant="body2">
                            {formatCurrency(advertiser.actualAmount)}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                            color={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                            size="small"
                            variant="filled"
                          />
                        </Grid>
                        <Grid item xs={1.2}>
                          <Typography 
                            variant="body2"
                            sx={{ 
                              color: (advertiser.budgetAmount - advertiser.actualAmount) < 0 ? 'success.main' : 
                                     (advertiser.budgetAmount - advertiser.actualAmount) > 0 ? 'error.main' : 
                                     'text.primary' 
                            }}
                          >
                            {formatCurrency(Math.abs(advertiser.budgetAmount - advertiser.actualAmount))}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                            color={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={1.2}>
                          <Typography variant="body2">
                            {formatCurrency(advertiser.previousYearActual)}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).label}
                            color={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).color}
                            size="small"
                          />
                        </Grid>
                  </Grid>
                </Box>
                ))}
                </Box>
              )}

              {/* Developmental Business Goal */}
              {renderDevelopmentalBusinessSection(sellerId, sellerData, expandedItems, toggleItemExpanded, editMode, editedBudgets, handleCellEdit, showComparison, formatCurrency, getPacingStatus, getPacingToGoal, year, month, handleAddDevelopmentalBudget, selectedDevelopmentalGoals, handleSelectDevelopmentalGoal, handleSelectAllDevelopmentalGoals, handleBatchDeleteDevelopmentalGoals, isDeleting)}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  )
}

function renderAgencyRow(agencyId: string, agencyData: any, expandedItems: Set<string>, toggleItemExpanded: (id: string) => void, editMode: boolean, editedBudgets: any, handleCellEdit: any, showComparison: boolean, formatCurrency: any, formatPercent: any, getVarianceColor: any, getPacingStatus: any, getPacingToGoal: any, getPercentToGoal: any, year: number, month: number | null) {
  const isExpanded = expandedItems.has(agencyId)
  
  // Calculate agency aggregated totals from all advertisers
  const aggregatedTotals = agencyData.advertisers.reduce((totals: any, advertiser: any) => ({
    budgetAmount: totals.budgetAmount + (advertiser.budgetAmount || 0),
    actualAmount: totals.actualAmount + (advertiser.actualAmount || 0),
    variance: totals.variance + ((advertiser.actualAmount || 0) - (advertiser.budgetAmount || 0)),
    previousYearActual: totals.previousYearActual + (advertiser.previousYearActual || 0)
  }), { budgetAmount: 0, actualAmount: 0, variance: 0, previousYearActual: 0 })
  
  return (
    <React.Fragment key={agencyId}>
      <TableRow sx={{ bgcolor: 'action.hover' }}>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Box sx={{ py: 1.5 }}>
            <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2, pr: 1 }}>
              <Grid item xs={2.5}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={() => toggleItemExpanded(agencyId)}
                  >
                    {isExpanded ? <ExpandMore /> : <ChevronRight />}
                  </IconButton>
                  <Business sx={{ mr: 1, color: 'secondary.main' }} />
                  <Typography variant="subtitle2" fontWeight="bold">
                    {agencyData.agency.name}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={1.2}>
                <Typography variant="body2" fontWeight="medium" align="left">
                  {formatCurrency(aggregatedTotals.budgetAmount)}
                </Typography>
              </Grid>
              <Grid item xs={1.2}>
                <Typography variant="body2" align="left">
                  {formatCurrency(aggregatedTotals.actualAmount)}
                </Typography>
              </Grid>
              <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPercentToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).label}
                  color={getPercentToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).color}
                  size="small"
                  variant="filled"
                />
              </Grid>
              <Grid item xs={1.2}>
                <Typography 
                  variant="body2" 
                  align="left"
                  sx={{ 
                    color: (aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount) < 0 ? 'success.main' : 
                           (aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount) > 0 ? 'error.main' : 
                           'text.primary' 
                  }}
                >
                  {formatCurrency(Math.abs(aggregatedTotals.budgetAmount - aggregatedTotals.actualAmount))}
                </Typography>
              </Grid>
              <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPacingToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).label}
                  color={getPacingToGoal(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount).color}
                  size="small"
                />
              </Grid>
              <Grid item xs={1.2}>
                <Typography variant="body2" align="left">
                  {formatCurrency(aggregatedTotals.previousYearActual)}
                </Typography>
              </Grid>
              <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month).label}
                  color={getPacingStatus(aggregatedTotals.budgetAmount, aggregatedTotals.actualAmount, year, month).color}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        </TableCell>
      </TableRow>
      
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              {/* Render advertisers under this agency */}
              {agencyData.advertisers.map((advertiser: any) => (
                <Box key={advertiser.id} sx={{ pl: 1, mb: 0.5 }}>
                  <Grid container spacing={0.5} alignItems="center" sx={{ pl: 1 }}>
                    <Grid item xs={2.5}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccountBalance sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">
                          {advertiser.entityName}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={1.2}>
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
                    <Grid item xs={1.2}>
                      <Typography variant="body2">
                        {formatCurrency(advertiser.actualAmount)}
                      </Typography>
                    </Grid>
                    <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        label={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                        color={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                        size="small"
                        variant="filled"
                      />
                    </Grid>
                    <Grid item xs={1.2}>
                      <Typography 
                        variant="body2"
                        sx={{ 
                          color: (advertiser.budgetAmount - advertiser.actualAmount) < 0 ? 'success.main' : 
                                 (advertiser.budgetAmount - advertiser.actualAmount) > 0 ? 'error.main' : 
                                 'text.primary' 
                        }}
                      >
                        {formatCurrency(Math.abs(advertiser.budgetAmount - advertiser.actualAmount))}
                      </Typography>
                    </Grid>
                    <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        label={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                        color={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={1.2}>
                      <Typography variant="body2">
                        {formatCurrency(advertiser.previousYearActual)}
                      </Typography>
                    </Grid>
                    <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        label={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).label}
                        color={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).color}
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
  )
}

function renderAdvertiserRow(advertiserId: string, advertiserData: any, editMode: boolean, editedBudgets: any, handleCellEdit: any, showComparison: boolean, formatCurrency: any, formatPercent: any, getVarianceColor: any, getPacingStatus: any, getPacingToGoal: any, getPercentToGoal: any, year: number, month: number | null) {
  const advertiser = advertiserData.advertiser
  
  return (
    <TableRow key={advertiserId}>
      <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
        <Box sx={{ pl: 2, pr: 1, py: 1.5 }}>
          <Grid container spacing={0.5} alignItems="center">
            <Grid item xs={2.5}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalance sx={{ mr: 1, color: 'info.main' }} />
                <Box>
                  <Typography variant="body2">
                    {advertiser.entityName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {advertiserData.agency ? `via ${advertiserData.agency.name}` : 'Independent'} • Seller: {advertiserData.seller.name}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={1.2}>
              {editMode ? (
                <TextField
                  size="small"
                  type="number"
                  value={editedBudgets[advertiser.id]?.budgetAmount ?? advertiser.budgetAmount}
                  onChange={(e) => handleCellEdit(advertiser.id, 'budgetAmount', parseFloat(e.target.value) || 0)}
                  sx={{ width: 100 }}
                />
              ) : (
                <Typography variant="body2" align="left">
                  {formatCurrency(advertiser.budgetAmount)}
                </Typography>
              )}
            </Grid>
            <Grid item xs={1.2}>
              <Typography variant="body2" align="left">
                {formatCurrency(advertiser.actualAmount)}
              </Typography>
            </Grid>
            <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                color={getPercentToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                size="small"
                variant="filled"
              />
            </Grid>
            <Grid item xs={1.2}>
              <Typography 
                variant="body2"
                align="left"
                sx={{ 
                  color: (advertiser.budgetAmount - advertiser.actualAmount) < 0 ? 'success.main' : 
                         (advertiser.budgetAmount - advertiser.actualAmount) > 0 ? 'error.main' : 
                         'text.primary' 
                }}
              >
                {formatCurrency(Math.abs(advertiser.budgetAmount - advertiser.actualAmount))}
              </Typography>
            </Grid>
            <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).label}
                color={getPacingToGoal(advertiser.budgetAmount, advertiser.actualAmount).color}
                size="small"
              />
            </Grid>
            <Grid item xs={1.2}>
              <Typography variant="body2" align="left">
                {formatCurrency(advertiser.previousYearActual)}
              </Typography>
            </Grid>
            <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).label}
                color={getPacingStatus(advertiser.budgetAmount, advertiser.actualAmount, year, month).color}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>
      </TableCell>
    </TableRow>
  )
}

// Helper function to render developmental business section for sellers
function renderDevelopmentalBusinessSection(sellerId: string, sellerData: any, expandedItems: Set<string>, toggleItemExpanded: (id: string) => void, editMode: boolean, editedBudgets: any, handleCellEdit: any, showComparison: boolean, formatCurrency: any, getPacingStatus: any, getPacingToGoal: any, year: number, month: number | null, handleAddDevelopmentalBudget: (sellerId: string) => void, selectedDevelopmentalGoals: Set<string>, handleSelectDevelopmentalGoal: (budgetId: string, checked: boolean) => void, handleSelectAllDevelopmentalGoals: (goals: any[], checked: boolean) => void, handleBatchDeleteDevelopmentalGoals: () => void, isDeleting: boolean) {
  // Get developmental business data from the new structure
  const developmentalData = sellerData.developmentalBusiness
  const developmentalGoals = developmentalData.goals
  const accountsWithBillingButNoGoals = developmentalData.accountsWithBillingButNoGoals
  const totalItems = developmentalGoals.length + accountsWithBillingButNoGoals.length

  // Use developmental data as-is since it already includes accounts with billing but no goals
  const correctedDevelopmentalData = developmentalData
  
  // Create unique ID for developmental section expansion state
  const developmentalId = `${sellerId}-developmental`
  const isDevelopmentalExpanded = expandedItems.has(developmentalId)

  // Helper function to get period label
  const getPeriodLabel = (budgetMonth: number | null) => {
    if (!month) {
      return `${year} Annual New Business`
    } else if (month > 0) {
      const monthName = new Date(2024, month - 1).toLocaleString('default', { month: 'long' })
      return `${monthName} ${year} New Business`
    } else {
      // Quarter
      const quarters = {
        [-1]: 'Q1',
        [-2]: 'Q2', 
        [-3]: 'Q3',
        [-4]: 'Q4'
      }
      return `${quarters[month as keyof typeof quarters]} ${year} New Business`
    }
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, pl: 2, pr: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Store sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight="bold">
            Developmental Business
          </Typography>
        </Box>
        
        {editMode && developmentalGoals.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={developmentalGoals.length > 0 && developmentalGoals.every(goal => selectedDevelopmentalGoals.has(goal.id))}
                  indeterminate={developmentalGoals.some(goal => selectedDevelopmentalGoals.has(goal.id)) && !developmentalGoals.every(goal => selectedDevelopmentalGoals.has(goal.id))}
                  onChange={(e) => handleSelectAllDevelopmentalGoals(developmentalGoals, e.target.checked)}
                />
              }
              label="Select All"
              sx={{ mr: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleBatchDeleteDevelopmentalGoals}
              disabled={selectedDevelopmentalGoals.size === 0 || isDeleting}
            >
              Delete Selected ({selectedDevelopmentalGoals.size})
            </Button>
          </Box>
        )}
      </Box>
      
      {/* Show aggregated total row first if there are any developmental items */}
      {totalItems > 0 && (
        <Box sx={{ pl: 2, mb: 1, backgroundColor: 'action.hover', py: 1, borderRadius: 1 }}>
          <Grid container spacing={0.5} alignItems="center">
            <Grid item xs={editMode ? 2.5 : 2.5}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={() => toggleItemExpanded(developmentalId)}
                  sx={{ mr: 0.5 }}
                >
                  {isDevelopmentalExpanded ? <ExpandMore /> : <ChevronRight />}
                </IconButton>
                <Store sx={{ mr: 1, fontSize: 16, color: 'primary.main' }} />
                <Typography variant="body2" fontWeight="bold">
                  Developmental Total
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={1.2}>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(correctedDevelopmentalData.totalBudget)}
              </Typography>
            </Grid>
            <Grid item xs={1.2}>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(correctedDevelopmentalData.totalActual)}
              </Typography>
            </Grid>
            <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={getPercentToGoal(correctedDevelopmentalData.totalBudget, correctedDevelopmentalData.totalActual).label}
                color={getPercentToGoal(correctedDevelopmentalData.totalBudget, correctedDevelopmentalData.totalActual).color}
                size="small"
                variant="filled"
              />
            </Grid>
            <Grid item xs={1.2}>
              <Typography 
                variant="body2"
                fontWeight="bold"
                sx={{ 
                  color: (correctedDevelopmentalData.totalBudget - correctedDevelopmentalData.totalActual) < 0 ? 'success.main' : 
                         (correctedDevelopmentalData.totalBudget - correctedDevelopmentalData.totalActual) > 0 ? 'error.main' : 
                         'text.primary' 
                }}
              >
                {formatCurrency(correctedDevelopmentalData.totalBudget - correctedDevelopmentalData.totalActual)}
              </Typography>
            </Grid>
            <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={getPacingToGoal(correctedDevelopmentalData.totalBudget, correctedDevelopmentalData.totalActual).label}
                color={getPacingToGoal(correctedDevelopmentalData.totalBudget, correctedDevelopmentalData.totalActual).color}
                size="small"
                variant="filled"
              />
            </Grid>
            <Grid item xs={2.6}>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Rolled up from goals & unassigned accounts
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Show individual developmental goals - only when expanded */}
      {isDevelopmentalExpanded && developmentalGoals.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ pl: 2, color: 'text.secondary', fontWeight: 'bold' }}>
            DEVELOPMENTAL GOALS:
          </Typography>
          {developmentalGoals.map((budget: any) => (
            <Box key={budget.id} sx={{ mb: 0.5 }}>
              <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2 }}>
                {editMode && (
                  <Grid item xs={0.5}>
                    <Checkbox
                      size="small"
                      checked={selectedDevelopmentalGoals.has(budget.id)}
                      onChange={(e) => handleSelectDevelopmentalGoal(budget.id, e.target.checked)}
                    />
                  </Grid>
                )}
                <Grid item xs={editMode ? 2.0 : 2.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Store sx={{ mr: 1, fontSize: 16, color: 'success.main' }} />
                    <Typography variant="body2">
                      {getPeriodLabel(budget.month)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={1.2}>
                  {editMode ? (
                    <TextField
                      size="small"
                      type="number"
                      value={editedBudgets[budget.id]?.budgetAmount ?? budget.budgetAmount}
                      onChange={(e) => handleCellEdit(budget.id, 'budgetAmount', parseFloat(e.target.value) || 0)}
                      sx={{ width: 100 }}
                    />
                  ) : (
                    <Typography variant="body2">
                      {formatCurrency(budget.budgetAmount)}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2">
                    {formatCurrency(budget.actualAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label={getPercentToGoal(budget.budgetAmount, budget.actualAmount).label}
                    color={getPercentToGoal(budget.budgetAmount, budget.actualAmount).color}
                    size="small"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={1.2}>
                  <Typography 
                    variant="body2"
                    sx={{ 
                      color: (budget.budgetAmount - budget.actualAmount) < 0 ? 'success.main' : 
                             (budget.budgetAmount - budget.actualAmount) > 0 ? 'error.main' : 
                             'text.primary' 
                    }}
                  >
                    {formatCurrency(Math.abs(budget.budgetAmount - budget.actualAmount))}
                  </Typography>
                </Grid>
                <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label={getPacingToGoal(budget.budgetAmount, budget.actualAmount).label}
                    color={getPacingToGoal(budget.budgetAmount, budget.actualAmount).color}
                    size="small"
                  />
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2">
                    {formatCurrency(budget.previousYearActual)}
                  </Typography>
                </Grid>
                <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label={getPacingStatus(budget.budgetAmount, budget.actualAmount, year, month).label}
                    color={getPacingStatus(budget.budgetAmount, budget.actualAmount, year, month).color}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Show accounts with billing but no goals - only when expanded */}
      {isDevelopmentalExpanded && accountsWithBillingButNoGoals.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ pl: 2, color: 'warning.main', fontWeight: 'bold' }}>
            ACCOUNTS WITH BILLING (NO GOALS SET):
          </Typography>
          {accountsWithBillingButNoGoals.map((account: any) => (
            <Box key={account.id} sx={{ mb: 0.5 }}>
              <Grid container spacing={0.5} alignItems="center" sx={{ pl: 2 }}>
                <Grid item xs={editMode ? 2.5 : 2.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Business sx={{ mr: 1, fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="body2">
                      {account.entityName}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2" color="text.secondary">
                    No Goal
                  </Typography>
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2" fontWeight="bold" color="warning.main">
                    {formatCurrency(account.actualAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={1.2} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label="—"
                    color="default"
                    size="small"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2" color="text.secondary">
                    N/A
                  </Typography>
                </Grid>
                <Grid item xs={1.3} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label="Needs Goal"
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={1.2}>
                  <Typography variant="body2">
                    {formatCurrency(account.previousYearActual || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={1.4} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label="No Goal"
                    color="default"
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Show message if no developmental items - only when expanded */}
      {isDevelopmentalExpanded && totalItems === 0 && (
        <Box sx={{ pl: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No developmental business goals or unassigned accounts for this seller
          </Typography>
        </Box>
      )}
      
      {isDevelopmentalExpanded && editMode && (
        <Box sx={{ mt: 1, pl: 4 }}>
          <Button 
            size="small" 
            startIcon={<Add />}
            onClick={() => handleAddDevelopmentalBudget(sellerId)}
            variant="outlined"
          >
            Add Developmental Goal
          </Button>
        </Box>
      )}
    </Box>
  )
}