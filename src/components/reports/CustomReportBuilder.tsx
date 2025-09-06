'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Tabs,
  Tab,
  InputAdornment,
} from '@mui/material'
import {
  DragIndicator,
  Add,
  Remove,
  FilterList,
  PlayArrow,
  Save,
  Download,
  TableChart,
  BarChart,
  PieChart,
  Timeline,
  Dashboard,
  Delete,
  Settings,
  ContentCopy,
  CameraAlt,
  Visibility,
  Search,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material'

interface ReportField {
  id: string
  name: string
  type: 'dimension' | 'metric'
  dataType: 'string' | 'number' | 'date' | 'currency' | 'percentage'
  category: string
  description?: string
}

interface ReportConfig {
  id: string
  name: string
  types: ('table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'dashboard')[]
  dimensions: ReportField[]
  metrics: ReportField[]
  filters: ReportFilter[]
  dateRange: string
  customStartDate?: string
  customEndDate?: string
}

interface ReportFilter {
  id: string
  field: ReportField
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between'
  value: string | number
  value2?: string | number
}

const AVAILABLE_FIELDS: ReportField[] = [
  // Campaign Dimensions
  { id: 'campaign_name', name: 'Campaign Name', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'campaign_status', name: 'Campaign Status', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'campaign_description', name: 'Campaign Description', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'campaign_probability', name: 'Win Probability', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'prebill_required', name: 'Pre-Bill Required', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'client_name', name: 'Client', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'agency_name', name: 'Agency', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'industry', name: 'Industry', type: 'dimension', dataType: 'string', category: 'Campaign' },
  { id: 'target_audience', name: 'Target Audience', type: 'dimension', dataType: 'string', category: 'Campaign' },
  
  // Date Dimensions
  { id: 'date', name: 'Date', type: 'dimension', dataType: 'date', category: 'Time' },
  { id: 'month', name: 'Month', type: 'dimension', dataType: 'string', category: 'Time' },
  { id: 'quarter', name: 'Quarter', type: 'dimension', dataType: 'string', category: 'Time' },
  { id: 'year', name: 'Year', type: 'dimension', dataType: 'string', category: 'Time' },
  
  // Show Dimensions
  { id: 'show_name', name: 'Show Name', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'show_category', name: 'Show Category', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'show_host', name: 'Show Host', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'show_frequency', name: 'Release Frequency', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'show_release_day', name: 'Release Day', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'youtube_channel', name: 'YouTube Channel', type: 'dimension', dataType: 'string', category: 'Show' },
  { id: 'megaphone_id', name: 'Megaphone ID', type: 'dimension', dataType: 'string', category: 'Show' },
  
  // Episode Dimensions
  { id: 'episode_title', name: 'Episode Title', type: 'dimension', dataType: 'string', category: 'Episode' },
  { id: 'episode_number', name: 'Episode Number', type: 'dimension', dataType: 'number', category: 'Episode' },
  { id: 'episode_status', name: 'Episode Status', type: 'dimension', dataType: 'string', category: 'Episode' },
  { id: 'episode_air_date', name: 'Episode Air Date', type: 'dimension', dataType: 'date', category: 'Episode' },
  
  // Order Dimensions
  { id: 'order_number', name: 'Order Number', type: 'dimension', dataType: 'string', category: 'Order' },
  { id: 'order_status', name: 'Order Status', type: 'dimension', dataType: 'string', category: 'Order' },
  { id: 'io_number', name: 'IO Number', type: 'dimension', dataType: 'string', category: 'Order' },
  
  // Invoice Dimensions
  { id: 'invoice_number', name: 'Invoice Number', type: 'dimension', dataType: 'string', category: 'Invoice' },
  { id: 'invoice_status', name: 'Invoice Status', type: 'dimension', dataType: 'string', category: 'Invoice' },
  { id: 'invoice_type', name: 'Invoice Type', type: 'dimension', dataType: 'string', category: 'Invoice' },
  
  // Seller Dimensions
  { id: 'advertiser_seller', name: 'Advertiser Seller', type: 'dimension', dataType: 'string', category: 'Sales' },
  { id: 'agency_seller', name: 'Agency Seller', type: 'dimension', dataType: 'string', category: 'Sales' },
  
  // Revenue Metrics
  { id: 'budget', name: 'Budget', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'spent', name: 'Amount Spent', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'order_total', name: 'Order Total', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'order_discount', name: 'Order Discount', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'order_net', name: 'Order Net Amount', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'invoice_amount', name: 'Invoice Amount', type: 'metric', dataType: 'currency', category: 'Revenue' },
  { id: 'invoice_paid', name: 'Invoice Paid Amount', type: 'metric', dataType: 'currency', category: 'Revenue' },
  
  // Performance Metrics
  { id: 'impressions', name: 'Impressions', type: 'metric', dataType: 'number', category: 'Performance' },
  { id: 'target_impressions', name: 'Target Impressions', type: 'metric', dataType: 'number', category: 'Performance' },
  { id: 'clicks', name: 'Clicks', type: 'metric', dataType: 'number', category: 'Performance' },
  { id: 'conversions', name: 'Conversions', type: 'metric', dataType: 'number', category: 'Performance' },
  { id: 'ctr', name: 'Click Through Rate', type: 'metric', dataType: 'percentage', category: 'Performance' },
  { id: 'conversion_rate', name: 'Conversion Rate', type: 'metric', dataType: 'percentage', category: 'Performance' },
  { id: 'cpc', name: 'Cost Per Click', type: 'metric', dataType: 'currency', category: 'Performance' },
  { id: 'cpa', name: 'Cost Per Acquisition', type: 'metric', dataType: 'currency', category: 'Performance' },
  { id: 'roi', name: 'Return on Investment', type: 'metric', dataType: 'percentage', category: 'Performance' },
  
  // Analytics Metrics
  { id: 'engagement_rate', name: 'Engagement Rate', type: 'metric', dataType: 'percentage', category: 'Analytics' },
  { id: 'avg_view_time', name: 'Avg View Time (sec)', type: 'metric', dataType: 'number', category: 'Analytics' },
  { id: 'bounce_rate', name: 'Bounce Rate', type: 'metric', dataType: 'percentage', category: 'Analytics' },
  { id: 'ad_playbacks', name: 'Ad Playbacks', type: 'metric', dataType: 'number', category: 'Analytics' },
  { id: 'completion_rate', name: 'Completion Rate', type: 'metric', dataType: 'percentage', category: 'Analytics' },
  { id: 'skip_rate', name: 'Skip Rate', type: 'metric', dataType: 'percentage', category: 'Analytics' },
  
  // Episode Metrics
  { id: 'episode_duration', name: 'Episode Duration (min)', type: 'metric', dataType: 'number', category: 'Episode' },
  { id: 'youtube_views', name: 'YouTube Views', type: 'metric', dataType: 'number', category: 'Episode' },
  { id: 'youtube_likes', name: 'YouTube Likes', type: 'metric', dataType: 'number', category: 'Episode' },
  { id: 'youtube_comments', name: 'YouTube Comments', type: 'metric', dataType: 'number', category: 'Episode' },
  { id: 'megaphone_downloads', name: 'Megaphone Downloads', type: 'metric', dataType: 'number', category: 'Episode' },
  
  // Show Metrics
  { id: 'show_sellout_projection', name: 'Sellout Projection', type: 'metric', dataType: 'currency', category: 'Show' },
  { id: 'episode_value', name: 'Est. Episode Value', type: 'metric', dataType: 'currency', category: 'Show' },
  
  // Campaign Count Metrics
  { id: 'active_campaigns', name: 'Active Campaigns', type: 'metric', dataType: 'number', category: 'Campaign' },
  { id: 'total_campaigns', name: 'Total Campaigns', type: 'metric', dataType: 'number', category: 'Campaign' },
  { id: 'completed_campaigns', name: 'Completed Campaigns', type: 'metric', dataType: 'number', category: 'Campaign' },
]

const REPORT_TYPES = [
  { id: 'table', name: 'Data Table', icon: TableChart, description: 'Detailed tabular data with sorting and filtering' },
  { id: 'bar_chart', name: 'Bar Chart', icon: BarChart, description: 'Compare values across categories' },
  { id: 'line_chart', name: 'Line Chart', icon: Timeline, description: 'Show trends over time' },
  { id: 'pie_chart', name: 'Pie Chart', icon: PieChart, description: 'Show proportions and percentages' },
  { id: 'dashboard', name: 'Dashboard', icon: Dashboard, description: 'Multiple visualizations in one view' },
]

// Helper function to format cell values
function formatCellValue(value: any, dataType: string): string {
  if (value === null || value === undefined) return '-'
  
  switch (dataType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Number(value) || 0)
    case 'percentage':
      return `${(Number(value) || 0).toFixed(1)}%`
    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(value) || 0)
    case 'date':
      return new Date(value).toLocaleDateString()
    default:
      return String(value)
  }
}

