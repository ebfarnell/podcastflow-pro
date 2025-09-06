'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material'
import { StatusChip } from '@/components/ui/StatusChip'
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { campaignApi, advertiserApi, agencyApi } from '@/services/api'
import { Campaign } from '@/store/slices/campaignSlice'
import { useQuery } from '@tanstack/react-query'
import { VisualExportModal } from '@/components/exports/VisualExportModal'
import { PDFExporter, createChartCanvas } from '@/utils/pdfExport'
import { exportToCSV, exportToJSON } from '@/utils/export'
import { useCampaignUpdates } from '@/hooks/useRealtimeUpdates'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'

export default function CampaignsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('all')
  const [agencyFilter, setAgencyFilter] = useState<string>('all')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [sortModel, setSortModel] = useState<any[]>([
    { field: 'createdAt', sort: 'desc' }
  ])

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', statusFilter, advertiserFilter, agencyFilter],
    queryFn: () => {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (advertiserFilter !== 'all') params.advertiserId = advertiserFilter
      if (agencyFilter !== 'all') params.agencyId = agencyFilter
      return campaignApi.list(params)
    },
    staleTime: 0, // Always refetch when window regains focus
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })

  // Fetch advertisers and agencies for filter dropdowns
  const { data: advertisersData } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: () => advertiserApi.list(),
  })

  const { data: agenciesData } = useQuery({
    queryKey: ['agencies-list'],
    queryFn: () => agencyApi.list(),
  })
  
  // Enable real-time updates for campaigns
  const { connected } = useCampaignUpdates()

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Campaign',
      flex: 1,
      minWidth: 150,
      sortable: true,
    },
    {
      field: 'advertiserName',
      headerName: 'Client',
      flex: 0.7,
      minWidth: 100,
      sortable: true,
      valueGetter: (params) => params.row.advertiserName || params.row.advertiser || 'Unknown',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      sortable: true,
      renderCell: (params: GridRenderCellParams) => {
        return <StatusChip status={params.value} />
      },
    },
    {
      field: 'budget',
      headerName: 'Budget',
      width: 90,
      type: 'number',
      sortable: true,
      valueFormatter: (params) => `$${params.value?.toLocaleString() || 0}`,
    },
    {
      field: 'spent',
      headerName: 'Spent',
      width: 90,
      type: 'number',
      sortable: true,
      valueFormatter: (params) => `$${params.value?.toLocaleString() || 0}`,
    },
    {
      field: 'impressions',
      headerName: 'Impressions',
      width: 100,
      type: 'number',
      sortable: true,
      valueFormatter: (params) => {
        const value = params.value || 0
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`
        }
        return value.toString()
      },
    },
    {
      field: 'startDate',
      headerName: 'Start',
      width: 85,
      type: 'date',
      sortable: true,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
        return ''
      },
    },
    {
      field: 'endDate',
      headerName: 'End',
      width: 85,
      type: 'date',
      sortable: true,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
        return ''
      },
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 95,
      type: 'date',
      sortable: true,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
        }
        return ''
      },
    },
  ]

  const filteredCampaigns = campaigns?.campaigns?.filter((campaign: Campaign) => {
    const advertiserName = campaign.advertiserName || campaign.advertiser || ''
    return campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advertiserName.toLowerCase().includes(searchTerm.toLowerCase())
  }) || []

  const handleRowClick = (params: any) => {
    router.push(`/campaigns/${params.row.id}`)
  }

  const handleExport = async (format: string, settings: any) => {
    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'Campaign Performance Report',
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          orientation: settings.orientation || 'landscape'
        })

        // Calculate metrics
        const totalBudget = filteredCampaigns.reduce((sum: number, c: Campaign) => sum + (c.budget || 0), 0)
        const totalSpent = filteredCampaigns.reduce((sum: number, c: Campaign) => sum + (c.spent || 0), 0)
        const totalImpressions = filteredCampaigns.reduce((sum: number, c: Campaign) => sum + (c.impressions || 0), 0)
        const activeCampaigns = filteredCampaigns.filter((c: Campaign) => c.status === 'active').length

        if (settings.includeSummary) {
          exporter.addSummarySection([
            { label: 'Total Campaigns', value: filteredCampaigns.length },
            { label: 'Active Campaigns', value: activeCampaigns },
            { label: 'Total Budget', value: `$${totalBudget.toLocaleString()}` },
            { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
            { label: 'Budget Utilization', value: `${((totalSpent / totalBudget) * 100).toFixed(1)}%` },
            { label: 'Total Impressions', value: totalImpressions >= 1000000 ? `${(totalImpressions / 1000000).toFixed(1)}M` : totalImpressions.toLocaleString() },
            { label: 'Avg CTR', value: '3.8%' },
            { label: 'Avg CPA', value: '$24.50' }
          ])
        }

        if (settings.includeCharts) {
          // Status distribution pie chart
          const statusCounts = filteredCampaigns.reduce((acc: any, c: Campaign) => {
            acc[c.status] = (acc[c.status] || 0) + 1
            return acc
          }, {})

          const statusChart = await createChartCanvas('pie', {
            labels: Object.keys(statusCounts),
            datasets: [{
              data: Object.values(statusCounts),
              backgroundColor: ['#4caf50', '#ff9800', '#2196f3', '#9e9e9e']
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Campaign Status Distribution'
              }
            }
          })
          await exporter.addChart(statusChart)

          // Performance metrics bar chart
          const topCampaigns = filteredCampaigns
            .slice(0, 5)
            .map((c: Campaign) => ({
              name: c.name,
              impressions: c.impressions || 0,
              ctr: c.ctr || 3.5,
              spent: c.spent || 0
            }))

          const performanceChart = await createChartCanvas('bar', {
            labels: topCampaigns.map((c: any) => c.name),
            datasets: [
              {
                label: 'Impressions (K)',
                data: topCampaigns.map((c: any) => c.impressions / 1000),
                backgroundColor: '#1976d2'
              },
              {
                label: 'CTR (%)',
                data: topCampaigns.map((c: any) => c.ctr),
                backgroundColor: '#dc004e'
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Top 5 Campaigns Performance'
              }
            }
          })
          await exporter.addChart(performanceChart)

          // Budget vs Spend comparison
          const budgetComparison = filteredCampaigns
            .filter((c: Campaign) => c.budget && c.spent)
            .slice(0, 8)
            .map((c: Campaign) => ({
              name: c.name,
              budget: c.budget || 0,
              spent: c.spent || 0
            }))

          const budgetChart = await createChartCanvas('bar', {
            labels: budgetComparison.map((c: any) => c.name),
            datasets: [
              {
                label: 'Budget',
                data: budgetComparison.map((c: any) => c.budget),
                backgroundColor: '#9c27b0'
              },
              {
                label: 'Spent',
                data: budgetComparison.map((c: any) => c.spent),
                backgroundColor: '#4caf50'
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Budget vs Actual Spend'
              }
            }
          })
          await exporter.addChart(budgetChart)
        }

        if (settings.includeRawData) {
          // Campaign details table
          const tableData = filteredCampaigns.map((c: Campaign) => [
            c.name,
            c.advertiserName || c.advertiser || 'Unknown',
            c.status,
            `$${(c.budget || 0).toLocaleString()}`,
            `$${(c.spent || 0).toLocaleString()}`,
            c.impressions >= 1000000 ? `${(c.impressions / 1000000).toFixed(1)}M` : (c.impressions || 0).toLocaleString(),
            `${c.ctr || 0}%`,
            c.startDate ? new Date(c.startDate).toLocaleDateString() : 'N/A',
            c.endDate ? new Date(c.endDate).toLocaleDateString() : 'N/A'
          ])

          exporter.addTable(
            ['Campaign', 'Client', 'Status', 'Budget', 'Spent', 'Impressions', 'CTR', 'Start Date', 'End Date'],
            tableData,
            'Campaign Details'
          )
        }

        exporter.addFooter('PodcastFlow Pro - Campaign Management')
        await exporter.save(`campaigns-report-${new Date().toISOString().split('T')[0]}.pdf`)
      }
      else if (format === 'csv') {
        const csvData = [
          ['Campaign Report', new Date().toLocaleDateString()],
          [],
          ['Campaign Name', 'Client', 'Status', 'Start Date', 'End Date', 'Budget', 'Spent', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'CPA', 'Created', 'Updated'],
          ...filteredCampaigns.map((c: Campaign) => [
            c.name,
            c.advertiserName || c.advertiser || 'Unknown',
            c.status,
            c.startDate ? new Date(c.startDate).toLocaleDateString() : '',
            c.endDate ? new Date(c.endDate).toLocaleDateString() : '',
            c.budget || 0,
            c.spent || 0,
            c.impressions || 0,
            c.clicks || 0,
            `${c.ctr || 0}%`,
            c.conversions || 0,
            c.cpa ? `$${c.cpa}` : '',
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
            c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''
          ])
        ]
        
        exportToCSV(csvData, `campaigns-${new Date().toISOString().split('T')[0]}.csv`)
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          totalCampaigns: filteredCampaigns.length,
          campaigns: filteredCampaigns.map((c: Campaign) => ({
            id: c.id,
            name: c.name,
            client: c.advertiserName || c.advertiser || 'Unknown',
            status: c.status,
            budget: c.budget,
            spent: c.spent,
            impressions: c.impressions,
            clicks: c.clicks,
            ctr: c.ctr,
            conversions: c.conversions,
            cpa: c.cpa,
            startDate: c.startDate,
            endDate: c.endDate,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
          }))
        }
        
        exportToJSON(jsonData, `campaigns-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
      <RoleGuard 
        roles={['master', 'admin', 'sales']} 
        permissions={[PERMISSIONS.CAMPAIGNS_VIEW]}
      >
        <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Campaigns
          </Typography>
          {user && ['master', 'admin', 'sales'].includes(user.role) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/campaigns/new')}
            >
              New Campaign
            </Button>
          )}
        </Box>

        <Card>
          <Box sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search campaigns..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Advertiser</InputLabel>
              <Select
                value={advertiserFilter}
                label="Advertiser"
                onChange={(e) => setAdvertiserFilter(e.target.value)}
              >
                <MenuItem value="all">All Advertisers</MenuItem>
                {advertisersData?.advertisers?.map((advertiser: any) => (
                  <MenuItem key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Agency</InputLabel>
              <Select
                value={agencyFilter}
                label="Agency"
                onChange={(e) => setAgencyFilter(e.target.value)}
              >
                <MenuItem value="all">All Agencies</MenuItem>
                {agenciesData?.agencies?.map((agency: any) => (
                  <MenuItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={() => setExportModalOpen(true)} size="small">
              <DownloadIcon />
            </IconButton>
          </Box>
          <Divider />
          <DataGrid
            rows={filteredCampaigns}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
              sorting: {
                sortModel: sortModel,
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection
            onRowClick={handleRowClick}
            loading={isLoading}
            sortModel={sortModel}
            onSortModelChange={(newSortModel) => setSortModel(newSortModel)}
            sortingMode="client"
            disableColumnMenu
            sx={{
              border: 0,
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
              },
              '& .MuiDataGrid-cell': {
                py: 1,
              },
              '& .MuiDataGrid-columnHeaders': {
                minHeight: '40px !important',
              },
              '& .MuiDataGrid-columnHeader': {
                height: '40px',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 600,
              },
              '& .MuiDataGrid-sortIcon': {
                opacity: 0.5,
              },
              '& .MuiDataGrid-columnHeader--sortable:hover': {
                '& .MuiDataGrid-sortIcon': {
                  opacity: 1,
                },
              },
            }}
            autoHeight
            density="compact"
          />
        </Card>
      </Box>


      <VisualExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Campaign Report"
        onExport={handleExport}
        availableFormats={['pdf', 'csv', 'json']}
        defaultFormat="pdf"
      />
      </RoleGuard>
      </DashboardLayout>
    </RouteProtection>
  )
}