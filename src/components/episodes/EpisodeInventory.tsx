'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Block as BlockIcon
} from '@mui/icons-material'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'

interface InventoryData {
  id: string
  episodeId: string
  showId: string
  airDate: string
  preRollSlots: number
  preRollAvailable: number
  preRollReserved: number
  preRollBooked: number
  preRollPrice: number
  midRollSlots: number
  midRollAvailable: number
  midRollReserved: number
  midRollBooked: number
  midRollPrice: number
  postRollSlots: number
  postRollAvailable: number
  postRollReserved: number
  postRollBooked: number
  postRollPrice: number
  estimatedImpressions: number
  actualImpressions?: number
}

interface ReservationItem {
  id: string
  reservationId: string
  inventoryId: string
  episodeId: string
  showId: string
  placementType: string
  unitPrice: number
  totalPrice: number
  airDate: string
  status: string
  reservationNumber: string
  reservationStatus: string
  campaignName?: string
  advertiserName?: string
}

interface EpisodeInventoryProps {
  episodeId: string
  canEdit?: boolean
}

export function EpisodeInventory({ episodeId, canEdit = false }: EpisodeInventoryProps) {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  // Initialize as empty array to prevent undefined issues
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState<Partial<InventoryData>>({})

  useEffect(() => {
    // Only fetch inventory if user is authenticated
    if (user) {
      fetchInventory()
    } else {
      setLoading(false)
    }
  }, [episodeId, user])

  const fetchInventory = async () => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/inventory`)
      if (response.ok) {
        const data = await response.json()
        setInventory(data.inventory)
        // Ensure reservations is always an array
        setReservations(Array.isArray(data.reservations) ? data.reservations : [])
        
        // Check if this is a YouTube episode (no console error, just handle silently)
        if (data.inventory?.isYouTubeEpisode) {
          // YouTube episodes don't have traditional inventory
          console.log('YouTube episode detected - inventory not applicable')
        }
      } else if (response.status === 404) {
        // Handle 404 gracefully - episode or inventory not found
        console.log('Episode inventory not found')
        setInventory(null)
        setReservations([])
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (inventory) {
      setEditData({
        preRollSlots: inventory.preRollSlots,
        preRollPrice: inventory.preRollPrice,
        midRollSlots: inventory.midRollSlots,
        midRollPrice: inventory.midRollPrice,
        postRollSlots: inventory.postRollSlots,
        postRollPrice: inventory.postRollPrice,
        estimatedImpressions: inventory.estimatedImpressions
      })
      setEditOpen(true)
    }
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (response.ok) {
        toast.success('Inventory updated successfully')
        setEditOpen(false)
        fetchInventory()
      } else {
        toast.error('Failed to update inventory')
      }
    } catch (error) {
      toast.error('Failed to update inventory')
    }
  }

  const getUtilization = (available: number, total: number) => {
    if (total === 0) return 0
    return Math.round(((total - available) / total) * 100)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircleIcon fontSize="small" color="success" />
      case 'reserved':
        return <ScheduleIcon fontSize="small" color="warning" />
      case 'cancelled':
        return <BlockIcon fontSize="small" color="error" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    )
  }

  // Show authentication message if user is not logged in
  if (!user) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            Please log in to view episode inventory details
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!inventory) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            No inventory data available for this episode
          </Typography>
        </CardContent>
      </Card>
    )
  }
  
  // Special handling for YouTube episodes
  if (inventory.isYouTubeEpisode) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <InventoryIcon />
              Episode Inventory
            </Typography>
          </Box>
          <Alert severity="info">
            Inventory management is not available for YouTube episodes. 
            YouTube content uses different monetization and placement strategies.
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const summary = {
    totalSlots: inventory.preRollSlots + inventory.midRollSlots + inventory.postRollSlots,
    totalAvailable: inventory.preRollAvailable + inventory.midRollAvailable + inventory.postRollAvailable,
    totalReserved: inventory.preRollReserved + inventory.midRollReserved + inventory.postRollReserved,
    totalBooked: inventory.preRollBooked + inventory.midRollBooked + inventory.postRollBooked
  }

  const totalUtilization = getUtilization(summary.totalAvailable, summary.totalSlots)

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <InventoryIcon />
              Episode Inventory
            </Typography>
            {canEdit && (
              <Button
                startIcon={<EditIcon />}
                onClick={handleEdit}
                size="small"
              >
                Edit Inventory
              </Button>
            )}
          </Box>

          {/* Summary Stats */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4">{summary.totalSlots}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Slots
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {summary.totalAvailable}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {summary.totalReserved}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reserved
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary.main">
                  {summary.totalBooked}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Booked
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Utilization */}
          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Overall Utilization
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {totalUtilization}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={totalUtilization}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          {/* Slot Details */}
          <Grid container spacing={2}>
            {/* Pre-roll */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Pre-roll
                </Typography>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Slots:</Typography>
                  <Typography variant="body2">{inventory.preRollSlots}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Available:</Typography>
                  <Typography variant="body2" color="success.main">
                    {inventory.preRollAvailable}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Reserved:</Typography>
                  <Typography variant="body2" color="warning.main">
                    {inventory.preRollReserved}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Price:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${inventory.preRollPrice}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Mid-roll */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Mid-roll
                </Typography>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Slots:</Typography>
                  <Typography variant="body2">{inventory.midRollSlots}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Available:</Typography>
                  <Typography variant="body2" color="success.main">
                    {inventory.midRollAvailable}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Reserved:</Typography>
                  <Typography variant="body2" color="warning.main">
                    {inventory.midRollReserved}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Price:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${inventory.midRollPrice}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Post-roll */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Post-roll
                </Typography>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Slots:</Typography>
                  <Typography variant="body2">{inventory.postRollSlots}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Available:</Typography>
                  <Typography variant="body2" color="success.main">
                    {inventory.postRollAvailable}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Reserved:</Typography>
                  <Typography variant="body2" color="warning.main">
                    {inventory.postRollReserved}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Price:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${inventory.postRollPrice}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Reservations - Defensive rendering with React stability */}
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Reservations
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Reservation #</TableCell>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Advertiser</TableCell>
                    <TableCell>Placement</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    console.log('=== EPISODE INVENTORY RESERVATIONS DEBUG ===');
                    console.log('reservations:', reservations);
                    console.log('reservations type:', typeof reservations);
                    console.log('reservations isArray:', Array.isArray(reservations));
                    console.log('reservations length:', Array.isArray(reservations) ? reservations.length : 'not array');
                    if (Array.isArray(reservations) && reservations.length > 0) {
                      console.log('first reservation:', reservations[0]);
                    }
                    
                    // Ensure reservations is always an array for safety
                    const safeReservations = Array.isArray(reservations) ? reservations : [];
                    
                    if (safeReservations.length === 0) {
                      // Fallback for empty reservations - never return undefined
                      return (
                        <TableRow key="no-reservations">
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              No reservations for this episode
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return safeReservations.map((item, index) => {
                      console.log(`Reservation ${index}:`, item);
                      
                      if (!item || typeof item !== 'object') {
                        console.warn('Invalid reservation item at index', index, item);
                        return null;
                      }
                      
                      return (
                        <TableRow key={item.id || `reservation-${index}`}>
                          <TableCell>{item.reservationNumber || '-'}</TableCell>
                          <TableCell>{item.campaignName || '-'}</TableCell>
                          <TableCell>{item.advertiserName || '-'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.placementType || 'Unknown'} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">${item.totalPrice || 0}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {getStatusIcon(item.status)}
                              <Typography variant="body2">
                                {item.status || 'Unknown'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    }).filter(Boolean); // Remove any null returns
                  })()} 
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Inventory</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Pre-roll Configuration
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Pre-roll Slots"
                type="number"
                fullWidth
                value={editData.preRollSlots || 0}
                onChange={(e) => setEditData({ ...editData, preRollSlots: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Pre-roll Price"
                type="number"
                fullWidth
                value={editData.preRollPrice || 0}
                onChange={(e) => setEditData({ ...editData, preRollPrice: parseFloat(e.target.value) })}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Mid-roll Configuration
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Mid-roll Slots"
                type="number"
                fullWidth
                value={editData.midRollSlots || 0}
                onChange={(e) => setEditData({ ...editData, midRollSlots: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Mid-roll Price"
                type="number"
                fullWidth
                value={editData.midRollPrice || 0}
                onChange={(e) => setEditData({ ...editData, midRollPrice: parseFloat(e.target.value) })}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Post-roll Configuration
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Post-roll Slots"
                type="number"
                fullWidth
                value={editData.postRollSlots || 0}
                onChange={(e) => setEditData({ ...editData, postRollSlots: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Post-roll Price"
                type="number"
                fullWidth
                value={editData.postRollPrice || 0}
                onChange={(e) => setEditData({ ...editData, postRollPrice: parseFloat(e.target.value) })}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Estimated Impressions"
                type="number"
                fullWidth
                value={editData.estimatedImpressions || 0}
                onChange={(e) => setEditData({ ...editData, estimatedImpressions: parseInt(e.target.value) })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}