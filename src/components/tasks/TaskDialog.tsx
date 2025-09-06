'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Autocomplete
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/services/api'
import { useQuery } from '@tanstack/react-query'

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  episodeId?: string
  showId?: string
  existingTask?: any
}

export function TaskDialog({ 
  open, 
  onClose, 
  onSuccess, 
  episodeId, 
  showId,
  existingTask 
}: TaskDialogProps) {
  const [formData, setFormData] = useState({
    title: existingTask?.title || '',
    description: existingTask?.description || '',
    assignedToId: existingTask?.assignedToId || '',
    taskType: existingTask?.taskType || 'general',
    priority: existingTask?.priority || 'medium',
    dueDate: existingTask?.dueDate ? new Date(existingTask.dueDate) : null,
    notes: existingTask?.notes || '',
    episodeId: existingTask?.episodeId || episodeId || ''
  })
  const [loading, setLoading] = useState(false)

  // Fetch users who can be assigned tasks
  const { data: usersData } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: {
          roles: 'producer,talent,admin',
          limit: 100
        }
      })
      return response.data
    },
    enabled: open
  })

  // Fetch episodes if showId is provided
  const { data: episodesData } = useQuery({
    queryKey: ['episodes', showId],
    queryFn: async () => {
      if (!showId) return { episodes: [] }
      const response = await api.get('/episodes', {
        params: {
          showId,
          limit: 100
        }
      })
      return response.data
    },
    enabled: !!showId && open && !episodeId
  })

  const handleChange = (field: string) => (value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      if (existingTask) {
        // Update existing task
        await api.put(`/tasks/${existingTask.id}`, formData)
      } else {
        // Create new task
        await api.post('/tasks', formData)
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Failed to save task. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const users = usersData?.users || []
  const episodes = episodesData?.episodes || []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {existingTask ? 'Edit Task' : 'Create New Task'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <TextField
            label="Task Title"
            value={formData.title}
            onChange={(e) => handleChange('title')(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description')(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />

          {!episodeId && episodes.length > 0 && (
            <FormControl fullWidth required>
              <InputLabel>Episode</InputLabel>
              <Select
                value={formData.episodeId}
                label="Episode"
                onChange={(e) => handleChange('episodeId')(e.target.value)}
              >
                {episodes.map((episode: any) => (
                  <MenuItem key={episode.id} value={episode.id}>
                    {episode.episodeNumber}. {episode.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Autocomplete
            options={users}
            getOptionLabel={(option: any) => `${option.name} (${option.role})`}
            value={users.find((u: any) => u.id === formData.assignedToId) || null}
            onChange={(_, newValue) => handleChange('assignedToId')(newValue?.id || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assigned To"
                required
              />
            )}
          />

          <FormControl fullWidth>
            <InputLabel>Task Type</InputLabel>
            <Select
              value={formData.taskType}
              label="Task Type"
              onChange={(e) => handleChange('taskType')(e.target.value)}
            >
              <MenuItem value="general">General</MenuItem>
              <MenuItem value="recording">Recording</MenuItem>
              <MenuItem value="review">Review</MenuItem>
              <MenuItem value="approval">Approval</MenuItem>
              <MenuItem value="script">Script</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={(e) => handleChange('priority')(e.target.value)}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Due Date"
              value={formData.dueDate}
              onChange={(newValue) => handleChange('dueDate')(newValue)}
              renderInput={(params: any) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <TextField
            label="Notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes')(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !formData.title || !formData.assignedToId || !formData.episodeId}
        >
          {loading ? 'Saving...' : existingTask ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}