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
  CardContent
} from '@mui/material'
import {
  Search,
  PlayCircle,
  Schedule,
  Mic,
  CheckCircle,
  Warning,
  CloudUpload,
  Download,
  Headphones
} from '@mui/icons-material'
import { format, isAfter, isBefore, addDays } from 'date-fns'

interface TalentEpisode {
  id: string
  title: string
  showName: string
  episodeNumber: string
  recordingDate: string | null
  airDate: string
  script: string | null
  scriptUrl: string | null
  recordingStatus: 'pending' | 'scheduled' | 'completed' | 'approved'
  recordingUrl: string | null
  notes: string | null
  duration: number | null
  deadline: string | null
}

export default function TalentEpisodesPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [episodes, setEpisodes] = useState<TalentEpisode[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [uploadDialog, setUploadDialog] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<TalentEpisode | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploadNotes, setUploadNotes] = useState('')

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchTalentEpisodes()
    }
  }, [user, sessionLoading, page, rowsPerPage, searchQuery, statusFilter])

  const fetchTalentEpisodes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: searchQuery,
        talentId: user?.id || ''
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('recordingStatus', statusFilter)
      }

      const response = await fetch(`/api/talent/episodes?${params}`)
      if (!response.ok) throw new Error('Failed to fetch episodes')
      
      const data = await response.json()
      
      // Transform the data for talent view
      const transformedEpisodes = data.episodes.map((episode: any) => ({
        id: episode.id,
        title: episode.title,
        showName: episode.show?.name || '',
        episodeNumber: episode.episodeNumber,
        recordingDate: episode.recordingDate,
        airDate: episode.airDate,
        script: episode.script,
        scriptUrl: episode.scriptUrl,
        recordingStatus: episode.audioUrl ? 'completed' : episode.recordingDate ? 'scheduled' : 'pending',
        recordingUrl: episode.audioUrl,
        notes: episode.notes,
        duration: episode.duration,
        deadline: episode.recordingDate || episode.airDate
      }))

      setEpisodes(transformedEpisodes)
      setTotalCount(data.total)
    } catch (err) {
      console.error('Error fetching episodes:', err)
      setError('Failed to load episodes')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadRecording = () => {
    if (!selectedEpisode || !audioFile) return

    // In production, this would upload the audio file
    console.log('Uploading recording:', {
      episodeId: selectedEpisode.id,
      audioFile,
      notes: uploadNotes
    })

    // Close dialog and reset
    setUploadDialog(false)
    setSelectedEpisode(null)
    setAudioFile(null)
    setUploadNotes('')
    
    // Refresh episodes
    fetchTalentEpisodes()
  }

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return 'default'
    const deadlineDate = new Date(deadline)
    const today = new Date()
    
    if (isBefore(deadlineDate, today)) return 'error'
    if (isBefore(deadlineDate, addDays(today, 3))) return 'warning'
    return 'success'
  }

  const getRecordingStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'success'
      case 'scheduled':
        return 'info'
      case 'pending':
      default:
        return 'warning'
    }
  }

  const stats = {
    total: totalCount,
    pending: episodes.filter(e => e.recordingStatus === 'pending').length,
    scheduled: episodes.filter(e => e.recordingStatus === 'scheduled').length,
    completed: episodes.filter(e => e.recordingStatus === 'completed').length,
    dueSoon: episodes.filter(e => {
      if (!e.deadline) return false
      const deadline = new Date(e.deadline)
      return isAfter(deadline, new Date()) && isBefore(deadline, addDays(new Date(), 7))
    }).length
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
                My Episodes
              </Typography>
              <Typography variant="body1" color="text.secondary">
                View and manage your recording assignments
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Assigned
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Pending
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.pending}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Due Soon
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.dueSoon}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.completed}
                  </Typography>
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
                  placeholder="Search episodes..."
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
                  {['all', 'pending', 'scheduled', 'completed'].map((status) => (
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
                  <TableCell>Episode</TableCell>
                  <TableCell>Show</TableCell>
                  <TableCell>Recording Date</TableCell>
                  <TableCell>Air Date</TableCell>
                  <TableCell>Script</TableCell>
                  <TableCell>Recording Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {episodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 3 }}>
                        No episodes assigned to you
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  episodes.map((episode) => (
                    <TableRow key={episode.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {episode.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Episode {episode.episodeNumber}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{episode.showName}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {episode.recordingDate ? (
                            <>
                              <Schedule fontSize="small" />
                              <Box>
                                <Typography variant="body2">
                                  {format(new Date(episode.recordingDate), 'MMM d, yyyy')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {format(new Date(episode.recordingDate), 'h:mm a')}
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not scheduled
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={format(new Date(episode.airDate), 'MMM d')}
                          size="small"
                          color={getDeadlineStatus(episode.deadline)}
                        />
                      </TableCell>
                      <TableCell>
                        {episode.scriptUrl ? (
                          <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={() => window.open(episode.scriptUrl || '', '_blank')}
                          >
                            Download
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not available
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={episode.recordingStatus}
                          color={getRecordingStatusColor(episode.recordingStatus)}
                          size="small"
                          icon={episode.recordingStatus === 'completed' ? <CheckCircle /> : undefined}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {episode.recordingUrl && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => window.open(episode.recordingUrl || '', '_blank')}
                              title="Listen to recording"
                            >
                              <Headphones />
                            </IconButton>
                          )}
                          {episode.recordingStatus !== 'completed' && episode.scriptUrl && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<CloudUpload />}
                              onClick={() => {
                                setSelectedEpisode(episode)
                                setUploadDialog(true)
                              }}
                            >
                              Upload
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {episodes.length > 0 && (
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

          {/* Upload Recording Dialog */}
          <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Upload Recording</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {selectedEpisode && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      <strong>Episode:</strong> {selectedEpisode.title}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Show:</strong> {selectedEpisode.showName}
                    </Typography>
                    <Typography variant="body2" gutterBottom sx={{ mb: 3 }}>
                      <strong>Episode Number:</strong> {selectedEpisode.episodeNumber}
                    </Typography>

                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUpload />}
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      {audioFile ? audioFile.name : 'Select Audio File'}
                      <input
                        type="file"
                        hidden
                        accept="audio/*"
                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      />
                    </Button>

                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Recording Notes"
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="Any notes about the recording..."
                    />
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleUploadRecording}
                disabled={!audioFile}
                startIcon={<CheckCircle />}
              >
                Upload Recording
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}