// Enhanced field component with drag and add button
interface FieldItemProps {
  field: ReportField
  onDragStart: (field: ReportField) => void
  onDragEnd: () => void
  onAdd: (field: ReportField) => void
  isAdded: boolean
}

function FieldItem({ field, onDragStart, onDragEnd, onAdd, isAdded }: FieldItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(field))
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart(field)
  }

  return (
    <ListItem
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      sx={{
        mb: 0.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: isAdded ? 'success.main' : 'divider',
        borderRadius: 1,
        cursor: 'grab',
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { cursor: 'grabbing' },
        opacity: isAdded ? 0.6 : 1,
      }}
    >
      <ListItemIcon sx={{ minWidth: 30 }}>
        <DragIndicator fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={field.name}
        secondary={field.type}
        primaryTypographyProps={{ variant: 'body2' }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
      <Chip
        label={field.dataType}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 20, mr: 1 }}
      />
      <IconButton
        size="small"
        onClick={() => onAdd(field)}
        disabled={isAdded}
        sx={{
          color: isAdded ? 'success.main' : 'primary.main',
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        {isAdded ? <Remove /> : <Add />}
      </IconButton>
    </ListItem>
  )
}

// Drop zone component
interface DropZoneProps {
  title: string
  fields: ReportField[]
  onDrop: (field: ReportField) => void
  onRemove: (fieldId: string) => void
  placeholder: string
  color: 'primary' | 'secondary'
}

