'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  Tooltip,
  Badge
} from '@mui/material'
import {
  Schedule,
  Add,
  Delete,
  Save,
  Send,
  Download,
  CheckCircle,
  Warning,
  CalendarMonth,
  AccessTime,
  AttachMoney,
  DragIndicator,
  ContentCopy,
  History,
  Visibility,
  Edit,
  RadioButtonUnchecked,
  RadioButtonChecked,
  Info
} from '@mui/icons-material'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
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
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CampaignSchedulePage({ params }: { params: { id: string } }) {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  
  // Campaign and schedule data
  const [campaign, setCampaign] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [availability, setAvailability] = useState<any>({})
  const [currentSchedule, setCurrentSchedule] = useState<any>(null)
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([])
  
  // Schedule builder state
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleItems, setScheduleItems] = useState<any[]>([])
  const [selectedShow, setSelectedShow] = useState<any>(null)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [placementType, setPlacementType] = useState('preroll')
  const [spotLength, setSpotLength] = useState(30)
  const [isLiveRead, setIsLiveRead] = useState(false)
  const [bulkRate, setBulkRate] = useState<number | null>(null)
  
  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && params.id) {
      fetchScheduleData()
    }
  }, [user, params.id])

  const fetchScheduleData = async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}/schedule`)
      if (!response.ok) throw new Error('Failed to fetch schedule data')
      const data = await response.json()
      
      setCampaign(data.campaign)
      setShows(data.shows)
      setAvailability(data.availability)
      setCurrentSchedule(data.currentSchedule)
      setScheduleHistory(data.scheduleHistory)
      
      if (data.currentSchedule?.scheduleItems) {
        setScheduleItems(data.currentSchedule.scheduleItems)
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching schedule:', err)
      setError('Failed to load schedule data')
      setLoading(false)
    }
  }

  const handleAddToSchedule = () => {
    if (!selectedShow || selectedDates.length === 0) {
      setError('Please select a show and dates')
      return
    }

    const showData = shows.find(s => s.id === selectedShow)
    const placement = showData?.showPlacements.find((p: any) => p.placementType === placementType)
    const rate = placement?.rates?.[spotLength] || placement?.baseRate || 0

    const newItems = selectedDates.map(date => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      showId: selectedShow,
      show: showData,
      airDate: date,
      placementType,
      length: spotLength,
      rate: bulkRate || rate,
      isLiveRead,
      notes: ''
    }))

    setScheduleItems([...scheduleItems, ...newItems])
    
    // Reset selection
    setSelectedDates([])
    setSelectedShow(null)
    setBulkRate(null)
  }

  const handleRemoveItem = (id: string) => {
    setScheduleItems(scheduleItems.filter(item => item.id !== id))
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(scheduleItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setScheduleItems(items)
  }

  const handleSaveSchedule = async () => {
    if (!scheduleName) {
      setError('Please enter a schedule name')
      return
    }

    if (scheduleItems.length === 0) {
      setError('Please add items to the schedule')
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${params.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scheduleName,
          scheduleItems: scheduleItems.map(item => ({
            showId: item.showId,
            airDate: item.airDate,
            placementType: item.placementType,
            length: item.length,
            rate: item.rate,
            isLiveRead: item.isLiveRead,
            notes: item.notes
          }))
        })
      })

      if (!response.ok) throw new Error('Failed to save schedule')
      
      setSuccess('Schedule saved successfully')
      fetchScheduleData()
      setScheduleName('')
      setScheduleItems([])
    } catch (err) {
      console.error('Error saving schedule:', err)
      setError('Failed to save schedule')
    }
  }

  const handleExportSchedule = async (format: string) => {
    if (!currentSchedule) return

    try {
      const response = await fetch(`/api/campaigns/${params.id}/schedule/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: currentSchedule.id,
          format
        })
      })

      if (!response.ok) throw new Error('Failed to export schedule')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule_${campaign.name}_v${currentSchedule.version}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setExportDialogOpen(false)
      setSuccess('Schedule exported successfully')
    } catch (err) {
      console.error('Error exporting schedule:', err)
      setError('Failed to export schedule')
    }
  }

  const calculateTotalCost = () => {
    return scheduleItems.reduce((sum, item) => sum + item.rate, 0)
  }

  const getAvailabilityColor = (showId: string, date: Date, placement: string) => {
    const dateKey = date.toISOString().split('T')[0]
    const avail = availability[showId]?.[dateKey]?.[placement]
    if (!avail) return 'default'
    
    const percentAvailable = (avail.available / avail.total) * 100
    if (percentAvailable === 0) return 'error'
    if (percentAvailable < 25) return 'warning'
    return 'success'
  }

  if (sessionLoading || loading) return <LinearProgress />
  if (!user) return null

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Campaign Schedule Builder
          </Typography>
          {campaign && (
            <Typography variant="subtitle1" color="textSecondary">
              {campaign.name} • {campaign.advertiser.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={() => setHistoryDialogOpen(true)}
            disabled={scheduleHistory.length === 0}
          >
            Version History
          </Button>
          {currentSchedule && (
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => setExportDialogOpen(true)}
            >
              Export Schedule
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} aria-label="schedule tabs">
          <Tab label="Build Schedule" icon={<Schedule />} iconPosition="start" />
          <Tab label="Current Schedule" icon={<Visibility />} iconPosition="start" />
          <Tab label="Inventory View" icon={<CalendarMonth />} iconPosition="start" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {/* Build Schedule Tab */}
        <Grid container spacing={3}>
          {/* Left Panel - Show Selection */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Select Shows & Dates
              </Typography>
              
              <Autocomplete
                value={selectedShow}
                onChange={(e, value) => setSelectedShow(value)}
                options={shows.map(s => s.id)}
                getOptionLabel={(option) => shows.find(s => s.id === option)?.name || ''}
                renderInput={(params) => (
                  <TextField {...params} label="Select Show" margin="normal" fullWidth />
                )}
              />

              {selectedShow && (
                <>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Placement Type</InputLabel>
                    <Select
                      value={placementType}
                      onChange={(e) => setPlacementType(e.target.value)}
                      label="Placement Type"
                    >
                      <MenuItem value="preroll">Pre-roll</MenuItem>
                      <MenuItem value="midroll">Mid-roll</MenuItem>
                      <MenuItem value="postroll">Post-roll</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth margin="normal">
                    <InputLabel>Spot Length</InputLabel>
                    <Select
                      value={spotLength}
                      onChange={(e) => setSpotLength(e.target.value as number)}
                      label="Spot Length"
                    >
                      <MenuItem value={15}>15 seconds</MenuItem>
                      <MenuItem value={30}>30 seconds</MenuItem>
                      <MenuItem value={60}>60 seconds</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isLiveRead}
                        onChange={(e) => setIsLiveRead(e.target.checked)}
                      />
                    }
                    label="Live Read"
                    sx={{ mt: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Override Rate (optional)"
                    type="number"
                    value={bulkRate || ''}
                    onChange={(e) => setBulkRate(e.target.value ? parseFloat(e.target.value) : null)}
                    margin="normal"
                    InputProps={{
                      startAdornment: '$'
                    }}
                  />

                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                      Select Air Dates
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {/* Simple date picker for demo - would be calendar in production */}
                      <DatePicker
                        label="Add Date"
                        value={null}
                        onChange={(date) => {
                          if (date) setSelectedDates([...selectedDates, date])
                        }}
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true
                          }
                        }}
                      />
                    </Box>
                  </LocalizationProvider>

                  {selectedDates.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Selected Dates ({selectedDates.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedDates.map((date, index) => (
                          <Chip
                            key={index}
                            label={date.toLocaleDateString()}
                            onDelete={() => {
                              setSelectedDates(selectedDates.filter((_, i) => i !== index))
                            }}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddToSchedule}
                    disabled={selectedDates.length === 0}
                    sx={{ mt: 3 }}
                  >
                    Add to Schedule
                  </Button>
                </>
              )}
            </Paper>
          </Grid>

          {/* Right Panel - Schedule Items */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Schedule Items ({scheduleItems.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="h6">
                    Total: ${calculateTotalCost().toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Schedule Name"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                margin="normal"
                sx={{ mb: 3 }}
              />

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="schedule-items">
                  {(provided) => (
                    <List {...provided.droppableProps} ref={provided.innerRef}>
                      {scheduleItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <ListItem
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              sx={{
                                mb: 1,
                                bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1
                              }}
                            >
                              <ListItemIcon {...provided.dragHandleProps}>
                                <DragIndicator />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle1">
                                      {item.show.name}
                                    </Typography>
                                    <Chip label={item.placementType} size="small" />
                                    <Chip label={`${item.length}s`} size="small" />
                                    {item.isLiveRead && <Chip label="Live Read" size="small" color="primary" />}
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="body2">
                                      {new Date(item.airDate).toLocaleDateString()} • ${item.rate}
                                    </Typography>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Delete />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </List>
                  )}
                </Droppable>
              </DragDropContext>

              {scheduleItems.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <Typography variant="body1" color="textSecondary">
                    No items in schedule. Add shows and dates to get started.
                  </Typography>
                </Box>
              )}

              {scheduleItems.length > 0 && (
                <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setScheduleItems([])
                      setScheduleName('')
                    }}
                  >
                    Clear Schedule
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveSchedule}
                  >
                    Save Schedule
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Current Schedule Tab */}
        {currentSchedule ? (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6">{currentSchedule.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Version {currentSchedule.version} • Created {new Date(currentSchedule.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Chip 
                label={currentSchedule.status} 
                color={
                  currentSchedule.status === 'approved' ? 'success' :
                  currentSchedule.status === 'sent_to_client' ? 'warning' : 'default'
                }
              />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Air Date</TableCell>
                    <TableCell>Show</TableCell>
                    <TableCell>Placement</TableCell>
                    <TableCell>Length</TableCell>
                    <TableCell>Live Read</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentSchedule.scheduleItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.airDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{item.show.name}</TableCell>
                      <TableCell>
                        <Chip label={item.placementType} size="small" />
                      </TableCell>
                      <TableCell>{item.length}s</TableCell>
                      <TableCell>
                        {item.isLiveRead ? <CheckCircle color="success" /> : '-'}
                      </TableCell>
                      <TableCell align="right">${item.rate}</TableCell>
                      <TableCell>{item.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="subtitle1" fontWeight="bold">
                        Total:
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1" fontWeight="bold">
                        ${currentSchedule.scheduleItems.reduce((sum: number, item: any) => sum + item.rate, 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {currentSchedule.status === 'draft' && (
              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={() => setConfirmDialogOpen(true)}
                >
                  Send to Client
                </Button>
              </Box>
            )}
          </Paper>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No schedule created yet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Use the Build Schedule tab to create your first schedule
            </Typography>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Inventory View Tab */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Inventory Availability
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            View available inventory across all shows for the next 30 days
          </Typography>

          <Grid container spacing={2}>
            {shows.map(show => (
              <Grid item xs={12} key={show.id}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {show.name}
                    </Typography>
                    <Grid container spacing={1}>
                      {['preroll', 'midroll', 'postroll'].map(placement => (
                        <Grid item xs={12} md={4} key={placement}>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {placement}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {Array.from({ length: 30 }, (_, i) => {
                              const date = new Date()
                              date.setDate(date.getDate() + i)
                              const color = getAvailabilityColor(show.id, date, placement)
                              return (
                                <Tooltip
                                  key={i}
                                  title={`${date.toLocaleDateString()} - ${placement}`}
                                >
                                  <Box
                                    sx={{
                                      width: 20,
                                      height: 20,
                                      bgcolor: 
                                        color === 'error' ? 'error.main' :
                                        color === 'warning' ? 'warning.main' :
                                        color === 'success' ? 'success.main' : 'grey.300',
                                      borderRadius: 0.5,
                                      cursor: 'pointer'
                                    }}
                                  />
                                </Tooltip>
                              )
                            })}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, bgcolor: 'success.main', borderRadius: 0.5 }} />
              <Typography variant="body2">Available</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, bgcolor: 'warning.main', borderRadius: 0.5 }} />
              <Typography variant="body2">Limited</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 20, height: 20, bgcolor: 'error.main', borderRadius: 0.5 }} />
              <Typography variant="body2">Sold Out</Typography>
            </Box>
          </Box>
        </Paper>
      </TabPanel>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Schedule</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Choose export format:
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleExportSchedule('xlsx')}
            >
              Excel (.xlsx)
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleExportSchedule('csv')}
            >
              CSV (.csv)
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog 
        open={historyDialogOpen} 
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Schedule Version History</DialogTitle>
        <DialogContent>
          <List>
            {scheduleHistory.map((schedule: any) => (
              <ListItem key={schedule.id}>
                <ListItemText
                  primary={`Version ${schedule.version}: ${schedule.name}`}
                  secondary={`Created ${new Date(schedule.createdAt).toLocaleDateString()} by ${schedule.creator?.name || 'Unknown'}`}
                />
                <Chip 
                  label={schedule.status} 
                  size="small"
                  color={
                    schedule.status === 'approved' ? 'success' :
                    schedule.status === 'sent_to_client' ? 'warning' : 'default'
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Send Schedule to Client?</DialogTitle>
        <DialogContent>
          <Typography>
            This will send the schedule to the client for approval. Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              try {
                await fetch(`/api/campaigns/${params.id}/schedule`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    scheduleId: currentSchedule.id,
                    status: 'sent_to_client'
                  })
                })
                setSuccess('Schedule sent to client')
                setConfirmDialogOpen(false)
                fetchScheduleData()
              } catch (err) {
                setError('Failed to send schedule')
              }
            }}
          >
            Send to Client
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}