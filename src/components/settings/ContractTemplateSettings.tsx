'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Skeleton,
  Menu,
  MenuItem,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ContractTemplate {
  id: string
  name: string
  description?: string
  htmlTemplate: string
  variables: Array<{
    name: string
    label: string
    type: 'text' | 'number' | 'date' | 'boolean'
    required: boolean
    defaultValue?: string
  }>
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  usage?: {
    totalContracts: number
    lastUsed?: string
  }
}

const defaultVariables = [
  { name: 'campaignName', label: 'Campaign Name', type: 'text' as const, required: true },
  { name: 'advertiserName', label: 'Advertiser Name', type: 'text' as const, required: true },
  { name: 'agencyName', label: 'Agency Name', type: 'text' as const, required: false },
  { name: 'orderNumber', label: 'Order Number', type: 'text' as const, required: true },
  { name: 'totalAmount', label: 'Total Amount', type: 'number' as const, required: true },
  { name: 'startDate', label: 'Start Date', type: 'date' as const, required: true },
  { name: 'endDate', label: 'End Date', type: 'date' as const, required: true },
  { name: 'organizationName', label: 'Organization Name', type: 'text' as const, required: true },
]

const defaultHtmlTemplate = '<!DOCTYPE html>\n' +
'<html>\n' +
'<head>\n' +
'    <title>Advertising Contract</title>\n' +
'    <style>\n' +
'        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }\n' +
'        .header { text-align: center; margin-bottom: 30px; }\n' +
'        .section { margin-bottom: 20px; }\n' +
'        .signature-section { margin-top: 40px; }\n' +
'        .signature-box { border-bottom: 1px solid #000; width: 200px; height: 50px; display: inline-block; margin-right: 50px; }\n' +
'        table { width: 100%; border-collapse: collapse; margin: 20px 0; }\n' +
'        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n' +
'        th { background-color: #f2f2f2; }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'    <div class="header">\n' +
'        <h1>PODCAST ADVERTISING CONTRACT</h1>\n' +
'        <p><strong>{{organizationName}}</strong></p>\n' +
'    </div>\n' +
'\n' +
'    <div class="section">\n' +
'        <h3>Contract Details</h3>\n' +
'        <p><strong>Order Number:</strong> {{orderNumber}}</p>\n' +
'        <p><strong>Campaign:</strong> {{campaignName}}</p>\n' +
'        <p><strong>Advertiser:</strong> {{advertiserName}}</p>\n' +
'        {{#if agencyName}}<p><strong>Agency:</strong> {{agencyName}}</p>{{/if}}\n' +
'        <p><strong>Contract Period:</strong> {{startDate}} to {{endDate}}</p>\n' +
'        <p><strong>Total Contract Value:</strong> ${{totalAmount}}</p>\n' +
'    </div>\n' +
'\n' +
'    <div class="section">\n' +
'        <h3>Terms and Conditions</h3>\n' +
'        <p>1. Payment terms: Net 30 days from invoice date</p>\n' +
'        <p>2. Cancellation policy: 48-hour notice required</p>\n' +
'        <p>3. All advertising content subject to approval</p>\n' +
'        <p>4. Performance metrics will be provided monthly</p>\n' +
'    </div>\n' +
'\n' +
'    <div class="signature-section">\n' +
'        <h3>Signatures</h3>\n' +
'        <div style="margin-top: 40px;">\n' +
'            <div style="display: inline-block; margin-right: 100px;">\n' +
'                <div class="signature-box"></div>\n' +
'                <p><strong>{{organizationName}}</strong><br>\n' +
'                Date: ________________</p>\n' +
'            </div>\n' +
'            <div style="display: inline-block;">\n' +
'                <div class="signature-box"></div>\n' +
'                <p><strong>{{advertiserName}}</strong><br>\n' +
'                Date: ________________</p>\n' +
'            </div>\n' +
'        </div>\n' +
'    </div>\n' +
'</body>\n' +
'</html>'

