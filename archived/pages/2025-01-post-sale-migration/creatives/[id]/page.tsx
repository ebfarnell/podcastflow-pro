'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
} from '@mui/material'
import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Archive as ArchiveIcon,
  PlayCircle as PlayIcon,
  Download as DownloadIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Description as ScriptIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { CreativeForm } from '@/components/creatives/CreativeForm'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}` : `${minutes}:00`
}

const formatTypeColors = {
  'pre-roll': 'primary',
  'mid-roll': 'secondary',
  'post-roll': 'info',
  'host-read': 'success',
  'produced': 'warning',
} as const

const formatIcons = {
  audio: <AudioIcon />,
  video: <VideoIcon />,
  script: <ScriptIcon />,
}

export default function CreativeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(0)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const creativeId = params.id as string

  // Fetch creative details
  const { data: creative, isLoading } = useQuery({
    queryKey: ['creative', creativeId],
    queryFn: async () => {
      const response = await api.get(`/creatives/${creativeId}`)
      return response.data
    },
  })

  // Fetch usage analytics
  const { data: usage } = useQuery({
    queryKey: ['creative-usage', creativeId],
    queryFn: async () => {
      const response = await api.get(`/creatives/${creativeId}/usage`)
      return response.data
    },
    enabled: !!creative,
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/creatives/${creativeId}`),
    onSuccess: () => {
      router.push('/creatives')
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/creatives/${creativeId}/duplicate`, {}),
    onSuccess: (response) => {
      router.push(`/creatives/${response.data.id}`)
    },
  })

  if (isLoading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
        <DashboardLayout>
          <LinearProgress />
        </DashboardLayout>
      </RouteProtection>
    )
  }

  if (!creative) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
        <DashboardLayout>
          <Alert severity="error">Creative not found</Alert>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  const handleDownload = () => {
    if (creative.audioUrl || creative.videoUrl) {
      const url = creative.audioUrl || creative.videoUrl
      window.open(url, '_blank')
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {creative.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={creative.type.replace('-', ' ')}
                  color={formatTypeColors[creative.type as keyof typeof formatTypeColors] || 'default'}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {formatIcons[creative.format as keyof typeof formatIcons]}
                  <Typography variant="body2">{creative.format}</Typography>
                </Box>
                <Chip label={formatDuration(creative.duration)} variant="outlined" />
                <Chip
                  label={creative.status}
                  color={creative.status === 'active' ? 'success' : 'default'}
                  size="small"
                />
                {creative.expiryDate && new Date(creative.expiryDate) < new Date() && (
                  <Chip label="Expired" color="error" size="small" />
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {(creative.audioUrl || creative.videoUrl) && (
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  variant="outlined"
                >
                  Download
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditDialogOpen(true)}
              >
                Edit
              </Button>
              <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
                <MoreVertIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Description */}
          {creative.description && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body1">{creative.description}</Typography>
              </CardContent>
            </Card>
          )}

          {/* Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Impressions
                  </Typography>
                  <Typography variant="h5">
                    {creative.impressions.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Clicks
                  </Typography>
                  <Typography variant="h5">
                    {creative.clicks.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {creative.impressions > 0
                      ? `${((creative.clicks / creative.impressions) * 100).toFixed(2)}% CTR`
                      : '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Conversions
                  </Typography>
                  <Typography variant="h5">
                    {creative.conversions.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {creative.clicks > 0
                      ? `${((creative.conversions / creative.clicks) * 100).toFixed(2)}% CVR`
                      : '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Revenue
                  </Typography>
                  <Typography variant="h5">
                    ${creative.revenue.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {creative.impressions > 0
                      ? `$${(creative.revenue / creative.impressions * 1000).toFixed(2)} CPM`
                      : '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs */}
          <Card>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Details" />
              <Tab label="Usage History" />
              <Tab label="Performance" />
            </Tabs>
            <Divider />
            <CardContent>
              <TabPanel value={activeTab} index={0}>
                <Grid container spacing={3}>
                  {/* Script/Content */}
                  {creative.script && (
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Script
                      </Typography>
                      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {creative.script}
                        </Typography>
                      </Paper>
                    </Grid>
                  )}

                  {/* Talking Points */}
                  {creative.talkingPoints && creative.talkingPoints.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Key Talking Points
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {creative.talkingPoints.map((point: string, index: number) => (
                          <Chip key={index} label={point} />
                        ))}
                      </Box>
                    </Grid>
                  )}

                  {/* Tags */}
                  {creative.tags && creative.tags.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {creative.tags.map((tag: string, index: number) => (
                          <Chip key={index} label={tag} variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                  )}

                  {/* Legal */}
                  {(creative.legalDisclaimer || (creative.restrictedTerms && creative.restrictedTerms.length > 0)) && (
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        Legal & Compliance
                      </Typography>
                      {creative.legalDisclaimer && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Legal Disclaimer
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {creative.legalDisclaimer}
                          </Typography>
                        </Box>
                      )}
                      {creative.restrictedTerms && creative.restrictedTerms.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Restricted Terms
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {creative.restrictedTerms.map((term: string, index: number) => (
                              <Chip
                                key={index}
                                label={term}
                                color="error"
                                variant="outlined"
                                size="small"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Grid>
                  )}

                  {/* Metadata */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Details
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        {creative.advertiser && (
                          <TableRow>
                            <TableCell>Advertiser</TableCell>
                            <TableCell>{creative.advertiser.name}</TableCell>
                          </TableRow>
                        )}
                        {creative.campaign && (
                          <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>{creative.campaign.name}</TableCell>
                          </TableRow>
                        )}
                        {creative.category && (
                          <TableRow>
                            <TableCell>Category</TableCell>
                            <TableCell>{creative.category}</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell>Created</TableCell>
                          <TableCell>
                            {format(new Date(creative.createdAt), 'MMM d, yyyy')} by{' '}
                            {creative.creator.name}
                          </TableCell>
                        </TableRow>
                        {creative.updater && (
                          <TableRow>
                            <TableCell>Last Updated</TableCell>
                            <TableCell>
                              {format(new Date(creative.updatedAt), 'MMM d, yyyy')} by{' '}
                              {creative.updater.name}
                            </TableCell>
                          </TableRow>
                        )}
                        {creative.expiryDate && (
                          <TableRow>
                            <TableCell>Expires</TableCell>
                            <TableCell>
                              {format(new Date(creative.expiryDate), 'MMM d, yyyy')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                {usage?.usage.length === 0 ? (
                  <Alert severity="info">
                    This creative hasn't been used in any campaigns yet.
                  </Alert>
                ) : (
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Entity</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Start Date</TableCell>
                          <TableCell>End Date</TableCell>
                          <TableCell>Impressions</TableCell>
                          <TableCell>Clicks</TableCell>
                          <TableCell>Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {usage?.usage.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.entityName || item.entityId}</TableCell>
                            <TableCell>
                              <Chip label={item.entityType} size="small" />
                            </TableCell>
                            <TableCell>{format(new Date(item.startDate), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              {item.endDate ? format(new Date(item.endDate), 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell>{item.impressions.toLocaleString()}</TableCell>
                            <TableCell>{item.clicks.toLocaleString()}</TableCell>
                            <TableCell>${item.revenue.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <Alert severity="info">
                  Performance analytics and charts coming soon.
                </Alert>
              </TabPanel>
            </CardContent>
          </Card>
        </Box>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null)
              duplicateMutation.mutate()
            }}
          >
            <CopyIcon sx={{ mr: 1 }} fontSize="small" />
            Duplicate Creative
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null)
              archiveMutation.mutate()
            }}
          >
            <ArchiveIcon sx={{ mr: 1 }} fontSize="small" />
            Archive Creative
          </MenuItem>
        </Menu>

        {/* Edit Dialog */}
        <CreativeForm
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          creative={creative}
          onSuccess={() => {
            setEditDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['creative', creativeId] })
          }}
        />
      </DashboardLayout>
    </RouteProtection>
  )
}