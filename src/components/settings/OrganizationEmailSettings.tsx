'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
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
  Send as SendIcon,
  Business as BusinessIcon,
  Palette as PaletteIcon,
  NotificationsActive as NotificationIcon,
  Preview as PreviewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Code as CodeIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOrganization } from '@/contexts/OrganizationContext'

interface OrganizationEmailSettingsData {
  configured: boolean
  replyToAddress: string | null
  supportEmail: string | null
  emailFooter: string | null
  notifications: {
    userInvitations: boolean
    taskAssignments: boolean
    campaignUpdates: boolean
    paymentReminders: boolean
    reportReady: boolean
    deadlineReminders: boolean
    approvalRequests: boolean
    adCopyUpdates: boolean
  }
  sendingRules: {
    dailyLimitPerUser: number
    allowedDomains: string[]
    requireApproval: boolean
    ccOnCertainEmails: boolean
    ccAddress: string | null
  }
}

interface OrganizationEmailBranding {
  enabled: boolean
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  customCSS: string | null
}

interface EmailTemplate {
  id: string
  key: string
  name: string
  description?: string
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
  category: string
  isActive: boolean
  isSystemDefault: boolean
  canCustomize: boolean
}

const notificationTypes = [
  { key: 'userInvitations', label: 'User Invitations', description: 'Send welcome emails to new team members' },
  { key: 'taskAssignments', label: 'Task Assignments', description: 'Notify users when tasks are assigned to them' },
  { key: 'campaignUpdates', label: 'Campaign Updates', description: 'Send updates when campaign status changes' },
  { key: 'paymentReminders', label: 'Payment Reminders', description: 'Send invoice and payment due reminders' },
  { key: 'reportReady', label: 'Report Ready', description: 'Notify when reports are ready for download' },
  { key: 'deadlineReminders', label: 'Deadline Reminders', description: 'Send reminders for upcoming deadlines' },
  { key: 'approvalRequests', label: 'Approval Requests', description: 'Notify approvers of pending requests' },
  { key: 'adCopyUpdates', label: 'Ad Copy Updates', description: 'Notify when ad copy is updated or approved' },
]