function DropZone({ title, fields, onDrop, onRemove, placeholder, color }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    try {
      const fieldData = e.dataTransfer.getData('application/json')
      const field = JSON.parse(fieldData) as ReportField
      onDrop(field)
    } catch (error) {
      console.error('Error parsing dropped field:', error)
    }
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          minHeight: 80,
          p: 2,
          bgcolor: isDragOver ? 'action.hover' : 'grey.50',
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragOver ? 'primary.main' : 'grey.300',
          transition: 'all 0.2s ease'
        }}
      >
        {fields.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            {placeholder}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {fields.map(field => (
              <Chip
                key={field.id}
                label={field.name}
                onDelete={() => onRemove(field.id)}
                color={color}
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  )
}

// Preview components
function TablePreview({ data, columns }: { data: any[], columns: ReportField[] }) {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <TableChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No records found for the selected criteria. Try adjusting your filters or date range.
        </Typography>
      </Box>
    )
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.id} sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                {col.name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.slice(0, 10).map((row, idx) => (
            <TableRow key={idx} hover>
              {columns.map((col) => (
                <TableCell key={col.id}>
                  {formatCellValue(row[col.id], col.dataType)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length > 10 && (
        <Typography variant="caption" sx={{ p: 1, display: 'block', textAlign: 'center', bgcolor: 'grey.50' }}>
          Showing 10 of {data.length} rows
        </Typography>
      )}
    </TableContainer>
  )
}

function BarChartPreview({ data, columns }: { data: any[], columns: ReportField[] }) {
  const dimensions = columns.filter(c => c.type === 'dimension')
  const metrics = columns.filter(c => c.type === 'metric')
  
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <BarChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No records found for the selected criteria. Try adjusting your filters or date range.
        </Typography>
      </Box>
    )
  }
  
  if (dimensions.length === 0 || metrics.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <BarChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Configuration Required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Bar chart requires at least one dimension and one metric.
        </Typography>
      </Box>
    )
  }

  const chartData = data.slice(0, 8).map(row => ({
    label: row[dimensions[0].id] || 'Unknown',
    value: row[metrics[0].id] || 0
  }))

  const maxValue = Math.max(...chartData.map(d => d.value))

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom textAlign="center">
        {metrics[0].name} by {dimensions[0].name}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chartData.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 120, fontSize: '0.8rem' }}>
              {String(item.label).substring(0, 15)}{String(item.label).length > 15 ? '...' : ''}
            </Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <Box
                sx={{
                  height: 20,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                  minWidth: '2px'
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 60, textAlign: 'right', fontSize: '0.8rem' }}>
              {formatCellValue(item.value, metrics[0].dataType)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function LineChartPreview({ data, columns }: { data: any[], columns: ReportField[] }) {
  const dimensions = columns.filter(c => c.type === 'dimension')
  const metrics = columns.filter(c => c.type === 'metric')
  
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Timeline sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No records found for the selected criteria. Try adjusting your filters or date range.
        </Typography>
      </Box>
    )
  }
  
  if (dimensions.length === 0 || metrics.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Timeline sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Configuration Required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Line chart requires at least one dimension and one metric.
        </Typography>
      </Box>
    )
  }

  // Simple line chart visualization
  const chartData = data.slice(0, 10).map(row => ({
    label: row[dimensions[0].id] || 'Unknown',
    value: Number(row[metrics[0].id]) || 0
  }))

  const maxValue = Math.max(...chartData.map(d => d.value))
  const minValue = Math.min(...chartData.map(d => d.value))
  const range = maxValue - minValue || 1

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom textAlign="center">
        {metrics[0].name} by {dimensions[0].name}
      </Typography>
      <Box sx={{ position: 'relative', height: 200, mb: 2 }}>
        <svg width="100%" height="100%" viewBox="0 0 500 200">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={i}
              x1="40"
              y1={40 + i * 30}
              x2="460"
              y2={40 + i * 30}
              stroke="#e0e0e0"
              strokeWidth="1"
            />
          ))}
          
          {/* Line path */}
          <path
            d={chartData.map((point, i) => {
              const x = 40 + (i * 420) / (chartData.length - 1)
              const y = 160 - ((point.value - minValue) / range) * 120
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
            }).join(' ')}
            fill="none"
            stroke="#1976d2"
            strokeWidth="2"
          />
          
          {/* Data points */}
          {chartData.map((point, i) => {
            const x = 40 + (i * 420) / (chartData.length - 1)
            const y = 160 - ((point.value - minValue) / range) * 120
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="#1976d2"
              />
            )
          })}
        </svg>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
        {chartData.map((point, i) => (
          <Typography key={i} variant="caption" sx={{ fontSize: '0.7rem' }}>
            {String(point.label).substring(0, 8)}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

function PieChartPreview({ data, columns }: { data: any[], columns: ReportField[] }) {
  const dimensions = columns.filter(c => c.type === 'dimension')
  const metrics = columns.filter(c => c.type === 'metric')
  
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <PieChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No records found for the selected criteria. Try adjusting your filters or date range.
        </Typography>
      </Box>
    )
  }
  
  if (dimensions.length === 0 || metrics.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <PieChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Configuration Required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pie chart requires at least one dimension and one metric.
        </Typography>
      </Box>
    )
  }

  // Get top 5 items for pie chart
  const pieData = data
    .slice(0, 5)
    .map(row => ({
      label: row[dimensions[0].id] || 'Unknown',
      value: Number(row[metrics[0].id]) || 0
    }))
    .filter(item => item.value > 0)

  const total = pieData.reduce((sum, item) => sum + item.value, 0)
  
  if (total === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <PieChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data to Display
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All values are zero for the selected metric.
        </Typography>
      </Box>
    )
  }

  const colors = ['#1976d2', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb']
  
  let currentAngle = 0
  const segments = pieData.map((item, i) => {
    const percentage = (item.value / total) * 100
    const angle = (percentage / 100) * 360
    const startAngle = currentAngle
    currentAngle += angle
    
    return {
      ...item,
      percentage,
      startAngle,
      endAngle: currentAngle,
      color: colors[i % colors.length]
    }
  })

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom textAlign="center">
        {metrics[0].name} by {dimensions[0].name}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Box sx={{ position: 'relative', width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            {segments.map((segment, i) => {
              const startAngleRad = (segment.startAngle * Math.PI) / 180
              const endAngleRad = (segment.endAngle * Math.PI) / 180
              
              const x1 = 100 + 80 * Math.cos(startAngleRad - Math.PI / 2)
              const y1 = 100 + 80 * Math.sin(startAngleRad - Math.PI / 2)
              const x2 = 100 + 80 * Math.cos(endAngleRad - Math.PI / 2)
              const y2 = 100 + 80 * Math.sin(endAngleRad - Math.PI / 2)
              
              const largeArc = segment.endAngle - segment.startAngle > 180 ? 1 : 0
              
              return (
                <path
                  key={i}
                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="2"
                />
              )
            })}
          </svg>
        </Box>
        <Box>
          {segments.map((segment, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: segment.color,
                  borderRadius: 0.5
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                {segment.label}: {segment.percentage.toFixed(1)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function DashboardPreview({ data, columns, reportName, dateRange }: { data: any[], columns: ReportField[], reportName: string, dateRange: string }) {
  const dimensions = columns.filter(c => c.type === 'dimension')
  const metrics = columns.filter(c => c.type === 'metric')
  
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Dashboard sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No records found for the selected criteria. Try adjusting your filters or date range.
        </Typography>
      </Box>
    )
  }
  
  if (dimensions.length === 0 || metrics.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Dashboard sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Configuration Required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Dashboard requires at least one dimension and one metric.
        </Typography>
      </Box>
    )
  }

  // Calculate KPIs
  const totalValue = data.reduce((sum, row) => sum + (Number(row[metrics[0].id]) || 0), 0)
  const avgValue = totalValue / data.length
  const maxValue = Math.max(...data.map(row => Number(row[metrics[0].id]) || 0))
  const uniqueCategories = new Set(data.map(row => row[dimensions[0].id])).size

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom textAlign="center" sx={{ mb: 3 }}>
        {reportName} Dashboard
      </Typography>
      
      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <Typography variant="h4">{data.length}</Typography>
            <Typography variant="body2">Total Records</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
            <Typography variant="h4">{uniqueCategories}</Typography>
            <Typography variant="body2">Unique {dimensions[0].name}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Typography variant="h4">{formatCellValue(totalValue, metrics[0].dataType)}</Typography>
            <Typography variant="body2">Total {metrics[0].name}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Typography variant="h4">{formatCellValue(avgValue, metrics[0].dataType)}</Typography>
            <Typography variant="body2">Average {metrics[0].name}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Bar Chart - Top Left */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Top {Math.min(data.length, 5)} by {metrics[0].name}
            </Typography>
            <Box sx={{ height: 300 }}>
              <BarChartPreview data={data.slice(0, 5)} columns={columns} />
            </Box>
          </Paper>
        </Grid>

        {/* Pie Chart - Top Right */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Distribution by {dimensions[0].name}
            </Typography>
            <Box sx={{ height: 300 }}>
              <PieChartPreview data={data.slice(0, 5)} columns={columns} />
            </Box>
          </Paper>
        </Grid>

        {/* Line Chart - Bottom Left */}
        {dimensions.some(d => ['date', 'month', 'quarter', 'year'].includes(d.id)) && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Trend Over Time
              </Typography>
              <Box sx={{ height: 300 }}>
                <LineChartPreview 
                  data={data.slice(-10)} 
                  columns={columns.filter(c => 
                    c.type === 'metric' || ['date', 'month', 'quarter', 'year'].includes(c.id)
                  )} 
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Data Table - Bottom or Full Width */}
        <Grid item xs={12} md={dimensions.some(d => ['date', 'month', 'quarter', 'year'].includes(d.id)) ? 6 : 12}>
          <Paper sx={{ p: 2, height: '100%', maxHeight: 400 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Data (Top 10)
            </Typography>
            <Box sx={{ height: 300, overflow: 'auto' }}>
              <TablePreview data={data.slice(0, 10)} columns={columns} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Summary Section */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle1" gutterBottom>
          Report Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Date Range: {dateRange.replace(/([A-Z])/g, ' $1').trim()}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Dimensions: {dimensions.map(d => d.name).join(', ')}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Metrics: {metrics.map(m => m.name).join(', ')}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

export function CustomReportBuilder() {
  const [mounted, setMounted] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    id: '',
    name: 'New Custom Report',
    types: ['table'],
    dimensions: [],
    metrics: [],
    filters: [],
    dateRange: 'last30days'
  })

  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [draggedField, setDraggedField] = useState<ReportField | null>(null)
  const [activePreviewTab, setActivePreviewTab] = useState(0)
  const [fieldSearch, setFieldSearch] = useState('')
  const previewRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDragStart = (field: ReportField) => {
    setDraggedField(field)
  }

  const handleDragEnd = () => {
    setDraggedField(null)
  }

  const handleAddField = (field: ReportField) => {
    if (field.type === 'dimension' && !reportConfig.dimensions.find(d => d.id === field.id)) {
      setReportConfig(prev => ({
        ...prev,
        dimensions: [...prev.dimensions, field]
      }))
    } else if (field.type === 'metric' && !reportConfig.metrics.find(m => m.id === field.id)) {
      setReportConfig(prev => ({
        ...prev,
        metrics: [...prev.metrics, field]
      }))
    }
  }

  const handleDimensionDrop = (field: ReportField) => {
    if (field.type === 'dimension' && !reportConfig.dimensions.find(d => d.id === field.id)) {
      setReportConfig(prev => ({
        ...prev,
        dimensions: [...prev.dimensions, field]
      }))
    }
  }

  const handleMetricDrop = (field: ReportField) => {
    if (field.type === 'metric' && !reportConfig.metrics.find(m => m.id === field.id)) {
      setReportConfig(prev => ({
        ...prev,
        metrics: [...prev.metrics, field]
      }))
    }
  }

  const removeDimension = (fieldId: string) => {
    setReportConfig(prev => ({
      ...prev,
      dimensions: prev.dimensions.filter(f => f.id !== fieldId)
    }))
  }

  const removeMetric = (fieldId: string) => {
    setReportConfig(prev => ({
      ...prev,
      metrics: prev.metrics.filter(f => f.id !== fieldId)
    }))
  }

  const generateReport = async () => {
    if (reportConfig.dimensions.length === 0 && reportConfig.metrics.length === 0) {
      alert('Please add at least one dimension or metric to generate a report.')
      return
    }

    if (reportConfig.types.length === 0) {
      alert('Please select at least one report type.')
      return
    }

    setIsGenerating(true)

    try {
      // For now, generate the same data for all report types
      const response = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: reportConfig.name,
          type: reportConfig.types[0], // Use first type for data generation
          dimensions: reportConfig.dimensions.map(d => d.id),
          metrics: reportConfig.metrics.map(m => m.id),
          filters: reportConfig.filters,
          dateRange: reportConfig.dateRange,
          customStartDate: reportConfig.customStartDate,
          customEndDate: reportConfig.customEndDate
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const result = await response.json()
      
      // Set the preview data with the result
      setPreviewData({
        columns: [...reportConfig.dimensions, ...reportConfig.metrics],
        data: result.data || [],
        metadata: result.metadata
      })
      setActivePreviewTab(0)
      
      // Collapse all field categories
      const allCategories = [...new Set(AVAILABLE_FIELDS.map(field => field.category))]
      setCollapsedCategories(new Set(allCategories))
      
      // Scroll to the preview section after a short delay to ensure it's rendered
      setTimeout(() => {
        const previewSection = document.querySelector('[data-preview-section="true"]')
        if (previewSection) {
          previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (error) {
      console.error('Report generation error:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const exportReport = async (format: string, reportType?: string) => {
    if (!previewData || !previewData.data) {
      alert('Please generate a report first before exporting.')
      return
    }

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: previewData.data,
          config: { 
            ...reportConfig, 
            type: reportType || reportConfig.types[0],
            dimensions: reportConfig.dimensions,
            metrics: reportConfig.metrics
          },
          format,
          settings: {
            includeSummary: true,
            includeCharts: (reportType || reportConfig.types[0]) !== 'table',
            includeRawData: true,
            orientation: 'landscape'
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to export report')
      }

      // Get the file content as a blob
      const blob = await response.blob()
      
      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportConfig.name}-${reportType || reportConfig.types[0]}-${format}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      alert(`Report exported successfully!`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export report. Please try again.')
    }
  }

  const copyReportImage = async (reportType: string) => {
    const element = previewRefs.current[reportType]
    if (!element) {
      alert('Preview not available for copying')
      return
    }

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      })
      
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ])
            alert('Report image copied to clipboard!')
          } catch (error) {
            console.error('Failed to copy image:', error)
            // Fallback: download the image
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${reportConfig.name}-${reportType}-${new Date().toISOString().split('T')[0]}.png`
            link.click()
            URL.revokeObjectURL(url)
            alert('Image downloaded (clipboard not supported)')
          }
        }
      }, 'image/png')
    } catch (error) {
      console.error('Error generating image:', error)
      alert('Failed to generate image')
    }
  }

  const handleReportTypeToggle = (typeId: string) => {
    setReportConfig(prev => {
      const newTypes = prev.types.includes(typeId as any)
        ? prev.types.filter(t => t !== typeId)
        : [...prev.types, typeId as any]
      
      return {
        ...prev,
        types: newTypes.length > 0 ? newTypes : ['table'] // Ensure at least one type is selected
      }
    })
  }

  const saveReport = async () => {
    try {
      const response = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: reportConfig.name,
          description: `Custom report with ${reportConfig.dimensions.length} dimensions, ${reportConfig.metrics.length} metrics, and ${reportConfig.types.length} visualization${reportConfig.types.length > 1 ? 's' : ''}`,
          config: reportConfig,
          isPublic: false
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      alert('Report template saved successfully!')
      setSaveDialogOpen(false)
    } catch (error) {
      console.error('Save template error:', error)
      alert('Failed to save template. Please try again.')
    }
  }

  // Filter fields based on search
  const filteredFields = AVAILABLE_FIELDS.filter(field => 
    field.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    field.category.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    field.id.toLowerCase().includes(fieldSearch.toLowerCase())
  )

  const fieldsByCategory = filteredFields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, ReportField[]>)

  // Check if a field is already added
  const isFieldAdded = (field: ReportField) => {
    if (field.type === 'dimension') {
      return reportConfig.dimensions.some(d => d.id === field.id)
    } else {
      return reportConfig.metrics.some(m => m.id === field.id)
    }
  }

  // Toggle category collapse state
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // Prevent SSR issues
  if (!mounted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Custom Report Builder...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Left Panel - Available Fields */}
        <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, height: 'fit-content' }}>
          <Typography variant="h6" gutterBottom>
            Available Fields
          </Typography>
          
          {/* Search Box */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search fields..."
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag fields or click + to add
          </Typography>
          
          {Object.entries(fieldsByCategory).map(([category, fields]) => {
            const isCollapsed = collapsedCategories.has(category)
            return (
              <Box key={category} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 }
                  }}
                  onClick={() => toggleCategoryCollapse(category)}
                >
                  <Typography variant="subtitle2" color="primary">
                    {category} ({fields.length})
                  </Typography>
                  <IconButton size="small" sx={{ p: 0.5 }}>
                    {isCollapsed ? <ExpandMore /> : <ExpandLess />}
                  </IconButton>
                </Box>
                {!isCollapsed && (
                  <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {fields.map(field => (
                      <FieldItem
                        key={field.id}
                        field={field}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onAdd={handleAddField}
                        isAdded={isFieldAdded(field)}
                      />
                    ))}
                  </List>
                )}
              </Box>
            )
          })}
        </Paper>
      </Grid>

        {/* Main Panel - Report Builder */}
        <Grid item xs={12} md={9}>
        <Paper sx={{ p: 3 }}>
          {/* Report Type Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Report Configuration
            </Typography>
            
            <TextField
              fullWidth
              label="Report Name"
              value={reportConfig.name}
              onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Report Types (Select Multiple)
            </Typography>
            <Grid container spacing={1} sx={{ mb: 3 }}>
              {REPORT_TYPES.map(type => {
                const IconComponent = type.icon
                const isSelected = reportConfig.types.includes(type.id as any)
                return (
                  <Grid item xs={6} sm={4} key={type.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        '&:hover': { borderColor: 'primary.main' },
                        position: 'relative'
                      }}
                      onClick={() => handleReportTypeToggle(type.id)}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <IconComponent color={isSelected ? 'primary' : 'action'} />
                        <Typography variant="caption" display="block">
                          {type.name}
                        </Typography>
                        {isSelected && (
                          <Checkbox
                            checked={true}
                            size="small"
                            sx={{ position: 'absolute', top: 4, right: 4 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Box>

          {/* Drop Zones */}
          <DropZone
            title="Dimensions (Group By)"
            fields={reportConfig.dimensions}
            onDrop={handleDimensionDrop}
            onRemove={removeDimension}
            placeholder="Drag dimension fields here or click + to add"
            color="primary"
          />

          <DropZone
            title="Metrics (Measure)"
            fields={reportConfig.metrics}
            onDrop={handleMetricDrop}
            onRemove={removeMetric}
            placeholder="Drag metric fields here or click + to add"
            color="secondary"
          />

          {/* Date Range */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Date Range</InputLabel>
                  <Select
                    value={reportConfig.dateRange}
                    label="Date Range"
                    onChange={(e) => setReportConfig(prev => ({ ...prev, dateRange: e.target.value }))}
                  >
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="yesterday">Yesterday</MenuItem>
                    <MenuItem value="last7days">Last 7 Days</MenuItem>
                    <MenuItem value="last30days">Last 30 Days</MenuItem>
                    <MenuItem value="last90days">Last 90 Days</MenuItem>
                    <MenuItem value="thisMonth">This Month</MenuItem>
                    <MenuItem value="lastMonth">Last Month</MenuItem>
                    <MenuItem value="thisQuarter">This Quarter</MenuItem>
                    <MenuItem value="ytd">Year to Date</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                  onClick={() => setFilterDialogOpen(true)}
                  fullWidth
                >
                  Add Filters ({reportConfig.filters.length})
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={isGenerating ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={generateReport}
              disabled={isGenerating || (reportConfig.dimensions.length === 0 && reportConfig.metrics.length === 0) || reportConfig.types.length === 0}
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={() => setSaveDialogOpen(true)}
            >
              Save Template
            </Button>
          </Box>
        </Paper>
        </Grid>
      </Grid>

      {/* Full Width Preview Section */}
      {previewData && previewData.data && (
        <Paper sx={{ p: 3, mt: 3 }} data-preview-section="true">
          <Typography variant="h6" gutterBottom>
            Report Preview
          </Typography>
          
          <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Report generated successfully!
              </Alert>
              
              <Tabs
                value={activePreviewTab}
                onChange={(_, newValue) => setActivePreviewTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
              >
                {reportConfig.types.map((type, idx) => {
                  const reportType = REPORT_TYPES.find(t => t.id === type)
                  const IconComponent = reportType?.icon || TableChart
                  return (
                    <Tab
                      key={type}
                      label={reportType?.name || type}
                      icon={<IconComponent fontSize="small" />}
                      iconPosition="start"
                    />
                  )
                })}
              </Tabs>

              {reportConfig.types.map((type, idx) => (
                <Box
                  key={type}
                  hidden={activePreviewTab !== idx}
                  sx={{ mb: 2 }}
                >
                  {activePreviewTab === idx && (
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={8}>
                        <Box
                          ref={el => previewRefs.current[type] = el}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            bgcolor: 'background.paper',
                            overflow: 'hidden'
                          }}
                        >
                        {type === 'table' && (
                          <TablePreview 
                            data={previewData.data} 
                            columns={previewData.columns} 
                          />
                        )}
                        {type === 'bar_chart' && (
                          <BarChartPreview 
                            data={previewData.data} 
                            columns={previewData.columns} 
                          />
                        )}
                        {type === 'line_chart' && (
                          <LineChartPreview 
                            data={previewData.data} 
                            columns={previewData.columns} 
                          />
                        )}
                        {type === 'pie_chart' && (
                          <PieChartPreview 
                            data={previewData.data} 
                            columns={previewData.columns} 
                          />
                        )}
                        {type === 'dashboard' && (
                          <DashboardPreview 
                            data={previewData.data} 
                            columns={previewData.columns}
                            reportName={reportConfig.name}
                            dateRange={reportConfig.dateRange}
                          />
                        )}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Export Options
                          </Typography>
                          
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Tooltip title="Copy as Image">
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ContentCopy />}
                                onClick={() => copyReportImage(type)}
                                fullWidth
                              >
                                Copy as Image
                              </Button>
                            </Tooltip>
                            
                            <Divider sx={{ my: 1 }} />
                            
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                              Download as:
                            </Typography>
                            
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<Download />}
                              onClick={() => exportReport('pdf', type)}
                              fullWidth
                            >
                              PDF Document
                            </Button>
                            
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => exportReport('csv', type)}
                              fullWidth
                            >
                              CSV Spreadsheet
                            </Button>
                            
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => exportReport('json', type)}
                              fullWidth
                            >
                              JSON Data
                            </Button>
                          </Box>
                          
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="caption" color="text.secondary">
                              <strong>Data Summary:</strong><br/>
                              {previewData.data.length} rows × {previewData.columns.length} columns
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  )}
                </Box>
              ))}
            </Box>
        </Paper>
      )}

      {/* Configuration Summary when no preview */}
      {(!previewData || !previewData.data) && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Configuration Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure your report and click "Generate Report" to see previews
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle2" gutterBottom>
                Report Types
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reportConfig.types.length} selected
              </Typography>
              {reportConfig.types.map(type => {
                const reportType = REPORT_TYPES.find(t => t.id === type)
                return (
                  <Chip 
                    key={type} 
                    label={reportType?.name || type} 
                    size="small" 
                    sx={{ mt: 0.5, mr: 0.5 }} 
                  />
                )
              })}
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle2" gutterBottom>
                Dimensions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reportConfig.dimensions.length} fields
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle2" gutterBottom>
                Metrics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reportConfig.metrics.length} fields
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle2" gutterBottom>
                Filters
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reportConfig.filters.length} active
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Report Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            fullWidth
            variant="outlined"
            value={reportConfig.name}
            onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Save this configuration as a template for future use. You can access saved templates from the Reports Dashboard.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveReport}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}