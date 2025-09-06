'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/config/queryClient'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Tab,
  Tabs,
  LinearProgress,
  Avatar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  Download,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  AccountBalance,
  Receipt,
  Payment as PaymentIcon,
  Schedule,
  CheckCircle,
  Warning,
  FilterList,
  MoreVert,
  CalendarMonth,
  Add,
  Edit,
  Delete,
  Assessment,
  Timeline,
  PieChart,
  Refresh
} from '@mui/icons-material'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { VisualExportModal } from '@/components/exports/VisualExportModal'
import { PDFExporter, createChartCanvas } from '@/utils/pdfExport'
import { exportToCSV, exportToJSON } from '@/utils/export'
import { financialApi, FinancialSummary, Transaction, Invoice, Payment } from '@/services/financialApi'
import React from 'react'




export default function FinancialsPage() {
  const queryClient = useQueryClient()
  const [selectedTab, setSelectedTab] = useState(0)
  const [dateRange, setDateRange] = useState('thisMonth')
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  
  // P&L State (from Executive Reports)
  const [plYear, setPlYear] = useState(new Date().getFullYear())
  const [plStartMonth, setPlStartMonth] = useState(1)
  const [plEndMonth, setPlEndMonth] = useState(12)
  const [plData, setPlData] = useState<any>(null)
  
  // Revenue Projections State (from Executive Reports)
  const [projectionMonths, setProjectionMonths] = useState(12)
  const [projectionData, setProjectionData] = useState<any>(null)
  
  // Expense management states
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    vendor: '',
    amount: '',
    category: 'office',
    type: 'oneTime',
    frequency: 'monthly',
    status: 'pending',
    notes: '',
    invoiceNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  })

  // Fetch financial summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'summary', dateRange],
    queryFn: () => financialApi.getFinancialSummary(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'transactions', dateRange],
    queryFn: () => financialApi.getTransactions({ dateRange, limit: 10 }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Fetch invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'invoices', dateRange],
    queryFn: () => financialApi.getInvoices({ dateRange, limit: 10 }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
  const invoices = invoicesData?.invoices || invoicesData || []

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'payments', dateRange],
    queryFn: () => financialApi.getPayments({ dateRange, limit: 10 }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Fetch cash flow
  const { data: cashFlow, isLoading: cashFlowLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'cashflow'],
    queryFn: () => financialApi.getCashFlow({ period: 'monthly', months: 6 }),
    staleTime: 10 * 60 * 1000, // 10 minutes - cash flow doesn't change often
  })

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials', 'expenses', dateRange],
    queryFn: () => fetch(`/api/expenses?dateRange=${dateRange}`).then(res => res.json()),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // P&L data fetching (from Executive Reports)
  const { data: plDataQuery, isLoading: plLoading } = useQuery({
    queryKey: ['executive', 'pl-report', plYear, plStartMonth, plEndMonth],
    queryFn: async () => {
      const response = await fetch(
        `/api/executive/pl-report?year=${plYear}&startMonth=${plStartMonth}&endMonth=${plEndMonth}`
      )
      if (!response.ok) throw new Error('Failed to fetch P&L data')
      return response.json()
    },
    enabled: selectedTab === 6,
    staleTime: 5 * 60 * 1000,
  })

  // Revenue projections data fetching (from Executive Reports)
  const { data: projectionDataQuery, isLoading: projectionLoading } = useQuery({
    queryKey: ['executive', 'revenue-projections', projectionMonths],
    queryFn: async () => {
      const response = await fetch(`/api/executive/revenue-projections?months=${projectionMonths}`)
      if (!response.ok) throw new Error('Failed to fetch projection data')
      return response.json()
    },
    enabled: selectedTab === 7,
    staleTime: 5 * 60 * 1000,
  })

  // Calculate revenue by source from transactions
  const revenueBySource = (() => {
    const revenueTransactions = transactions.filter(t => t.type === 'income')
    const sourceGroups = revenueTransactions.reduce((acc, t) => {
      const source = t.client || 'Other'
      acc[source] = (acc[source] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)
    
    const totalRevenue = summary?.totalRevenue || Object.values(sourceGroups).reduce((sum, amount) => sum + amount, 0)
    return Object.entries(sourceGroups).map(([source, amount]) => ({
      source,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
    })).sort((a, b) => b.amount - a.amount)
  })()

  // Computed values
  const totalRevenue = summary?.totalRevenue || 0
  const totalExpenses = summary?.totalExpenses || 0
  const netProfit = summary?.netProfit || 0
  const profitMargin = summary?.profitMargin || 0
  const outstandingAmount = summary?.outstandingInvoices || 0
  const monthlyRecurring = summary?.monthlyRecurring || 0

  const loading = summaryLoading || transactionsLoading || invoicesLoading || paymentsLoading || cashFlowLoading || expensesLoading
  const error = null // React Query handles errors internally

  // Update local state when queries complete
  React.useEffect(() => {
    if (plDataQuery) setPlData(plDataQuery)
  }, [plDataQuery])

  React.useEffect(() => {
    if (projectionDataQuery) setProjectionData(projectionDataQuery)
  }, [projectionDataQuery])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }


  const handleCreateInvoice = async (invoiceData: any) => {
    try {
      const newInvoice = await financialApi.createInvoice(invoiceData)
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials', 'invoices'] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials', 'summary'] })
      return { success: true, invoice: newInvoice }
    } catch (error) {
      console.error('Error creating invoice:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  const handleRecordPayment = async (paymentData: any) => {
    try {
      const newPayment = await financialApi.recordPayment(paymentData)
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials', 'payments'] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials', 'summary'] })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials', 'transactions'] })
      return { success: true, payment: newPayment }
    } catch (error) {
      console.error('Error recording payment:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Expense mutations
  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof expenseForm) => {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to create expense')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials'] })
      setExpenseDialogOpen(false)
      resetExpenseForm()
    },
    onError: (error) => {
      console.error('Error creating expense:', error)
      alert('Failed to create expense')
    }
  })

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof expenseForm }) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update expense')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials'] })
      setExpenseDialogOpen(false)
      setEditingExpense(null)
      resetExpenseForm()
    },
    onError: (error) => {
      console.error('Error updating expense:', error)
      alert('Failed to update expense')
    }
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete expense')
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, 'financials'] })
    },
    onError: (error) => {
      console.error('Error deleting expense:', error)
      alert('Failed to delete expense')
    }
  })

  const handleCreateExpense = () => {
    createExpenseMutation.mutate(expenseForm)
  }

  const handleUpdateExpense = () => {
    if (!editingExpense) return
    updateExpenseMutation.mutate({ id: editingExpense.id, data: expenseForm })
  }

  const handleDeleteExpense = (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    deleteExpenseMutation.mutate(id)
  }

  const resetExpenseForm = () => {
    setExpenseForm({
      description: '',
      vendor: '',
      amount: '',
      category: 'office',
      type: 'oneTime',
      frequency: 'monthly',
      status: 'pending',
      notes: '',
      invoiceNumber: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    })
  }

  const openEditExpense = (expense: any) => {
    setEditingExpense(expense)
    setExpenseForm({
      description: expense.description,
      vendor: expense.vendor,
      amount: expense.amount.toString(),
      category: expense.category,
      type: expense.type,
      frequency: expense.frequency || 'monthly',
      status: expense.status,
      notes: expense.notes || '',
      invoiceNumber: expense.invoiceNumber || '',
      startDate: expense.startDate ? new Date(expense.startDate).toISOString().split('T')[0] : '',
      endDate: expense.endDate ? new Date(expense.endDate).toISOString().split('T')[0] : ''
    })
    setExpenseDialogOpen(true)
  }

  const handleExport = async (format: string, settings: any) => {
    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'Financial Report',
          subtitle: `${dateRange} - Generated on ${new Date().toLocaleDateString()}`,
          orientation: settings.orientation || 'portrait'
        })

        // Financial summary
        if (settings.includeSummary) {
          exporter.addSummarySection([
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}` },
            { label: 'Total Expenses', value: `$${totalExpenses.toLocaleString()}` },
            { label: 'Net Profit', value: `$${netProfit.toLocaleString()}` },
            { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%` },
            { label: 'Outstanding', value: `$${outstandingAmount.toLocaleString()}` },
            { label: 'Overdue Invoices', value: invoices.filter(inv => inv.status === 'overdue').length },
            { label: 'Revenue Growth', value: '+23%' },
            { label: 'YTD Revenue', value: '$1.2M' }
          ])
        }

        // Cash flow area chart data (needed for both charts and raw data)
        const chartData = cashFlow?.data || []

        if (settings.includeCharts) {
          const cashFlowChart = await createChartCanvas('line', {
            labels: chartData.map((d: any) => d.month),
            datasets: [
              {
                label: 'Income',
                data: chartData.map((d: any) => d.income),
                borderColor: '#82ca9d',
                backgroundColor: 'rgba(130, 202, 157, 0.2)',
                fill: true
              },
              {
                label: 'Expenses',
                data: chartData.map((d: any) => d.expenses),
                borderColor: '#ff7c7c',
                backgroundColor: 'rgba(255, 124, 124, 0.2)',
                fill: true
              },
              {
                label: 'Net',
                data: chartData.map((d: any) => d.net),
                borderColor: '#1976d2',
                backgroundColor: 'rgba(25, 118, 210, 0.2)',
                fill: false,
                borderWidth: 3
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Cash Flow Analysis'
              }
            }
          })
          await exporter.addChart(cashFlowChart)

          // Revenue by source pie chart
          const revenueSourceChart = await createChartCanvas('doughnut', {
            labels: revenueBySource.map(d => d.source),
            datasets: [{
              data: revenueBySource.map(d => d.amount),
              backgroundColor: ['#1976d2', '#dc004e', '#9c27b0']
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Revenue Distribution by Source'
              }
            }
          })
          await exporter.addChart(revenueSourceChart)

          // Monthly profit trend
          const profitTrendChart = await createChartCanvas('bar', {
            labels: chartData.map((d: any) => d.month),
            datasets: [{
              label: 'Net Profit',
              data: chartData.map((d: any) => d.net),
              backgroundColor: chartData.map((d: any) => d.net > 80000 ? '#4caf50' : '#2196f3')
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Monthly Profit Trend'
              }
            }
          })
          await exporter.addChart(profitTrendChart)
        }

        if (settings.includeRawData) {
          // Cash flow breakdown
          exporter.addTable(
            ['Month', 'Income', 'Expenses', 'Net Profit', 'Margin %'],
            chartData.map((d: any) => [
              d.month,
              `$${d.income.toLocaleString()}`,
              `$${d.expenses.toLocaleString()}`,
              `$${d.net.toLocaleString()}`,
              `${((d.net / d.income) * 100).toFixed(1)}%`
            ]),
            'Monthly Cash Flow Breakdown'
          )

          // Outstanding invoices
          exporter.addTable(
            ['Invoice #', 'Client', 'Amount', 'Due Date', 'Status'],
            invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').map((inv: any) => [
              inv.id,
              inv.client,
              `$${inv.amount.toLocaleString()}`,
              new Date(inv.dueDate).toLocaleDateString(),
              inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
            ]),
            'Outstanding Invoices'
          )

          // Recent transactions
          exporter.addTable(
            ['Date', 'Description', 'Client', 'Type', 'Amount', 'Status'],
            transactions.map((t: any) => [
              new Date(t.date).toLocaleDateString(),
              t.description,
              t.client,
              t.type.charAt(0).toUpperCase() + t.type.slice(1),
              `${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString()}`,
              t.status.charAt(0).toUpperCase() + t.status.slice(1)
            ]),
            'Recent Transactions'
          )
        }

        exporter.addFooter('PodcastFlow Pro - Financial Management')
        await exporter.save(`financial-report-${dateRange}-${new Date().toISOString().split('T')[0]}.pdf`)
      }
      else if (format === 'csv') {
        const csvData = [
          ['Financial Report', new Date().toLocaleDateString(), dateRange],
          [],
          ['Financial Summary'],
          ['Metric', 'Value'],
          ['Total Revenue', totalRevenue],
          ['Total Expenses', totalExpenses],
          ['Net Profit', netProfit],
          ['Profit Margin', `${profitMargin.toFixed(1)}%`],
          ['Outstanding Amount', outstandingAmount],
          [],
          ['Cash Flow Analysis'],
          ['Month', 'Income', 'Expenses', 'Net'],
          ...(cashFlow?.data || []).map((d: any) => [d.month, d.income, d.expenses, d.net]),
          [],
          ['Revenue by Source'],
          ['Source', 'Amount', 'Percentage'],
          ...revenueBySource.map(s => [s.source, s.amount, `${s.percentage}%`]),
          [],
          ['Outstanding Invoices'],
          ['Invoice', 'Client', 'Amount', 'Due Date', 'Status'],
          ...invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').map((inv: any) => [
            inv.id,
            inv.client,
            inv.amount,
            inv.dueDate,
            inv.status
          ])
        ]
        
        exportToCSV(csvData, `financial-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`)
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          period: dateRange,
          summary: {
            totalRevenue,
            totalExpenses,
            netProfit,
            profitMargin: parseFloat(profitMargin.toFixed(2)),
            outstandingAmount: outstandingAmount,
            revenueGrowth: summary?.revenueGrowth || 23
          },
          cashFlow: cashFlow?.data || [],
          revenueBySource,
          outstandingInvoices: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue'),
          recentTransactions: transactions,
          insights: {
            highestRevenueMonth: (cashFlow?.data || []).length > 0 ? (cashFlow?.data || []).reduce((max: any, d: any) => d.income > max.income ? d : max).month : 'N/A',
            lowestExpenseMonth: (cashFlow?.data || []).length > 0 ? (cashFlow?.data || []).reduce((min: any, d: any) => d.expenses < min.expenses ? d : min).month : 'N/A',
            averageMonthlyProfit: (cashFlow?.data || []).length > 0 ? (cashFlow?.data || []).reduce((sum: any, d: any) => sum + d.net, 0) / (cashFlow?.data || []).length : 0,
            projectedYearEndRevenue: totalRevenue * (1 + (summary?.revenueGrowth || 23) / 100)
          }
        }
        
        exportToJSON(jsonData, `financial-report-${dateRange}-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ color: 'text.primary', mb: 1 }}>
            Financial Management Hub
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Comprehensive financial overview including payments, invoices, transactions, expenses, P&L statements, revenue projections, and budget analysis.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DateRangeSelector
                value={dateRange}
                onChange={setDateRange}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onCustomDateChange={(start, end) => {
                  setCustomStartDate(start)
                  setCustomEndDate(end)
                }}
              />
            </Box>
            <Button variant="contained" startIcon={<Download />} onClick={() => setExportModalOpen(true)}>
              Export Report
            </Button>
          </Box>
        </Box>

        {/* Financial Overview */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${totalRevenue.toLocaleString()}
                    </Typography>
                    <Chip
                      label={
                        summary?.revenueGrowth !== undefined && summary.revenueGrowth !== 0
                          ? `${summary.revenueGrowth > 0 ? '+' : ''}${summary.revenueGrowth.toFixed(1)}% growth`
                          : `${summary?.campaigns?.total || 0} campaigns`
                      }
                      size="small"
                      color={
                        summary?.revenueGrowth !== undefined && summary.revenueGrowth !== 0
                          ? (summary.revenueGrowth > 0 ? "success" : "error")
                          : "success"
                      }
                      icon={
                        summary?.revenueGrowth !== undefined && summary.revenueGrowth !== 0
                          ? (summary.revenueGrowth > 0 ? <TrendingUp /> : <TrendingDown />)
                          : <AttachMoney />
                      }
                    />
                  </Box>
                  <AttachMoney color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Expenses
                    </Typography>
                    <Typography variant="h5">
                      ${totalExpenses.toLocaleString()}
                    </Typography>
                    <Chip
                      label={
                        summary?.expenses?.byCategory && Object.keys(summary.expenses.byCategory).length > 0
                          ? `${Object.keys(summary.expenses.byCategory).length} categories`
                          : `${summary?.expenses?.pending || 0} pending`
                      }
                      size="small"
                      color={
                        summary?.expenses?.byCategory && Object.keys(summary.expenses.byCategory).length > 0
                          ? "info"
                          : "warning"
                      }
                    />
                  </Box>
                  <PaymentIcon color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Net Profit
                    </Typography>
                    <Typography variant="h5">
                      ${netProfit.toLocaleString()}
                    </Typography>
                    <Chip
                      label={`${profitMargin.toFixed(1)}% margin`}
                      size="small"
                      color="primary"
                    />
                  </Box>
                  <AccountBalance color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Outstanding
                    </Typography>
                    <Typography variant="h5">
                      ${(summary?.outstandingInvoices || 0).toLocaleString()}
                    </Typography>
                    <Chip
                      label={`${summary?.outstandingInvoiceCount || 0} invoices`}
                      size="small"
                      color="error"
                    />
                  </Box>
                  <Receipt color="error" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        {!loading && (
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={selectedTab} 
            onChange={(e, value) => setSelectedTab(value)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Overview" />
            <Tab label="Transactions" />
            <Tab label="Expenses" />
            <Tab label="Invoices & Payments" />
            <Tab label="Reports" />
            <Tab label="P&L Statement" icon={<Assessment />} iconPosition="start" />
            <Tab label="Revenue Projections" icon={<Timeline />} iconPosition="start" />
            <Tab label="Budget Analysis" icon={<PieChart />} iconPosition="start" />
          </Tabs>
        </Paper>
        )}

        {!loading && selectedTab === 0 && (
          <Grid container spacing={3}>
            {/* Cash Flow Chart */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Cash Flow Analysis
                </Typography>
                <ChartContainer height={300}>
                  <AreaChart data={cashFlow?.data || []} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Income" />
                    <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ff7c7c" fill="#ff7c7c" name="Expenses" />
                  </AreaChart>
                </ChartContainer>
              </Paper>
            </Grid>

            {/* Recent Transactions */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Recent Transactions</Typography>
                  <Button size="small" onClick={() => setSelectedTab(1)}>View All</Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {transactions.slice(0, 5).map((transaction) => (
                    <Box key={transaction.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ 
                        bgcolor: transaction.type === 'income' ? 'success.light' : 'error.light',
                        color: transaction.type === 'income' ? 'success.main' : 'error.main'
                      }}>
                        {transaction.type === 'income' ? <TrendingUp /> : <TrendingDown />}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2">{transaction.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.client || transaction.vendor} • {new Date(transaction.date).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle2" color={transaction.type === 'income' ? 'success.main' : 'error.main'}>
                          {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}
                        </Typography>
                        <Chip
                          label={transaction.status}
                          size="small"
                          color={transaction.status === 'completed' ? 'success' : 'warning'}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>

            {/* Outstanding Invoices */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Outstanding Invoices</Typography>
                  <Button size="small" onClick={() => setSelectedTab(2)}>View All</Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).slice(0, 5).map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>{invoice.number || invoice.id}</TableCell>
                          <TableCell>{invoice.client}</TableCell>
                          <TableCell align="right">${invoice.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.status}
                              size="small"
                              color={invoice.status === 'overdue' ? 'error' : 'warning'}
                              icon={invoice.status === 'overdue' ? <Warning /> : <Schedule />}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* Revenue by Source */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Revenue by Source
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3].map((i) => (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2"><CircularProgress size={12} /></Typography>
                          <Typography variant="body2"><CircularProgress size={12} /></Typography>
                        </Box>
                        <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
                      </Box>
                    ))}
                  </Box>
                ) : revenueBySource.length === 0 ? (
                  <Typography color="text.secondary">No revenue data available</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {revenueBySource.map((source, index) => (
                    <Box key={index}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{source.source}</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          ${source.amount.toLocaleString()} ({source.percentage}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={source.percentage}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {!loading && selectedTab === 1 && (
          <Grid container spacing={3}>
            {/* Transactions Tab */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>All Transactions</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      select
                      size="small"
                      defaultValue="all"
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="income">Income</MenuItem>
                      <MenuItem value="expense">Expenses</MenuItem>
                    </TextField>
                    <Button variant="outlined" startIcon={<FilterList />}>
                      Filter
                    </Button>
                  </Box>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Client/Vendor</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} hover>
                          <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{transaction.client}</TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.type}
                              size="small"
                              color={transaction.type === 'income' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: transaction.type === 'income' ? 'success.main' : 'error.main',
                            fontWeight: 'medium'
                          }}>
                            {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.status}
                              size="small"
                              color={transaction.status === 'completed' ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small">
                              <MoreVert />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {!loading && selectedTab === 2 && (
          <Grid container spacing={3}>
            {/* Expenses Tab */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Expense Management</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      select
                      size="small"
                      defaultValue="all"
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="oneTime">One-time</MenuItem>
                      <MenuItem value="recurring">Recurring</MenuItem>
                    </TextField>
                    <Button 
                      variant="contained" 
                      startIcon={<Add />}
                      onClick={() => {
                        setEditingExpense(null)
                        resetExpenseForm()
                        setExpenseDialogOpen(true)
                      }}
                    >
                      Add Expense
                    </Button>
                  </Box>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2">{expense.description}</Typography>
                              {expense.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {expense.notes}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{expense.vendor}</TableCell>
                          <TableCell>
                            <Chip label={expense.category} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={expense.type === 'recurring' ? `Recurring (${expense.frequency})` : 'One-time'} 
                              size="small" 
                              color={expense.type === 'recurring' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'medium' }}>
                            ${expense.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={expense.status}
                              size="small"
                              color={
                                expense.status === 'paid' ? 'success' :
                                expense.status === 'overdue' ? 'error' :
                                expense.status === 'cancelled' ? 'default' :
                                'warning'
                              }
                            />
                          </TableCell>
                          <TableCell>{new Date(expense.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => openEditExpense(expense)}>
                              <Edit />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteExpense(expense.id)} color="error">
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {!loading && selectedTab === 3 && (
          <Grid container spacing={3}>
            {/* Invoices & Payments Tab */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Invoices & Payments</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      startIcon={<Receipt />}
                      onClick={() => {
                        // TODO: Open create invoice modal
                      }}
                    >
                      Create Invoice
                    </Button>
                  </Box>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Issue Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invoices.map((invoice: any) => (
                        <TableRow key={invoice.id} hover>
                          <TableCell>{invoice.number || invoice.id}</TableCell>
                          <TableCell>{invoice.client}</TableCell>
                          <TableCell>{invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                          <TableCell align="right">${invoice.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.status}
                              size="small"
                              color={
                                invoice.status === 'paid' ? 'success' :
                                invoice.status === 'overdue' ? 'error' :
                                'warning'
                              }
                              icon={
                                invoice.status === 'paid' ? <CheckCircle /> :
                                invoice.status === 'overdue' ? <Warning /> :
                                <Schedule />
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small">
                              <Download />
                            </IconButton>
                            <IconButton size="small">
                              <MoreVert />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            
            {/* Payments Section */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Payment History</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      startIcon={<PaymentIcon />}
                      onClick={() => {
                        // TODO: Open record payment modal
                      }}
                    >
                      Record Payment
                    </Button>
                  </Box>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Payment Date</TableCell>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} hover>
                          <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                          <TableCell>{payment.invoiceId}</TableCell>
                          <TableCell>{payment.client}</TableCell>
                          <TableCell>
                            <Chip label={payment.method} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'medium' }}>
                            ${payment.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>{payment.reference}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small">
                              <Receipt />
                            </IconButton>
                            <IconButton size="small">
                              <MoreVert />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {!loading && selectedTab === 4 && (
          <Grid container spacing={3}>
            {/* Reports Tab */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Financial Reports
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                            <CalendarMonth />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">Monthly Report</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Detailed monthly financial analysis
                            </Typography>
                          </Box>
                          <Button variant="outlined" size="small">
                            Generate
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                            <TrendingUp />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">Quarterly Report</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Quarterly performance and trends
                            </Typography>
                          </Box>
                          <Button variant="outlined" size="small">
                            Generate
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                            <Receipt />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">Tax Report</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Tax preparation and compliance
                            </Typography>
                          </Box>
                          <Button variant="outlined" size="small">
                            Generate
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                            <AccountBalance />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">P&L Statement</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Profit and loss analysis
                            </Typography>
                          </Box>
                          <Button variant="outlined" size="small">
                            Generate
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Recent Reports
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Report Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell>Generated</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* TODO: Implement recent reports API */}
                        {[].map((report: any, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{report.name}</TableCell>
                            <TableCell>
                              <Chip label={report.type} size="small" />
                            </TableCell>
                            <TableCell>{report.period}</TableCell>
                            <TableCell>{new Date(report.generated).toLocaleDateString()}</TableCell>
                            <TableCell align="right">
                              <IconButton size="small">
                                <Download />
                              </IconButton>
                              <IconButton size="small">
                                <MoreVert />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* P&L Statement Tab */}
        {!loading && selectedTab === 5 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>P&L Statement</Typography>
                  <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['executive', 'pl-report'] })} color="primary">
                    <Refresh />
                  </IconButton>
                </Box>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Year</InputLabel>
                      <Select value={plYear} onChange={(e) => setPlYear(e.target.value as number)} label="Year">
                        {[2023, 2024, 2025, 2026].map(year => (
                          <MenuItem key={year} value={year}>{year}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Start Month</InputLabel>
                      <Select value={plStartMonth} onChange={(e) => setPlStartMonth(e.target.value as number)} label="Start Month">
                        {Array.from({ length: 12 }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>End Month</InputLabel>
                      <Select value={plEndMonth} onChange={(e) => setPlEndMonth(e.target.value as number)} label="End Month">
                        {Array.from({ length: 12 }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {plLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : plData ? (
                  <>
                    {/* Key Metrics */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Total Revenue</Typography>
                            <Typography variant="h4">{formatCurrency(plData.totals?.revenue?.total || 0)}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <TrendingUp color="success" fontSize="small" />
                              <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                                {formatPercent(plData.metrics?.grossMargin || 0)} margin
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Gross Profit</Typography>
                            <Typography variant="h4">{formatCurrency(plData.totals?.grossProfit || 0)}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {formatPercent(plData.totals?.grossProfit && plData.totals?.revenue?.total 
                                ? (plData.totals.grossProfit / plData.totals.revenue.total) * 100 
                                : 0)} of revenue
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>EBITDA</Typography>
                            <Typography variant="h4">{formatCurrency(plData.totals?.ebitda || 0)}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              {(plData.totals?.ebitda || 0) >= 0 ? (
                                <TrendingUp color="success" fontSize="small" />
                              ) : (
                                <TrendingDown color="error" fontSize="small" />
                              )}
                              <Typography 
                                variant="body2" 
                                color={(plData.totals?.ebitda || 0) >= 0 ? 'success.main' : 'error.main'}
                                sx={{ ml: 1 }}
                              >
                                {formatPercent(plData.metrics?.ebitdaMargin || 0)} margin
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Net Income</Typography>
                            <Typography variant="h4">{formatCurrency(plData.totals?.netIncome || 0)}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              {(plData.totals?.netIncome || 0) >= 0 ? (
                                <TrendingUp color="success" fontSize="small" />
                              ) : (
                                <TrendingDown color="error" fontSize="small" />
                              )}
                              <Typography 
                                variant="body2" 
                                color={(plData.totals?.netIncome || 0) >= 0 ? 'success.main' : 'error.main'}
                                sx={{ ml: 1 }}
                              >
                                {formatPercent(plData.metrics?.netMargin || 0)} margin
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* P&L Table */}
                    {plData.period?.months && (
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Category</TableCell>
                              {plData.period.months.map((month: any) => (
                                <TableCell key={month.number} align="right">{month.name}</TableCell>
                              ))}
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {/* Revenue Section */}
                            <TableRow>
                              <TableCell colSpan={plData.period.months.length + 2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                                Revenue
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ pl: 3 }}>Advertising Revenue</TableCell>
                              {plData.period.months.map((month: any) => (
                                <TableCell key={month.number} align="right">
                                  {formatCurrency(plData.monthlyPL?.[month.number]?.revenue?.advertising || 0)}
                                </TableCell>
                              ))}
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(plData.totals?.revenue?.advertising || 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ pl: 3 }}>Other Revenue</TableCell>
                              {plData.period.months.map((month: any) => (
                                <TableCell key={month.number} align="right">
                                  {formatCurrency(plData.monthlyPL?.[month.number]?.revenue?.other || 0)}
                                </TableCell>
                              ))}
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(plData.totals?.revenue?.other || 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Total Revenue</TableCell>
                              {plData.period.months.map((month: any) => (
                                <TableCell key={month.number} align="right" sx={{ fontWeight: 'bold' }}>
                                  {formatCurrency(plData.monthlyPL?.[month.number]?.revenue?.total || 0)}
                                </TableCell>
                              ))}
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(plData.totals?.revenue?.total || 0)}
                              </TableCell>
                            </TableRow>

                            {/* Net Income */}
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Net Income</TableCell>
                              {plData.period.months.map((month: any) => (
                                <TableCell 
                                  key={month.number} 
                                  align="right" 
                                  sx={{ 
                                    fontWeight: 'bold',
                                    bgcolor: (plData.monthlyPL?.[month.number]?.netIncome || 0) >= 0 ? 'success.light' : 'error.light'
                                  }}
                                >
                                  {formatCurrency(plData.monthlyPL?.[month.number]?.netIncome || 0)}
                                </TableCell>
                              ))}
                              <TableCell 
                                align="right" 
                                sx={{ 
                                  fontWeight: 'bold',
                                  bgcolor: (plData.totals?.netIncome || 0) >= 0 ? 'success.light' : 'error.light'
                                }}
                              >
                                {formatCurrency(plData.totals?.netIncome || 0)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    No P&L data available for the selected period.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Revenue Projections Tab */}
        {!loading && selectedTab === 6 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>Revenue Projections</Typography>
                  <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['executive', 'revenue-projections'] })} color="primary">
                    <Refresh />
                  </IconButton>
                </Box>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Projection Period</InputLabel>
                      <Select 
                        value={projectionMonths} 
                        onChange={(e) => setProjectionMonths(e.target.value as number)} 
                        label="Projection Period"
                      >
                        <MenuItem value={3}>3 Months</MenuItem>
                        <MenuItem value={6}>6 Months</MenuItem>
                        <MenuItem value={12}>12 Months</MenuItem>
                        <MenuItem value={24}>24 Months</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {projectionLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : projectionData ? (
                  <>
                    {/* Summary Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Confirmed Revenue</Typography>
                            <Typography variant="h4">{formatCurrency(projectionData.summary?.totalConfirmed || 0)}</Typography>
                            <Chip 
                              label="Booked" 
                              color="success" 
                              size="small" 
                              sx={{ mt: 1 }} 
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Pending Revenue</Typography>
                            <Typography variant="h4">{formatCurrency(projectionData.summary?.totalPending || 0)}</Typography>
                            <Chip 
                              label="In Negotiation" 
                              color="warning" 
                              size="small" 
                              sx={{ mt: 1 }} 
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Projected Revenue</Typography>
                            <Typography variant="h4">{formatCurrency(projectionData.summary?.totalPotential || 0)}</Typography>
                            <Chip 
                              label={`${(projectionData.summary?.growthRate || 0).toFixed(1)}% Growth`} 
                              color="info" 
                              size="small" 
                              sx={{ mt: 1 }} 
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>Total Forecast</Typography>
                            <Typography variant="h4">{formatCurrency(projectionData.summary?.totalProjected || 0)}</Typography>
                            <Chip 
                              label={`${projectionData.summary?.confidenceLevel || 'Medium'} Confidence`} 
                              color={projectionData.summary?.confidenceLevel === 'High' ? 'success' : 'default'} 
                              size="small" 
                              sx={{ mt: 1 }} 
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* Revenue Projection Chart */}
                    {projectionData.monthlyProjections && projectionData.monthlyProjections.length > 0 && (
                      <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>Monthly Revenue Projections</Typography>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={projectionData.monthlyProjections}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="confirmed" stackId="a" fill="#4caf50" name="Confirmed" />
                            <Bar dataKey="pending" stackId="a" fill="#ff9800" name="Pending" />
                            <Bar dataKey="potential" stackId="a" fill="#2196f3" name="Projected" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    )}

                    {/* Top Advertisers and Shows */}
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3 }}>
                          <Typography variant="h6" gutterBottom>Top Advertisers by Revenue</Typography>
                          {projectionData.topAdvertisers && projectionData.topAdvertisers.length > 0 ? (
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Advertiser</TableCell>
                                    <TableCell align="right">Projected Revenue</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {projectionData.topAdvertisers.map((advertiser: any) => (
                                    <TableRow key={advertiser.name}>
                                      <TableCell>{advertiser.name}</TableCell>
                                      <TableCell align="right">{formatCurrency(advertiser.revenue)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography color="text.secondary">No advertiser data available</Typography>
                          )}
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3 }}>
                          <Typography variant="h6" gutterBottom>Top Shows by Revenue</Typography>
                          {projectionData.topShows && projectionData.topShows.length > 0 ? (
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Show</TableCell>
                                    <TableCell align="right">Projected Revenue</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {projectionData.topShows.map((show: any) => (
                                    <TableRow key={show.name}>
                                      <TableCell>{show.name}</TableCell>
                                      <TableCell align="right">{formatCurrency(show.revenue)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography color="text.secondary">No show data available</Typography>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  <Alert severity="info">
                    No projection data available for the selected period.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Budget Analysis Tab */}
        {!loading && selectedTab === 7 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>Budget vs Actual Analysis</Typography>
                
                {plData && plData.budgetComparison ? (
                  <Grid container spacing={3}>
                    {Object.entries(plData.budgetComparison).map(([month, data]: [string, any]) => (
                      <Grid item xs={12} md={4} key={month}>
                        <Card sx={{ height: '100%' }}>
                          <CardContent>
                            <Typography variant="subtitle1" gutterBottom>
                              Month {month}
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="textSecondary">Revenue</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography>{formatCurrency(data.revenue?.actual || 0)}</Typography>
                                <Chip 
                                  label={`${(data.revenue?.percentVariance || 0) > 0 ? '+' : ''}${(data.revenue?.percentVariance || 0).toFixed(1)}%`}
                                  color={(data.revenue?.percentVariance || 0) >= 0 ? 'success' : 'error'}
                                  size="small"
                                />
                              </Box>
                            </Box>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="textSecondary">Expenses</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography>{formatCurrency(data.expenses?.actual || 0)}</Typography>
                                <Chip 
                                  label={`${(data.expenses?.percentVariance || 0) > 0 ? '+' : ''}${(data.expenses?.percentVariance || 0).toFixed(1)}%`}
                                  color={(data.expenses?.percentVariance || 0) <= 0 ? 'success' : 'error'}
                                  size="small"
                                />
                              </Box>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="textSecondary">Net Income</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ fontWeight: 'bold' }}>{formatCurrency(data.netIncome?.actual || 0)}</Typography>
                                <Chip 
                                  label={`${(data.netIncome?.percentVariance || 0) > 0 ? '+' : ''}${(data.netIncome?.percentVariance || 0).toFixed(1)}%`}
                                  color={(data.netIncome?.percentVariance || 0) >= 0 ? 'success' : 'error'}
                                  size="small"
                                />
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info">
                    Budget comparison data is not available. Please check your P&L Statement tab to ensure data is loaded.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      <VisualExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Financial Report"
        onExport={handleExport}
        availableFormats={['pdf', 'csv', 'json']}
        defaultFormat="pdf"
      />

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onClose={() => setExpenseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Description"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Vendor"
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              InputProps={{ startAdornment: '$' }}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                label="Category"
              >
                <MenuItem value="office">Office</MenuItem>
                <MenuItem value="equipment">Equipment</MenuItem>
                <MenuItem value="software">Software</MenuItem>
                <MenuItem value="marketing">Marketing</MenuItem>
                <MenuItem value="travel">Travel</MenuItem>
                <MenuItem value="utilities">Utilities</MenuItem>
                <MenuItem value="payroll">Payroll</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={expenseForm.type}
                onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                label="Type"
              >
                <MenuItem value="oneTime">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>
            {expenseForm.type === 'recurring' && (
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={expenseForm.frequency}
                  onChange={(e) => setExpenseForm({ ...expenseForm, frequency: e.target.value })}
                  label="Frequency"
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={expenseForm.status}
                onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Invoice Number (Optional)"
              value={expenseForm.invoiceNumber}
              onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
            />
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={expenseForm.startDate}
              onChange={(e) => setExpenseForm({ ...expenseForm, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            {expenseForm.type === 'recurring' && (
              <TextField
                fullWidth
                label="End Date (Optional)"
                type="date"
                value={expenseForm.endDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            )}
            <TextField
              fullWidth
              label="Notes (Optional)"
              multiline
              rows={3}
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={editingExpense ? handleUpdateExpense : handleCreateExpense}
          >
            {editingExpense ? 'Update' : 'Create'} Expense
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}
