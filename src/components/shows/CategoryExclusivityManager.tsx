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
  Grid,
  FormControlLabel,
  Switch,
  Autocomplete,
  Checkbox,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'

interface CategoryExclusivity {
  id: string
  showId: string
  category: string
  level: 'episode' | 'show' | 'network'
  advertiserId?: string
  campaignId?: string
  startDate: string
  endDate: string
  isActive: boolean
  notes: string
  createdAt: string
  showName: string
  advertiserName?: string
  campaignName?: string
  createdByName: string
}

interface CategoryExclusivityManagerProps {
  showId: string
  showName: string
  onExclusivityUpdated?: () => void
}

const exclusivityLevels = [
  { value: 'episode', label: 'Episode Level', description: 'Exclusive within single episode' },
  { value: 'show', label: 'Show Level', description: 'Exclusive across entire show' },
  { value: 'network', label: 'Network Level', description: 'Exclusive across all shows' }
]

const commonCategories = [
  'Automotive', 'Financial Services', 'Healthcare', 'Technology', 'Retail',
  'Food & Beverage', 'Travel', 'Entertainment', 'Education', 'Real Estate',
  'Insurance', 'Telecommunications', 'Sports', 'Fashion', 'Gaming'
]

export default function CategoryExclusivityManager({ 
  showId, 
  showName, 
  onExclusivityUpdated 
}: CategoryExclusivityManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CategoryExclusivity | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<CategoryExclusivity | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [activeOnly, setActiveOnly] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<string>('')

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    level: 'episode' as 'episode' | 'show' | 'network',
    advertiserId: '',
    campaignId: '',
    startDate: dayjs(),
    endDate: dayjs().add(30, 'days'),
    notes: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()

  // Fetch exclusivities
  const { data: exclusivities, isLoading, error } = useQuery({
    queryKey: ['category-exclusivity', showId, activeOnly, selectedCategory, selectedLevel],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeOnly) params.set('activeOnly', 'true')
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedLevel) params.set('level', selectedLevel)
      params.set('dateRange', 'all')

      const response = await fetch(`/api/shows/${showId}/category-exclusivity?${params}`)
      if (!response.ok) throw new Error('Failed to fetch category exclusivities')
      return response.json()
    }
  })

  // Fetch advertisers for form
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers'],
    queryFn: async () => {
      const response = await fetch('/api/advertisers')
      if (!response.ok) throw new Error('Failed to fetch advertisers')
      return response.json()
    }
  })

  // Fetch campaigns for selected advertiser
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', formData.advertiserId],
    queryFn: async () => {
      if (!formData.advertiserId) return []
      const response = await fetch(`/api/campaigns?advertiserId=${formData.advertiserId}`)
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      return response.json()
    },
    enabled: !!formData.advertiserId
  })

  // Create/update exclusivity
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingEntry 
        ? `/api/shows/${showId}/category-exclusivity/${editingEntry.id}`
        : `/api/shows/${showId}/category-exclusivity`
      
      const response = await fetch(url, {
        method: editingEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save exclusivity')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-exclusivity', showId] })
      setDialogOpen(false)
      resetForm()
      onExclusivityUpdated?.()
    }
  })

  // Delete exclusivity
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/shows/${showId}/category-exclusivity/${entryId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete exclusivity')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-exclusivity', showId] })
      setDeleteConfirmOpen(false)
      setEntryToDelete(null)
      onExclusivityUpdated?.()
    }
  })

  // Batch operations
  const batchMutation = useMutation({
    mutationFn: async (data: { action: string; exclusivityIds: string[]; newStatus?: boolean }) => {
      const response = await fetch(`/api/shows/${showId}/category-exclusivity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update exclusivities')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-exclusivity', showId] })
      setSelectedEntries([])
    }
  })

  const resetForm = () => {
    setFormData({
      category: '',
      level: 'episode',
      advertiserId: '',
      campaignId: '',
      startDate: dayjs(),
      endDate: dayjs().add(30, 'days'),
      notes: ''
    })
    setFormErrors({})
    setEditingEntry(null)
  }

  const handleEdit = (entry: CategoryExclusivity) => {
    setEditingEntry(entry)
    setFormData({
      category: entry.category,
      level: entry.level,
      advertiserId: entry.advertiserId || '',
      campaignId: entry.campaignId || '',
      startDate: dayjs(entry.startDate),
      endDate: dayjs(entry.endDate),
      notes: entry.notes || ''
    })
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.category.trim()) {
      errors.category = 'Category is required'
    }

    if (formData.endDate.isBefore(formData.startDate)) {
      errors.endDate = 'End date must be after start date'
    }

    if (formData.startDate.isBefore(dayjs(), 'day')) {
      errors.startDate = 'Start date cannot be in the past'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    const submitData = {
      category: formData.category.trim(),
      level: formData.level,
      advertiserId: formData.advertiserId || null,
      campaignId: formData.campaignId || null,
      startDate: formData.startDate.format('YYYY-MM-DD'),
      endDate: formData.endDate.format('YYYY-MM-DD'),
      notes: formData.notes.trim()
    }

    createMutation.mutate(submitData)
  }

  const getStatusChip = (entry: CategoryExclusivity) => {
    const now = dayjs()
    const start = dayjs(entry.startDate)
    const end = dayjs(entry.endDate)

    if (!entry.isActive) {
      return <Chip label="Inactive" color="default" size="small" />
    } else if (now.isBefore(start)) {
      return <Chip label="Scheduled" color="info" size="small" />
    } else if (now.isAfter(end)) {
      return <Chip label="Expired" color="warning" size="small" />
    } else {
      return <Chip label="Active" color="success" size="small" />
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'episode': return <InfoIcon fontSize="small" color="info" />
      case 'show': return <WarningIcon fontSize="small" color="warning" />
      case 'network': return <BlockIcon fontSize="small" color="error" />
      default: return null
    }
  }

  const handleBatchToggle = (activate: boolean) => {
    if (selectedEntries.length === 0) return

    batchMutation.mutate({
      action: 'toggle_status',
      exclusivityIds: selectedEntries,
      newStatus: activate
    })
  }

  const isOverlapping = (entry: CategoryExclusivity) => {
    if (!exclusivities) return false

    return exclusivities.some((other: CategoryExclusivity) => 
      other.id !== entry.id &&
      other.category === entry.category &&
      other.level === entry.level &&
      other.isActive &&
      dayjs(other.startDate).isBefore(dayjs(entry.endDate)) &&
      dayjs(other.endDate).isAfter(dayjs(entry.startDate))
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load category exclusivities: {error.message}
      </Alert>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Category Exclusivity - {showName}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm()
                setDialogOpen(true)
              }}
            >
              Add Exclusivity
            </Button>
          </Box>

          {/* Filters */}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                options={commonCategories}
                value={selectedCategory}
                onChange={(_, value) => setSelectedCategory(value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Filter by Category" />
                )}
                freeSolo
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Level</InputLabel>
                <Select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  label="Filter by Level"
                >
                  <MenuItem value="">All Levels</MenuItem>
                  {exclusivityLevels.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                  />
                }
                label="Active Only"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {selectedEntries.length > 0 && (
                <Box>
                  <Button
                    size="small"
                    onClick={() => handleBatchToggle(true)}
                    disabled={batchMutation.isPending}
                    startIcon={<ToggleOnIcon />}
                  >
                    Activate ({selectedEntries.length})
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleBatchToggle(false)}
                    disabled={batchMutation.isPending}
                    startIcon={<ToggleOffIcon />}
                    sx={{ ml: 1 }}
                  >
                    Deactivate
                  </Button>
                </Box>
              )}
            </Grid>
          </Grid>

          {/* Exclusivities Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedEntries.length > 0 && selectedEntries.length < (exclusivities?.length || 0)}
                      checked={exclusivities?.length > 0 && selectedEntries.length === exclusivities.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEntries(exclusivities?.map((ex: CategoryExclusivity) => ex.id) || [])
                        } else {
                          setSelectedEntries([])
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Advertiser/Campaign</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Conflicts</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 9 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : exclusivities?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No category exclusivities found. Add your first exclusivity rule to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  exclusivities?.map((entry: CategoryExclusivity) => (
                    <TableRow key={entry.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedEntries.includes(entry.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEntries([...selectedEntries, entry.id])
                            } else {
                              setSelectedEntries(selectedEntries.filter(id => id !== entry.id))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {entry.category}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getLevelIcon(entry.level)}
                          <Typography variant="body2">
                            {exclusivityLevels.find(l => l.value === entry.level)?.label}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(entry.startDate).format('MMM D, YYYY')} - {dayjs(entry.endDate).format('MMM D, YYYY')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {entry.advertiserName ? (
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.advertiserName}
                            </Typography>
                            {entry.campaignName && (
                              <Typography variant="caption" color="text.secondary">
                                {entry.campaignName}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            General Rule
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{getStatusChip(entry)}</TableCell>
                      <TableCell>
                        {isOverlapping(entry) && (
                          <Tooltip title="This exclusivity overlaps with another rule">
                            <WarningIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </TableCell>
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
          {editingEntry ? 'Edit Category Exclusivity' : 'Add Category Exclusivity'}
        </DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Autocomplete
                  options={commonCategories}
                  value={formData.category}
                  onChange={(_, value) => setFormData({ ...formData, category: value || '' })}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Category" 
                      error={!!formErrors.category}
                      helperText={formErrors.category}
                      required
                    />
                  )}
                  freeSolo
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth error={!!formErrors.level}>
                  <InputLabel>Exclusivity Level</InputLabel>
                  <Select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                    label="Exclusivity Level"
                  >
                    {exclusivityLevels.map(level => (
                      <MenuItem key={level.value} value={level.value}>
                        <Box>
                          <Typography>{level.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {level.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  options={advertisers || []}
                  getOptionLabel={(option) => option.name || ''}
                  value={advertisers?.find((a: any) => a.id === formData.advertiserId) || null}
                  onChange={(_, value) => {
                    setFormData({ 
                      ...formData, 
                      advertiserId: value?.id || '',
                      campaignId: '' // Reset campaign when advertiser changes
                    })
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Advertiser (Optional)"
                      helperText="Leave empty for general category exclusivity"
                    />
                  )}
                />
              </Grid>

              {formData.advertiserId && (
                <Grid item xs={12}>
                  <Autocomplete
                    options={campaigns || []}
                    getOptionLabel={(option) => option.name || ''}
                    value={campaigns?.find((c: any) => c.id === formData.campaignId) || null}
                    onChange={(_, value) => {
                      setFormData({ ...formData, campaignId: value?.id || '' })
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Campaign (Optional)"
                        helperText="Specific campaign for this exclusivity"
                      />
                    )}
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(date) => setFormData({ ...formData, startDate: date || dayjs() })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.startDate,
                      helperText: formErrors.startDate
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="End Date"
                  value={formData.endDate}
                  onChange={(date) => setFormData({ ...formData, endDate: date || dayjs() })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.endDate,
                      helperText: formErrors.endDate
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
                  placeholder="Add any notes about this exclusivity rule..."
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
            Are you sure you want to delete the {entryToDelete?.category} exclusivity 
            ({entryToDelete?.level} level) from {entryToDelete ? dayjs(entryToDelete.startDate).format('MMM D, YYYY') : ''} 
            to {entryToDelete ? dayjs(entryToDelete.endDate).format('MMM D, YYYY') : ''}?
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