export function OrganizationEmailSettings() {
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const [previewDialog, setPreviewDialog] = useState(false)
  const [editTemplateDialog, setEditTemplateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localSettings, setLocalSettings] = useState<OrganizationEmailSettingsData | null>(null)
  const [localBranding, setLocalBranding] = useState<OrganizationEmailBranding | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate>>({})

  // Fetch organization email settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['organization-email-settings'],
    queryFn: async () => {
      const response = await api.get('/organization/email-settings')
      return response.data
    },
  })

  // Fetch email templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['organization-email-templates'],
    queryFn: async () => {
      const response = await api.get('/organization/email-templates')
      return response.data
    },
  })

  // Update local state when data is loaded
  useEffect(() => {
    if (settingsData?.settings) {
      setLocalSettings(settingsData.settings)
    }
    if (settingsData?.branding) {
      setLocalBranding(settingsData.branding)
    }
  }, [settingsData])

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { settings: OrganizationEmailSettingsData; branding: OrganizationEmailBranding }) => {
      const response = await api.put('/organization/email-settings', data)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Organization email settings saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['organization-email-settings'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to save organization email settings')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Preview template mutation
  const previewTemplateMutation = useMutation({
    mutationFn: async (data: { templateKey?: string; customTemplate?: Partial<EmailTemplate>; templateData?: any }) => {
      const response = await api.post('/organization/email-templates/preview', data)
      return response.data
    },
    onSuccess: (data) => {
      setPreviewData(data.preview)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to preview template')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate>) => {
      const response = await api.post('/organization/email-templates', template)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Email template saved successfully!')
      setEditTemplateDialog(false)
      queryClient.invalidateQueries({ queryKey: ['organization-email-templates'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to save email template')
      setTimeout(() => setError(null), 5000)
    },
  })

  const handleSaveSettings = () => {
    if (!localSettings || !localBranding) return
    saveSettingsMutation.mutate({ settings: localSettings, branding: localBranding })
  }

  const handleNotificationToggle = (key: string) => {
    if (!localSettings) return
    setLocalSettings({
      ...localSettings,
      notifications: {
        ...localSettings.notifications,
        [key]: !localSettings.notifications[key as keyof typeof localSettings.notifications]
      }
    })
  }

  const handleAddDomain = () => {
    if (!localSettings) return
    if (newDomain && !localSettings.sendingRules.allowedDomains.includes(newDomain)) {
      setLocalSettings({
        ...localSettings,
        sendingRules: {
          ...localSettings.sendingRules,
          allowedDomains: [...localSettings.sendingRules.allowedDomains, newDomain]
        }
      })
      setNewDomain('')
    }
  }

  const handleRemoveDomain = (domain: string) => {
    if (!localSettings) return
    setLocalSettings({
      ...localSettings,
      sendingRules: {
        ...localSettings.sendingRules,
        allowedDomains: localSettings.sendingRules.allowedDomains.filter(d => d !== domain)
      }
    })
  }

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setPreviewDialog(true)
    previewTemplateMutation.mutate({ templateKey: template.key })
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setEditingTemplate({
      key: template.key,
      name: template.name,
      description: template.description,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      variables: template.variables,
      category: template.category,
    })
    setEditTemplateDialog(true)
  }

  const handleSaveTemplate = () => {
    saveTemplateMutation.mutate(editingTemplate)
  }

  if (settingsLoading || !localSettings || !localBranding) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={300} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={250} />
      </Box>
    )
  }

  if (!settingsData?.configured) {
    return (
      <Alert severity="info">
        Organization email settings not configured. The settings below will be used once the platform email system is set up by the master administrator.
      </Alert>
    )
  }

  return (
    <>
      {/* Organization Email Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <BusinessIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Organization Email Preferences
            </Typography>
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reply-To Address"
                value={localSettings.replyToAddress || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  replyToAddress: e.target.value
                })}
                helperText="Where replies should be sent"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Support Email"
                value={localSettings.supportEmail || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  supportEmail: e.target.value
                })}
                helperText="Contact email shown in templates"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Email Footer Text"
                value={localSettings.emailFooter || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  emailFooter: e.target.value
                })}
                helperText="Text to include at the bottom of all emails"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <NotificationIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Notification Settings
            </Typography>
          </Box>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Control which types of emails are sent to users in your organization
          </Typography>
          
          <Grid container spacing={2}>
            {notificationTypes.map((type) => (
              <Grid item xs={12} key={type.key}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">
                      {type.label}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {type.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {templatesData?.templates && (
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          const template = templatesData.templates.find((t: EmailTemplate) => t.key === type.key)
                          if (template) handlePreviewTemplate(template)
                        }}
                        title="Preview template"
                      >
                        <PreviewIcon />
                      </IconButton>
                    )}
                    <Switch
                      checked={localSettings.notifications[type.key as keyof typeof localSettings.notifications]}
                      onChange={() => handleNotificationToggle(type.key)}
                    />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeIcon sx={{ mr: 2 }} />
              <Typography variant="h6">
                Email Templates
              </Typography>
            </Box>
          </Box>

          {templatesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : !templatesData?.templates || templatesData.templates.length === 0 ? (
            <Alert severity="info">
              No custom templates yet. System default templates will be used.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Template</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templatesData.templates.map((template: EmailTemplate) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {template.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {template.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={template.category} size="small" />
                      </TableCell>
                      <TableCell>
                        {template.isSystemDefault ? (
                          <Chip label="System Default" size="small" variant="outlined" />
                        ) : (
                          <Chip label="Custom" size="small" color="primary" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handlePreviewTemplate(template)}
                          title="Preview"
                        >
                          <PreviewIcon />
                        </IconButton>
                        {template.canCustomize && (
                          <IconButton
                            size="small"
                            onClick={() => handleEditTemplate(template)}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Email Branding */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <PaletteIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Email Branding
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localBranding.enabled}
                    onChange={(e) => setLocalBranding({
                      ...localBranding,
                      enabled: e.target.checked
                    })}
                  />
                }
                label="Enable Custom Branding"
              />
              <Typography variant="body2" color="textSecondary">
                Use custom colors and logo in email templates
              </Typography>
            </Grid>

            {localBranding.enabled && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Logo URL"
                    value={localBranding.logoUrl || ''}
                    onChange={(e) => setLocalBranding({
                      ...localBranding,
                      logoUrl: e.target.value
                    })}
                    helperText="URL to your organization's logo (recommended: 200x50px)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Primary Brand Color"
                    type="color"
                    value={localBranding.primaryColor}
                    onChange={(e) => setLocalBranding({
                      ...localBranding,
                      primaryColor: e.target.value
                    })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            backgroundColor: localBranding.primaryColor,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Secondary Brand Color"
                    type="color"
                    value={localBranding.secondaryColor}
                    onChange={(e) => setLocalBranding({
                      ...localBranding,
                      secondaryColor: e.target.value
                    })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            backgroundColor: localBranding.secondaryColor,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Custom CSS"
                    value={localBranding.customCSS || ''}
                    onChange={(e) => setLocalBranding({
                      ...localBranding,
                      customCSS: e.target.value
                    })}
                    helperText="Advanced: Add custom CSS to email templates"
                    sx={{ fontFamily: 'monospace' }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Email Sending Rules */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Email Sending Rules
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Daily Email Limit per User"
                type="number"
                value={localSettings.sendingRules.dailyLimitPerUser}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  sendingRules: { 
                    ...localSettings.sendingRules, 
                    dailyLimitPerUser: parseInt(e.target.value) || 100
                  }
                })}
                helperText="Maximum emails a user can send per day"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.sendingRules.requireApproval}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      sendingRules: { 
                        ...localSettings.sendingRules, 
                        requireApproval: e.target.checked 
                      }
                    })}
                  />
                }
                label="Require Approval for Bulk Emails"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Allowed Recipient Domains
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Leave empty to allow sending to any domain, or add specific domains to restrict
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddDomain}
                  disabled={!newDomain}
                >
                  Add Domain
                </Button>
              </Box>

              {localSettings.sendingRules.allowedDomains.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {localSettings.sendingRules.allowedDomains.map((domain) => (
                    <Chip
                      key={domain}
                      label={domain}
                      onDelete={() => handleRemoveDomain(domain)}
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.sendingRules.ccOnCertainEmails}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      sendingRules: { 
                        ...localSettings.sendingRules, 
                        ccOnCertainEmails: e.target.checked 
                      }
                    })}
                  />
                }
                label="CC on Certain Emails"
              />
              {localSettings.sendingRules.ccOnCertainEmails && (
                <TextField
                  fullWidth
                  label="CC Email Address"
                  value={localSettings.sendingRules.ccAddress || ''}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    sendingRules: { 
                      ...localSettings.sendingRules, 
                      ccAddress: e.target.value 
                    }
                  })}
                  helperText="Address to CC on payment reminders and important notifications"
                  sx={{ mt: 2 }}
                />
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={handleSaveSettings}
          size="large"
          disabled={saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? 'Saving...' : 'Save Organization Settings'}
        </Button>
      </Box>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Email Template Preview
          {selectedTemplate && (
            <Typography variant="body2" color="textSecondary">
              {selectedTemplate.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {previewTemplateMutation.isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : previewData ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Subject:</Typography>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
                {previewData.subject}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>HTML Preview:</Typography>
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'grey.100', 
                borderRadius: 1,
                mb: 2,
                maxHeight: 400,
                overflow: 'auto'
              }}>
                <div dangerouslySetInnerHTML={{ __html: previewData.htmlContent }} />
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>Plain Text:</Typography>
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'grey.100', 
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflow: 'auto'
              }}>
                {previewData.textContent}
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary" align="center">
              Failed to load preview
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editTemplateDialog} onClose={() => setEditTemplateDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Edit Email Template
          {selectedTemplate && (
            <Typography variant="body2" color="textSecondary">
              {selectedTemplate.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={editingTemplate.name || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject Line"
                value={editingTemplate.subject || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                helperText="Use {{variableName}} for dynamic content"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={10}
                label="HTML Content"
                value={editingTemplate.htmlContent || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, htmlContent: e.target.value })}
                sx={{ fontFamily: 'monospace' }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Plain Text Content"
                value={editingTemplate.textContent || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, textContent: e.target.value })}
                sx={{ fontFamily: 'monospace' }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Available variables: {editingTemplate.variables?.join(', ')}
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTemplateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveTemplate}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={saveTemplateMutation.isPending}
          >
            {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}