'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  RadioGroup,
  Radio,
  Divider,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import {
  Email as EmailIcon,
  Settings as SettingsIcon,
  NotificationsOff as UnsubscribeIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface UserEmailPreferencesData {
  configured: boolean
  enabled: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
  format: 'html' | 'text'
  categories: {
    taskAssignments: boolean
    taskComments: boolean
    taskDeadlines: boolean
    campaignStatusChanges: boolean
    campaignComments: boolean
    mentions: boolean
    approvalRequests: boolean
    approvalDecisions: boolean
    reportCompletion: boolean
    systemAnnouncements: boolean
  }
  digestSettings: {
    dailyDigestTime: string
    weeklyDigestDay: number
    includeTaskSummary: boolean
    includeCampaignSummary: boolean
    includeUpcomingDeadlines: boolean
  }
}

interface EmailHistoryEntry {
  id: string
  recipient: string
  subject?: string
  templateKey?: string
  status: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  createdAt: string
}

const notificationCategories = [
  { 
    group: 'Tasks', 
    items: [
      { key: 'taskAssignments', label: 'Task Assignments', description: 'When tasks are assigned to me' },
      { key: 'taskComments', label: 'Task Comments', description: 'Comments on tasks I\'m involved in' },
      { key: 'taskDeadlines', label: 'Task Deadlines', description: 'Reminders for upcoming task deadlines' },
    ]
  },
  { 
    group: 'Campaigns', 
    items: [
      { key: 'campaignStatusChanges', label: 'Campaign Status Changes', description: 'When campaigns I\'m involved in change status' },
      { key: 'campaignComments', label: 'Campaign Comments', description: 'Comments on campaigns I\'m working on' },
    ]
  },
  { 
    group: 'Collaboration', 
    items: [
      { key: 'mentions', label: 'Mentions', description: 'When someone mentions me in a comment' },
      { key: 'approvalRequests', label: 'Approval Requests', description: 'When I need to approve something' },
      { key: 'approvalDecisions', label: 'Approval Decisions', description: 'When my requests are approved or rejected' },
    ]
  },
  { 
    group: 'Other', 
    items: [
      { key: 'reportCompletion', label: 'Report Completion', description: 'When reports I requested are ready' },
      { key: 'systemAnnouncements', label: 'System Announcements', description: 'Important platform updates and maintenance' },
    ]
  },
]

export function UserEmailPreferences() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [localPreferences, setLocalPreferences] = useState<UserEmailPreferencesData | null>(null)

  // Fetch user email preferences
  const { data: preferencesData, isLoading: preferencesLoading } = useQuery({
    queryKey: ['user-email-preferences'],
    queryFn: async () => {
      const response = await api.get('/api/user/email-preferences')
      return response.data
    },
  })

  // Fetch email history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['user-email-history'],
    queryFn: async () => {
      const response = await api.get('/api/user/email-preferences/history')
      return response.data
    },
    enabled: showHistory,
  })

  // Update local state when data is loaded
  useEffect(() => {
    if (preferencesData?.preferences) {
      setLocalPreferences(preferencesData.preferences)
    }
  }, [preferencesData])

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: UserEmailPreferencesData) => {
      const response = await api.put('/api/user/email-preferences', preferences)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Email preferences saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['user-email-preferences'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to save email preferences')
      setTimeout(() => setError(null), 5000)
    },
  })

  const handleSavePreferences = () => {
    if (!localPreferences) return
    savePreferencesMutation.mutate(localPreferences)
  }

  const handleCategoryToggle = (key: string) => {
    if (!localPreferences) return
    setLocalPreferences({
      ...localPreferences,
      categories: {
        ...localPreferences.categories,
        [key]: !localPreferences.categories[key as keyof typeof localPreferences.categories]
      }
    })
  }

  const handleUnsubscribeAll = () => {
    if (!localPreferences) return
    setLocalPreferences({
      ...localPreferences,
      enabled: false
    })
    setSuccess('You have been unsubscribed from all email notifications')
    setTimeout(() => setSuccess(null), 3000)
  }

  if (preferencesLoading || !localPreferences) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={250} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    )
  }

  if (!preferencesData?.configured) {
    return (
      <Alert severity="info">
        Email preferences not configured. Using default settings. Once you save your preferences, they will be applied to all future emails.
      </Alert>
    )
  }

  return (
    <>
      {/* Email Notification Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <EmailIcon sx={{ mr: 2 }} />
              <Typography variant="h6">
                Email Notification Settings
              </Typography>
            </Box>
            {!localPreferences.enabled && (
              <Chip
                label="All Emails Disabled"
                color="error"
                icon={<UnsubscribeIcon />}
              />
            )}
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localPreferences.enabled}
                    onChange={(e) => setLocalPreferences({
                      ...localPreferences,
                      enabled: e.target.checked
                    })}
                  />
                }
                label="Enable Email Notifications"
              />
              <Typography variant="body2" color="textSecondary">
                Master switch for all email notifications
              </Typography>
            </Grid>

            {localPreferences.enabled && (
              <>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Notification Frequency
                  </Typography>
                  <RadioGroup
                    value={localPreferences.frequency}
                    onChange={(e) => setLocalPreferences({
                      ...localPreferences,
                      frequency: e.target.value as any
                    })}
                  >
                    <FormControlLabel 
                      value="immediate" 
                      control={<Radio />} 
                      label="Immediate" 
                    />
                    <FormControlLabel 
                      value="daily" 
                      control={<Radio />} 
                      label="Daily Digest" 
                    />
                    <FormControlLabel 
                      value="weekly" 
                      control={<Radio />} 
                      label="Weekly Digest" 
                    />
                  </RadioGroup>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Email Format
                  </Typography>
                  <RadioGroup
                    value={localPreferences.format}
                    onChange={(e) => setLocalPreferences({
                      ...localPreferences,
                      format: e.target.value as any
                    })}
                  >
                    <FormControlLabel 
                      value="html" 
                      control={<Radio />} 
                      label="HTML (Rich formatting)" 
                    />
                    <FormControlLabel 
                      value="text" 
                      control={<Radio />} 
                      label="Plain Text" 
                    />
                  </RadioGroup>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      {localPreferences.enabled && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Categories
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Choose which types of notifications you want to receive
            </Typography>

            {notificationCategories.map((group) => (
              <Box key={group.group} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  {group.group}
                </Typography>
                <List disablePadding>
                  {group.items.map((item, index) => (
                    <React.Fragment key={item.key}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={item.label}
                          secondary={item.description}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            edge="end"
                            checked={localPreferences.categories[item.key as keyof typeof localPreferences.categories]}
                            onChange={() => handleCategoryToggle(item.key)}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < group.items.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Digest Settings */}
      {localPreferences.enabled && localPreferences.frequency !== 'immediate' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <ScheduleIcon sx={{ mr: 2 }} />
              <Typography variant="h6">
                Digest Settings
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {localPreferences.frequency === 'daily' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Daily Digest Time</InputLabel>
                    <Select
                      value={localPreferences.digestSettings.dailyDigestTime}
                      label="Daily Digest Time"
                      onChange={(e) => setLocalPreferences({
                        ...localPreferences,
                        digestSettings: { 
                          ...localPreferences.digestSettings, 
                          dailyDigestTime: e.target.value 
                        }
                      })}
                    >
                      <MenuItem value="06:00">6:00 AM</MenuItem>
                      <MenuItem value="07:00">7:00 AM</MenuItem>
                      <MenuItem value="08:00">8:00 AM</MenuItem>
                      <MenuItem value="09:00">9:00 AM</MenuItem>
                      <MenuItem value="10:00">10:00 AM</MenuItem>
                      <MenuItem value="17:00">5:00 PM</MenuItem>
                      <MenuItem value="18:00">6:00 PM</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {localPreferences.frequency === 'weekly' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Weekly Digest Day</InputLabel>
                    <Select
                      value={localPreferences.digestSettings.weeklyDigestDay}
                      label="Weekly Digest Day"
                      onChange={(e) => setLocalPreferences({
                        ...localPreferences,
                        digestSettings: { 
                          ...localPreferences.digestSettings, 
                          weeklyDigestDay: Number(e.target.value) 
                        }
                      })}
                    >
                      <MenuItem value={0}>Sunday</MenuItem>
                      <MenuItem value={1}>Monday</MenuItem>
                      <MenuItem value={2}>Tuesday</MenuItem>
                      <MenuItem value={3}>Wednesday</MenuItem>
                      <MenuItem value={4}>Thursday</MenuItem>
                      <MenuItem value={5}>Friday</MenuItem>
                      <MenuItem value={6}>Saturday</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Include in Digest:
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={localPreferences.digestSettings.includeTaskSummary}
                      onChange={(e) => setLocalPreferences({
                        ...localPreferences,
                        digestSettings: { 
                          ...localPreferences.digestSettings, 
                          includeTaskSummary: e.target.checked 
                        }
                      })}
                    />
                  }
                  label="Task Summary"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={localPreferences.digestSettings.includeCampaignSummary}
                      onChange={(e) => setLocalPreferences({
                        ...localPreferences,
                        digestSettings: { 
                          ...localPreferences.digestSettings, 
                          includeCampaignSummary: e.target.checked 
                        }
                      })}
                    />
                  }
                  label="Campaign Summary"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={localPreferences.digestSettings.includeUpcomingDeadlines}
                      onChange={(e) => setLocalPreferences({
                        ...localPreferences,
                        digestSettings: { 
                          ...localPreferences.digestSettings, 
                          includeUpcomingDeadlines: e.target.checked 
                        }
                      })}
                    />
                  }
                  label="Upcoming Deadlines"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Email History */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <HistoryIcon sx={{ mr: 2 }} />
              <Typography variant="h6">
                Email History
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show'} History
            </Button>
          </Box>

          {showHistory && (
            <>
              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : !historyData?.hasData ? (
                <Alert severity="info">
                  {historyData?.message || 'No email history available'}
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Subject</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Sent</TableCell>
                        <TableCell>Opened</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historyData.emails.slice(0, 10).map((email: EmailHistoryEntry) => (
                        <TableRow key={email.id}>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                              {email.subject || `(${email.templateKey || 'Custom email'})`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={email.status}
                              size="small"
                              color={
                                email.status === 'delivered' ? 'success' :
                                email.status === 'sent' ? 'primary' :
                                email.status === 'failed' ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {email.sentAt ? new Date(email.sentAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            {email.openedAt ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<UnsubscribeIcon />}
          onClick={handleUnsubscribeAll}
          disabled={!localPreferences.enabled}
        >
          Unsubscribe from All
        </Button>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={handleSavePreferences}
          size="large"
          disabled={savePreferencesMutation.isPending}
        >
          {savePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>
    </>
  )
}