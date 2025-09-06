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
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'

interface DateRangeSelectorProps {
  value: string
  onChange: (value: string) => void
  customStartDate?: Dayjs | null
  customEndDate?: Dayjs | null
  onCustomDateChange?: (startDate: Dayjs | null, endDate: Dayjs | null) => void
  hideCustom?: boolean
  sx?: any
}

export function DateRangeSelector({
  value,
  onChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  hideCustom = false,
  sx
}: DateRangeSelectorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Dayjs | null>(
    customStartDate || dayjs().subtract(30, 'day')
  )
  const [tempEndDate, setTempEndDate] = useState<Dayjs | null>(
    customEndDate || dayjs()
  )

  const handleDateRangeChange = (newValue: string) => {
    onChange(newValue)
    if (newValue === 'custom') {
      setShowDatePicker(true)
    }
  }

  const handleApplyCustomDates = () => {
    if (tempStartDate && tempEndDate && onCustomDateChange) {
      onCustomDateChange(tempStartDate, tempEndDate)
      setShowDatePicker(false)
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, ...sx }}>
        {/* Single Row */}
        <ToggleButtonGroup
          value={value}
          exclusive
          onChange={(e, newValue) => newValue && handleDateRangeChange(newValue)}
          size="small"
          sx={{ 
            height: '32px',
            '& .MuiToggleButton-root': {
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              padding: '4px 8px',
              minWidth: 'auto'
            }
          }}
        >
          <ToggleButton value="7D">7 Days</ToggleButton>
          <ToggleButton value="30D">30 Days</ToggleButton>
          <ToggleButton value="90D">90 Days</ToggleButton>
          <ToggleButton value="MTD">MTD</ToggleButton>
          <ToggleButton value="lastMonth">Last Month</ToggleButton>
          <ToggleButton value="QTD">QTD</ToggleButton>
          <ToggleButton value="YTD">YTD</ToggleButton>
          <ToggleButton value="allTime">All Time</ToggleButton>
          {!hideCustom && <ToggleButton value="custom">Custom</ToggleButton>}
        </ToggleButtonGroup>
        
        {value === 'custom' && customStartDate && customEndDate && (
          <Button 
            variant="text" 
            size="small" 
            onClick={() => setShowDatePicker(true)}
            sx={{ mt: 1, alignSelf: 'flex-start' }}
          >
            {customStartDate.format('MMM DD')} - {customEndDate.format('MMM DD, YYYY')}
          </Button>
        )}
      </Box>

      {/* Custom Date Range Dialog */}
      <Dialog open={showDatePicker} onClose={() => setShowDatePicker(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Date Range</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              <DatePicker
                label="Start Date"
                value={tempStartDate}
                onChange={(newValue) => setTempStartDate(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={tempEndDate}
                onChange={(newValue) => setTempEndDate(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    helperText: "Cannot select today or future dates"
                  }
                }}
                minDate={tempStartDate || undefined}
                maxDate={dayjs().subtract(1, 'day')}
              />
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDatePicker(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleApplyCustomDates}
            disabled={!tempStartDate || !tempEndDate || tempStartDate.isAfter(tempEndDate)}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}