'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Menu,
  MenuItem
} from '@mui/material'
import {
  Search,
  PlayArrow,
  Pause,
  Download,
  Delete,
  MoreVert,
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Mic,
  VolumeUp,
  Timer
} from '@mui/icons-material'
import { format, formatDuration } from 'date-fns'
import { useAudio } from '@/contexts/AudioContext'

interface Recording {
  id: string
  episodeId: string
  episodeTitle: string
  showName: string
  recordingDate: string
  uploadDate: string
  duration: number
  fileSize: number
  status: 'uploaded' | 'processing' | 'approved' | 'rejected'
  fileUrl: string
  notes: string | null
  feedback: string | null
  waveformData?: number[]
}

export default function TalentRecordingsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const { playAudio, pauseAudio, isPlaying, currentTrack } = useAudio()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [reuploadDialog, setReuploadDialog] = useState(false)
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null)

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchRecordings()
    }
  }, [user, sessionLoading, page, rowsPerPage, searchQuery, statusFilter])

  const fetchRecordings = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: searchQuery,
        talentId: user?.id || ''
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/talent/recordings?${params}`)
      if (!response.ok) throw new Error('Failed to fetch recordings')
      
      const data = await response.json()
      
      // Transform the data
      const transformedRecordings = data.recordings.map((recording: any) => ({
        id: recording.id,
        episodeId: recording.episodeId,
        episodeTitle: recording.episode?.title || '',
        showName: recording.episode?.show?.name || '',
        recordingDate: recording.recordingDate,
        uploadDate: recording.uploadDate,
        duration: recording.duration || 0,
        fileSize: recording.fileSize || 0,
        status: recording.status || 'uploaded',
        fileUrl: recording.fileUrl,
        notes: recording.notes,
        feedback: recording.feedback,
        waveformData: recording.waveformData
      }))

      setRecordings(transformedRecordings)
      setTotalCount(data.total)
    } catch (err) {
      console.error('Error fetching recordings:', err)
      setError('Failed to load recordings')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayPause = (recording: Recording) => {
    if (isPlaying && currentTrack?.id === recording.id) {
      pauseAudio()
    } else {
      playAudio({
        id: recording.id,
        title: recording.episodeTitle,
        show: recording.showName,
        audioUrl: recording.fileUrl,
        duration: recording.duration
      })
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, recording: Recording) => {
    setAnchorEl(event.currentTarget)
    setSelectedRecording(recording)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    handleMenuClose()
    setDeleteDialog(true)
  }

  const handleReupload = () => {
    handleMenuClose()
    setReuploadDialog(true)
  }

  const confirmDelete = async () => {
    if (!selectedRecording) return

    try {
      const response = await fetch(`/api/talent/recordings/${selectedRecording.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete recording')
      
      setDeleteDialog(false)
      setSelectedRecording(null)
      fetchRecordings()
    } catch (err) {
      console.error('Error deleting recording:', err)
      setError('Failed to delete recording')
    }
  }

  const handleReuploadSubmit = async () => {
    if (!selectedRecording || !newAudioFile) return

    // In production, this would upload the new file
    console.log('Reuploading:', {
      recordingId: selectedRecording.id,
      newFile: newAudioFile
    })

    setReuploadDialog(false)
    setNewAudioFile(null)
    fetchRecordings()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'rejected':
        return 'error'
      case 'processing':
        return 'info'
      case 'uploaded':
      default:
        return 'warning'
    }
  }

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const stats = {
    total: totalCount,
    approved: recordings.filter(r => r.status === 'approved').length,
    pending: recordings.filter(r => r.status === 'uploaded' || r.status === 'processing').length,
    rejected: recordings.filter(r => r.status === 'rejected').length,
    totalDuration: recordings.reduce((sum, r) => sum + r.duration, 0)
  }

  if (sessionLoading || loading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.EPISODES_TALENT_MANAGE}>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_TALENT_MANAGE}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                My Recordings
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your uploaded recordings
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => router.push('/talent/episodes')}
            >
              Upload New Recording
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Recordings
                      </Typography>
                      <Typography variant="h4">{stats.total}</Typography>
                    </Box>
                    <Mic color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Approved
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {stats.approved}
                      </Typography>
                    </Box>
                    <CheckCircle color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Pending Review
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {stats.pending}
                      </Typography>
                    </Box>
                    <Schedule color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Duration
                      </Typography>
                      <Typography variant="h4">
                        {Math.floor(stats.totalDuration / 3600)}h {Math.floor((stats.totalDuration % 3600) / 60)}m
                      </Typography>
                    </Box>
                    <Timer color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ mb: 3, p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Search recordings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['all', 'approved', 'uploaded', 'processing', 'rejected'].map((status) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setStatusFilter(status)}
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {status}
                    </Button>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50}></TableCell>
                  <TableCell>Episode</TableCell>
                  <TableCell>Show</TableCell>
                  <TableCell>Recorded</TableCell>
                  <TableCell>Uploaded</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recordings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 3 }}>
                        No recordings found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recordings.map((recording) => (
                    <TableRow key={recording.id} hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handlePlayPause(recording)}
                          color="primary"
                        >
                          {isPlaying && currentTrack?.id === recording.id ? (
                            <Pause />
                          ) : (
                            <PlayArrow />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {recording.episodeTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>{recording.showName}</TableCell>
                      <TableCell>
                        {format(new Date(recording.recordingDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(recording.uploadDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{formatTime(recording.duration)}</TableCell>
                      <TableCell>{formatFileSize(recording.fileSize)}</TableCell>
                      <TableCell>
                        <Box>
                          <Chip
                            label={recording.status}
                            color={getStatusColor(recording.status)}
                            size="small"
                          />
                          {recording.feedback && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                              {recording.feedback}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => window.open(recording.fileUrl, '_blank')}
                            title="Download"
                          >
                            <Download />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, recording)}
                          >
                            <MoreVert />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {recordings.length > 0 && (
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10))
                  setPage(0)
                }}
              />
            )}
          </TableContainer>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleReupload}>
              <CloudUpload fontSize="small" sx={{ mr: 1 }} />
              Re-upload
            </MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          </Menu>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
            <DialogTitle>Delete Recording?</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete this recording? This action cannot be undone.
              </Typography>
              {selectedRecording && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Episode:</strong> {selectedRecording.episodeTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Recorded:</strong> {format(new Date(selectedRecording.recordingDate), 'MMM d, yyyy')}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
              <Button onClick={confirmDelete} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* Re-upload Dialog */}
          <Dialog open={reuploadDialog} onClose={() => setReuploadDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Re-upload Recording</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {selectedRecording && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      <strong>Episode:</strong> {selectedRecording.episodeTitle}
                    </Typography>
                    <Typography variant="body2" gutterBottom sx={{ mb: 3 }}>
                      <strong>Current Status:</strong> {selectedRecording.status}
                    </Typography>

                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUpload />}
                      fullWidth
                    >
                      {newAudioFile ? newAudioFile.name : 'Select New Audio File'}
                      <input
                        type="file"
                        hidden
                        accept="audio/*"
                        onChange={(e) => setNewAudioFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReuploadDialog(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleReuploadSubmit}
                disabled={!newAudioFile}
              >
                Upload New Version
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}