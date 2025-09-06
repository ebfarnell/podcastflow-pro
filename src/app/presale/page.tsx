'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar
} from '@mui/material'
import {
  Campaign,
  Schedule,
  Inventory,
  EventNote,
  Search,
  Add,
  Edit,
  Visibility,
  Dashboard as DashboardIcon,
  ArrowForward,
  CheckCircle,
  Cancel,
  Block,
  DateRange,
  Close,
  ViewList,
  ViewModule
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { campaignApi } from '@/services/api/campaign'
import { inventoryApi } from '@/services/api/inventory'
import { orderApi } from '@/services/api/order'
import { HasPermission } from '@/components/auth/RoleGuard'
import { PERMISSIONS, hasPermission } from '@/types/auth'
import { ScheduleBrowser } from '@/components/presale/ScheduleBrowser'

interface PreSaleTab {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
  permission?: string
}

export default function PreSalePage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(() => {
    // Check if tab is specified in URL parameters
    const tabParam = searchParams.get('tab')
    return tabParam === 'campaigns' ? 'campaigns' : 'overview'
  })
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'dashboard'>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProbability, setFilterProbability] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [customDateDialog, setCustomDateDialog] = useState(false)
  const [customDateType, setCustomDateType] = useState<'month' | 'quarter' | 'range'>('range')
  const [customYear, setCustomYear] = useState(new Date().getFullYear())
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1)
  const [customQuarter, setCustomQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  
  // Data states
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [lostCampaigns, setLostCampaigns] = useState<any[]>([])
  
  // Persistent counts for tabs (don't change when switching tabs)
  const [tabCounts, setTabCounts] = useState({
    campaigns: 0,
    reservations: 0,
    lost: 0
  })
  
  const [metrics, setMetrics] = useState<any>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalReservations: 0,
    pendingReservations: 0,
    totalInventorySlots: 0,
    totalEpisodes: 0,
    soldInventorySlots: 0,
    pendingInventorySlots: 0,
    selloutPercentage: 0,
    pendingPercentage: 0,
    totalRevenue: 0,
    lostCampaigns: 0,
    lostRevenue: 0
  })

  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  // Conversion dialog
  const [conversionDialog, setConversionDialog] = useState<{
    open: boolean
    campaign: any | null
  }>({ open: false, campaign: null })
  
  // Reservation details dialog
  const [reservationDetailsDialog, setReservationDetailsDialog] = useState<{
    open: boolean
    reservation: any | null
  }>({ open: false, reservation: null })
  
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({ open: false, message: '', severity: 'info' })

  // Define tabs with defensive checks - ensure icons are always valid React nodes
  const tabs: PreSaleTab[] = [
    { id: 'overview', label: 'Overview', icon: <DashboardIcon /> },
    { id: 'campaigns', label: 'Campaigns', icon: <Campaign />, count: tabCounts.campaigns, permission: PERMISSIONS.CAMPAIGNS_VIEW },
    { id: 'reservations', label: 'Reservations', icon: <Schedule />, count: tabCounts.reservations, permission: PERMISSIONS.ORDERS_VIEW },
    { id: 'lost', label: 'Lost Campaigns', icon: <Block />, count: tabCounts.lost, permission: PERMISSIONS.CAMPAIGNS_VIEW },
    { id: 'inventory', label: 'Inventory', icon: <Inventory />, permission: PERMISSIONS.ORDERS_VIEW },
    { id: 'schedule', label: 'Schedules', icon: <EventNote />, permission: PERMISSIONS.CAMPAIGNS_CREATE }
  ]

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  // Initial data fetch for counts
  useEffect(() => {
    if (user && tabCounts.campaigns === 0 && tabCounts.reservations === 0 && tabCounts.lost === 0) {
      // Fetch all data initially for tab counts
      const fetchInitialData = async () => {
        try {
          const [campaignData, reservationData, lostData] = await Promise.all([
            campaignApi.list(),
            orderApi.getReservations(),
            fetch('/api/campaigns/lost').then(res => res.json())
          ])
          
          // The campaigns API returns an array directly, not wrapped in an object
          const allCampaigns = Array.isArray(campaignData) ? campaignData : []
          const nonCancelledCampaigns = allCampaigns.filter(c => c.status !== 'cancelled')
          
          // The reservations API returns an array directly
          const allReservations = Array.isArray(reservationData) ? reservationData : []
          
          // The lost campaigns API returns an object with lostCampaigns array
          const allLostCampaigns = Array.isArray(lostData?.lostCampaigns) ? lostData.lostCampaigns : []
          
          // Set persistent tab counts
          setTabCounts({
            campaigns: nonCancelledCampaigns.length,
            reservations: allReservations.length,
            lost: allLostCampaigns.length
          })
          
          // Set initial data for overview tab
          setCampaigns(nonCancelledCampaigns)
          setReservations(allReservations)
          setLostCampaigns(allLostCampaigns)
        } catch (error) {
          // Set empty arrays on error to prevent UI issues
          setCampaigns([])
          setReservations([])
          setLostCampaigns([])
        }
      }
      fetchInitialData()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, activeTab, filterStatus, filterProbability, dateRange])

  // Force data refresh when component mounts to ensure fresh data
  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [])

  // Update metrics whenever data changes
  useEffect(() => {
    updateMetrics()
  }, [campaigns, reservations, inventory, lostCampaigns])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Always fetch all data for overview tab
      if (activeTab === 'overview') {
        // Fetch campaigns
        const campaignData = await campaignApi.list()
        let allCampaigns = Array.isArray(campaignData) ? campaignData : []
        
        // Apply date range filter for overview tab too
        if (dateRange.start || dateRange.end) {
          const startFilter = dateRange.start ? new Date(dateRange.start) : null
          const endFilter = dateRange.end ? new Date(dateRange.end) : null
          
          allCampaigns = allCampaigns.filter(campaign => {
            const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null
            const campaignEnd = campaign.endDate ? new Date(campaign.endDate) : null
            
            // Campaign should overlap with the selected date range
            if (startFilter && campaignEnd && campaignEnd < startFilter) return false
            if (endFilter && campaignStart && campaignStart > endFilter) return false
            
            return true
          })
        }
        
        setCampaigns(allCampaigns)
        
        // Fetch reservations - TODO: Add date filtering to reservations based on campaign dates
        const reservationData = await orderApi.getReservations()
        setReservations(Array.isArray(reservationData) ? reservationData : [])
        
        // Fetch inventory
        try {
          const startDate = dateRange.start || new Date().toISOString().split('T')[0]
          const endDate = dateRange.end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          const inventoryData = await inventoryApi.list({ startDate, endDate })
          
          if (inventoryData && typeof inventoryData === 'object' && inventoryData.inventory) {
            const inventoryArray = Array.isArray(inventoryData.inventory) ? inventoryData.inventory : []
            const validInventory = inventoryArray.filter(item => 
              item && 
              typeof item === 'object' && 
              (item.id || item.episodeId)
            )
            setInventory(validInventory)
          } else {
            setInventory([])
          }
        } catch (inventoryError) {
          setInventory([])
        }
        
        // Fetch lost campaigns
        try {
          const lostResponse = await fetch('/api/campaigns/lost')
          const lostCampaignsData = await lostResponse.json()
          let lostCampaigns = Array.isArray(lostCampaignsData?.lostCampaigns) ? lostCampaignsData.lostCampaigns : []
          
          // Apply date range filter to lost campaigns too
          if (dateRange.start || dateRange.end) {
            const startFilter = dateRange.start ? new Date(dateRange.start) : null
            const endFilter = dateRange.end ? new Date(dateRange.end) : null
            
            lostCampaigns = lostCampaigns.filter(campaign => {
              const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null
              const campaignEnd = campaign.endDate ? new Date(campaign.endDate) : null
              
              // Campaign should overlap with the selected date range
              if (startFilter && campaignEnd && campaignEnd < startFilter) return false
              if (endFilter && campaignStart && campaignStart > endFilter) return false
              
              return true
            })
          }
          
          setLostCampaigns(lostCampaigns)
        } catch (lostError) {
          setLostCampaigns([])
        }
      } else {
        // Fetch based on active tab
        switch (activeTab) {
          case 'campaigns':
            // When filter is 'all', exclude cancelled campaigns unless specifically filtered for
            const statusFilter = filterStatus === 'all' ? undefined : filterStatus
            const campaignData = await campaignApi.list({ status: statusFilter })
            let filteredCampaigns = Array.isArray(campaignData) ? campaignData : []
            
            // If showing 'all', filter out cancelled campaigns
            if (filterStatus === 'all') {
              filteredCampaigns = filteredCampaigns.filter(c => c.status !== 'cancelled')
            }
            
            // Apply date range filter based on campaign start/end dates
            if (dateRange.start || dateRange.end) {
              const startFilter = dateRange.start ? new Date(dateRange.start) : null
              const endFilter = dateRange.end ? new Date(dateRange.end) : null
              
              filteredCampaigns = filteredCampaigns.filter(campaign => {
                const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null
                const campaignEnd = campaign.endDate ? new Date(campaign.endDate) : null
                
                // Campaign should overlap with the selected date range
                if (startFilter && campaignEnd && campaignEnd < startFilter) return false
                if (endFilter && campaignStart && campaignStart > endFilter) return false
                
                return true
              })
            }
            
            // Apply probability filter
            if (filterProbability !== 'all') {
              const targetProbability = parseInt(filterProbability)
              filteredCampaigns = filteredCampaigns.filter(campaign => 
                (campaign.probability || 10) === targetProbability
              )
            }
            
            // Apply search filter
            if (searchTerm) {
              const searchLower = searchTerm.toLowerCase()
              filteredCampaigns = filteredCampaigns.filter(campaign =>
                campaign.name.toLowerCase().includes(searchLower) ||
                (campaign.advertiserName && campaign.advertiserName.toLowerCase().includes(searchLower))
              )
            }
            
            setCampaigns(filteredCampaigns)
            break
          
          case 'reservations':
            const reservationData = await orderApi.getReservations({ status: filterStatus !== 'all' ? filterStatus : undefined })
            setReservations(Array.isArray(reservationData) ? reservationData : [])
            break
          
          case 'lost':
            const lostCampaignsData = await fetch('/api/campaigns/lost').then(res => res.json())
            let filteredLostCampaigns = Array.isArray(lostCampaignsData?.lostCampaigns) ? lostCampaignsData.lostCampaigns : []
            
            // Apply date range filter based on campaign start/end dates
            if (dateRange.start || dateRange.end) {
              const startFilter = dateRange.start ? new Date(dateRange.start) : null
              const endFilter = dateRange.end ? new Date(dateRange.end) : null
              
              filteredLostCampaigns = filteredLostCampaigns.filter(campaign => {
                const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null
                const campaignEnd = campaign.endDate ? new Date(campaign.endDate) : null
                
                // Campaign should overlap with the selected date range
                if (startFilter && campaignEnd && campaignEnd < startFilter) return false
                if (endFilter && campaignStart && campaignStart > endFilter) return false
                
                return true
              })
            }
            
            // Apply search filter
            if (searchTerm) {
              const searchLower = searchTerm.toLowerCase()
              filteredLostCampaigns = filteredLostCampaigns.filter(campaign =>
                campaign.name.toLowerCase().includes(searchLower) ||
                (campaign.advertiserName && campaign.advertiserName.toLowerCase().includes(searchLower))
              )
            }
            
            setLostCampaigns(filteredLostCampaigns)
            break
          
          case 'inventory':
            try {
              const startDate = dateRange.start || new Date().toISOString().split('T')[0]
              const endDate = dateRange.end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              const inventoryData = await inventoryApi.list({ startDate, endDate })
              
              // The inventory API returns { inventory: [], summary: {} }
              if (inventoryData && typeof inventoryData === 'object' && inventoryData.inventory) {
                const inventoryArray = Array.isArray(inventoryData.inventory) ? inventoryData.inventory : []
                // Filter out any null/undefined items and validate structure
                const validInventory = inventoryArray.filter(item => 
                  item && 
                  typeof item === 'object' && 
                  (item.id || item.episodeId) // Must have some form of ID
                )
                setInventory(validInventory)
              } else {
                setInventory([])
              }
            } catch (inventoryError) {
              setInventory([])
            }
            break
        }
      }
    } catch (error) {
      // Silently handle error - arrays are already set to empty in individual catches
    } finally {
      setLoading(false)
    }
  }

  const updateMetrics = () => {
    const safeCampaigns = Array.isArray(campaigns) ? campaigns : []
    const safeReservations = Array.isArray(reservations) ? reservations : []
    const safeInventory = Array.isArray(inventory) ? inventory : []
    const safeLostCampaigns = Array.isArray(lostCampaigns) ? lostCampaigns : []
    
    // Calculate inventory metrics - FIX: Use proper calculation for available slots
    const totalSlots = safeInventory.reduce((sum, i) => sum + (i.totalSlots || 0), 0)
    const soldSlots = safeInventory.reduce((sum, i) => sum + (i.totalBooked || 0), 0)
    const pendingSlots = safeInventory.reduce((sum, i) => sum + (i.totalReserved || 0), 0)
    const availableSlots = safeInventory.reduce((sum, i) => sum + (i.totalAvailable || 0), 0)
    
    const selloutPercentage = totalSlots > 0 ? ((soldSlots + pendingSlots) / totalSlots) * 100 : 0
    const pendingPercentage = totalSlots > 0 ? (pendingSlots / totalSlots) * 100 : 0
    
    // Count inventory status - FIX: Use correct property names
    const availableInventory = safeInventory.filter(i => (i.totalAvailable || 0) > 0).length
    const utilizedInventory = safeInventory.filter(i => (i.totalBooked || 0) > 0 || (i.totalReserved || 0) > 0).length
    
    setMetrics({
      totalCampaigns: safeCampaigns.length,
      activeCampaigns: safeCampaigns.filter(c => c.status === 'active' || c.status === 'proposal').length,
      totalReservations: safeReservations.length,
      pendingReservations: safeReservations.filter(r => r.status === 'held' || r.status === 'pending').length,
      totalInventorySlots: totalSlots,
      totalEpisodes: safeInventory.length, // Count of episodes with inventory
      // FIX: Show available slots instead of sold slots in "Available Slots" card
      soldInventorySlots: availableSlots, // This is actually available slots
      pendingInventorySlots: pendingSlots,
      selloutPercentage: selloutPercentage,
      pendingPercentage: pendingPercentage,
      totalRevenue: safeCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
      lostCampaigns: safeLostCampaigns.length,
      lostRevenue: safeLostCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
      availableInventory: availableInventory,
      utilizedInventory: utilizedInventory
    })
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue)
    setPage(0)
  }


  const handleConvertToReservation = (campaign: any) => {
    setConversionDialog({ open: true, campaign })
  }

  const handleConfirmConversion = async () => {
    if (!conversionDialog.campaign) return
    
    try {
      // Update campaign status to 'pending'
      await campaignApi.update(conversionDialog.campaign.id, {
        status: 'pending'
      })
      
      // Create reservation
      const reservation = await orderApi.createReservation({
        campaignId: conversionDialog.campaign.id,
        advertiserId: conversionDialog.campaign.advertiserId,
        items: []
      })
      
      setSnackbar({
        open: true,
        message: 'Campaign successfully converted to reservation. Pending admin approval.',
        severity: 'success'
      })
      
      // Update tab counts
      setTabCounts(prev => ({
        ...prev,
        reservations: prev.reservations + 1
      }))
      
      // Refresh data
      fetchData()
      setConversionDialog({ open: false, campaign: null })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to convert campaign to reservation',
        severity: 'error'
      })
    }
  }

  const handleApproveReservation = async (reservation: any) => {
    try {
      await orderApi.confirmReservation(reservation.id)
      
      // Update the campaign status to 'approved'
      if (reservation.campaignId) {
        await campaignApi.update(reservation.campaignId, {
          status: 'approved'
        })
      }
      
      setSnackbar({
        open: true,
        message: 'Reservation approved successfully. Order created.',
        severity: 'success'
      })
      
      // Update tab counts (reservation becomes an order, so reduce reservation count)
      setTabCounts(prev => ({
        ...prev,
        reservations: prev.reservations - 1
      }))
      
      // Refresh data
      fetchData()
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to approve reservation',
        severity: 'error'
      })
    }
  }

  const handleMarkAsLost = async (campaign: any) => {
    if (!confirm(`Are you sure you want to mark "${campaign.name}" as Lost? This will remove it from the forecast and set its probability to 0%.`)) {
      return
    }
    
    try {
      await campaignApi.update(campaign.id, {
        status: 'lost'
      })
      
      setSnackbar({
        open: true,
        message: `Campaign "${campaign.name}" has been marked as Lost and removed from the forecast.`,
        severity: 'info'
      })
      
      // Update tab counts
      setTabCounts(prev => ({
        ...prev,
        campaigns: prev.campaigns - 1,
        lost: prev.lost + 1
      }))
      
      // Refresh data
      fetchData()
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to mark campaign as lost. Please try again.',
        severity: 'error'
      })
    }
  }

  const getDateRange = (type: string) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    switch (type) {
      case 'thisMonth':
        return {
          start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          end: `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
        }
      case 'nextMonth':
        const nextMonth = month + 1
        const nextYear = nextMonth > 11 ? year + 1 : year
        const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
        return {
          start: `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`,
          end: `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${new Date(nextYear, adjustedMonth + 1, 0).getDate()}`
        }
      case 'thisQuarter':
        const currentQuarter = Math.floor(month / 3)
        const quarterStart = currentQuarter * 3
        return {
          start: `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`,
          end: `${year}-${String(quarterStart + 3).padStart(2, '0')}-${new Date(year, quarterStart + 3, 0).getDate()}`
        }
      case 'nextQuarter':
        const nextQuarter = Math.floor(month / 3) + 1
        const nextQuarterYear = nextQuarter > 3 ? year + 1 : year
        const adjustedQuarter = nextQuarter > 3 ? 0 : nextQuarter
        const nextQuarterStart = adjustedQuarter * 3
        return {
          start: `${nextQuarterYear}-${String(nextQuarterStart + 1).padStart(2, '0')}-01`,
          end: `${nextQuarterYear}-${String(nextQuarterStart + 3).padStart(2, '0')}-${new Date(nextQuarterYear, nextQuarterStart + 3, 0).getDate()}`
        }
      case 'thisYear':
        return {
          start: `${year}-01-01`,
          end: `${year}-12-31`
        }
      case 'nextYear':
        return {
          start: `${year + 1}-01-01`,
          end: `${year + 1}-12-31`
        }
      default:
        return { start: '', end: '' }
    }
  }

  const applyDatePreset = (type: string) => {
    const range = getDateRange(type)
    setDateRange(range)
    setSelectedPreset(type)
  }

  const applyCustomDate = () => {
    let start = ''
    let end = ''
    
    switch (customDateType) {
      case 'month':
        start = `${customYear}-${String(customMonth).padStart(2, '0')}-01`
        end = `${customYear}-${String(customMonth).padStart(2, '0')}-${new Date(customYear, customMonth, 0).getDate()}`
        break
      case 'quarter':
        const quarterStart = (customQuarter - 1) * 3
        start = `${customYear}-${String(quarterStart + 1).padStart(2, '0')}-01`
        end = `${customYear}-${String(quarterStart + 3).padStart(2, '0')}-${new Date(customYear, quarterStart + 3, 0).getDate()}`
        break
      case 'range':
        // Keep existing manual date range
        return
    }
    
    setDateRange({ start, end })
    setSelectedPreset(null)
    setCustomDateDialog(false)
  }

  const renderOverview = () => (
    <Grid container spacing={3}>
      {/* Metrics Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Active Campaigns
            </Typography>
            <Typography variant="h4">
              {metrics.activeCampaigns}
            </Typography>
            <Typography variant="body2" color="success.main">
              {metrics.totalCampaigns} total
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Pending Reservations
            </Typography>
            <Typography variant="h4">
              {metrics.pendingReservations}
            </Typography>
            <Typography variant="body2" color="warning.main">
              {metrics.totalReservations} total
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Sellout
            </Typography>
            <Typography variant="h4" color={metrics.selloutPercentage > 80 ? "success.main" : metrics.selloutPercentage > 50 ? "warning.main" : "inherit"}>
              {metrics.selloutPercentage.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {metrics.pendingPercentage.toFixed(1)}% pending
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Lost Campaigns
            </Typography>
            <Typography variant="h4" color="error">
              {metrics.lostCampaigns}
            </Typography>
            <Typography variant="body2" color="error">
              {formatCurrency(metrics.lostRevenue)} lost revenue
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Sales Workflow */}
      <Grid item xs={12}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Sales Workflow
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="1. Create Campaign (Proposal Phase)" color="primary" size="small" />
                <Chip label="2. Convert to Reservation" color="warning" size="small" />
                <Chip label="3. Admin Approval" color="info" size="small" />
                <Chip label="4. Generate Contract & Invoice" color="success" size="small" />
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<Campaign />}
              onClick={() => router.push('/campaigns/new')}
              sx={{ mt: 2 }}
            >
              New Campaign
            </Button>
          </Box>
        </Paper>
      </Grid>

      {/* Recent Activity */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: 400, overflow: 'hidden' }}>
          <Typography variant="h6" gutterBottom>
            Recent Campaigns
          </Typography>
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Probability</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const safeCampaigns = Array.isArray(campaigns) ? campaigns.slice(0, 5) : []
                  
                  if (safeCampaigns.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">No campaigns available</Typography>
                        </TableCell>
                      </TableRow>
                    )
                  }
                  
                  return safeCampaigns.map((campaign, index) => {
                    if (!campaign || typeof campaign !== 'object') {
                      return null
                    }
                    
                    return (
                      <TableRow key={campaign.id || `campaign-${index}`}>
                        <TableCell>{campaign.name || 'Unknown Campaign'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={campaign.status || 'unknown'} 
                            size="small"
                            color={campaign.status === 'active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${campaign.probability || 10}%`}
                            size="small"
                            style={{ 
                              backgroundColor: 
                                (campaign.probability || 10) >= 90 ? '#4caf50' :
                                (campaign.probability || 10) >= 65 ? '#2196f3' :
                                (campaign.probability || 10) >= 35 ? '#ff9800' :
                                '#f44336',
                              color: 'white'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(campaign.budget || 0)}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}`)}
                            disabled={!campaign.id}
                          >
                            <ArrowForward />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  }).filter(Boolean)
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>

      {/* Inventory Summary */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Inventory Summary
            </Typography>
            <Button
              size="small"
              onClick={() => setActiveTab('inventory')}
              endIcon={<ArrowForward />}
            >
              View Details
            </Button>
          </Box>
          
          {/* Date Range Info */}
          {(dateRange.start || dateRange.end) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" noWrap>
                {formatDate(dateRange.start || new Date().toISOString())} - {formatDate(dateRange.end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())}
              </Typography>
            </Alert>
          )}
          
          {/* Summary Metrics */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="h4" color="primary">
                  {(() => {
                    const safeInventory = Array.isArray(inventory) ? inventory : []
                    return safeInventory.filter(i => (i.totalAvailable || 0) > 0).length
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Episodes Available
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="h4" color="success.main">
                  {metrics.soldInventorySlots || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Slots Available
                </Typography>
              </Box>
            </Grid>
          </Grid>
          
          {/* Inventory by Show */}
          <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Inventory by Show
            </Typography>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              {(() => {
                const safeInventory = Array.isArray(inventory) ? inventory : []
                
                // Group inventory by show
                const showGroups = safeInventory.reduce((acc, item) => {
                  if (!item || typeof item !== 'object') return acc
                  
                  const showName = item.showName || 'Unknown Show'
                  if (!acc[showName]) {
                    acc[showName] = {
                      totalSlots: 0,
                      availableSlots: 0,
                      reservedSlots: 0,
                      bookedSlots: 0,
                      episodes: 0
                    }
                  }
                  
                  acc[showName].totalSlots += item.totalSlots || 0
                  acc[showName].availableSlots += item.totalAvailable || 0
                  acc[showName].reservedSlots += item.totalReserved || 0
                  acc[showName].bookedSlots += item.totalBooked || 0
                  acc[showName].episodes += 1
                  
                  return acc
                }, {})
                
                const shows = Object.entries(showGroups)
                
                if (shows.length === 0) {
                  return (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography color="text.secondary" variant="body2">
                        No inventory available for selected date range
                      </Typography>
                    </Box>
                  )
                }
                
                return shows.map(([showName, data], index) => (
                  <Box key={`show-${index}`} sx={{ mb: 1.5, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{showName}</Typography>
                      <Chip 
                        label={`${data.episodes}`} 
                        size="small" 
                        variant="outlined"
                        sx={{ height: 20, '& .MuiChip-label': { px: 1 } }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="success.main">
                        {data.availableSlots} avail
                      </Typography>
                      <Typography variant="caption" color="warning.main">
                        {data.reservedSlots} resv
                      </Typography>
                      <Typography variant="caption" color="info.main">
                        {data.bookedSlots} book
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={data.totalSlots > 0 ? ((data.bookedSlots + data.reservedSlots) / data.totalSlots) * 100 : 0}
                      sx={{ mt: 0.5, height: 4, borderRadius: 1 }}
                    />
                  </Box>
                ))
              })()}
            </Box>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  )

  const renderCampaigns = () => {
    // Dashboard view
    if (viewMode === 'dashboard') {
      return (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Campaigns Dashboard</AlertTitle>
            Overview of all campaigns with key metrics and quick actions.
          </Alert>
          <Grid container spacing={3}>
            {/* Summary Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Campaigns
                  </Typography>
                  <Typography variant="h4">
                    {campaigns.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active: {campaigns.filter(c => c.status === 'active').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Budget
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(campaigns.reduce((sum, c) => sum + (c.budget || 0), 0))}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Spent: {formatCurrency(campaigns.reduce((sum, c) => sum + (c.spent || 0), 0))}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    High Probability
                  </Typography>
                  <Typography variant="h4">
                    {campaigns.filter(c => (c.probability || 10) >= 65).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Campaigns ≥65% probability
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    In Proposal
                  </Typography>
                  <Typography variant="h4">
                    {campaigns.filter(c => c.status === 'proposal').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Ready for conversion
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Recent Campaigns List */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Campaigns
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {campaigns.slice(0, 5).map((campaign, index) => (
                  <Box key={campaign.id || index} sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle1">{campaign.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {campaign.advertiserName} • {formatDate(campaign.startDate)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={`${campaign.probability || 10}%`}
                          size="small"
                          style={{ 
                            backgroundColor: 
                              (campaign.probability || 10) >= 90 ? '#4caf50' :
                              (campaign.probability || 10) >= 65 ? '#2196f3' :
                              (campaign.probability || 10) >= 35 ? '#ff9800' :
                              '#f44336',
                            color: 'white'
                          }}
                        />
                        <Chip 
                          label={campaign.status}
                          size="small"
                          color={
                            campaign.status === 'proposal' ? 'primary' :
                            campaign.status === 'active' ? 'success' :
                            'default'
                          }
                        />
                        <Typography variant="h6">
                          {formatCurrency(campaign.budget || 0)}
                        </Typography>
                        <IconButton 
                          size="small"
                          onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}`)}
                        >
                          <ArrowForward />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )
    }
    
    // Grid view
    if (viewMode === 'grid') {
      return (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Campaigns Grid View</AlertTitle>
            Visual card-based view of all campaigns.
          </Alert>
          <Grid container spacing={3}>
            {campaigns.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((campaign, index) => (
              <Grid item xs={12} sm={6} md={4} key={campaign.id || index}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Chip 
                        label={campaign.status}
                        size="small"
                        color={
                          campaign.status === 'proposal' ? 'primary' :
                          campaign.status === 'active' ? 'success' :
                          campaign.status === 'pending' ? 'warning' :
                          'default'
                        }
                      />
                      <Chip 
                        label={`${campaign.probability || 10}%`}
                        size="small"
                        style={{ 
                          backgroundColor: 
                            (campaign.probability || 10) >= 90 ? '#4caf50' :
                            (campaign.probability || 10) >= 65 ? '#2196f3' :
                            (campaign.probability || 10) >= 35 ? '#ff9800' :
                            '#f44336',
                          color: 'white'
                        }}
                      />
                    </Stack>
                    <Typography variant="h6" gutterBottom>
                      {campaign.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {campaign.advertiserName}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2">
                      <strong>Budget:</strong> {formatCurrency(campaign.budget || 0)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Spent:</strong> {formatCurrency(campaign.spent || 0)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Start:</strong> {formatDate(campaign.startDate)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>End:</strong> {formatDate(campaign.endDate)}
                    </Typography>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}`)}
                        fullWidth
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}/edit`)}
                        fullWidth
                      >
                        Edit
                      </Button>
                    </Stack>
                    {campaign.status === 'proposal' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<ArrowForward />}
                        onClick={() => handleConvertToReservation(campaign)}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        Convert
                      </Button>
                    )}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
          {campaigns.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={campaigns.length}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              sx={{ mt: 2 }}
            />
          )}
        </Box>
      )
    }
    
    // Default list view (existing table view)
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Campaigns</AlertTitle>
          Campaigns start in proposal phase. Use Schedule Builder to create media plans, then convert approved campaigns to reservations.
        </Alert>
        <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Campaign Name</TableCell>
              <TableCell>Advertiser</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Probability</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell align="right">Budget</TableCell>
              <TableCell align="right">Spent</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(() => {
              const safeCampaigns = Array.isArray(campaigns) ? campaigns : []
              const slicedCampaigns = safeCampaigns.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              
              if (slicedCampaigns.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No campaigns available</Typography>
                    </TableCell>
                  </TableRow>
                )
              }
              
              return slicedCampaigns.map((campaign, index) => {
                if (!campaign || typeof campaign !== 'object') {
                  return null
                }
                
                return (
                  <TableRow key={campaign.id || `campaign-${index}`}>
                    <TableCell>{campaign.name || 'Unknown Campaign'}</TableCell>
                    <TableCell>{campaign.advertiserName || 'Unknown Advertiser'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={campaign.status || 'unknown'}
                        size="small"
                        color={
                          campaign.status === 'proposal' ? 'primary' :
                          campaign.status === 'active' ? 'success' :
                          campaign.status === 'pending' ? 'warning' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={`${campaign.probability || 10}%`}
                        size="small"
                        style={{ 
                          backgroundColor: 
                            (campaign.probability || 10) >= 90 ? '#4caf50' :
                            (campaign.probability || 10) >= 65 ? '#2196f3' :
                            (campaign.probability || 10) >= 35 ? '#ff9800' :
                            '#f44336',
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(campaign.startDate || new Date().toISOString())}</TableCell>
                    <TableCell>{formatDate(campaign.endDate || new Date().toISOString())}</TableCell>
                    <TableCell align="right">{formatCurrency(campaign.budget || 0)}</TableCell>
                    <TableCell align="right">{formatCurrency(campaign.spent || 0)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Campaign">
                          <IconButton 
                            size="small"
                            onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}`)}
                            disabled={!campaign.id}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Campaign">
                          <IconButton 
                            size="small"
                            onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}/edit`)}
                            disabled={!campaign.id}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        {campaign.status === 'proposal' && (
                          <Tooltip title="Convert to Reservation">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleConvertToReservation(campaign)
                              }}
                            >
                              <ArrowForward />
                            </IconButton>
                          </Tooltip>
                        )}
                        {(campaign.status === 'draft' || campaign.status === 'active' || campaign.status === 'paused') && (
                          <Tooltip title="Mark as Lost">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkAsLost(campaign)
                              }}
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              }).filter(Boolean)
            })()}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={Array.isArray(campaigns) ? campaigns.length : 0}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </TableContainer>
    </Box>
    )
  }

  const renderLostCampaigns = () => (
    <Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>Lost Campaigns</AlertTitle>
        These campaigns were marked as lost and have been removed from the forecast. They remain here for admin review and analysis.
      </Alert>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Lost Campaigns
              </Typography>
              <Typography variant="h4" color="error">
                {metrics.lostCampaigns}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Campaigns that didn't convert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Lost Revenue
              </Typography>
              <Typography variant="h4" color="error">
                {formatCurrency(metrics.lostRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Potential revenue not realized
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Campaign Name</TableCell>
              <TableCell>Advertiser</TableCell>
              <TableCell>Seller</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell align="right">Budget</TableCell>
              <TableCell>Lost Date</TableCell>
              <TableCell align="right">Days in Pipeline</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(() => {
              const safeLostCampaigns = Array.isArray(lostCampaigns) ? lostCampaigns : []
              const slicedLostCampaigns = safeLostCampaigns.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              
              if (slicedLostCampaigns.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No lost campaigns available</Typography>
                    </TableCell>
                  </TableRow>
                )
              }
              
              return slicedLostCampaigns.map((campaign, index) => {
                if (!campaign || typeof campaign !== 'object') {
                  return null
                }
                
                return (
                  <TableRow key={campaign.id || `lost-campaign-${index}`}>
                    <TableCell>{campaign.name || 'Unknown Campaign'}</TableCell>
                    <TableCell>{campaign.advertiser || 'Unknown Advertiser'}</TableCell>
                    <TableCell>{campaign.seller || 'Unknown Seller'}</TableCell>
                    <TableCell>{formatDate(campaign.startDate || new Date().toISOString())}</TableCell>
                    <TableCell>{formatDate(campaign.endDate || new Date().toISOString())}</TableCell>
                    <TableCell align="right">{formatCurrency(campaign.budget || 0)}</TableCell>
                    <TableCell>{formatDate(campaign.lostDate || new Date().toISOString())}</TableCell>
                    <TableCell align="right">{campaign.daysInPipeline || 0} days</TableCell>
                    <TableCell>
                      <Tooltip title="View Campaign">
                        <IconButton 
                          size="small"
                          onClick={() => campaign.id && router.push(`/campaigns/${campaign.id}`)}
                          disabled={!campaign.id}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              }).filter(Boolean)
            })()}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={Array.isArray(lostCampaigns) ? lostCampaigns.length : 0}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        />
      </TableContainer>
    </Box>
  )

  const renderContent = () => {
    if (loading) return <LinearProgress />

    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'campaigns':
        return renderCampaigns()
      case 'lost':
        return renderLostCampaigns()
      case 'schedule':
        return <ScheduleBrowser />
      case 'reservations':
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>Reservations</AlertTitle>
              Reservations are created when campaigns (in proposal phase) are converted. They hold inventory until admin approval.
            </Alert>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Reservation #</TableCell>
                    <TableCell>Campaign Origin</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Inventory Reserved</TableCell>
                    <TableCell align="right">Total Amount</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const safeReservations = Array.isArray(reservations) ? reservations : []
                    const slicedReservations = safeReservations.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    
                    if (slicedReservations.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">No reservations available</Typography>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    
                    return slicedReservations.map((reservation, index) => {
                      if (!reservation || typeof reservation !== 'object') {
                        return null
                      }
                      
                      return (
                        <TableRow key={reservation.id || `reservation-${index}`}>
                          <TableCell>{reservation.orderNumber || 'Unknown Order'}</TableCell>
                          <TableCell>{reservation.campaignId || 'Unknown Campaign'}</TableCell>
                          <TableCell>{reservation.advertiserName || 'Unknown Advertiser'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={reservation.status || 'unknown'}
                              size="small"
                              color={
                                reservation.status === 'pending' ? 'warning' :
                                reservation.status === 'approved' ? 'success' :
                                'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{reservation.totalSlots || 0} slots</TableCell>
                          <TableCell align="right">{formatCurrency(reservation.totalAmount || 0)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="View Details">
                                <IconButton 
                                  size="small"
                                  onClick={() => {
                                    if (reservation.id) {
                                      setReservationDetailsDialog({ open: true, reservation })
                                    }
                                  }}
                                  disabled={!reservation.id}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              {reservation.status === 'pending' && (user?.role === 'admin' || user?.role === 'master') && (
                                <Tooltip title="Approve Reservation">
                                  <IconButton 
                                    size="small" 
                                    color="success"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleApproveReservation(reservation)
                                    }}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    }).filter(Boolean)
                  })()}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={Array.isArray(reservations) ? reservations.length : 0}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />
            </TableContainer>
          </Box>
        )
      case 'inventory':
        return (
          <HasPermission permission={PERMISSIONS.ORDERS_VIEW}>
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Inventory Management</AlertTitle>
                Track available ad slots across episodes. Inventory is automatically calculated based on episode length and reserved when proposals convert to reservations.
                {user?.role === 'producer' || user?.role === 'talent' ? (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Note:</strong> You can only see inventory for shows you're assigned to.
                  </Typography>
                ) : user?.role === 'sales' ? (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Note:</strong> You can see inventory for all shows unless specifically restricted.
                  </Typography>
                ) : null}
              </Alert>
            
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Episodes
                    </Typography>
                    <Typography variant="h4">
                      {metrics?.totalEpisodes || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      With available inventory
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Available Slots
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {metrics?.soldInventorySlots || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ready for booking
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Reserved Slots
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {metrics?.pendingInventorySlots || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending approval
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Utilization Rate
                    </Typography>
                    <Typography 
                      variant="h4" 
                      color={
                        (metrics?.selloutPercentage || 0) > 70 ? "success.main" : 
                        (metrics?.selloutPercentage || 0) > 40 ? "warning.main" : 
                        "text.primary"
                      }
                    >
                      {(metrics?.selloutPercentage || 0).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Slots booked/reserved
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Episode</TableCell>
                    <TableCell>Show</TableCell>
                    <TableCell>Air Date</TableCell>
                    <TableCell align="center">Length (min)</TableCell>
                    <TableCell align="center">Total Slots</TableCell>
                    <TableCell align="center">Available</TableCell>
                    <TableCell align="center">Reserved</TableCell>
                    <TableCell align="center">Booked</TableCell>
                    <TableCell align="right">Est. Revenue</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    // Ensure inventory is always an array - defensive programming
                    const safeInventory = Array.isArray(inventory) ? inventory : [];
                    
                    if (safeInventory.length === 0) {
                      // Fallback for empty inventory - never return undefined/null without a React element
                      return (
                        <TableRow key="no-inventory">
                          <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Inventory sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                              <Typography variant="h6" color="text.secondary" gutterBottom>
                                No Inventory Available
                              </Typography>
                              <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Episodes need to be scheduled and have future air dates to generate inventory records.
                              </Typography>
                              {user?.role === 'producer' || user?.role === 'talent' ? (
                                <Typography variant="body2" color="text.secondary">
                                  Make sure you're assigned to shows with scheduled episodes.
                                </Typography>
                              ) : (
                                <Button
                                  variant="outlined"
                                  onClick={() => router.push('/episodes')}
                                  startIcon={<Add />}
                                >
                                  Manage Episodes
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return safeInventory.map((item, index) => {
                      if (!item || typeof item !== 'object') {
                        return null;
                      }
                      
                      return (
                        <TableRow key={item.id || `inventory-${index}`}>
                          <TableCell>{item.episodeTitle || 'Unknown Episode'}</TableCell>
                          <TableCell>{item.showName || 'Unknown Show'}</TableCell>
                          <TableCell>{formatDate(item.airDate || new Date().toISOString())}</TableCell>
                          <TableCell align="center">{item.episodeLength || 0} min</TableCell>
                          <TableCell align="center">{item.totalSlots || 0}</TableCell>
                          <TableCell align="center">{item.totalAvailable || 0}</TableCell>
                          <TableCell align="center">{item.totalReserved || 0}</TableCell>
                          <TableCell align="center">{item.totalBooked || 0}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(
                              (item.preRollPrice || 0) * (item.preRollSlots || 0) +
                              (item.midRollPrice || 0) * (item.midRollSlots || 0) +
                              (item.postRollPrice || 0) * (item.postRollSlots || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => item.episodeId && router.push(`/episodes/${item.episodeId}`)}
                              disabled={!item.episodeId}
                            >
                              <Visibility />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    }).filter(Boolean); // Remove any null returns for React stability
                  })()}
                  {/* Loading state - separate fallback for React stability */}
                  {loading && (
                    <TableRow key="loading-inventory">
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <LinearProgress />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          Loading inventory data...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={Array.isArray(inventory) ? inventory.length : 0}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
                showFirstButton
                showLastButton
              />
            </TableContainer>
            </Box>
          </HasPermission>
        )
      default:
        return (
          <Alert severity="info">
            <AlertTitle>Coming Soon</AlertTitle>
            This view is being integrated into the unified Pre-Sale Management interface.
          </Alert>
        )
    }
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user) return null

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Pre-Sale Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Manage your complete pre-sale workflow from proposals to contracts
            </Typography>
          </Box>

        {/* Action Bar */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Probability</InputLabel>
                <Select
                  value={filterProbability}
                  onChange={(e) => setFilterProbability(e.target.value)}
                  label="Probability"
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="all">All Probabilities</MenuItem>
                  <MenuItem value="10">10% - Initial Contact</MenuItem>
                  <MenuItem value="35">35% - Qualified Lead</MenuItem>
                  <MenuItem value="65">65% - Proposal Sent</MenuItem>
                  <MenuItem value="90">90% - Verbal Agreement</MenuItem>
                  <MenuItem value="100">100% - Signed Contract</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {/* Create New button removed per request
            <Grid item xs={12} md={1.5}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  switch (activeTab) {
                    case 'campaigns':
                      router.push('/campaigns/new')
                      break
                    case 'reservations':
                      // Reservations are created from campaigns in proposal phase, not directly
                      router.push('/campaigns/new')
                      break
                    case 'lost':
                      // Lost campaigns can't be created directly - they are marked as lost
                      router.push('/campaigns/new')
                      break
                    case 'schedule':
                      router.push('/schedule-builder')
                      break
                    default:
                      router.push('/campaigns/new')
                  }
                }}
              >
                Create New
              </Button>
            </Grid>
            */}
          </Grid>
          
          {/* Date Filter Section */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Date Filters
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
              {(dateRange.start || dateRange.end) && (
                <IconButton 
                  onClick={() => {
                    setDateRange({ start: '', end: '' })
                    setSelectedPreset(null)
                  }}
                  size="small"
                  color="error"
                >
                  <Close />
                </IconButton>
              )}
            </Stack>
            
            {/* Current Date Range Display */}
            {(dateRange.start || dateRange.end) && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Date Range:</strong> {dateRange.start || 'No start date'} to {dateRange.end || 'No end date'}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            variant="scrollable" 
            scrollButtons={false}
            sx={{
              '& .MuiTab-root': {
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.875rem'
              }
            }}
          >
            {(() => {
              const visibleTabs = tabs.filter((tab, index) => {
                // Overview tab should always be visible (no permission required)
                if (tab.id === 'overview') {
                  return true;
                }
                
                // Check permission if specified
                if (tab.permission && user) {
                  const hasAccess = hasPermission(user.role, tab.permission);
                  return hasAccess;
                }
                
                // If no permission specified, show the tab
                return true;
              });
              
              // If no tabs are visible (which shouldn't happen), at least show overview
              if (visibleTabs.length === 0) {
                return (
                  <Tab key="overview" label="Overview" value="overview" icon={<DashboardIcon />} />
                );
              }
              
              return visibleTabs.map((tab) => {
                const tabLabel = tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label;
                
                return (
                  <Tab
                    key={tab.id}
                    label={tabLabel}
                    value={tab.id}
                    icon={tab.icon}
                  />
                );
              });
            })()}
          </Tabs>
        </Box>

        {/* Content */}
        {renderContent()}
        
        {/* Conversion Dialog */}
        <Dialog 
          open={conversionDialog.open} 
          onClose={() => setConversionDialog({ open: false, campaign: null })}
        >
          <DialogTitle>Convert Campaign to Reservation</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to convert "{conversionDialog.campaign?.name}" to a reservation? 
              This will create a reservation holding the inventory and require admin approval before becoming an active order.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConversionDialog({ open: false, campaign: null })}>
              Cancel
            </Button>
            <Button onClick={handleConfirmConversion} color="warning" variant="contained">
              Convert to Reservation
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Reservation Details Dialog */}
        <Dialog 
          open={reservationDetailsDialog.open} 
          onClose={() => setReservationDetailsDialog({ open: false, reservation: null })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Reservation Details
              <IconButton onClick={() => setReservationDetailsDialog({ open: false, reservation: null })}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {reservationDetailsDialog.reservation && (
              <Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Reservation Number
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {reservationDetailsDialog.reservation.orderNumber || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Status
                    </Typography>
                    <Chip 
                      label={reservationDetailsDialog.reservation.status || 'unknown'} 
                      size="small"
                      color={
                        reservationDetailsDialog.reservation.status === 'pending' ? 'warning' :
                        reservationDetailsDialog.reservation.status === 'approved' ? 'success' :
                        'default'
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Campaign Origin
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {reservationDetailsDialog.reservation.campaignId || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Client/Advertiser
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {reservationDetailsDialog.reservation.advertiserName || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Inventory Reserved
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {reservationDetailsDialog.reservation.totalSlots || 0} slots
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(reservationDetailsDialog.reservation.totalAmount || 0)}
                    </Typography>
                  </Grid>
                  {reservationDetailsDialog.reservation.createdAt && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Created Date
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {formatDate(reservationDetailsDialog.reservation.createdAt)}
                      </Typography>
                    </Grid>
                  )}
                  {reservationDetailsDialog.reservation.expiresAt && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Expiration Date
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {formatDate(reservationDetailsDialog.reservation.expiresAt)}
                      </Typography>
                    </Grid>
                  )}
                  {reservationDetailsDialog.reservation.notes && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Notes
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {reservationDetailsDialog.reservation.notes}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
                
                {/* Show inventory items if available */}
                {reservationDetailsDialog.reservation.items && reservationDetailsDialog.reservation.items.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Reserved Inventory Items
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Show</TableCell>
                            <TableCell>Episode</TableCell>
                            <TableCell>Air Date</TableCell>
                            <TableCell>Placement</TableCell>
                            <TableCell align="right">Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reservationDetailsDialog.reservation.items.map((item: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{item.showName || 'N/A'}</TableCell>
                              <TableCell>{item.episodeTitle || 'N/A'}</TableCell>
                              <TableCell>{item.airDate ? formatDate(item.airDate) : 'N/A'}</TableCell>
                              <TableCell>{item.placement || 'N/A'}</TableCell>
                              <TableCell align="right">{formatCurrency(item.rate || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {reservationDetailsDialog.reservation?.status === 'pending' && (user?.role === 'admin' || user?.role === 'master') && (
              <Button 
                onClick={() => {
                  handleApproveReservation(reservationDetailsDialog.reservation)
                  setReservationDetailsDialog({ open: false, reservation: null })
                }}
                color="success"
                variant="contained"
                startIcon={<CheckCircle />}
              >
                Approve Reservation
              </Button>
            )}
            <Button onClick={() => setReservationDetailsDialog({ open: false, reservation: null })}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

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
                      {(() => {
                        const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)
                        return years.map(year => {
                          if (typeof year !== 'number') {
                            return null
                          }
                          return (
                            <MenuItem key={year} value={year}>{year}</MenuItem>
                          )
                        }).filter(Boolean)
                      })()}
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
                      {(() => {
                        const months = Array.from({ length: 12 }, (_, i) => i + 1)
                        return months.map(month => {
                          if (typeof month !== 'number') {
                            return null
                          }
                          return (
                            <MenuItem key={month} value={month}>
                              {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                            </MenuItem>
                          )
                        }).filter(Boolean)
                      })()}
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
                      {(() => {
                        const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)
                        return years.map(year => {
                          if (typeof year !== 'number') {
                            return null
                          }
                          return (
                            <MenuItem key={year} value={year}>{year}</MenuItem>
                          )
                        }).filter(Boolean)
                      })()}
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
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="date"
                    fullWidth
                    label="End Date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
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
              disabled={customDateType === 'range' && !dateRange.start && !dateRange.end}
            >
              Apply Filter
            </Button>
          </DialogActions>
        </Dialog>
        </Box>
      </DashboardLayout>
    </ErrorBoundary>
  )
}