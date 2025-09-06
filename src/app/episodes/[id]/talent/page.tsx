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
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Stack,
  Checkbox,
  FormControlLabel,
  Autocomplete
} from '@mui/material'
import {
  Person,
  Assignment,
  Note,
  Add,
  Edit,
  Delete,
  CheckCircle,
  Schedule,
  Warning,
  Info,
  Mic,
  PlayArrow,
  RecordVoiceOver,
  ArrowBack,
  Task,
  Comment,
  People
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

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

const TASK_TYPES = {
  'general': 'General',
  'recording': 'Recording',
  'review': 'Review',
  'approval': 'Approval',
  'script': 'Script Work'
}

const TASK_PRIORITIES = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'urgent': 'Urgent'
}

const NOTE_TYPES = {
  'general': 'General',
  'script_note': 'Script Note',
  'timing': 'Timing',
  'feedback': 'Feedback'
}

export default function EpisodeTalentPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Data state
  const [episodeData, setEpisodeData] = useState<any>(null)
  const [availableTalent, setAvailableTalent] = useState<any[]>([])
  const [availableProducers, setAvailableProducers] = useState<any[]>([])

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  // Form state
  const [selectedTalent, setSelectedTalent] = useState<string[]>([])
  const [selectedProducers, setSelectedProducers] = useState<string[]>([])
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedToId: '',
    dueDate: null as Date | null,
    priority: 'medium',
    taskType: 'general'
  })
  const [noteForm, setNoteForm] = useState({
    content: '',
    noteType: 'general',
    isPrivate: false
  })

  const episodeId = params.id as string

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && episodeId) {
      fetchEpisodeData()
      fetchAvailableUsers()
    }
  }, [user, episodeId])

  const fetchEpisodeData = async () => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/talent`)
      if (!response.ok) throw new Error('Failed to fetch episode data')
      
      const data = await response.json()
      setEpisodeData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching episode data:', err)
      setError('Failed to load episode data')
      setLoading(false)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const [talentResponse, producerResponse] = await Promise.all([
        fetch('/api/users?role=talent'),
        fetch('/api/users?role=producer,admin,master')
      ])

      if (talentResponse.ok) {
        const talentData = await talentResponse.json()
        setAvailableTalent(talentData.users || [])
      }

      if (producerResponse.ok) {
        const producerData = await producerResponse.json()
        setAvailableProducers(producerData.users || [])
      }
    } catch (err) {
      console.error('Error fetching available users:', err)
    }
  }

  const handleAssignTalent = async () => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/talent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_talent',
          talentIds: selectedTalent
        })
      })

      if (!response.ok) throw new Error('Failed to assign talent')

      const result = await response.json()
      setSuccess(result.message)
      setAssignDialogOpen(false)
      setSelectedTalent([])
      fetchEpisodeData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleAssignProducers = async () => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/talent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_producers',
          producerIds: selectedProducers
        })
      })

      if (!response.ok) throw new Error('Failed to assign producers')

      const result = await response.json()
      setSuccess(result.message)
      setAssignDialogOpen(false)
      setSelectedProducers([])
      fetchEpisodeData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.assignedToId) {
      setError('Task title and assignee are required')
      return
    }

    try {
      const response = await fetch(`/api/episodes/${episodeId}/talent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_task',
          task: taskForm
        })
      })

      if (!response.ok) throw new Error('Failed to create task')

      setSuccess('Task created successfully')
      setTaskDialogOpen(false)
      setTaskForm({
        title: '',
        description: '',
        assignedToId: '',
        dueDate: null,
        priority: 'medium',
        taskType: 'general'
      })
      fetchEpisodeData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleAddNote = async () => {
    if (!noteForm.content) {
      setError('Note content is required')
      return
    }

    try {
      const response = await fetch(`/api/episodes/${episodeId}/talent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_note',
          note: noteForm
        })
      })

      if (!response.ok) throw new Error('Failed to add note')

      setSuccess('Note added successfully')
      setNoteDialogOpen(false)
      setNoteForm({
        content: '',
        noteType: 'general',
        isPrivate: false
      })
      fetchEpisodeData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'info'
      case 'low': return 'default'
      default: return 'default'
    }
  }

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'primary'
      case 'pending': return 'warning'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user || !episodeData) return <DashboardLayout><Typography>Episode not found</Typography></DashboardLayout>

  const { episode, talentTasks, talentNotes } = episodeData

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push(`/episodes/${episodeId}`)}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                Episode Talent Management
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {episode.title} • {episode.show.name}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={<Schedule />}
              label={episode.status}
              color={episode.status === 'published' ? 'success' : 'primary'}
            />
            <Button
              variant="outlined"
              startIcon={<People />}
              onClick={() => setAssignDialogOpen(true)}
            >
              Manage Assignments
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Assignment Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <RecordVoiceOver color="primary" />
                  <Typography variant="h6">
                    Assigned Talent
                  </Typography>
                </Box>
                {episode.assignedTalent.length > 0 ? (
                  <Stack spacing={1}>
                    {episode.assignedTalent.map((talent: any) => (
                      <Box key={talent.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                          <Person />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {talent.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {talent.email}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No talent assigned yet
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Assignment color="secondary" />
                  <Typography variant="h6">
                    Assigned Producers
                  </Typography>
                </Box>
                {episode.assignedProducers.length > 0 ? (
                  <Stack spacing={1}>
                    {episode.assignedProducers.map((producer: any) => (
                      <Box key={producer.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                          <Person />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {producer.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {producer.email}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No producers assigned yet
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Tasks" icon={<Task />} iconPosition="start" />
            <Tab label="Notes" icon={<Comment />} iconPosition="start" />
            <Tab label="Ad Spots" icon={<Mic />} iconPosition="start" />
          </Tabs>
          <Divider />

          <TabPanel value={tabValue} index={0}>
            {/* Tasks */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Talent Tasks ({talentTasks.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setTaskDialogOpen(true)}
              >
                Create Task
              </Button>
            </Box>

            {talentTasks.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Task</TableCell>
                      <TableCell>Assigned To</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {talentTasks.map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography variant="caption" color="textSecondary">
                              {task.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              <Person />
                            </Avatar>
                            <Typography variant="body2">
                              {task.assignedTo.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={TASK_TYPES[task.taskType as keyof typeof TASK_TYPES]}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES]}
                            size="small"
                            color={getTaskPriorityColor(task.priority)}
                          />
                        </TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <Typography variant="body2">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              No due date
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={task.status.replace('_', ' ')}
                            size="small"
                            color={getTaskStatusColor(task.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Task sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Tasks Yet
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Create tasks to manage talent collaboration
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setTaskDialogOpen(true)}
                >
                  Create First Task
                </Button>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Notes */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Collaboration Notes ({talentNotes.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setNoteDialogOpen(true)}
              >
                Add Note
              </Button>
            </Box>

            {talentNotes.length > 0 ? (
              <List>
                {talentNotes.map((note: any) => (
                  <ListItem key={note.id} divider>
                    <ListItemIcon>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        <Comment />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {note.author.name}
                          </Typography>
                          <Chip 
                            label={NOTE_TYPES[note.noteType as keyof typeof NOTE_TYPES]} 
                            size="small" 
                            variant="outlined"
                          />
                          {note.isPrivate && (
                            <Chip label="Private" size="small" color="warning" />
                          )}
                          <Typography variant="caption" color="textSecondary">
                            {new Date(note.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2">
                          {note.content}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Comment sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Notes Yet
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Add notes to communicate with the team
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setNoteDialogOpen(true)}
                >
                  Add First Note
                </Button>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Ad Spots */}
            <Typography variant="h6" gutterBottom>
              Scheduled Ad Spots ({episode.episodeSpots.length})
            </Typography>

            {episode.episodeSpots.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Placement</TableCell>
                      <TableCell>Spot #</TableCell>
                      <TableCell>Advertiser</TableCell>
                      <TableCell>Start Time</TableCell>
                      <TableCell>Length</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {episode.episodeSpots.map((spot: any) => (
                      <TableRow key={spot.id}>
                        <TableCell>
                          <Chip 
                            label={spot.placementType} 
                            size="small" 
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>{spot.spotNumber}</TableCell>
                        <TableCell>
                          {spot.orderItem?.order?.advertiser?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          {spot.startTime ? `${Math.floor(spot.startTime / 60)}:${(spot.startTime % 60).toString().padStart(2, '0')}` : 'TBD'}
                        </TableCell>
                        <TableCell>
                          {spot.actualLength || spot.orderItem?.length || 'TBD'}s
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={spot.status}
                            size="small"
                            color={spot.status === 'aired' ? 'success' : 'primary'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Mic sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Ad Spots Scheduled
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Ad spots will appear here when orders are created
                </Typography>
              </Box>
            )}
          </TabPanel>
        </Paper>

        {/* Assignment Dialog */}
        <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Manage Episode Assignments</DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Assign Talent
                </Typography>
                <Autocomplete
                  multiple
                  options={availableTalent}
                  getOptionLabel={(option) => option.name}
                  value={availableTalent.filter(t => selectedTalent.includes(t.id))}
                  onChange={(e, newValue) => {
                    setSelectedTalent(newValue.map(v => v.id))
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Talent" />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ mr: 2 }}>
                        <Person />
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {option.email}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Assign Producers
                </Typography>
                <Autocomplete
                  multiple
                  options={availableProducers}
                  getOptionLabel={(option) => option.name}
                  value={availableProducers.filter(p => selectedProducers.includes(p.id))}
                  onChange={(e, newValue) => {
                    setSelectedProducers(newValue.map(v => v.id))
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Producers" />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ mr: 2 }}>
                        <Assignment />
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {option.email}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAssignTalent}
              disabled={selectedTalent.length === 0}
            >
              Assign Talent
            </Button>
            <Button
              variant="contained"
              onClick={handleAssignProducers}
              disabled={selectedProducers.length === 0}
            >
              Assign Producers
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Task Dialog */}
        <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create Task</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Task Title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Assign To</InputLabel>
                  <Select
                    value={taskForm.assignedToId}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                    label="Assign To"
                    required
                  >
                    {[...episode.assignedTalent, ...episode.assignedProducers].map((user: any) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Task Type</InputLabel>
                  <Select
                    value={taskForm.taskType}
                    onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}
                    label="Task Type"
                  >
                    {Object.entries(TASK_TYPES).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    label="Priority"
                  >
                    {Object.entries(TASK_PRIORITIES).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label="Due Date (optional)"
                    value={taskForm.dueDate}
                    onChange={(date) => setTaskForm({ ...taskForm, dueDate: date })}
                    slotProps={{
                      textField: { fullWidth: true }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreateTask}
              disabled={!taskForm.title || !taskForm.assignedToId}
            >
              Create Task
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Note</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Note Content"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Note Type</InputLabel>
                  <Select
                    value={noteForm.noteType}
                    onChange={(e) => setNoteForm({ ...noteForm, noteType: e.target.value })}
                    label="Note Type"
                  >
                    {Object.entries(NOTE_TYPES).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={noteForm.isPrivate}
                      onChange={(e) => setNoteForm({ ...noteForm, isPrivate: e.target.checked })}
                    />
                  }
                  label="Private Note"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAddNote}
              disabled={!noteForm.content}
            >
              Add Note
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}