'use client'

import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import {
  TrendingUp,
  Email,
  Edit,
  History,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Send as SendIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

interface CampaignKPIsProps {
  campaignId: string
}

interface KPIData {
  id?: string
  kpiType: 'unique_web_visits' | 'conversions' | 'both'
  goalCPA?: number
  conversionValue?: number
  targetVisits?: number
  targetConversions?: number
  actualVisits: number
  actualConversions: number
  actualCPA?: number
  clientCanUpdate: boolean
  reminderFrequency: 'monthly' | 'quarterly' | 'biannually' | 'annually' | 'never'
  nextReminderDate?: string
  lastClientUpdate?: string
}

export function CampaignKPIs({ campaignId }: CampaignKPIsProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailData, setEmailData] = useState({
    clientEmail: '',
    clientName: '',
    expiresInDays: 30,
  })

  // Fetch KPI data
  const { data: kpi, isLoading } = useQuery({
    queryKey: ['campaign-kpi', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpi`)
      if (!response.ok) {
        if (response.status === 404) {
          return null // No KPI configured yet
        }
        throw new Error('Failed to fetch KPI data')
      }
      return response.json()
    },
  })

  // Fetch KPI history
  const { data: history = [] } = useQuery({
    queryKey: ['campaign-kpi-history', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpi/history`)
      if (!response.ok) return []
      return response.json()
    },
    enabled: showHistory,
  })

  // Create/Update KPI mutation
  const saveKPIMutation = useMutation({
    mutationFn: async (data: KPIData) => {
      const url = kpi 
        ? `/api/campaigns/${campaignId}/kpi/${kpi.id}`
        : `/api/campaigns/${campaignId}/kpi`
      
      const response = await fetch(url, {
        method: kpi ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) throw new Error('Failed to save KPI')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-kpi', campaignId] })
      setIsEditing(false)
    },
  })

  // Send reminder email mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const response = await fetch(`/api/campaigns/${campaignId}/kpi/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      })
      
      if (!response.ok) throw new Error('Failed to send reminder')
      return response.json()
    },
    onSuccess: () => {
      setShowEmailDialog(false)
      queryClient.invalidateQueries({ queryKey: ['campaign-kpi', campaignId] })
    },
  })

  const [formData, setFormData] = useState<KPIData>({
    kpiType: 'both',
    goalCPA: undefined,
    conversionValue: undefined,
    targetVisits: undefined,
    targetConversions: undefined,
    actualVisits: 0,
    actualConversions: 0,
    clientCanUpdate: true,
    reminderFrequency: 'monthly',
  })

  React.useEffect(() => {
    if (kpi) {
      setFormData({
        ...kpi,
        goalCPA: kpi.goalCPA || undefined,
        conversionValue: kpi.conversionValue || undefined,
        targetVisits: kpi.targetVisits || undefined,
        targetConversions: kpi.targetConversions || undefined,
      })
    }
  }, [kpi])

  const handleSave = () => {
    saveKPIMutation.mutate(formData)
  }

  const handleSendReminder = () => {
    sendReminderMutation.mutate(emailData)
  }

  const calculateProgress = () => {
    if (!kpi) return { visits: 0, conversions: 0 }
    
    const visitProgress = kpi.targetVisits 
      ? (kpi.actualVisits / kpi.targetVisits) * 100 
      : 0
    
    const conversionProgress = kpi.targetConversions 
      ? (kpi.actualConversions / kpi.targetConversions) * 100 
      : 0
    
    return { visits: visitProgress, conversions: conversionProgress }
  }

  const progress = calculateProgress()

  if (isLoading) {
    return <Typography>Loading KPIs...</Typography>
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Campaign KPIs</Typography>
        <Box>
          {kpi && (
            <Button
              startIcon={<Email />}
              onClick={() => setShowEmailDialog(true)}
              sx={{ mr: 1 }}
            >
              Send Client Update Request
            </Button>
          )}
          {kpi && !isEditing && (
            <Button
              startIcon={<Edit />}
              onClick={() => setIsEditing(true)}
              sx={{ mr: 1 }}
            >
              Edit KPIs
            </Button>
          )}
          {kpi && (
            <Button
              startIcon={<History />}
              onClick={() => setShowHistory(!showHistory)}
            >
              History
            </Button>
          )}
        </Box>
      </Box>

      {!kpi && !isEditing ? (
        // No KPI configured
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <TrendingUp sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No KPIs Configured
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Set up KPI tracking to monitor campaign performance and enable client self-service updates.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsEditing(true)}
            >
              Configure KPIs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Overview Cards */}
          {kpi && !isEditing && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      KPI Type
                    </Typography>
                    <Chip 
                      label={
                        kpi.kpiType === 'both' ? 'Visits + Conversions' :
                        kpi.kpiType === 'unique_web_visits' ? 'Unique Web Visits' :
                        'Conversions'
                      }
                      color="primary"
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Goal CPA
                    </Typography>
                    <Typography variant="h5">
                      ${kpi.goalCPA?.toFixed(2) || 'Not set'}
                    </Typography>
                    {kpi.actualCPA && (
                      <Typography 
                        variant="caption" 
                        color={kpi.actualCPA <= (kpi.goalCPA || 0) ? 'success.main' : 'error.main'}
                      >
                        Actual: ${kpi.actualCPA.toFixed(2)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              {(kpi.kpiType === 'unique_web_visits' || kpi.kpiType === 'both') && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Web Visits
                      </Typography>
                      <Typography variant="h5">
                        {kpi.actualVisits.toLocaleString()} / {kpi.targetVisits?.toLocaleString() || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {progress.visits.toFixed(1)}% of target
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              {(kpi.kpiType === 'conversions' || kpi.kpiType === 'both') && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Conversions
                      </Typography>
                      <Typography variant="h5">
                        {kpi.actualConversions.toLocaleString()} / {kpi.targetConversions?.toLocaleString() || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {progress.conversions.toFixed(1)}% of target
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}

          {/* KPI Configuration Form */}
          {isEditing && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  {kpi ? 'Edit KPI Configuration' : 'Configure Campaign KPIs'}
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>KPI Type</InputLabel>
                      <Select
                        value={formData.kpiType}
                        onChange={(e) => setFormData({ ...formData, kpiType: e.target.value as any })}
                        label="KPI Type"
                      >
                        <MenuItem value="unique_web_visits">Unique Web Visits</MenuItem>
                        <MenuItem value="conversions">Conversions</MenuItem>
                        <MenuItem value="both">Both</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Goal CPA ($)"
                      type="number"
                      value={formData.goalCPA || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        goalCPA: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                    />
                  </Grid>

                  {(formData.kpiType === 'conversions' || formData.kpiType === 'both') && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Conversion Value ($)"
                          type="number"
                          value={formData.conversionValue || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            conversionValue: e.target.value ? parseFloat(e.target.value) : undefined 
                          })}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Target Conversions"
                          type="number"
                          value={formData.targetConversions || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            targetConversions: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                        />
                      </Grid>
                    </>
                  )}

                  {(formData.kpiType === 'unique_web_visits' || formData.kpiType === 'both') && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Target Web Visits"
                        type="number"
                        value={formData.targetVisits || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          targetVisits: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                      />
                    </Grid>
                  )}

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Actual Web Visits"
                      type="number"
                      value={formData.actualVisits}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        actualVisits: parseInt(e.target.value) || 0 
                      })}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Actual Conversions"
                      type="number"
                      value={formData.actualConversions}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        actualConversions: parseInt(e.target.value) || 0 
                      })}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Client Update Settings
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Reminder Schedule</InputLabel>
                      <Select
                        value={formData.reminderFrequency}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          reminderFrequency: e.target.value as any 
                        })}
                        label="Reminder Schedule"
                      >
                        <MenuItem value="monthly">Monthly</MenuItem>
                        <MenuItem value="quarterly">Quarterly</MenuItem>
                        <MenuItem value="biannually">Bi-Annually</MenuItem>
                        <MenuItem value="annually">Annually</MenuItem>
                        <MenuItem value="never">Never (Manual Only)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Set how often you'd like to be reminded to request KPI updates. 
                      Reminders must be sent manually.
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.clientCanUpdate}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            clientCanUpdate: e.target.checked 
                          })}
                        />
                      }
                      label="Allow client to update KPI values"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saveKPIMutation.isPending}
                  >
                    Save KPIs
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Client Update Info */}
          {kpi && kpi.clientCanUpdate && !isEditing && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Client updates are enabled</strong>
              </Typography>
              {kpi.lastClientUpdate && (
                <Typography variant="body2">
                  Last updated by client: {format(new Date(kpi.lastClientUpdate), 'MMM d, yyyy')}
                </Typography>
              )}
              {kpi.reminderFrequency && kpi.reminderFrequency !== 'never' && (
                <Typography variant="body2">
                  Reminder schedule: {
                    kpi.reminderFrequency === 'monthly' ? 'Monthly' :
                    kpi.reminderFrequency === 'quarterly' ? 'Quarterly' :
                    kpi.reminderFrequency === 'biannually' ? 'Bi-Annually' :
                    kpi.reminderFrequency === 'annually' ? 'Annually' : ''
                  } (Manual send required)
                </Typography>
              )}
            </Alert>
          )}

          {/* KPI History */}
          {showHistory && history.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>KPI Update History</Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Changes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={entry.changeType} />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={entry.updateSource}
                            color={entry.updateSource === 'client' ? 'secondary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {entry.changedFields?.join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Email Reminder Dialog */}
      <Dialog open={showEmailDialog} onClose={() => setShowEmailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Client Update Request</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client Email"
                  value={emailData.clientEmail}
                  onChange={(e) => setEmailData({ ...emailData, clientEmail: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client Name (Optional)"
                  value={emailData.clientName}
                  onChange={(e) => setEmailData({ ...emailData, clientName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Link Expires In (Days)"
                  type="number"
                  value={emailData.expiresInDays}
                  onChange={(e) => setEmailData({ 
                    ...emailData, 
                    expiresInDays: parseInt(e.target.value) || 30 
                  })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEmailDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSendReminder}
            disabled={!emailData.clientEmail || sendReminderMutation.isPending}
            startIcon={<SendIcon />}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}