'use client'

import { useState, useEffect } from 'react'
import { trackingApi, CreateShipmentRequest, UpdateShipmentStatusRequest } from '@/services/trackingApi'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Add,
  Delete,
  Edit,
  LocalShipping,
  CheckCircle,
  Schedule,
  Error,
  ExpandMore,
  Launch,
  ContentCopy,
} from '@mui/icons-material'

export interface ProductShipment {
  id: string
  productName: string
  carrier: 'UPS' | 'FedEx' | 'USPS' | 'DHL' | 'Other'
  trackingNumber: string
  shippedDate: string
  estimatedDelivery?: string
  actualDelivery?: string
  status: 'shipped' | 'in_transit' | 'delivered' | 'failed' | 'returned'
  recipientName: string
  recipientAddress: string
  notes?: string
}

interface Campaign {
  id: string
  name: string
  advertiser: string
  productShipments?: ProductShipment[]
}

interface ProductTrackingModalProps {
  open: boolean
  onClose: () => void
  campaign: Campaign
  onSave: (shipments: ProductShipment[]) => void
}

const carrierUrls = {
  UPS: 'https://www.ups.com/track?tracknum=',
  FedEx: 'https://www.fedex.com/fedextrack/?tracknumber=',
  USPS: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  DHL: 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=',
  Other: '',
}

