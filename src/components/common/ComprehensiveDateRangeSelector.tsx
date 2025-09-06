'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { CalendarToday } from '@mui/icons-material'
import dayjs, { Dayjs } from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'

// Enable quarter plugin
dayjs.extend(quarterOfYear)

interface ComprehensiveDateRangeSelectorProps {
  value: string
  onChange: (value: string) => void
  customStartDate?: Dayjs | null
  customEndDate?: Dayjs | null
  onCustomDateChange?: (startDate: Dayjs | null, endDate: Dayjs | null) => void
  sx?: any
  variant?: 'compact' | 'full'
}

export function ComprehensiveDateRangeSelector({
  value,
  onChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  sx,
  variant = 'full'
}: ComprehensiveDateRangeSelectorProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [customType, setCustomType] = useState<'dates' | 'month' | 'quarter' | 'year'>('dates')
  const [tempStartDate, setTempStartDate] = useState<Dayjs | null>(
    customStartDate || dayjs().subtract(30, 'day')
  )
  const [tempEndDate, setTempEndDate] = useState<Dayjs | null>(
    customEndDate || dayjs()
  )
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))
  const [selectedQuarter, setSelectedQuarter] = useState<number>(dayjs().quarter())
  const [selectedQuarterYear, setSelectedQuarterYear] = useState<number>(dayjs().year())
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year())

  const quickRanges = [
    { value: 'today', label: 'Today' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'lastQuarter', label: 'Last Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'lastYear', label: 'Last Year' },
  ]

  const handleDateRangeChange = (newValue: string) => {
    onChange(newValue)
    if (newValue === 'custom') {
      setShowCustomDialog(true)
    }
  }

  const handleCustomApply = () => {
    if (!onCustomDateChange) return

    let startDate: Dayjs
    let endDate: Dayjs

    switch (customType) {
      case 'month':
        startDate = dayjs(selectedMonth).startOf('month')
        endDate = dayjs(selectedMonth).endOf('month')
        break
      case 'quarter':
        startDate = dayjs().year(selectedQuarterYear).quarter(selectedQuarter).startOf('quarter')
        endDate = dayjs().year(selectedQuarterYear).quarter(selectedQuarter).endOf('quarter')
        break
      case 'year':
        startDate = dayjs().year(selectedYear).startOf('year')
        endDate = dayjs().year(selectedYear).endOf('year')
        break
      case 'dates':
      default:
        if (!tempStartDate || !tempEndDate) return
        startDate = tempStartDate
        endDate = tempEndDate
        break
    }

    onCustomDateChange(startDate, endDate)
    setShowCustomDialog(false)
  }

  const getDisplayText = () => {
    const labels = {
      today: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisQuarter: 'This Quarter',
      lastQuarter: 'Last Quarter',
      thisYear: 'This Year',
      lastYear: 'Last Year',
      custom: customStartDate && customEndDate 
        ? `${customStartDate.format('MMM DD')} - ${customEndDate.format('MMM DD, YYYY')}`
        : 'Custom Range'
    }
    return labels[value as keyof typeof labels] || 'Select Range'
  }

  // Generate year options (current year ± 10 years)
  const currentYear = dayjs().year()
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)

  // Generate month options for current year and previous years
  const monthOptions = []
  for (let year = currentYear; year >= currentYear - 5; year--) {
    for (let month = (year === currentYear ? dayjs().month() : 11); month >= 0; month--) {
      const monthDate = dayjs().year(year).month(month)
      monthOptions.push({
        value: monthDate.format('YYYY-MM'),
        label: monthDate.format('MMMM YYYY')
      })
    }
  }

  if (variant === 'compact') {
    return (
      <>
        <Button
          variant="outlined"
          startIcon={<CalendarToday />}
          onClick={() => setShowCustomDialog(true)}
          sx={sx}
        >
          {getDisplayText()}
        </Button>

        {/* Custom Range Dialog */}
        <Dialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Select Date Range</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {/* Quick Ranges */}
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Quick Ranges</Typography>
              <Grid container spacing={1} sx={{ mb: 3 }}>
                {quickRanges.map((range) => (
                  <Grid item key={range.value}>
                    <Button
                      variant={value === range.value ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => {
                        onChange(range.value)
                        setShowCustomDialog(false)
                      }}
                    >
                      {range.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>

              {/* Custom Selection Type */}
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Custom Selection</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Selection Type</InputLabel>
                <Select
                  value={customType}
                  label="Selection Type"
                  onChange={(e) => setCustomType(e.target.value as any)}
                >
                  <MenuItem value="dates">Specific Dates</MenuItem>
                  <MenuItem value="month">Month</MenuItem>
                  <MenuItem value="quarter">Quarter</MenuItem>
                  <MenuItem value="year">Year</MenuItem>
                </Select>
              </FormControl>

              {/* Custom Type Content */}
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                {customType === 'dates' && (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <DatePicker
                        label="Start Date"
                        value={tempStartDate}
                        onChange={(newValue) => setTempStartDate(newValue)}
                        slotProps={{
                          textField: { fullWidth: true }
                        }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <DatePicker
                        label="End Date"
                        value={tempEndDate}
                        onChange={(newValue) => setTempEndDate(newValue)}
                        slotProps={{
                          textField: { fullWidth: true }
                        }}
                        minDate={tempStartDate || undefined}
                      />
                    </Grid>
                  </Grid>
                )}

                {customType === 'month' && (
                  <FormControl fullWidth>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={selectedMonth}
                      label="Month"
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      {monthOptions.map((month) => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {customType === 'quarter' && (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <InputLabel>Quarter</InputLabel>
                        <Select
                          value={selectedQuarter}
                          label="Quarter"
                          onChange={(e) => setSelectedQuarter(e.target.value as number)}
                        >
                          <MenuItem value={1}>Q1 (Jan-Mar)</MenuItem>
                          <MenuItem value={2}>Q2 (Apr-Jun)</MenuItem>
                          <MenuItem value={3}>Q3 (Jul-Sep)</MenuItem>
                          <MenuItem value={4}>Q4 (Oct-Dec)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <InputLabel>Year</InputLabel>
                        <Select
                          value={selectedQuarterYear}
                          label="Year"
                          onChange={(e) => setSelectedQuarterYear(e.target.value as number)}
                        >
                          {yearOptions.map((year) => (
                            <MenuItem key={year} value={year}>{year}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                )}

                {customType === 'year' && (
                  <FormControl fullWidth>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={selectedYear}
                      label="Year"
                      onChange={(e) => setSelectedYear(e.target.value as number)}
                    >
                      {yearOptions.map((year) => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </LocalizationProvider>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCustomDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCustomApply}>
              Apply
            </Button>
          </DialogActions>
        </Dialog>
      </>
    )
  }

  // Full variant with buttons in a single row
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', ...sx }}>
        {/* Quick Range Buttons */}
        <ToggleButtonGroup
          value={value}
          exclusive
          onChange={(e, newValue) => newValue && handleDateRangeChange(newValue)}
          size="small"
          sx={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            '& .MuiToggleButton-root': {
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              padding: '6px 12px',
              minWidth: 'auto',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              },
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark'
                }
              }
            }
          }}
        >
          {quickRanges.map((range) => (
            <ToggleButton key={range.value} value={range.value}>
              {range.label}
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>

        {value === 'custom' && customStartDate && customEndDate && (
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => setShowCustomDialog(true)}
            startIcon={<CalendarToday fontSize="small" />}
            sx={{ ml: 1 }}
          >
            {customStartDate.format('MMM DD')} - {customEndDate.format('MMM DD, YYYY')}
          </Button>
        )}
      </Box>

      {/* Custom Range Dialog - Same as compact version */}
      <Dialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Date Range</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Custom Selection Type */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Selection Type</InputLabel>
              <Select
                value={customType}
                label="Selection Type"
                onChange={(e) => setCustomType(e.target.value as any)}
              >
                <MenuItem value="dates">Specific Dates</MenuItem>
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="quarter">Quarter</MenuItem>
                <MenuItem value="year">Year</MenuItem>
              </Select>
            </FormControl>

            {/* Custom Type Content */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              {customType === 'dates' && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Start Date"
                      value={tempStartDate}
                      onChange={(newValue) => setTempStartDate(newValue)}
                      slotProps={{
                        textField: { fullWidth: true }
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DatePicker
                      label="End Date"
                      value={tempEndDate}
                      onChange={(newValue) => setTempEndDate(newValue)}
                      slotProps={{
                        textField: { fullWidth: true }
                      }}
                      minDate={tempStartDate || undefined}
                    />
                  </Grid>
                </Grid>
              )}

              {customType === 'month' && (
                <FormControl fullWidth>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={selectedMonth}
                    label="Month"
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {monthOptions.map((month) => (
                      <MenuItem key={month.value} value={month.value}>
                        {month.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {customType === 'quarter' && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Quarter</InputLabel>
                      <Select
                        value={selectedQuarter}
                        label="Quarter"
                        onChange={(e) => setSelectedQuarter(e.target.value as number)}
                      >
                        <MenuItem value={1}>Q1 (Jan-Mar)</MenuItem>
                        <MenuItem value={2}>Q2 (Apr-Jun)</MenuItem>
                        <MenuItem value={3}>Q3 (Jul-Sep)</MenuItem>
                        <MenuItem value={4}>Q4 (Oct-Dec)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Year</InputLabel>
                      <Select
                        value={selectedQuarterYear}
                        label="Year"
                        onChange={(e) => setSelectedQuarterYear(e.target.value as number)}
                      >
                        {yearOptions.map((year) => (
                          <MenuItem key={year} value={year}>{year}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              )}

              {customType === 'year' && (
                <FormControl fullWidth>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(e) => setSelectedYear(e.target.value as number)}
                  >
                    {yearOptions.map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </LocalizationProvider>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCustomApply}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}