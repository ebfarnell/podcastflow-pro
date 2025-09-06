'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Box,
} from '@mui/material'

interface ReportExportModalProps {
  open: boolean
  onClose: () => void
  onExport: (format: 'pdf' | 'csv') => void
  title?: string
}

export function ReportExportModal({
  open,
  onClose,
  onExport,
  title = 'Export Report'
}: ReportExportModalProps) {
  const [format, setFormat] = React.useState<'pdf' | 'csv'>('pdf')

  const handleExport = () => {
    onExport(format)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Choose the format for your export:
          </Typography>
          <FormControl component="fieldset">
            <RadioGroup
              value={format}
              onChange={(e) => setFormat(e.target.value as 'pdf' | 'csv')}
            >
              <FormControlLabel
                value="pdf"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">PDF Document</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Best for sharing and printing
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="csv"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">CSV Spreadsheet</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Best for data analysis in Excel or Google Sheets
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleExport}>
          Export
        </Button>
      </DialogActions>
    </Dialog>
  )
}