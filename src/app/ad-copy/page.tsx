'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Add,
  Search,
  MoreVert,
  Edit,
  ContentCopy,
  Delete,
  Download,
  Upload,
  Article,
  Mic,
  VideoLibrary,
  CheckCircle,
  Schedule,
  Warning,
  Folder,
  Label,
  Person,
  CalendarMonth,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface AdCopy {
  id: string
  title: string
  advertiser: string
  campaign: string
  type: 'script' | 'audio' | 'video'
  version: string
  status: 'draft' | 'approved' | 'in-use' | 'archived'
  createdBy: string
  createdDate: string
  lastModified: string
  tags: string[]
  duration?: string
  language: string
  notes?: string
}

const mockAdCopies: AdCopy[] = [
  {
    id: '1',
    title: 'TechCorp Q1 Launch - 30s Radio',
    advertiser: 'TechCorp Inc.',
    campaign: 'Q1 Product Launch',
    type: 'script',
    version: '2.1',
    status: 'approved',
    createdBy: 'Sarah Johnson',
    createdDate: '2024-01-05',
    lastModified: '2024-01-08',
    tags: ['product-launch', 'tech', 'radio'],
    duration: '30s',
    language: 'English',
    notes: 'Approved for all podcast placements',
  },
  {
    id: '2',
    title: 'HealthPlus Wellness - Host Read',
    advertiser: 'HealthPlus',
    campaign: 'Winter Wellness',
    type: 'script',
    version: '1.0',
    status: 'draft',
    createdBy: 'Michael Chen',
    createdDate: '2024-01-08',
    lastModified: '2024-01-08',
    tags: ['health', 'host-read', 'wellness'],
    duration: '60s',
    language: 'English',
  },
  {
    id: '3',
    title: 'AutoDrive Safety Campaign - Audio',
    advertiser: 'AutoDrive',
    campaign: 'Safety First 2024',
    type: 'audio',
    version: '1.2',
    status: 'in-use',
    createdBy: 'Alex Thompson',
    createdDate: '2023-12-20',
    lastModified: '2024-01-02',
    tags: ['automotive', 'safety', 'brand-awareness'],
    duration: '45s',
    language: 'English',
    notes: 'Currently running on 5 shows',
  },
]

