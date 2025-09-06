'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { approvalsApi } from '@/services/api'
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tab,
  Tabs,
} from '@mui/material'
import {
  Assignment,
  CheckCircle,
  Schedule,
  Upload,
  PlayCircle,
  Mic,
  Description,
  MoreVert,
  Notification,
  Edit,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

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
      id={`producer-tabpanel-${index}`}
      aria-labelledby={`producer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function TalentDashboard() {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState(0)
  const [submitDialog, setSubmitDialog] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<any>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [submitNotes, setSubmitNotes] = useState('')

  // Fetch approvals assigned to this producer
  const { data: approvalsData = [], isLoading } = useQuery({
    queryKey: ['producer-approvals'],
    queryFn: async () => {
      const response = await approvalsApi.list()
      // Filter for approvals assigned to current talent
      const currentUser = 'current-talent' // In production, get from auth context
      return response.approvals?.filter((approval: any) => 
        approval.assignedTalent?.includes(currentUser) ||
        approval.talentNames?.includes(currentUser) ||
        approval.responsibleRole === 'Producer/Talent'
      ) || []
    },
  })

  const pendingTasks = approvalsData.filter((a: any) => 
    a.status === 'pending' || a.status === 'revision'
  )
  const completedTasks = approvalsData.filter((a: any) => 
    a.status === 'submitted' || a.status === 'approved'
  )

  const handleSubmitSpot = () => {
    if (!selectedApproval || !audioFile) return

    // In production, this would upload the audio file and submit
    console.log('Submitting spot:', {
      approvalId: selectedApproval.id,
      audioFile,
      notes: submitNotes,
    })

    // Close dialog
    setSubmitDialog(false)
    setSelectedApproval(null)
    setAudioFile(null)
    setSubmitNotes('')
  }

  const getDeadlineColor = (deadline: string) => {
    if (!deadline) return 'default'
    const daysUntil = Math.ceil(
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntil < 0) return 'error'
    if (daysUntil <= 2) return 'warning'
    return 'success'
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Talent Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your assigned ad recordings
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Badge badgeContent={pendingTasks.length} color="warning">
              <Button variant="outlined" startIcon={<Assignment />}>
                Pending Tasks
              </Button>
            </Badge>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Pending Tasks
                    </Typography>
                    <Typography variant="h4">
                      {pendingTasks.length}
                    </Typography>
                  </Box>
                  <Assignment color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                      In Production
                    </Typography>
                    <Typography variant="h4">
                      {pendingTasks.filter((a: any) => a.workflow?.currentStage === 'in_production').length}
                    </Typography>
                  </Box>
                  <Mic color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                      Completed
                    </Typography>
                    <Typography variant="h4">
                      {completedTasks.length}
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
                      Due Today
                    </Typography>
                    <Typography variant="h4">
                      {pendingTasks.filter((a: any) => {
                        if (!a.deadline) return false
                        const daysUntil = Math.ceil(
                          (new Date(a.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        )
                        return daysUntil === 0
                      }).length}
                    </Typography>
                  </Box>
                  <Schedule color="error" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label={`Pending (${pendingTasks.length})`} />
            <Tab label={`Completed (${completedTasks.length})`} />
            <Tab label="All Tasks" />
          </Tabs>
        </Paper>

        {/* Task Lists */}
        <TabPanel value={selectedTab} index={0}>
          <Grid container spacing={3}>
            {pendingTasks.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No pending tasks at the moment
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              pendingTasks.map((approval: any) => (
                <Grid item xs={12} md={6} key={approval.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {approval.campaignName || approval.campaign}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {approval.advertiserName || approval.advertiser}
                          </Typography>
                        </Box>
                        <Chip
                          label={approval.priority}
                          color={approval.priority === 'high' ? 'error' : 'default'}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          <strong>Show:</strong> {approval.showName || approval.show}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Type:</strong> {approval.type} • {approval.duration}s
                        </Typography>
                        {approval.deadline && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Deadline:</strong>{' '}
                            <Chip
                              label={new Date(approval.deadline).toLocaleDateString()}
                              size="small"
                              color={getDeadlineColor(approval.deadline)}
                            />
                          </Typography>
                        )}
                      </Box>

                      {approval.status === 'revision' && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          Revision requested: {approval.revisionNotes || 'Please review feedback'}
                        </Alert>
                      )}

                      {approval.script && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Script Preview:
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              p: 1,
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                              fontStyle: 'italic',
                            }}
                          >
                            {approval.script.substring(0, 150)}...
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<Description />}
                        onClick={() => router.push(`/producer/tasks/${approval.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<Upload />}
                        onClick={() => {
                          setSelectedApproval(approval)
                          setSubmitDialog(true)
                        }}
                      >
                        Submit Spot
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <List>
            {completedTasks.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No completed tasks yet
                </Typography>
              </Paper>
            ) : (
              completedTasks.map((approval: any, index: number) => (
                <React.Fragment key={approval.id}>
                  <ListItem>
                    <ListItemText
                      primary={`${approval.campaignName} - ${approval.showName}`}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            {approval.advertiserName} • {approval.type} • {approval.duration}s
                          </Typography>
                          <br />
                          <Typography variant="caption" component="span">
                            Submitted: {new Date(approval.spotSubmittedAt || approval.submittedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={approval.status}
                        color={approval.status === 'approved' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < completedTasks.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Typography variant="body1" color="text.secondary">
            All tasks view coming soon...
          </Typography>
        </TabPanel>

        {/* Submit Spot Dialog */}
        <Dialog open={submitDialog} onClose={() => setSubmitDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Submit Completed Spot</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              {selectedApproval && (
                <>
                  <Typography variant="body2" gutterBottom>
                    <strong>Campaign:</strong> {selectedApproval.campaignName}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Show:</strong> {selectedApproval.showName}
                  </Typography>
                  <Typography variant="body2" gutterBottom sx={{ mb: 3 }}>
                    <strong>Duration:</strong> {selectedApproval.duration}s
                  </Typography>

                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<Upload />}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    {audioFile ? audioFile.name : 'Upload Audio File'}
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
                    label="Production Notes"
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                    placeholder="Any notes about the production..."
                  />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSubmitDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmitSpot}
              disabled={!audioFile}
              startIcon={<CheckCircle />}
            >
              Submit Spot
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}