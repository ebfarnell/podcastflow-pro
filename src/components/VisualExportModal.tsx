import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Box,
  Typography,
  Divider,
} from '@mui/material'

interface VisualExportModalProps {
  open: boolean
  onClose: () => void
  title: string
  onExport: (format: string, settings: any) => Promise<void>
  availableFormats?: string[]
  defaultFormat?: string
}

export default function VisualExportModal({
  open,
  onClose,
  title,
  onExport,
  availableFormats = ['pdf', 'csv', 'json'],
  defaultFormat = 'pdf'
}: VisualExportModalProps) {
  const [format, setFormat] = useState(defaultFormat)
  const [settings, setSettings] = useState({
    orientation: 'portrait',
    includeSummary: true,
    includeCharts: true,
    includeRawData: true,
    dateRange: 'thisMonth'
  })
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await onExport(format, settings)
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Export Format</FormLabel>
            <RadioGroup
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              row
            >
              {availableFormats.map((fmt) => (
                <FormControlLabel
                  key={fmt}
                  value={fmt}
                  control={<Radio />}
                  label={fmt.toUpperCase()}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        {format === 'pdf' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth size="small">
                <FormLabel>Orientation</FormLabel>
                <Select
                  value={settings.orientation}
                  onChange={(e) => handleSettingChange('orientation', e.target.value)}
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Landscape</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Include Sections</FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeSummary}
                        onChange={(e) => handleSettingChange('includeSummary', e.target.checked)}
                      />
                    }
                    label="Executive Summary"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeCharts}
                        onChange={(e) => handleSettingChange('includeCharts', e.target.checked)}
                      />
                    }
                    label="Charts and Visualizations"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeRawData}
                        onChange={(e) => handleSettingChange('includeRawData', e.target.checked)}
                      />
                    }
                    label="Raw Data Tables"
                  />
                </FormGroup>
              </FormControl>
            </Box>
          </>
        )}

        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <FormLabel>Date Range</FormLabel>
            <Select
              value={settings.dateRange}
              onChange={(e) => handleSettingChange('dateRange', e.target.value)}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="thisWeek">This Week</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="lastMonth">Last Month</MenuItem>
              <MenuItem value="thisQuarter">This Quarter</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Export will include data for the selected date range and format.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button 
          onClick={handleExport} 
          variant="contained"
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}