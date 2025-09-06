'use client'

import { useState } from 'react'
import { MigrationNotice } from '@/components/common/MigrationNotice'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Tooltip,
  Alert,
  Skeleton,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  PlayCircle as PlayIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Archive as ArchiveIcon,
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
import { useRouter } from 'next/navigation'
import { CreativeForm } from '@/components/creatives/CreativeForm'

interface Creative {
  id: string
  name: string
  description?: string
  type: string
  format: string
  duration: number
  status: string
  category?: string
  tags: string[]
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  advertiser?: {
    id: string
    name: string
  }
  campaign?: {
    id: string
    name: string
  }
  creator: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  expiryDate?: string
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

export default function CreativesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedType, setSelectedType] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; creative: Creative } | null>(null)

  // Fetch creatives
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['creatives', page, rowsPerPage, searchQuery, selectedType, selectedFormat, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      })
      
      if (searchQuery) params.append('search', searchQuery)
      if (selectedType) params.append('type', selectedType)
      if (selectedFormat) params.append('format', selectedFormat)
      if (selectedStatus) params.append('status', selectedStatus)

      const response = await api.get(`/creatives?${params}`)
      return response.data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard: boolean }) => {
      await api.delete(`/creatives/${id}${hard ? '?hard=true' : ''}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatives'] })
      setMenuAnchor(null)
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/creatives/${id}/duplicate`, {})
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatives'] })
      setMenuAnchor(null)
    },
  })

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, creative: Creative) => {
    setMenuAnchor({ el: event.currentTarget, creative })
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleView = (creative: Creative) => {
    router.push(`/creatives/${creative.id}`)
  }

  const handleEdit = (creative: Creative) => {
    setSelectedCreative(creative)
    setCreateDialogOpen(true)
    handleMenuClose()
  }

  const handleDuplicate = (creative: Creative) => {
    duplicateMutation.mutate(creative.id)
  }

  const handleArchive = (creative: Creative) => {
    deleteMutation.mutate({ id: creative.id, hard: false })
  }

  const handleDelete = (creative: Creative) => {
    if (confirm('Are you sure you want to permanently delete this creative? This action cannot be undone.')) {
      deleteMutation.mutate({ id: creative.id, hard: true })
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}` : `${minutes}:00`
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <MigrationNotice targetTab="creative" pageName="Creative Library" />
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Creative Library
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedCreative(null)
                setCreateDialogOpen(true)
              }}
            >
              Add Creative
            </Button>
          </Box>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search creatives..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        label="Type"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="pre-roll">Pre-Roll</MenuItem>
                        <MenuItem value="mid-roll">Mid-Roll</MenuItem>
                        <MenuItem value="post-roll">Post-Roll</MenuItem>
                        <MenuItem value="host-read">Host Read</MenuItem>
                        <MenuItem value="produced">Produced</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Format</InputLabel>
                      <Select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        label="Format"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="audio">Audio</MenuItem>
                        <MenuItem value="video">Video</MenuItem>
                        <MenuItem value="script">Script</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        label="Status"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Failed to load creatives. Please try again.
            </Alert>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Creative</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Format</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Advertiser</TableCell>
                  <TableCell>Performance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={9}>
                        <Skeleton variant="rectangular" height={60} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.creatives.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        No creatives found. Create your first creative to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.creatives.map((creative: Creative) => (
                    <TableRow key={creative.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">{creative.name}</Typography>
                          {creative.description && (
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                              {creative.description}
                            </Typography>
                          )}
                          {creative.tags.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {creative.tags.slice(0, 3).map((tag) => (
                                <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                              ))}
                              {creative.tags.length > 3 && (
                                <Chip label={`+${creative.tags.length - 3}`} size="small" variant="outlined" />
                              )}
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={creative.type.replace('-', ' ')}
                          size="small"
                          color={formatTypeColors[creative.type as keyof typeof formatTypeColors] || 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatIcons[creative.format as keyof typeof formatIcons]}
                          <Typography variant="body2">{creative.format}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{formatDuration(creative.duration)}</TableCell>
                      <TableCell>
                        {creative.advertiser ? (
                          <Typography variant="body2">{creative.advertiser.name}</Typography>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            {creative.impressions.toLocaleString()} impressions
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {creative.clicks} clicks • {creative.conversions} conversions
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={creative.status}
                          size="small"
                          color={
                            creative.status === 'active'
                              ? 'success'
                              : creative.status === 'inactive'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            {format(new Date(creative.createdAt), 'MMM d, yyyy')}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            by {creative.creator.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, creative)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 20, 50]}
              component="div"
              count={data?.total || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        </Box>

        {/* Action Menu */}
        <Menu
          anchorEl={menuAnchor?.el}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => menuAnchor && handleView(menuAnchor.creative)}>
            <ViewIcon sx={{ mr: 1 }} fontSize="small" />
            View Details
          </MenuItem>
          <MenuItem onClick={() => menuAnchor && handleEdit(menuAnchor.creative)}>
            <EditIcon sx={{ mr: 1 }} fontSize="small" />
            Edit
          </MenuItem>
          <MenuItem onClick={() => menuAnchor && handleDuplicate(menuAnchor.creative)}>
            <CopyIcon sx={{ mr: 1 }} fontSize="small" />
            Duplicate
          </MenuItem>
          {menuAnchor?.creative.format !== 'script' && (
            <MenuItem>
              <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
              Download
            </MenuItem>
          )}
          <MenuItem onClick={() => menuAnchor && handleArchive(menuAnchor.creative)}>
            <ArchiveIcon sx={{ mr: 1 }} fontSize="small" />
            Archive
          </MenuItem>
          <MenuItem
            onClick={() => menuAnchor && handleDelete(menuAnchor.creative)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
            Delete
          </MenuItem>
        </Menu>

        {/* Create/Edit Dialog */}
        <CreativeForm
          open={createDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false)
            setSelectedCreative(null)
          }}
          creative={selectedCreative}
          onSuccess={() => {
            setCreateDialogOpen(false)
            setSelectedCreative(null)
            refetch()
          }}
        />
      </DashboardLayout>
    </RouteProtection>
  )
}