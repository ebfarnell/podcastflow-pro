'use client'

import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Grid,
} from '@mui/material'
import {
  MoreVert,
  Edit,
  Delete,
  Receipt,
  CloudDownload,
  TrendingDown,
  AccountBalanceWallet,
  CalendarToday,
  BarChart,
} from '@mui/icons-material'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { ComprehensiveDateRangeSelector } from '@/components/common/ComprehensiveDateRangeSelector'
import { Dayjs } from 'dayjs'

interface AccountsPayableTabProps {
  expensesData: any
  timeRange: string
  onTimeRangeChange: (value: string) => void
  customStartDate?: Dayjs | null
  customEndDate?: Dayjs | null
  onCustomDateChange?: (startDate: Dayjs | null, endDate: Dayjs | null) => void
}

export function AccountsPayableTab({ 
  expensesData, 
  timeRange, 
  onTimeRangeChange,
  customStartDate, 
  customEndDate,
  onCustomDateChange
}: AccountsPayableTabProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedExpense, setSelectedExpense] = useState<any>(null)

  const getTimeRangeLabel = (range: string) => {
    if (range === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate.format('MMM DD')} - ${customEndDate.format('MMM DD, YYYY')}`
    }
    
    const labels = {
      'today': 'Today',
      'thisWeek': 'This Week',
      'thisMonth': 'This Month',
      'lastMonth': 'Last Month',
      'thisQuarter': 'This Quarter',
      'lastQuarter': 'Last Quarter',
      'thisYear': 'This Year',
      'lastYear': 'Last Year',
    }
    return labels[range as keyof typeof labels] || range
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, expense: any) => {
    setAnchorEl(event.currentTarget)
    setSelectedExpense(expense)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedExpense(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'pending':
        return 'warning'
      case 'overdue':
        return 'error'
      default:
        return 'default'
    }
  }

  const expenses = expensesData?.expenses || []
  const summary = expensesData?.summary || {}

  return (
    <Box>
      {/* Date Range Selector */}
      <Box sx={{ mb: 3 }}>
        <ComprehensiveDateRangeSelector
          value={timeRange}
          onChange={onTimeRangeChange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateChange={onCustomDateChange}
          variant="full"
        />
      </Box>

      {/* Expense Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingDown sx={{ mr: 2, color: 'error.main' }} />
                <Typography color="text.secondary">Total Expenses</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(summary.total || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getTimeRangeLabel(timeRange)} period
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceWallet sx={{ mr: 2, color: 'primary.main' }} />
                <Typography color="text.secondary">AWS Costs</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(summary.awsTotal || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Infrastructure costs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CalendarToday sx={{ mr: 2, color: 'warning.main' }} />
                <Typography color="text.secondary">Recurring</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(summary.recurring || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monthly expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BarChart sx={{ mr: 2, color: 'info.main' }} />
                <Typography color="text.secondary">One-time</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(summary.oneTime || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Non-recurring costs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expenses Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Recurring</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No expenses found for this period
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense: any) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {expense.vendor}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {expense.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={expense.category}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(expense.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(expense.date).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={expense.status}
                      size="small"
                      color={getStatusColor(expense.status) as any}
                    />
                  </TableCell>
                  <TableCell>
                    {expense.recurring ? (
                      <Chip
                        label={expense.frequency}
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        One-time
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, expense)}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Receipt fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Receipt</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <CloudDownload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download Invoice</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* AWS Cost Breakdown */}
      {summary.awsTotal > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
            AWS Services Breakdown
          </Typography>
          <Box sx={{ mt: 2 }}>
            {expenses
              .filter((e: any) => e.vendor === 'Amazon Web Services')
              .map((expense: any) => (
                <Box
                  key={expense.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography>{expense.description}</Typography>
                  <Typography fontWeight="bold">
                    {formatCurrency(expense.amount)}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Paper>
      )}
    </Box>
  )
}