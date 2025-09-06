'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material'
import {
  Download,
  PictureAsPdf,
  TableChart,
  Description,
  Assessment,
  AccountBalance,
  TrendingUp,
  Receipt,
  CalendarMonth,
  DateRange,
  Info
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'

interface ReportConfig {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: 'financial' | 'tax' | 'analysis'
  endpoint: string
  parameters: {
    dateRange?: boolean
    quarter?: boolean
    year?: boolean
    customDates?: boolean
    format?: string[]
  }
  color: string
}

const REPORT_TYPES: ReportConfig[] = [
  {
    id: 'monthly',
    name: 'Monthly Financial Report',
    description: 'Comprehensive monthly revenue, expenses, and P&L summary',
    icon: <CalendarMonth />,
    category: 'financial',
    endpoint: '/api/reports/financial/monthly',
    parameters: {
      dateRange: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#1976d2'
  },
  {
    id: 'quarterly',
    name: 'Quarterly Performance Report',
    description: 'Quarterly business performance with trends and KPIs',
    icon: <Assessment />,
    category: 'financial',
    endpoint: '/api/reports/financial/quarterly',
    parameters: {
      quarter: true,
      year: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#2e7d32'
  },
  {
    id: 'pl',
    name: 'Profit & Loss Statement',
    description: 'Detailed P&L with revenue streams and expense breakdown',
    icon: <TrendingUp />,
    category: 'financial',
    endpoint: '/api/reports/financial/pl',
    parameters: {
      year: true,
      customDates: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#ed6c02'
  },
  {
    id: 'tax',
    name: 'Tax Preparation Report',
    description: 'Annual tax summary with deductible expenses and quarterly breakdown',
    icon: <AccountBalance />,
    category: 'tax',
    endpoint: '/api/reports/financial/tax',
    parameters: {
      year: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#9c27b0'
  },
  {
    id: 'budget',
    name: 'Budget Analysis Report',
    description: 'Budget vs actual analysis with variance reporting',
    icon: <Receipt />,
    category: 'analysis',
    endpoint: '/api/reports/financial/budget',
    parameters: {
      dateRange: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#d32f2f'
  },
  {
    id: 'cashflow',
    name: 'Cash Flow Statement',
    description: 'Operating, investing, and financing cash flows',
    icon: <DateRange />,
    category: 'financial',
    endpoint: '/api/reports/financial/cashflow',
    parameters: {
      dateRange: true,
      format: ['pdf', 'excel', 'csv']
    },
    color: '#0288d1'
  }
]

export function FinancialReportsTab() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [reportFormat, setReportFormat] = useState('pdf')
  const [dateRange, setDateRange] = useState('thisMonth')
  const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3))
  const [year, setYear] = useState(new Date().getFullYear())
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')

  const handleReportSelect = (report: ReportConfig) => {
    setSelectedReport(report)
    setDownloadDialogOpen(true)
  }

  const handleGenerateReport = async () => {
    if (!selectedReport) return

    setGeneratingReport(true)
    setDownloadDialogOpen(false)

    try {
      // Build request parameters
      const params: any = {
        format: reportFormat
      }

      if (selectedReport.parameters.dateRange) {
        params.dateRange = dateRange
        if (dateRange === 'custom' && customStartDate && customEndDate) {
          params.startDate = customStartDate.format('YYYY-MM-DD')
          params.endDate = customEndDate.format('YYYY-MM-DD')
        }
      }

      if (selectedReport.parameters.quarter) {
        params.quarter = quarter
      }

      if (selectedReport.parameters.year) {
        params.year = year
      }

      if (selectedReport.parameters.customDates && customStartDate && customEndDate) {
        params.startMonth = customStartDate.month() + 1
        params.endMonth = customEndDate.month() + 1
        params.year = customStartDate.year()
      }

      // Make API call
      const response = await fetch(selectedReport.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate report')
      }

      // Handle different response types
      let blob: Blob
      let filename: string

      if (reportFormat === 'json') {
        const data = await response.json()
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        filename = `${selectedReport.id}-report-${new Date().toISOString().split('T')[0]}.json`
      } else {
        blob = await response.blob()
        const contentDisposition = response.headers.get('Content-Disposition')
        filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 
                  `${selectedReport.id}-report-${new Date().toISOString().split('T')[0]}.${reportFormat}`
      }

      // Download the file
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSnackbarMessage(`${selectedReport.name} generated successfully!`)
      setSnackbarSeverity('success')
      setSnackbarOpen(true)
    } catch (error) {
      console.error('Report generation error:', error)
      setSnackbarMessage(error instanceof Error ? error.message : 'Failed to generate report')
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    } finally {
      setGeneratingReport(false)
      setSelectedReport(null)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'financial': return 'primary'
      case 'tax': return 'secondary'
      case 'analysis': return 'success'
      default: return 'default'
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Financial Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Generate comprehensive financial reports for analysis, tax preparation, and compliance
        </Typography>
      </Box>

      {/* Report Cards Grid */}
      <Grid container spacing={3}>
        {REPORT_TYPES.map((report) => (
          <Grid item xs={12} md={6} lg={4} key={report.id}>
            <Card 
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                  borderColor: report.color
                }
              }}
              onClick={() => handleReportSelect(report)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      backgroundColor: `${report.color}15`,
                      color: report.color,
                      mr: 2
                    }}
                  >
                    {report.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {report.name}
                    </Typography>
                    <Chip 
                      label={report.category} 
                      size="small"
                      color={getCategoryColor(report.category) as any}
                      sx={{ mb: 1 }}
                    />
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {report.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {report.parameters.format?.map((format) => (
                    <Chip
                      key={format}
                      label={format.toUpperCase()}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Download />}
                  sx={{ 
                    mt: 2,
                    backgroundColor: report.color,
                    '&:hover': {
                      backgroundColor: report.color,
                      filter: 'brightness(0.9)'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReportSelect(report)
                  }}
                >
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mt: 4, p: 3, backgroundColor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PictureAsPdf />}
              onClick={() => {
                const monthlyReport = REPORT_TYPES.find(r => r.id === 'monthly')
                if (monthlyReport) {
                  setReportFormat('pdf')
                  handleReportSelect(monthlyReport)
                }
              }}
            >
              Current Month P&L
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => {
                const quarterlyReport = REPORT_TYPES.find(r => r.id === 'quarterly')
                if (quarterlyReport) {
                  setReportFormat('excel')
                  handleReportSelect(quarterlyReport)
                }
              }}
            >
              Quarterly Report
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AccountBalance />}
              onClick={() => {
                const taxReport = REPORT_TYPES.find(r => r.id === 'tax')
                if (taxReport) {
                  setReportFormat('pdf')
                  setYear(new Date().getFullYear() - 1)
                  handleReportSelect(taxReport)
                }
              }}
            >
              Last Year Tax Report
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Description />}
              onClick={() => {
                const budgetReport = REPORT_TYPES.find(r => r.id === 'budget')
                if (budgetReport) {
                  setReportFormat('csv')
                  handleReportSelect(budgetReport)
                }
              }}
            >
              Budget Analysis
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Report Configuration Dialog */}
      <Dialog 
        open={downloadDialogOpen} 
        onClose={() => setDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Configure {selectedReport?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* Format Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                label="Export Format"
              >
                {selectedReport?.parameters.format?.map((format) => (
                  <MenuItem key={format} value={format}>
                    {format.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date Range Selection */}
            {selectedReport?.parameters.dateRange && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  label="Date Range"
                >
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="lastMonth">Last Month</MenuItem>
                  <MenuItem value="thisQuarter">This Quarter</MenuItem>
                  <MenuItem value="lastQuarter">Last Quarter</MenuItem>
                  <MenuItem value="thisYear">This Year</MenuItem>
                  <MenuItem value="lastYear">Last Year</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Custom Date Range */}
            {dateRange === 'custom' && selectedReport?.parameters.customDates && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <DatePicker
                    label="Start Date"
                    value={customStartDate}
                    onChange={setCustomStartDate}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={customEndDate}
                    onChange={setCustomEndDate}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Box>
              </LocalizationProvider>
            )}

            {/* Quarter Selection */}
            {selectedReport?.parameters.quarter && (
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select
                    value={quarter}
                    onChange={(e) => setQuarter(Number(e.target.value))}
                    label="Quarter"
                  >
                    <MenuItem value={1}>Q1</MenuItem>
                    <MenuItem value={2}>Q2</MenuItem>
                    <MenuItem value={3}>Q3</MenuItem>
                    <MenuItem value={4}>Q4</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  inputProps={{ min: 2020, max: new Date().getFullYear() }}
                />
              </Box>
            )}

            {/* Year Selection */}
            {selectedReport?.parameters.year && !selectedReport?.parameters.quarter && (
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                inputProps={{ min: 2020, max: new Date().getFullYear() }}
                sx={{ mb: 3 }}
              />
            )}

            {/* Info Alert */}
            <Alert severity="info" icon={<Info />}>
              This report will include all financial data for your organization within the selected period.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerateReport} 
            variant="contained"
            disabled={generatingReport}
            startIcon={generatingReport ? <CircularProgress size={20} /> : <Download />}
          >
            {generatingReport ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Overlay */}
      {generatingReport && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6">Generating Report...</Typography>
            <Typography variant="body2" color="text.secondary">
              This may take a few moments
            </Typography>
          </Card>
        </Box>
      )}

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}