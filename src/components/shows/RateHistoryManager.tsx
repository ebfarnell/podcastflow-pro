'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Tooltip,
  Grid,
  FormControlLabel,
  Switch
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Visibility as VisibilityIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'

interface RateHistoryEntry {
  id: string
  showId: string
  placementType: string
  rate: number
  effectiveDate: string
  expiryDate?: string
  notes: string
  createdAt: string
  createdByName: string
  showName: string
}

interface RateHistoryManagerProps {
  showId: string
  showName: string
  onRateUpdated?: () => void
}

const placementTypes = [
  { value: 'pre-roll', label: 'Pre-roll' },
  { value: 'mid-roll', label: 'Mid-roll' },
  { value: 'post-roll', label: 'Post-roll' },
  { value: 'host-read', label: 'Host Read' },
  { value: 'sponsorship', label: 'Sponsorship' }
]

export default function RateHistoryManager({ showId, showName, onRateUpdated }: RateHistoryManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<RateHistoryEntry | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<RateHistoryEntry | null>(null)
  const [includeExpired, setIncludeExpired] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<string>('')

  // Form state
  const [formData, setFormData] = useState({
    placementType: '',
    rate: '',
    effectiveDate: dayjs(),
    expiryDate: null as dayjs.Dayjs | null,
    notes: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()

  // Fetch rate history
  const { data: rateHistory, isLoading, error } = useQuery({
    queryKey: ['rate-history', showId, includeExpired, selectedPlacement],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeExpired) params.set('includeExpired', 'true')
      if (selectedPlacement) params.set('placementType', selectedPlacement)

      const response = await fetch(`/api/shows/${showId}/rate-history?${params}`)
      if (!response.ok) throw new Error('Failed to fetch rate history')
      return response.json()
    }
  })

  // Create/update rate entry
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingEntry 
        ? `/api/shows/${showId}/rate-history/${editingEntry.id}`
        : `/api/shows/${showId}/rate-history`
      
      const response = await fetch(url, {
        method: editingEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save rate entry')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-history', showId] })
      setDialogOpen(false)
      resetForm()
      onRateUpdated?.()
    }
  })

  // Delete rate entry
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/shows/${showId}/rate-history/${entryId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete rate entry')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-history', showId] })
      setDeleteConfirmOpen(false)
      setEntryToDelete(null)
      onRateUpdated?.()
    }
  })

  const resetForm = () => {
    setFormData({
      placementType: '',
      rate: '',
      effectiveDate: dayjs(),
      expiryDate: null,
      notes: ''
    })
    setFormErrors({})
    setEditingEntry(null)
  }

  const handleEdit = (entry: RateHistoryEntry) => {
    setEditingEntry(entry)
    setFormData({
      placementType: entry.placementType,
      rate: entry.rate.toString(),
      effectiveDate: dayjs(entry.effectiveDate),
      expiryDate: entry.expiryDate ? dayjs(entry.expiryDate) : null,
      notes: entry.notes || ''
    })
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.placementType) {
      errors.placementType = 'Placement type is required'
    }
    
    if (!formData.rate || parseFloat(formData.rate) <= 0) {
      errors.rate = 'Rate must be greater than 0'
    }

    if (formData.expiryDate && formData.expiryDate.isBefore(formData.effectiveDate)) {
      errors.expiryDate = 'Expiry date must be after effective date'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    const submitData = {
      placementType: formData.placementType,
      rate: parseFloat(formData.rate),
      effectiveDate: formData.effectiveDate.format('YYYY-MM-DD'),
      expiryDate: formData.expiryDate?.format('YYYY-MM-DD') || null,
      notes: formData.notes
    }

    createMutation.mutate(submitData)
  }

  const getStatusChip = (entry: RateHistoryEntry) => {
    const now = dayjs()
    const effective = dayjs(entry.effectiveDate)
    const expiry = entry.expiryDate ? dayjs(entry.expiryDate) : null

    if (now.isBefore(effective)) {
      return <Chip label="Future" color="info" size="small" />
    } else if (expiry && now.isAfter(expiry)) {
      return <Chip label="Expired" color="default" size="small" />
    } else {
      return <Chip label="Active" color="success" size="small" />
    }
  }

  const getRateTrend = (entry: RateHistoryEntry, index: number) => {
    if (index === rateHistory?.length - 1) return null

    const previousEntry = rateHistory.find((e: RateHistoryEntry, i: number) => 
      i > index && 
      e.placementType === entry.placementType &&
      dayjs(e.effectiveDate).isBefore(dayjs(entry.effectiveDate))
    )

    if (!previousEntry) return null

    const change = entry.rate - previousEntry.rate
    const changePercent = ((change / previousEntry.rate) * 100).toFixed(1)

    if (Math.abs(change) < 0.01) {
      return <RemoveIcon fontSize="small" color="disabled" />
    }

    return (
      <Tooltip title={`${change > 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent}%)`}>
        {change > 0 ? 
          <TrendingUpIcon fontSize="small" color="success" /> : 
          <TrendingDownIcon fontSize="small" color="error" />
        }
      </Tooltip>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load rate history: {error.message}
      </Alert>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Rate History - {showName}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm()
                setDialogOpen(true)
              }}
            >
              Add Rate
            </Button>
          </Box>

          {/* Filters */}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Placement Type</InputLabel>
                <Select
                  value={selectedPlacement}
                  onChange={(e) => setSelectedPlacement(e.target.value)}
                  label="Placement Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {placementTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeExpired}
                    onChange={(e) => setIncludeExpired(e.target.checked)}
                  />
                }
                label="Include Expired"
              />
            </Grid>
          </Grid>

          {/* Rate History Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Placement Type</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Trend</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rateHistory?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No rate history found. Add your first rate to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rateHistory?.map((entry: RateHistoryEntry, index: number) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Chip 
                          label={placementTypes.find(p => p.value === entry.placementType)?.label || entry.placementType}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${entry.rate.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>{dayjs(entry.effectiveDate).format('MMM D, YYYY')}</TableCell>
                      <TableCell>
                        {entry.expiryDate ? dayjs(entry.expiryDate).format('MMM D, YYYY') : 'No expiry'}
                      </TableCell>
                      <TableCell>{getStatusChip(entry)}</TableCell>
                      <TableCell>{getRateTrend(entry, index)}</TableCell>
                      <TableCell>{entry.createdByName}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(entry)}
                          disabled={createMutation.isPending}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEntryToDelete(entry)
                            setDeleteConfirmOpen(true)
                          }}
                          disabled={deleteMutation.isPending}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingEntry ? 'Edit Rate Entry' : 'Add New Rate'}
        </DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth error={!!formErrors.placementType}>
                  <InputLabel>Placement Type</InputLabel>
                  <Select
                    value={formData.placementType}
                    onChange={(e) => setFormData({ ...formData, placementType: e.target.value })}
                    label="Placement Type"
                  >
                    {placementTypes.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.placementType && (
                    <Typography variant="caption" color="error">
                      {formErrors.placementType}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Rate"
                  type="number"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  error={!!formErrors.rate}
                  helperText={formErrors.rate}
                  InputProps={{
                    startAdornment: <Typography>$</Typography>
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Effective Date"
                  value={formData.effectiveDate}
                  onChange={(date) => setFormData({ ...formData, effectiveDate: date || dayjs() })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.effectiveDate,
                      helperText: formErrors.effectiveDate
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Expiry Date (Optional)"
                  value={formData.expiryDate}
                  onChange={(date) => setFormData({ ...formData, expiryDate: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.expiryDate,
                      helperText: formErrors.expiryDate
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this rate change..."
                />
              </Grid>
            </Grid>
          </Box>

          {createMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {createMutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving...' : editingEntry ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the {entryToDelete?.placementType} rate of ${entryToDelete?.rate.toFixed(2)} 
            effective {entryToDelete ? dayjs(entryToDelete.effectiveDate).format('MMM D, YYYY') : ''}?
          </Typography>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={() => entryToDelete && deleteMutation.mutate(entryToDelete.id)}
            color="error"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}