export function ContractTemplateSettings() {
  const queryClient = useQueryClient()
  const [templateDialog, setTemplateDialog] = useState(false)
  const [previewDialog, setPreviewDialog] = useState(false)
  const [variableDialog, setVariableDialog] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState<ContractTemplate | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    htmlTemplate: defaultHtmlTemplate,
    variables: defaultVariables,
    isDefault: false,
    isActive: true,
  })

  const [variableForm, setVariableForm] = useState({
    name: '',
    label: '',
    type: 'text' as const,
    required: true,
    defaultValue: '',
  })

  // Fetch contract templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const response = await fetch('/api/contracts/templates')
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await response.json()
      return data.templates || []
    },
  })

  // Create/Update template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = currentTemplate ? `/api/contracts/templates/${currentTemplate.id}` : '/api/contracts/templates'
      const method = currentTemplate ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save template')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
      setTemplateDialog(false)
      resetForm()
    },
  })

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/contracts/templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
      setMenuAnchor(null)
    },
  })

  const resetForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      htmlTemplate: defaultHtmlTemplate,
      variables: defaultVariables,
      isDefault: false,
      isActive: true,
    })
    setCurrentTemplate(null)
  }

  const handleEditTemplate = (template: ContractTemplate) => {
    setCurrentTemplate(template)
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      htmlTemplate: template.htmlTemplate,
      variables: template.variables,
      isDefault: template.isDefault,
      isActive: template.isActive,
    })
    setTemplateDialog(true)
    setMenuAnchor(null)
  }

  const handleDeleteTemplate = (template: ContractTemplate) => {
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id)
    }
  }

  const handleDuplicateTemplate = (template: ContractTemplate) => {
    setCurrentTemplate(null)
    setTemplateForm({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      htmlTemplate: template.htmlTemplate,
      variables: template.variables,
      isDefault: false,
      isActive: true,
    })
    setTemplateDialog(true)
    setMenuAnchor(null)
  }

  const handlePreviewTemplate = (template: ContractTemplate) => {
    setCurrentTemplate(template)
    setPreviewDialog(true)
    setMenuAnchor(null)
  }

  const handleSaveTemplate = () => {
    saveTemplateMutation.mutate(templateForm)
  }

  const handleAddVariable = () => {
    setTemplateForm(prev => ({
      ...prev,
      variables: [...prev.variables, { ...variableForm }]
    }))
    setVariableForm({
      name: '',
      label: '',
      type: 'text',
      required: true,
      defaultValue: '',
    })
    setVariableDialog(false)
  }

  const handleRemoveVariable = (index: number) => {
    setTemplateForm(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
  }

  const generatePreviewHtml = (template: ContractTemplate) => {
    let html = template.htmlTemplate
    
    // Replace variables with sample data
    const sampleData: Record<string, string> = {
      campaignName: 'Sample Campaign 2025',
      advertiserName: 'Sample Advertiser Inc.',
      agencyName: 'Sample Agency LLC',
      orderNumber: 'ORD-202501-0001',
      totalAmount: '15,000.00',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      organizationName: 'PodcastFlow Pro',
    }

    // Simple variable replacement (in real implementation, use proper templating engine)
    template.variables.forEach(variable => {
      const value = sampleData[variable.name] || `[${variable.label}]`
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g')
      html = html.replace(regex, value)
    })

    // Handle simple conditionals
    html = html.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, varName, content) => {
      return sampleData[varName] ? content : ''
    })

    return html
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, template: ContractTemplate) => {
    setMenuAnchor(event.currentTarget)
    setSelectedTemplate(template)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="rectangular" width={120} height={36} />
          </Box>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Skeleton variant="rectangular" width="100%" height={80} />
            </Box>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Contract Templates
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm()
                setTemplateDialog(true)
              }}
            >
              New Template
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
            Manage HTML contract templates with variable substitution for automated contract generation.
          </Typography>

          <List>
            {templates?.map((template: ContractTemplate) => (
              <ListItem
                key={template.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">{template.name}</Typography>
                      {template.isDefault && (
                        <Chip label="Default" size="small" color="primary" />
                      )}
                      {!template.isActive && (
                        <Chip label="Inactive" size="small" color="default" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {template.description || 'No description'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Typography variant="caption">
                          Variables: {template.variables.length}
                        </Typography>
                        {template.usage && (
                          <Typography variant="caption">
                            Used: {template.usage.totalContracts} times
                          </Typography>
                        )}
                        <Typography variant="caption">
                          Updated: {new Date(template.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={(e) => handleMenuClick(e, template)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )) || []}
          </List>

          {!templates?.length && (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No contract templates found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first template to start generating automated contracts
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {currentTemplate ? 'Edit Template' : 'New Contract Template'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} sx={{ mb: 3 }}>
            <Tab label="Basic Info" />
            <Tab label="HTML Template" />
            <Tab label="Variables" />
          </Tabs>

          {tabValue === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <TextField
                label="Template Name"
                fullWidth
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                required
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateForm.isDefault}
                      onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                    />
                  }
                  label="Default Template"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateForm.isActive}
                      onChange={(e) => setTemplateForm({ ...templateForm, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Box>
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ pt: 2 }}>
              <TextField
                label="HTML Template"
                fullWidth
                multiline
                rows={20}
                value={templateForm.htmlTemplate}
                onChange={(e) => setTemplateForm({ ...templateForm, htmlTemplate: e.target.value })}
                helperText="Use {{variableName}} for variable substitution. Supports {{#if variable}} conditionals."
                sx={{ fontFamily: 'monospace' }}
              />
            </Box>
          )}

          {tabValue === 2 && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">Template Variables</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setVariableDialog(true)}
                >
                  Add Variable
                </Button>
              </Box>
              
              {templateForm.variables.map((variable, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">{`{{${variable.name}}}`}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({variable.type})
                      </Typography>
                      {variable.required && (
                        <Chip label="Required" size="small" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2"><strong>Label:</strong> {variable.label}</Typography>
                        {variable.defaultValue && (
                          <Typography variant="body2"><strong>Default:</strong> {variable.defaultValue}</Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleRemoveVariable(index)}
                      >
                        Remove
                      </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={!templateForm.name || saveTemplateMutation.isPending}
          >
            {currentTemplate ? 'Update' : 'Create'} Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variable Dialog */}
      <Dialog open={variableDialog} onClose={() => setVariableDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Variable</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Variable Name"
              fullWidth
              value={variableForm.name}
              onChange={(e) => setVariableForm({ ...variableForm, name: e.target.value })}
              helperText="Use camelCase (e.g., campaignName)"
            />
            <TextField
              label="Display Label"
              fullWidth
              value={variableForm.label}
              onChange={(e) => setVariableForm({ ...variableForm, label: e.target.value })}
            />
            <TextField
              select
              label="Type"
              fullWidth
              value={variableForm.type}
              onChange={(e) => setVariableForm({ ...variableForm, type: e.target.value as any })}
            >
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
            </TextField>
            <TextField
              label="Default Value"
              fullWidth
              value={variableForm.defaultValue}
              onChange={(e) => setVariableForm({ ...variableForm, defaultValue: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={variableForm.required}
                  onChange={(e) => setVariableForm({ ...variableForm, required: e.target.checked })}
                />
              }
              label="Required"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariableDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddVariable}
            disabled={!variableForm.name || !variableForm.label}
          >
            Add Variable
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          {currentTemplate && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: generatePreviewHtml(currentTemplate)
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleEditTemplate(selectedTemplate!)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handlePreviewTemplate(selectedTemplate!)}>
          <VisibilityIcon sx={{ mr: 1 }} />
          Preview
        </MenuItem>
        <MenuItem onClick={() => handleDuplicateTemplate(selectedTemplate!)}>
          <FileCopyIcon sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem 
          onClick={() => handleDeleteTemplate(selectedTemplate!)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  )
}