'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
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
  Switch,
  FormControlLabel,
  Divider,
  LinearProgress,
  Tooltip,
  Stack,
  InputAdornment
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  AttachMoney,
  Schedule,
  PlayArrow,
  Stop,
  Settings,
  Info,
  ArrowBack
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function ShowPlacementsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Data state
  const [show, setShow] = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    placementType: '',
    totalSpots: 1,
    liveReadSpots: 0,
    liveReadPercentage: 0,
    defaultLength: 30,
    availableLengths: [15, 30, 60],
    baseRate: 0,
    rates: {} as Record<string, number>
  })

  const showId = params.id as string

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && showId) {
      fetchShowDetails()
      fetchPlacements()
    }
  }, [user, showId])

  const fetchShowDetails = async () => {
    try {
      const response = await fetch(`/api/shows/${showId}`)
      if (!response.ok) throw new Error('Failed to fetch show details')
      const data = await response.json()
      setShow(data)
    } catch (err) {
      console.error('Error fetching show:', err)
      setError('Failed to load show details')
    }
  }

  const fetchPlacements = async () => {
    try {
      const response = await fetch(`/api/shows/${showId}/placements`)
      if (!response.ok) throw new Error('Failed to fetch placements')
      const data = await response.json()
      setPlacements(data.placements)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching placements:', err)
      setError('Failed to load placements')
      setLoading(false)
    }
  }

  const handleCreatePlacement = async () => {
    try {
      // Build rates object from available lengths
      const rates: Record<string, number> = {}
      formData.availableLengths.forEach(length => {
        rates[length.toString()] = formData.rates[length.toString()] || formData.baseRate
      })

      const response = await fetch(`/api/shows/${showId}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rates
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create placement')
      }

      setSuccess('Placement created successfully')
      setCreateDialogOpen(false)
      resetForm()
      fetchPlacements()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdatePlacement = async () => {
    if (!selectedPlacement) return

    try {
      const rates: Record<string, number> = {}
      formData.availableLengths.forEach(length => {
        rates[length.toString()] = formData.rates[length.toString()] || formData.baseRate
      })

      const response = await fetch(`/api/shows/${showId}/placements/${selectedPlacement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rates
        })
      })

      if (!response.ok) throw new Error('Failed to update placement')

      setSuccess('Placement updated successfully')
      setEditDialogOpen(false)
      setSelectedPlacement(null)
      resetForm()
      fetchPlacements()
    } catch (err) {
      setError('Failed to update placement')
    }
  }

  const handleDeletePlacement = async () => {
    if (!selectedPlacement) return

    try {
      const response = await fetch(`/api/shows/${showId}/placements/${selectedPlacement.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete placement')
      }

      setSuccess('Placement deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedPlacement(null)
      fetchPlacements()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const resetForm = () => {
    setFormData({
      placementType: '',
      totalSpots: 1,
      liveReadSpots: 0,
      liveReadPercentage: 0,
      defaultLength: 30,
      availableLengths: [15, 30, 60],
      baseRate: 0,
      rates: {}
    })
  }

  const openEditDialog = (placement: any) => {
    setSelectedPlacement(placement)
    setFormData({
      placementType: placement.placementType,
      totalSpots: placement.totalSpots,
      liveReadSpots: placement.liveReadSpots,
      liveReadPercentage: placement.liveReadPercentage || 0,
      defaultLength: placement.defaultLength,
      availableLengths: placement.availableLengths || [15, 30, 60],
      baseRate: placement.baseRate,
      rates: placement.rates || {}
    })
    setEditDialogOpen(true)
  }

  const getRateForLength = (length: number) => {
    return formData.rates[length.toString()] || formData.baseRate
  }

  const setRateForLength = (length: number, rate: number) => {
    setFormData({
      ...formData,
      rates: {
        ...formData.rates,
        [length.toString()]: rate
      }
    })
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user || !show) return <DashboardLayout><Typography>Show not found</Typography></DashboardLayout>

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push(`/shows/${showId}`)}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                {show.name} - Placements
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Manage ad placement types and pricing
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Add Placement
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Placements Overview */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Settings color="primary" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Placements
                    </Typography>
                    <Typography variant="h4">
                      {placements.length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Schedule color="info" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Spots
                    </Typography>
                    <Typography variant="h4">
                      {placements.reduce((sum, p) => sum + p.totalSpots, 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PlayArrow color="success" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Live Read Spots
                    </Typography>
                    <Typography variant="h4">
                      {placements.reduce((sum, p) => sum + p.liveReadSpots, 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AttachMoney color="warning" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Avg Base Rate
                    </Typography>
                    <Typography variant="h4">
                      ${placements.length > 0 ? 
                        (placements.reduce((sum, p) => sum + p.baseRate, 0) / placements.length).toFixed(0) : 
                        '0'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Placements Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Placement Type</TableCell>
                  <TableCell>Total Spots</TableCell>
                  <TableCell>Live Read</TableCell>
                  <TableCell>Default Length</TableCell>
                  <TableCell>Available Lengths</TableCell>
                  <TableCell align="right">Base Rate</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {placements.map((placement) => (
                  <TableRow key={placement.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>
                        {placement.placementType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {placement.totalSpots}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {placement.liveReadSpots} 
                        {placement.liveReadPercentage && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            ({placement.liveReadPercentage}%)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {placement.defaultLength}s
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {placement.availableLengths.map((length: number) => (
                          <Chip 
                            key={length} 
                            label={`${length}s`} 
                            size="small" 
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        ${placement.baseRate.toFixed(2)}
                      </Typography>
                      {placement.rates && Object.keys(placement.rates).length > 0 && (
                        <Tooltip title="Custom rates available">
                          <Info fontSize="small" color="info" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={placement.isActive ? 'Active' : 'Inactive'}
                        color={placement.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(placement)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedPlacement(placement)
                          setDeleteDialogOpen(true)
                        }}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {placements.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No placements configured
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Add placement types to start managing ad spots for this show
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Add First Placement
              </Button>
            </Box>
          )}
        </Paper>

        {/* Create/Edit Placement Dialog */}
        <Dialog 
          open={createDialogOpen || editDialogOpen} 
          onClose={() => {
            setCreateDialogOpen(false)
            setEditDialogOpen(false)
            setSelectedPlacement(null)
            resetForm()
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {createDialogOpen ? 'Create New Placement' : 'Edit Placement'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Placement Type</InputLabel>
                  <Select
                    value={formData.placementType}
                    onChange={(e) => setFormData({ ...formData, placementType: e.target.value })}
                    label="Placement Type"
                    disabled={editDialogOpen}
                  >
                    <MenuItem value="preroll">Pre-roll</MenuItem>
                    <MenuItem value="midroll">Mid-roll</MenuItem>
                    <MenuItem value="postroll">Post-roll</MenuItem>
                    <MenuItem value="intro">Intro</MenuItem>
                    <MenuItem value="outro">Outro</MenuItem>
                    <MenuItem value="host_read">Host Read</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Total Spots"
                  type="number"
                  value={formData.totalSpots}
                  onChange={(e) => setFormData({ ...formData, totalSpots: parseInt(e.target.value) || 1 })}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Live Read Spots"
                  type="number"
                  value={formData.liveReadSpots}
                  onChange={(e) => setFormData({ ...formData, liveReadSpots: parseInt(e.target.value) || 0 })}
                  inputProps={{ min: 0, max: formData.totalSpots }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Live Read Percentage"
                  type="number"
                  value={formData.liveReadPercentage}
                  onChange={(e) => setFormData({ ...formData, liveReadPercentage: parseFloat(e.target.value) || 0 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Default Length"
                  type="number"
                  value={formData.defaultLength}
                  onChange={(e) => setFormData({ ...formData, defaultLength: parseInt(e.target.value) || 30 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">seconds</InputAdornment>
                  }}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Base Rate"
                  type="number"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: parseFloat(e.target.value) || 0 })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Custom Rates by Length
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Set different rates for different ad lengths. Leave blank to use base rate.
            </Typography>

            <Grid container spacing={2}>
              {formData.availableLengths.map((length) => (
                <Grid item xs={6} md={4} key={length}>
                  <TextField
                    fullWidth
                    label={`${length} seconds`}
                    type="number"
                    value={getRateForLength(length)}
                    onChange={(e) => setRateForLength(length, parseFloat(e.target.value) || formData.baseRate)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>
                    }}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCreateDialogOpen(false)
              setEditDialogOpen(false)
              setSelectedPlacement(null)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={createDialogOpen ? handleCreatePlacement : handleUpdatePlacement}
              disabled={!formData.placementType || !formData.baseRate}
            >
              {createDialogOpen ? 'Create' : 'Update'} Placement
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Placement</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the {selectedPlacement?.placementType} placement? 
              This action cannot be undone and may affect existing orders.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeletePlacement}
            >
              Delete Placement
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}