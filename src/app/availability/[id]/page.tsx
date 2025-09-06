'use client'

import { useState } from 'react'
import { imageService } from '@/services/imageService'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  InputAdornment,
} from '@mui/material'
import {
  ArrowBack,
  Podcasts,
  CalendarMonth,
  Schedule,
  AttachMoney,
  People,
  TrendingUp,
  Visibility,
  ShoppingCart,
  Share,
  Download,
  MoreVert,
  BookmarkBorder,
  Bookmark,
  PlayArrow,
  Edit,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface AdSlot {
  id: string
  show: string
  showLogo: string
  episode: string
  publishDate: string
  slotPosition: string
  duration: string
  price: number
  status: 'available' | 'reserved' | 'sold'
  targetAudience: string
  estimatedReach: number
  showDescription: string
  hostName: string
  category: string
  avgRating: number
  demographics: {
    age: { '18-24': number, '25-34': number, '35-44': number, '45-54': number, '55+': number }
    gender: { male: number, female: number, other: number }
    location: { urban: number, suburban: number, rural: number }
  }
  historicalPerformance: {
    avgCTR: number
    avgConversionRate: number
    lastMonthListeners: number[]
  }
}

const mockSlot: AdSlot = {
  id: '1',
  show: 'The Tech Review Show',
  showLogo: imageService.generateCoverImage('The Tech Review Show', { width: 80, height: 80 }),
  episode: 'AI Revolution in 2024: What to Expect',
  publishDate: '2024-01-16',
  slotPosition: 'Mid-roll',
  duration: '60s',
  price: 2500,
  status: 'available',
  targetAudience: 'Tech Professionals, Early Adopters',
  estimatedReach: 92000,
  showDescription: 'Weekly deep dives into the latest technology trends, gadgets, and industry news. Hosted by Alex Thompson, a former Silicon Valley engineer with 15 years of experience.',
  hostName: 'Alex Thompson',
  category: 'Technology',
  avgRating: 4.8,
  demographics: {
    age: { '18-24': 15, '25-34': 45, '35-44': 25, '45-54': 12, '55+': 3 },
    gender: { male: 68, female: 30, other: 2 },
    location: { urban: 60, suburban: 30, rural: 10 }
  },
  historicalPerformance: {
    avgCTR: 3.8,
    avgConversionRate: 2.4,
    lastMonthListeners: [85000, 89000, 92000, 88000, 91000, 87000, 93000]
  }
}

export default function AdSlotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [reserveDialog, setReserveDialog] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reservationData, setReservationData] = useState({
    advertiser: '',
    campaign: '',
    contactName: '',
    contactEmail: '',
    notes: '',
  })

  const slotId = params.id as string

  const handleReserve = () => {
    // TODO: Submit reservation to API
    alert('Ad slot reserved successfully!')
    setReserveDialog(false)
    router.push('/availability')
  }

  const handleSave = () => {
    setSaved(!saved)
    alert(saved ? 'Removed from saved slots' : 'Added to saved slots')
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Slot link copied to clipboard!')
  }

  const handleDownload = () => {
    const content = `Ad Slot Details\nShow: ${mockSlot.show}\nEpisode: ${mockSlot.episode}\nPosition: ${mockSlot.slotPosition}\nDuration: ${mockSlot.duration}\nPrice: $${mockSlot.price}\nEstimated Reach: ${mockSlot.estimatedReach.toLocaleString()}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ad-slot-${mockSlot.id}-details.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success'
      case 'reserved': return 'warning'
      case 'sold': return 'error'
      default: return 'default'
    }
  }

  const getPricePerListener = () => {
    return (mockSlot.price / mockSlot.estimatedReach * 1000).toFixed(2)
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/availability')}
          >
            Back to Availability
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleSave} color={saved ? 'primary' : 'default'}>
              {saved ? <Bookmark /> : <BookmarkBorder />}
            </IconButton>
            <IconButton onClick={handleShare}>
              <Share />
            </IconButton>
            <IconButton onClick={handleDownload}>
              <Download />
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        {/* Header */}
        <Paper sx={{ p: 4, mb: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar 
                src={mockSlot.showLogo} 
                sx={{ width: 80, height: 80 }}
              >
                <Podcasts sx={{ fontSize: 40 }} />
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" component="h1" gutterBottom>
                {mockSlot.show}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {mockSlot.episode}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={mockSlot.status} color={getStatusColor(mockSlot.status)} />
                <Chip label={mockSlot.category} variant="outlined" />
                <Chip label={`⭐ ${mockSlot.avgRating}`} variant="outlined" />
              </Box>
              <Typography variant="body1" color="text.secondary">
                Hosted by {mockSlot.hostName}
              </Typography>
            </Grid>
            <Grid item>
              <Card sx={{ textAlign: 'center', minWidth: 200 }}>
                <CardContent>
                  <Typography variant="h4" color="primary" gutterBottom>
                    ${mockSlot.price.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {mockSlot.slotPosition} • {mockSlot.duration}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${getPricePerListener()} per 1K listeners
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {mockSlot.status === 'available' && (
                      <Button 
                        variant="contained" 
                        fullWidth 
                        startIcon={<ShoppingCart />}
                        onClick={() => setReserveDialog(true)}
                      >
                        Reserve Slot
                      </Button>
                    )}
                    {mockSlot.status === 'reserved' && (
                      <Button variant="outlined" fullWidth disabled>
                        Reserved
                      </Button>
                    )}
                    {mockSlot.status === 'sold' && (
                      <Button variant="outlined" fullWidth disabled>
                        Sold Out
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <People color="primary" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Estimated Reach
                    </Typography>
                    <Typography variant="h6">
                      {mockSlot.estimatedReach.toLocaleString()}
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
                  <TrendingUp color="success" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Avg CTR
                    </Typography>
                    <Typography variant="h6">
                      {mockSlot.historicalPerformance.avgCTR}%
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
                  <CalendarMonth color="info" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Publish Date
                    </Typography>
                    <Typography variant="h6">
                      {new Date(mockSlot.publishDate).toLocaleDateString()}
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
                    <Typography color="text.secondary" variant="body2">
                      Conversion Rate
                    </Typography>
                    <Typography variant="h6">
                      {mockSlot.historicalPerformance.avgConversionRate}%
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Content Sections */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Show Description
              </Typography>
              <Typography variant="body1" paragraph>
                {mockSlot.showDescription}
              </Typography>
              <Typography variant="h6" gutterBottom>
                Target Audience
              </Typography>
              <Typography variant="body1">
                {mockSlot.targetAudience}
              </Typography>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Audience Demographics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Age Distribution</Typography>
                  {Object.entries(mockSlot.demographics.age).map(([age, percentage]) => (
                    <Box key={age} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">{age}</Typography>
                      <Typography variant="body2" fontWeight="medium">{percentage}%</Typography>
                    </Box>
                  ))}
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Gender Distribution</Typography>
                  {Object.entries(mockSlot.demographics.gender).map(([gender, percentage]) => (
                    <Box key={gender} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{gender}</Typography>
                      <Typography variant="body2" fontWeight="medium">{percentage}%</Typography>
                    </Box>
                  ))}
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Location Distribution</Typography>
                  {Object.entries(mockSlot.demographics.location).map(([location, percentage]) => (
                    <Box key={location} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{location}</Typography>
                      <Typography variant="body2" fontWeight="medium">{percentage}%</Typography>
                    </Box>
                  ))}
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Ad Slot Details
              </Typography>
              <List dense>
                <ListItem disableGutters>
                  <ListItemIcon><Schedule /></ListItemIcon>
                  <ListItemText primary="Position" secondary={mockSlot.slotPosition} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemIcon><PlayArrow /></ListItemIcon>
                  <ListItemText primary="Duration" secondary={mockSlot.duration} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemIcon><CalendarMonth /></ListItemIcon>
                  <ListItemText primary="Publish Date" secondary={new Date(mockSlot.publishDate).toLocaleDateString()} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemIcon><AttachMoney /></ListItemIcon>
                  <ListItemText primary="Price" secondary={`$${mockSlot.price.toLocaleString()}`} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemIcon><People /></ListItemIcon>
                  <ListItemText primary="Est. Listeners" secondary={mockSlot.estimatedReach.toLocaleString()} />
                </ListItem>
              </List>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance History
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Last 7 episodes average listeners:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {mockSlot.historicalPerformance.lastMonthListeners.map((listeners, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Episode {index + 1}</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {listeners.toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Avg CTR</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {mockSlot.historicalPerformance.avgCTR}%
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Avg Conversion Rate</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {mockSlot.historicalPerformance.avgConversionRate}%
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => router.push(`/shows/${mockSlot.show}`)}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            View Show Details
          </MenuItem>
          <MenuItem onClick={() => setAnchorEl(null)}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Contact Show Host
          </MenuItem>
          <MenuItem onClick={handleShare}>
            <Share fontSize="small" sx={{ mr: 1 }} />
            Share Slot
          </MenuItem>
          <MenuItem onClick={handleDownload}>
            <Download fontSize="small" sx={{ mr: 1 }} />
            Download Details
          </MenuItem>
        </Menu>

        {/* Reserve Dialog */}
        <Dialog open={reserveDialog} onClose={() => setReserveDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Reserve Ad Slot</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 3 }}>
              This will reserve the slot for 48 hours. Complete your booking within this time.
            </Alert>
            <TextField
              fullWidth
              label="Advertiser/Company"
              value={reservationData.advertiser}
              onChange={(e) => setReservationData({...reservationData, advertiser: e.target.value})}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Campaign Name"
              value={reservationData.campaign}
              onChange={(e) => setReservationData({...reservationData, campaign: e.target.value})}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Contact Name"
              value={reservationData.contactName}
              onChange={(e) => setReservationData({...reservationData, contactName: e.target.value})}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Contact Email"
              value={reservationData.contactEmail}
              onChange={(e) => setReservationData({...reservationData, contactEmail: e.target.value})}
              margin="normal"
              type="email"
              required
            />
            <TextField
              fullWidth
              label="Additional Notes"
              value={reservationData.notes}
              onChange={(e) => setReservationData({...reservationData, notes: e.target.value})}
              margin="normal"
              multiline
              rows={3}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReserveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleReserve}
              disabled={!reservationData.advertiser || !reservationData.contactEmail}
            >
              Reserve Slot
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}