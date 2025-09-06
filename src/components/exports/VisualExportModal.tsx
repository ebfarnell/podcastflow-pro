'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Paper
} from '@mui/material'
import {
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon
} from '@mui/icons-material'

interface ExportOption {
  format: 'pdf' | 'csv' | 'json' | 'png'
  label: string
  icon: React.ReactNode
  available: boolean
}

interface ExportSettings {
  includeCharts: boolean
  includeRawData: boolean
  includeSummary: boolean
  dateRange: 'today' | 'week' | 'month' | 'year' | 'custom'
  orientation: 'portrait' | 'landscape'
}

interface VisualExportModalProps {
  open: boolean
  onClose: () => void
  title: string
  onExport: (format: string, settings: ExportSettings) => Promise<void>
  availableFormats?: ('pdf' | 'csv' | 'json' | 'png')[]
  defaultFormat?: 'pdf' | 'csv' | 'json' | 'png'
  showPreview?: boolean
  previewContent?: React.ReactNode
}

export const VisualExportModal: React.FC<VisualExportModalProps> = ({
  open,
  onClose,
  title,
  onExport,
  availableFormats = ['pdf', 'csv', 'json'],
  defaultFormat = 'pdf',
  showPreview = false,
  previewContent
}) => {
  const [selectedFormat, setSelectedFormat] = useState<string>(defaultFormat)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [settings, setSettings] = useState<ExportSettings>({
    includeCharts: true,
    includeRawData: true,
    includeSummary: true,
    dateRange: 'month',
    orientation: 'portrait'
  })

  const exportOptions: ExportOption[] = [
    {
      format: 'pdf',
      label: 'PDF Report',
      icon: <PdfIcon />,
      available: availableFormats.includes('pdf')
    },
    {
      format: 'csv',
      label: 'CSV Data',
      icon: <CsvIcon />,
      available: availableFormats.includes('csv')
    },
    {
      format: 'json',
      label: 'JSON Data',
      icon: <JsonIcon />,
      available: availableFormats.includes('json')
    },
    {
      format: 'png',
      label: 'Chart Image',
      icon: <ImageIcon />,
      available: availableFormats.includes('png')
    }
  ]

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    
    try {
      await onExport(selectedFormat, settings)
      onClose()
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleSettingChange = (key: keyof ExportSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{title}</Typography>
            {showPreview && (
              <Button
                size="small"
                startIcon={<PreviewIcon />}
                onClick={() => setShowPreviewDialog(true)}
              >
                Preview
              </Button>
            )}
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Format Selection */}
            <Typography variant="subtitle2" gutterBottom>
              Select Export Format
            </Typography>
            <ToggleButtonGroup
              value={selectedFormat}
              exclusive
              onChange={(_, value) => value && setSelectedFormat(value)}
              aria-label="export format"
              fullWidth
              sx={{ mb: 3 }}
            >
              {exportOptions.map((option) => (
                <ToggleButton
                  key={option.format}
                  value={option.format}
                  disabled={!option.available}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    py: 2
                  }}
                >
                  {option.icon}
                  <Typography variant="caption">{option.label}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* Export Settings */}
            {selectedFormat === 'pdf' && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  PDF Settings
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeCharts}
                        onChange={(e) => handleSettingChange('includeCharts', e.target.checked)}
                      />
                    }
                    label="Include Charts & Visualizations"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeRawData}
                        onChange={(e) => handleSettingChange('includeRawData', e.target.checked)}
                      />
                    }
                    label="Include Detailed Data Tables"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={settings.includeSummary}
                        onChange={(e) => handleSettingChange('includeSummary', e.target.checked)}
                      />
                    }
                    label="Include Executive Summary"
                  />
                </FormGroup>

                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Page Orientation</InputLabel>
                  <Select
                    value={settings.orientation}
                    label="Page Orientation"
                    onChange={(e) => handleSettingChange('orientation', e.target.value)}
                  >
                    <MenuItem value="portrait">Portrait</MenuItem>
                    <MenuItem value="landscape">Landscape</MenuItem>
                  </Select>
                </FormControl>
              </Paper>
            )}

            {/* Date Range Selection */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={settings.dateRange}
                label="Date Range"
                onChange={(e) => handleSettingChange('dateRange', e.target.value)}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">Last 30 Days</MenuItem>
                <MenuItem value="year">Last Year</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>

            {/* Format-specific information */}
            <Alert severity="info" sx={{ mt: 2 }}>
              {selectedFormat === 'pdf' && (
                "PDF exports include professional formatting, charts, and branding. Perfect for sharing with stakeholders."
              )}
              {selectedFormat === 'csv' && (
                "CSV exports contain raw data in a spreadsheet-friendly format. Great for further analysis in Excel or Google Sheets."
              )}
              {selectedFormat === 'json' && (
                "JSON exports provide structured data for integration with other systems or custom analysis."
              )}
              {selectedFormat === 'png' && (
                "PNG exports create high-resolution images of charts and visualizations for presentations."
              )}
            </Alert>

            {exportError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {exportError}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={isExporting}
            startIcon={isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      {showPreview && (
        <Dialog
          open={showPreviewDialog}
          onClose={() => setShowPreviewDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Export Preview</DialogTitle>
          <DialogContent>
            <Box sx={{ p: 2 }}>
              {previewContent || (
                <Typography color="text.secondary">
                  Preview not available
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
}