export function ProductTrackingModal({ open, onClose, campaign, onSave }: ProductTrackingModalProps) {
  const [shipments, setShipments] = useState<ProductShipment[]>(campaign.productShipments || [])
  const [editingShipment, setEditingShipment] = useState<ProductShipment | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newShipment, setNewShipment] = useState<Partial<ProductShipment>>({
    productName: '',
    carrier: 'UPS',
    trackingNumber: '',
    shippedDate: new Date().toISOString().split('T')[0],
    recipientName: '',
    recipientAddress: '',
    status: 'shipped',
    notes: '',
  })

  useEffect(() => {
    if (open && campaign.id) {
      // For now, use campaign data until backend is deployed
      setShipments(campaign.productShipments || [])
      // Uncomment when backend is deployed:
      // loadCampaignShipments()
    }
  }, [open, campaign.id, campaign.productShipments])

  const loadCampaignShipments = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await trackingApi.getCampaignShipments(campaign.id)
      if (response.error) {
        setError(response.error)
      } else if (response.data) {
        setShipments(response.data.shipments || [])
      }
    } catch (err) {
      setError('Failed to load shipments')
      console.error('Load shipments error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: ProductShipment['status']) => {
    switch (status) {
      case 'delivered': return 'success'
      case 'in_transit': return 'info'
      case 'shipped': return 'warning'
      case 'failed': return 'error'
      case 'returned': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: ProductShipment['status']) => {
    switch (status) {
      case 'delivered': return <CheckCircle fontSize="small" />
      case 'in_transit': return <LocalShipping fontSize="small" />
      case 'shipped': return <Schedule fontSize="small" />
      case 'failed': return <Error fontSize="small" />
      case 'returned': return <Error fontSize="small" />
      default: return <Schedule fontSize="small" />
    }
  }

  const handleAddShipment = async () => {
    if (!newShipment.productName || !newShipment.trackingNumber || !newShipment.recipientName) {
      setError('Please fill in all required fields')
      return
    }

    // For now, add locally until backend is deployed
    const shipment: ProductShipment = {
      id: Date.now().toString(),
      productName: newShipment.productName!,
      carrier: newShipment.carrier!,
      trackingNumber: newShipment.trackingNumber!,
      recipientName: newShipment.recipientName!,
      recipientAddress: newShipment.recipientAddress!,
      shippedDate: newShipment.shippedDate!,
      estimatedDelivery: newShipment.estimatedDelivery,
      actualDelivery: newShipment.actualDelivery,
      status: newShipment.status!,
      notes: newShipment.notes,
    }

    setShipments([...shipments, shipment])
    setNewShipment({
      productName: '',
      carrier: 'UPS',
      trackingNumber: '',
      shippedDate: new Date().toISOString().split('T')[0],
      recipientName: '',
      recipientAddress: '',
      status: 'shipped',
      notes: '',
    })
    setShowAddForm(false)

    // Uncomment when backend is deployed:
    /*
    setLoading(true)
    setError(null)

    try {
      const shipmentData: CreateShipmentRequest = {
        productName: newShipment.productName!,
        carrier: newShipment.carrier! as CreateShipmentRequest['carrier'],
        trackingNumber: newShipment.trackingNumber!,
        recipientName: newShipment.recipientName!,
        recipientAddress: newShipment.recipientAddress || '',
        shippedDate: newShipment.shippedDate!,
        estimatedDelivery: newShipment.estimatedDelivery,
        status: newShipment.status! as CreateShipmentRequest['status'],
        notes: newShipment.notes || '',
      }

      const response = await trackingApi.createShipment(campaign.id, shipmentData)
      
      if (response.error) {
        setError(response.error)
      } else if (response.data) {
        await loadCampaignShipments()
        // Reset form...
      }
    } catch (err) {
      setError('Failed to create shipment')
      console.error('Create shipment error:', err)
    } finally {
      setLoading(false)
    }
    */
  }

  const handleUpdateShipment = async (id: string, updates: Partial<ProductShipment>) => {
    // For now, update locally until backend is deployed
    setShipments(shipments.map(s => s.id === id ? { ...s, ...updates } : s))

    // Uncomment when backend is deployed:
    /*
    if (updates.status) {
      setLoading(true)
      setError(null)

      try {
        const response = await trackingApi.updateShipmentStatus(id, {
          status: updates.status,
          notes: updates.notes || ''
        })

        if (response.error) {
          setError(response.error)
        } else {
          setShipments(shipments.map(s => s.id === id ? { ...s, ...updates } : s))
        }
      } catch (err) {
        setError('Failed to update shipment')
        console.error('Update shipment error:', err)
      } finally {
        setLoading(false)
      }
    } else {
      setShipments(shipments.map(s => s.id === id ? { ...s, ...updates } : s))
    }
    */
  }

  const handleDeleteShipment = (id: string) => {
    setShipments(shipments.filter(s => s.id !== id))
  }

  const handleSave = () => {
    onSave(shipments)
    onClose()
  }

  const openTrackingUrl = (carrier: string, trackingNumber: string) => {
    const baseUrl = carrierUrls[carrier as keyof typeof carrierUrls]
    if (baseUrl) {
      window.open(baseUrl + trackingNumber, '_blank')
    }
  }

  const copyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber)
  }

  const handleRefreshTracking = async () => {
    // For now, show a message until backend is deployed
    setError('Tracking refresh will be available once backend is deployed')
    
    // Uncomment when backend is deployed:
    /*
    setLoading(true)
    setError(null)

    try {
      const shipmentIds = shipments.map(s => s.id)
      const response = await trackingApi.batchUpdateTracking(shipmentIds)
      
      if (response.error) {
        setError(response.error)
      } else {
        await loadCampaignShipments()
      }
    } catch (err) {
      setError('Failed to refresh tracking')
      console.error('Refresh tracking error:', err)
    } finally {
      setLoading(false)
    }
    */
  }

  const deliveredCount = shipments.filter(s => s.status === 'delivered').length
  const totalCount = shipments.length

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Product Tracking - {campaign.name}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip 
              label={`${deliveredCount}/${totalCount} Delivered`}
              color={deliveredCount === totalCount && totalCount > 0 ? 'success' : 'default'}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {campaign.advertiser}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowAddForm(true)}
              disabled={loading}
            >
              Add Product Shipment
            </Button>
            {shipments.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<LocalShipping />}
                onClick={handleRefreshTracking}
                disabled={loading}
              >
                Refresh Tracking
              </Button>
            )}
          </Box>

          {shipments.length === 0 && !showAddForm && !loading && (
            <Alert severity="info">
              No product shipments tracked yet. Click "Add Product Shipment" to start tracking products sent to talent.
            </Alert>
          )}

          {loading && shipments.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <Typography variant="body1">Loading shipments...</Typography>
            </Box>
          )}
        </Box>

        {showAddForm && (
          <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Add New Shipment</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Product Name"
                    value={newShipment.productName}
                    onChange={(e) => setNewShipment({ ...newShipment, productName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Carrier</InputLabel>
                    <Select
                      value={newShipment.carrier}
                      onChange={(e) => setNewShipment({ ...newShipment, carrier: e.target.value as any })}
                      label="Carrier"
                    >
                      <MenuItem value="UPS">UPS</MenuItem>
                      <MenuItem value="FedEx">FedEx</MenuItem>
                      <MenuItem value="USPS">USPS</MenuItem>
                      <MenuItem value="DHL">DHL</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tracking Number"
                    value={newShipment.trackingNumber}
                    onChange={(e) => setNewShipment({ ...newShipment, trackingNumber: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Shipped Date"
                    type="date"
                    value={newShipment.shippedDate}
                    onChange={(e) => setNewShipment({ ...newShipment, shippedDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Recipient (Talent) Name"
                    value={newShipment.recipientName}
                    onChange={(e) => setNewShipment({ ...newShipment, recipientName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={newShipment.status}
                      onChange={(e) => setNewShipment({ ...newShipment, status: e.target.value as any })}
                      label="Status"
                    >
                      <MenuItem value="shipped">Shipped</MenuItem>
                      <MenuItem value="in_transit">In Transit</MenuItem>
                      <MenuItem value="delivered">Delivered</MenuItem>
                      <MenuItem value="failed">Failed Delivery</MenuItem>
                      <MenuItem value="returned">Returned</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Address"
                    value={newShipment.recipientAddress}
                    onChange={(e) => setNewShipment({ ...newShipment, recipientAddress: e.target.value })}
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    value={newShipment.notes}
                    onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                    multiline
                    rows={2}
                    placeholder="Additional notes about the shipment..."
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={handleAddShipment}>
                  Add Shipment
                </Button>
                <Button variant="outlined" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {shipments.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Carrier</TableCell>
                  <TableCell>Tracking #</TableCell>
                  <TableCell>Recipient</TableCell>
                  <TableCell>Shipped</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shipments.map((shipment) => (
                  <TableRow key={shipment.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{shipment.productName}</Typography>
                      {shipment.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {shipment.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{shipment.carrier}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {shipment.trackingNumber}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => copyTrackingNumber(shipment.trackingNumber)}
                          title="Copy tracking number"
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                        {shipment.carrier !== 'Other' && (
                          <IconButton 
                            size="small" 
                            onClick={() => openTrackingUrl(shipment.carrier, shipment.trackingNumber)}
                            title="Track package"
                          >
                            <Launch fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{shipment.recipientName}</Typography>
                      {shipment.recipientAddress && (
                        <Typography variant="caption" color="text.secondary">
                          {shipment.recipientAddress}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(shipment.shippedDate).toLocaleDateString()}
                      </Typography>
                      {shipment.estimatedDelivery && (
                        <Typography variant="caption" color="text.secondary">
                          Est: {new Date(shipment.estimatedDelivery).toLocaleDateString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(shipment.status)}
                        label={shipment.status.replace('_', ' ')}
                        color={getStatusColor(shipment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={shipment.status}
                          onChange={(e) => handleUpdateShipment(shipment.id, { status: e.target.value as any })}
                          variant="outlined"
                        >
                          <MenuItem value="shipped">Shipped</MenuItem>
                          <MenuItem value="in_transit">In Transit</MenuItem>
                          <MenuItem value="delivered">Delivered</MenuItem>
                          <MenuItem value="failed">Failed</MenuItem>
                          <MenuItem value="returned">Returned</MenuItem>
                        </Select>
                      </FormControl>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteShipment(shipment.id)}
                        sx={{ ml: 1 }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}