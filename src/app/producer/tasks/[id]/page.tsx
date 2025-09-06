'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsApi, api } from '@/services/api'
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import {
  ArrowBack,
  Description,
  Schedule,
  Business,
  Campaign,
  Mic,
  Timer,
  Warning,
  CheckCircle,
  Upload,
  PlayArrow,
  Pause,
  Stop,
  FiberManualRecord,
  CloudUpload,
  AttachFile,
  Comment,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function ProducerTaskDetails() {
  const router = useRouter()
  const params = useParams()
  const taskId = params.id as string
  const queryClient = useQueryClient()

  const [recording, setRecording] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [productionNotes, setProductionNotes] = useState('')
  const [submitDialog, setSubmitDialog] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  // Fetch task details
  const { data: task, isLoading } = useQuery({
    queryKey: ['producer-task', taskId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}`)
      return response.data
    },
  })

  // Submit spot mutation
  const submitSpotMutation = useMutation({
    mutationFn: async (data: { audioFile: File; notes: string }) => {
      // In production, upload audio and submit
      const formData = new FormData()
      formData.append('audio', data.audioFile)
      formData.append('notes', data.notes)
      formData.append('submittedBy', 'current-producer')
      formData.append('submitterRole', 'producer')

      // Simulate API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true })
        }, 1000)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['producer-approvals'] })
      router.push('/producer/dashboard')
    },
  })

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        setAudioFile(file)
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
      setRecordingTime(0)

      // Update recording time
      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Store interval ID to clear later
      recorder.onstart = () => {
        (recorder as any).intervalId = interval
      }
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Unable to access microphone. Please check permissions.')
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach((track) => track.stop())
      
      // Clear the interval
      if ((mediaRecorder as any).intervalId) {
        clearInterval((mediaRecorder as any).intervalId)
      }
      
      setRecording(false)
      setMediaRecorder(null)
    }
  }

  const handleSubmit = () => {
    if (!audioFile) return

    submitSpotMutation.mutate({
      audioFile,
      notes: productionNotes,
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading || !task) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4 }}>
          <LinearProgress />
        </Box>
      </DashboardLayout>
    )
  }

  const daysUntilDeadline = Math.ceil(
    (new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/producer/dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {task.campaignName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip label={task.showName} icon={<Mic />} />
              <Chip
                label={`${task.duration}s ${task.type}`}
                variant="outlined"
              />
              <Chip
                label={`Due: ${new Date(task.deadline).toLocaleDateString()}`}
                color={daysUntilDeadline < 0 ? 'error' : daysUntilDeadline <= 2 ? 'warning' : 'default'}
                icon={<Schedule />}
              />
            </Box>
          </Box>
        </Box>

        {/* Progress Stepper */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={task.status === 'submitted' ? 2 : task.status === 'pending' ? 0 : 1}>
            <Step>
              <StepLabel>Request Received</StepLabel>
            </Step>
            <Step>
              <StepLabel>In Production</StepLabel>
            </Step>
            <Step>
              <StepLabel>Submitted for Review</StepLabel>
            </Step>
          </Stepper>
        </Paper>

        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid item xs={12} md={8}>
            {/* Script Section */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Script
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {task.script}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>

            {/* Talking Points */}
            {task.talkingPoints && task.talkingPoints.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Key Talking Points
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {task.talkingPoints.map((point: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={point} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Recording Section */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Mic sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Recording Studio
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Box sx={{ textAlign: 'center', py: 3 }}>
                  {recording ? (
                    <>
                      <Typography variant="h3" sx={{ mb: 2 }}>
                        {formatTime(recordingTime)}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                        <FiberManualRecord color="error" sx={{ animation: 'pulse 1.5s infinite' }} />
                        <Typography variant="body1">Recording in progress...</Typography>
                      </Box>
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        startIcon={<Stop />}
                        onClick={handleStopRecording}
                      >
                        Stop Recording
                      </Button>
                    </>
                  ) : (
                    <>
                      {audioFile ? (
                        <Box sx={{ mb: 3 }}>
                          <Alert severity="success" sx={{ mb: 2 }}>
                            Recording saved: {audioFile.name}
                          </Alert>
                          <audio controls src={URL.createObjectURL(audioFile)} style={{ width: '100%' }} />
                        </Box>
                      ) : (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                          Click the button below to start recording your spot
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button
                          variant="contained"
                          color="error"
                          size="large"
                          startIcon={<FiberManualRecord />}
                          onClick={handleStartRecording}
                        >
                          Start Recording
                        </Button>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<Upload />}
                          size="large"
                        >
                          Upload File
                          <input
                            type="file"
                            hidden
                            accept="audio/*"
                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                          />
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Production Notes */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Comment sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Production Notes
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Add any notes about your production..."
                  value={productionNotes}
                  onChange={(e) => setProductionNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {/* Campaign Details */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Campaign Details
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Business />
                    </ListItemIcon>
                    <ListItemText
                      primary="Advertiser"
                      secondary={task.advertiserName}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Campaign />
                    </ListItemIcon>
                    <ListItemText
                      primary="Campaign"
                      secondary={task.campaignName}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Timer />
                    </ListItemIcon>
                    <ListItemText
                      primary="Duration"
                      secondary={`${task.duration} seconds`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Schedule />
                    </ListItemIcon>
                    <ListItemText
                      primary="Deadline"
                      secondary={new Date(task.deadline).toLocaleString()}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Restrictions */}
            {(task.restrictedTerms?.length > 0 || task.legalDisclaimer) && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Important Notes
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {task.legalDisclaimer && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {task.legalDisclaimer}
                    </Alert>
                  )}
                  
                  {task.restrictedTerms && task.restrictedTerms.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Restricted Terms:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {task.restrictedTerms.map((term: string, index: number) => (
                          <Chip
                            key={index}
                            label={term}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<CloudUpload />}
              onClick={() => setSubmitDialog(true)}
              disabled={!audioFile || submitSpotMutation.isPending}
            >
              Submit Spot for Review
            </Button>
          </Grid>
        </Grid>

        {/* Submit Dialog */}
        <Dialog open={submitDialog} onClose={() => setSubmitDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Submit Spot for Review</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" paragraph>
                Please confirm that you want to submit this spot for review:
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Campaign />
                  </ListItemIcon>
                  <ListItemText
                    primary="Campaign"
                    secondary={task.campaignName}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AttachFile />
                  </ListItemIcon>
                  <ListItemText
                    primary="Audio File"
                    secondary={audioFile?.name}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Timer />
                  </ListItemIcon>
                  <ListItemText
                    primary="Duration"
                    secondary={`${task.duration} seconds`}
                  />
                </ListItem>
              </List>

              {productionNotes && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Production Notes:
                  </Typography>
                  <Typography variant="body2">
                    {productionNotes}
                  </Typography>
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSubmitDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitSpotMutation.isPending}
              startIcon={submitSpotMutation.isPending ? <LinearProgress size={20} /> : <CheckCircle />}
            >
              {submitSpotMutation.isPending ? 'Submitting...' : 'Submit Spot'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}