export default function AdCopyPage() {
  const router = useRouter()
  const [adCopies, setAdCopies] = useState(mockAdCopies)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState(0)
  const [selectedType, setSelectedType] = useState('all')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedCopy, setSelectedCopy] = useState<AdCopy | null>(null)
  const [createDialog, setCreateDialog] = useState(false)

  const handleEdit = (copy: AdCopy) => {
    router.push(`/ad-copy/${copy.id}/edit`)
  }

  const handleDuplicate = (copy: AdCopy) => {
    const newCopy = {
      ...copy,
      id: Date.now().toString(),
      title: `${copy.title} (Copy)`,
      version: '1.0',
      status: 'draft' as const,
      createdDate: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
    }
    setAdCopies(prev => [newCopy, ...prev])
    alert('Ad copy duplicated successfully!')
  }

  const handleDownload = (copy: AdCopy) => {
    const content = `Ad Copy: ${copy.title}\nAdvertiser: ${copy.advertiser}\nCampaign: ${copy.campaign}\nType: ${copy.type}\nDuration: ${copy.duration}\nStatus: ${copy.status}\nVersion: ${copy.version}\nCreated: ${copy.createdDate}\nNotes: ${copy.notes || 'None'}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${copy.title.replace(/\s+/g, '-')}-v${copy.version}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredCopies = adCopies.filter(copy => {
    const matchesSearch = 
      copy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      copy.advertiser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      copy.campaign.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = selectedType === 'all' || copy.type === selectedType
    
    const matchesTab = 
      selectedTab === 0 || // All
      (selectedTab === 1 && copy.status === 'draft') ||
      (selectedTab === 2 && copy.status === 'approved') ||
      (selectedTab === 3 && copy.status === 'in-use') ||
      (selectedTab === 4 && copy.status === 'archived')
    
    return matchesSearch && matchesType && matchesTab
  })

  const getStatusColor = (status: AdCopy['status']) => {
    switch (status) {
      case 'draft': return 'default'
      case 'approved': return 'success'
      case 'in-use': return 'primary'
      case 'archived': return 'warning'
      default: return 'default'
    }
  }

  const getTypeIcon = (type: AdCopy['type']) => {
    switch (type) {
      case 'script': return <Article />
      case 'audio': return <Mic />
      case 'video': return <VideoLibrary />
    }
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Ad Copy Library
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage creative assets and ad copy versions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<Upload />}>
              Import
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialog(true)}
            >
              Create New
            </Button>
          </Box>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Article color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Scripts
                    </Typography>
                    <Typography variant="h5">
                      {adCopies.filter(c => c.type === 'script').length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Mic color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Audio Files
                    </Typography>
                    <Typography variant="h5">
                      {adCopies.filter(c => c.type === 'audio').length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Approved
                    </Typography>
                    <Typography variant="h5">
                      {adCopies.filter(c => c.status === 'approved').length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Schedule color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      In Use
                    </Typography>
                    <Typography variant="h5">
                      {adCopies.filter(c => c.status === 'in-use').length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper>
          <Tabs 
            value={selectedTab} 
            onChange={(e, value) => setSelectedTab(value)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="All" />
            <Tab label="Drafts" />
            <Tab label="Approved" />
            <Tab label="In Use" />
            <Tab label="Archived" />
          </Tabs>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search ad copy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              Type: {selectedType === 'all' ? 'All' : selectedType}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={() => { setSelectedType('all'); setAnchorEl(null); }}>All Types</MenuItem>
              <MenuItem onClick={() => { setSelectedType('script'); setAnchorEl(null); }}>Scripts</MenuItem>
              <MenuItem onClick={() => { setSelectedType('audio'); setAnchorEl(null); }}>Audio</MenuItem>
              <MenuItem onClick={() => { setSelectedType('video'); setAnchorEl(null); }}>Video</MenuItem>
            </Menu>
          </Box>
        </Paper>

        {/* Ad Copy Grid */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {filteredCopies.map((copy) => (
            <Grid item xs={12} md={6} lg={4} key={copy.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getTypeIcon(copy.type)}
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                        {copy.title}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setSelectedCopy(copy)
                        setAnchorEl(e.currentTarget)
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {copy.advertiser} • {copy.campaign}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={copy.status}
                      size="small"
                      color={getStatusColor(copy.status)}
                    />
                    <Chip
                      label={`v${copy.version}`}
                      size="small"
                      variant="outlined"
                    />
                    {copy.duration && (
                      <Chip
                        label={copy.duration}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <List dense>
                    <ListItem disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Person fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={copy.createdBy}
                        secondary="Created by"
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CalendarMonth fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={new Date(copy.lastModified).toLocaleDateString()}
                        secondary="Last modified"
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  </List>

                  {copy.tags.length > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {copy.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          icon={<Label />}
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))}
                    </Box>
                  )}

                  {copy.notes && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {copy.notes}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<Edit />} onClick={() => handleEdit(copy)}>
                    Edit
                  </Button>
                  <Button size="small" startIcon={<ContentCopy />} onClick={() => handleDuplicate(copy)}>
                    Duplicate
                  </Button>
                  <Button size="small" startIcon={<Download />} onClick={() => handleDownload(copy)}>
                    Download
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Create Dialog */}
        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Ad Copy</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Title"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Advertiser"
                margin="normal"
                select
              >
                <MenuItem value="TechCorp Inc.">TechCorp Inc.</MenuItem>
                <MenuItem value="HealthPlus">HealthPlus</MenuItem>
                <MenuItem value="AutoDrive">AutoDrive</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="Campaign"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Type"
                margin="normal"
                select
              >
                <MenuItem value="script">Script</MenuItem>
                <MenuItem value="audio">Audio</MenuItem>
                <MenuItem value="video">Video</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="Duration"
                margin="normal"
                select
              >
                <MenuItem value="15s">15 seconds</MenuItem>
                <MenuItem value="30s">30 seconds</MenuItem>
                <MenuItem value="45s">45 seconds</MenuItem>
                <MenuItem value="60s">60 seconds</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="Language"
                margin="normal"
                defaultValue="English"
              />
              <TextField
                fullWidth
                label="Tags (comma separated)"
                margin="normal"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button variant="contained">Create</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}
