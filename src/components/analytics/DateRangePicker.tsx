import { useState } from 'react'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { Box, Button, Popover, TextField } from '@mui/material'
import { CalendarToday } from '@mui/icons-material'
import dayjs, { Dayjs } from 'dayjs'

interface DateRangePickerProps {
  onDateChange: (startDate: Date, endDate: Date) => void
}

export function DateRangePicker({ onDateChange }: DateRangePickerProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(30, 'day'))
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs())

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleApply = () => {
    if (startDate && endDate) {
      onDateChange(startDate.toDate(), endDate.toDate())
    }
    handleClose()
  }

  const open = Boolean(anchorEl)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Button
        variant="outlined"
        startIcon={<CalendarToday />}
        onClick={handleClick}
      >
        {startDate?.format('MMM DD')} - {endDate?.format('MMM DD, YYYY')}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
              }
            }}
          />
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
              }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleApply}>
              Apply
            </Button>
          </Box>
        </Box>
      </Popover>
    </LocalizationProvider>
  )
}