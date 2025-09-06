'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Box,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { Download, FileDownload } from '@mui/icons-material'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import axios from 'axios'
import { useSnackbar } from '@/hooks/useSnackbar'

interface AgencyReportModalProps {
  open: boolean
  onClose: () => void
  agencyId: string
  agencyName: string
}

export function AgencyReportModal({
  open,
  onClose,
  agencyId,
  agencyName,
}: AgencyReportModalProps) {
  const { showSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(subMonths(new Date(), 11)), // Default: last 12 months
    end: endOfMonth(new Date()),
  })
  const [format, setFormat] = useState<'zip' | 'pdf'>('zip')
  const [sections, setSections] = useState({
    summary: true,
    monthly: true,
    weekly: true,
    campaigns: true,
    lineItems: true,
  })

  const handleSectionChange = (section: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleGenerate = async () => {
    setLoading(true)
    
    try {
      const response = await axios.post(
        '/api/reports/agency',
        {
          agencyId,
          range: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          },
          format,
          includeSections: Object.entries(sections)
            .filter(([_, enabled]) => enabled)
            .map(([section]) => section),
        },
        {
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = `agency-report-${agencyName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${format}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      downloadBlob(response.data, filename)
      showSnackbar('Report generated successfully', 'success')
      onClose()
    } catch (error: any) {
      console.error('Report generation error:', error)
      
      // Try to parse error response
      if (error.response?.data) {
        try {
          const reader = new FileReader()
          reader.onload = () => {
            try {
              const errorData = JSON.parse(reader.result as string)
              showSnackbar(
                `Failed to generate report: ${errorData.message || 'Unknown error'} ${
                  errorData.correlationId ? `(ID: ${errorData.correlationId})` : ''
                }`,
                'error'
              )
            } catch {
              showSnackbar('Failed to generate report. Please try again.', 'error')
            }
          }
          reader.readAsText(error.response.data)
        } catch {
          showSnackbar('Failed to generate report. Please try again.', 'error')
        }
      } else {
        showSnackbar(
          error.message || 'Failed to generate report. Please try again.',
          'error'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Generate Agency Report
          <Typography variant="body2" color="text.secondary">
            {agencyName}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            {/* Date Range */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Date Range
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={dateRange.start}
                  onChange={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={dateRange.end}
                  onChange={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </Box>
            </Box>

            {/* Format */}
            <FormControl>
              <FormLabel>Report Format</FormLabel>
              <RadioGroup
                value={format}
                onChange={(e) => setFormat(e.target.value as 'zip' | 'pdf')}
                row
              >
                <FormControlLabel
                  value="zip"
                  control={<Radio />}
                  label="ZIP (Multiple CSV files)"
                />
                <FormControlLabel
                  value="pdf"
                  control={<Radio />}
                  label="PDF Report"
                  disabled // Can be enabled when PDF support is added
                />
              </RadioGroup>
              {format === 'pdf' && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  PDF format is coming soon. Please use ZIP format for now.
                </Alert>
              )}
            </FormControl>

            {/* Sections */}
            <FormControl>
              <FormLabel>Include Sections</FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sections.summary}
                      onChange={() => handleSectionChange('summary')}
                    />
                  }
                  label="Summary Overview"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sections.monthly}
                      onChange={() => handleSectionChange('monthly')}
                    />
                  }
                  label="Monthly Breakdown"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sections.weekly}
                      onChange={() => handleSectionChange('weekly')}
                    />
                  }
                  label="Weekly Analysis"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sections.campaigns}
                      onChange={() => handleSectionChange('campaigns')}
                    />
                  }
                  label="Campaign Details"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sections.lineItems}
                      onChange={() => handleSectionChange('lineItems')}
                    />
                  }
                  label="Line Item Details"
                />
              </FormGroup>
            </FormControl>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <FileDownload />}
            disabled={loading || !Object.values(sections).some(v => v)}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}