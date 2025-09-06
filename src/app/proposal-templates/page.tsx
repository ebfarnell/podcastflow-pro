'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon,
  Visibility as ViewIcon,
  Description as TemplateIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { toast } from '@/lib/toast'

interface Template {
  id: string
  name: string
  description: string
  isActive: boolean
  itemCount: number
  filterCount: number
  createdByName: string
  createdAt: string
  items?: any[]
  filters?: any[]
}

export default function ProposalTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/proposal-templates')
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch('/api/proposal-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to create template')
      }

      toast.success('Template created successfully')
      setCreateDialogOpen(false)
      setFormData({ name: '', description: '' })
      fetchTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Failed to create template')
    }
  }

  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template)
    setViewDialogOpen(true)
  }

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      const response = await fetch('/api/proposal-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description,
          items: template.items,
          filters: template.filters
        })
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate template')
      }

      toast.success('Template duplicated successfully')
      fetchTemplates()
    } catch (error) {
      console.error('Error duplicating template:', error)
      toast.error('Failed to duplicate template')
    }
  }

  const getPlacementColor = (type: string) => {
    switch (type) {
      case 'pre-roll': return 'primary'
      case 'mid-roll': return 'secondary'
      case 'post-roll': return 'success'
      default: return 'default'
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_CREATE}>
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" display="flex" alignItems="center" gap={1}>
              <TemplateIcon fontSize="large" />
              Proposal Templates
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Template
            </Button>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : templates.length === 0 ? (
            <Paper sx={{ p: 4 }}>
              <Alert severity="info">
                No templates found. Create your first template to speed up proposal creation.
              </Alert>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="center">Filters</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{template.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={template.itemCount} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={template.filterCount} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{template.createdByName}</TableCell>
                      <TableCell>
                        {new Date(template.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => handleViewTemplate(template)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton
                            size="small"
                            onClick={() => handleDuplicateTemplate(template)}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small">
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Create Template Dialog */}
          <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  margin="normal"
                  multiline
                  rows={3}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateTemplate}
                variant="contained"
                disabled={!formData.name}
              >
                Create
              </Button>
            </DialogActions>
          </Dialog>

          {/* View Template Dialog */}
          <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogContent>
              {selectedTemplate && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {selectedTemplate.description}
                  </Typography>
                  
                  {selectedTemplate.items && selectedTemplate.items.length > 0 && (
                    <>
                      <Typography variant="subtitle1" gutterBottom>
                        Placement Rules
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                        {selectedTemplate.items.map((item, idx) => (
                          <Chip
                            key={idx}
                            label={`${item.placementType}: ${item.slotCount} slots (${item.budgetPercentage}%)`}
                            size="small"
                            color={getPlacementColor(item.placementType)}
                          />
                        ))}
                      </Box>
                    </>
                  )}

                  {selectedTemplate.filters && selectedTemplate.filters.length > 0 && (
                    <>
                      <Typography variant="subtitle1" gutterBottom>
                        Filters
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {selectedTemplate.filters.map((filter, idx) => (
                          <Chip
                            key={idx}
                            label={`${filter.filterType}: ${JSON.stringify(filter.filterValue)}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Container>
      </DashboardLayout>
    </RouteProtection>
  )
}