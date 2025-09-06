'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material'
import {
  Description as TemplateIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  AttachMoney as MoneyIcon,
  CalendarMonth as CalendarIcon,
  FilterList as FilterIcon
} from '@mui/icons-material'
import { toast } from '@/lib/toast'

interface Template {
  id: string
  name: string
  description: string
  itemCount: number
  filterCount: number
  items: Array<{
    placementType: string
    slotCount: number
    budgetPercentage: number
    weeklyDistribution?: any
    priority: number
  }>
  filters: Array<{
    filterType: string
    filterValue: any
  }>
  createdByName: string
  createdAt: string
}

interface TemplateSelectorProps {
  open: boolean
  onClose: () => void
  onSelectTemplate: (template: Template) => void
  campaignBudget?: number | null
}

export function TemplateSelector({
  open,
  onClose,
  onSelectTemplate,
  campaignBudget
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

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

  const handleSelectTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate)
      toast.success(`Applied "${selectedTemplate.name}" template`)
      onClose()
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

  const calculateBudgetAllocation = (template: Template) => {
    if (!campaignBudget) return null
    
    return template.items.map(item => ({
      ...item,
      estimatedBudget: (campaignBudget * (item.budgetPercentage / 100)).toFixed(0)
    }))
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <TemplateIcon />
            <Typography variant="h6">Choose a Proposal Template</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Alert severity="info">
            No templates available. Create your first template to speed up proposal creation.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {templates.map((template) => {
              const budgetAllocation = calculateBudgetAllocation(template)
              const isSelected = selectedTemplate?.id === template.id
              
              return (
                <Grid item xs={12} key={template.id}>
                  <Card 
                    variant={isSelected ? "outlined" : "elevation"}
                    sx={{ 
                      border: isSelected ? 2 : 0,
                      borderColor: 'primary.main',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 3
                      }
                    }}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box flex={1}>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {template.description}
                          </Typography>
                          
                          <Box display="flex" gap={1} mt={2} mb={2}>
                            <Chip
                              icon={<CalendarIcon />}
                              label={`${template.itemCount} placement rules`}
                              size="small"
                              variant="outlined"
                            />
                            {template.filterCount > 0 && (
                              <Chip
                                icon={<FilterIcon />}
                                label={`${template.filterCount} filters`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>

                          {/* Placement breakdown */}
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Placement Distribution:
                            </Typography>
                            <Box display="flex" gap={1} flexWrap="wrap">
                              {template.items.map((item, idx) => (
                                <Chip
                                  key={idx}
                                  label={`${item.placementType}: ${item.slotCount} slots (${item.budgetPercentage}%)`}
                                  size="small"
                                  color={getPlacementColor(item.placementType)}
                                />
                              ))}
                            </Box>
                          </Box>

                          {/* Budget allocation preview */}
                          {campaignBudget && budgetAllocation && (
                            <Box mt={2}>
                              <Typography variant="subtitle2" gutterBottom>
                                Budget Allocation Preview:
                              </Typography>
                              <Box display="flex" gap={1} flexWrap="wrap">
                                {budgetAllocation.map((item, idx) => (
                                  <Chip
                                    key={idx}
                                    icon={<MoneyIcon />}
                                    label={`${item.placementType}: $${item.estimatedBudget}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}

                          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                            Created by {template.createdByName} • {new Date(template.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        
                        {isSelected && (
                          <Box>
                            <CheckIcon color="primary" />
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSelectTemplate}
          variant="contained"
          disabled={!selectedTemplate}
          startIcon={<CheckIcon />}
        >
          Apply Template
        </Button>
      </DialogActions>
    </Dialog>
  )
}