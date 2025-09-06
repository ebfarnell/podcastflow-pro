'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Box,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  Autocomplete
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { AdRequest } from '@/types/workflow'
import { useAuth } from '@/lib/auth/client'

interface AdRequestDialogProps {
  open: boolean
  onClose: () => void
  adRequest?: AdRequest | null
  orderId?: string
  showId?: string
  onSuccess: () => void
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

interface ShowOption {
  id: string
  name: string
}

export default function AdRequestDialog({
  open,
  onClose,
  adRequest,
  orderId,
  showId,
  onSuccess
}: AdRequestDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [shows, setShows] = useState<ShowOption[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    showId: showId || '',
    assignedToId: '',
    assignedToRole: 'producer' as 'producer' | 'talent',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: null as Date | null,
    notes: '',
    status: adRequest?.status || 'pending',
    deliverables: adRequest?.deliverables || []
  })

  useEffect(() => {
    if (adRequest) {
      setFormData({
        title: adRequest.title,
        description: adRequest.description || '',
        showId: adRequest.showId,
        assignedToId: adRequest.assignedToId,
        assignedToRole: adRequest.assignedToRole,
        priority: adRequest.priority,
        dueDate: adRequest.dueDate ? new Date(adRequest.dueDate) : null,
        notes: adRequest.notes || '',
        status: adRequest.status,
        deliverables: adRequest.deliverables || []
      })
    }

    fetchUsers()
    if (!showId) fetchShows()
  }, [adRequest, showId])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?roles=producer,talent')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchShows = async () => {
    try {
      const response = await fetch('/api/shows')
      if (!response.ok) throw new Error('Failed to fetch shows')
      const data = await response.json()
      setShows(data.shows || [])
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError('')

      // Validation
      if (!formData.title.trim()) {
        setError('Title is required')
        return
      }
      if (!formData.showId && !showId) {
        setError('Show is required')
        return
      }
      if (!formData.assignedToId) {
        setError('Assignee is required')
        return
      }

      const payload = {
        ...formData,
        orderId: orderId || adRequest?.orderId,
        showId: formData.showId || showId,
        dueDate: formData.dueDate?.toISOString()
      }

      const url = adRequest 
        ? `/api/ad-requests/${adRequest.id}`
        : '/api/ad-requests'
      
      const response = await fetch(url, {
        method: adRequest ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save ad request')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => u.role === formData.assignedToRole)

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {adRequest ? 'Edit Ad Request' : 'Create Ad Request'}
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />

            {!showId && (
              <FormControl fullWidth required>
                <InputLabel>Show</InputLabel>
                <Select
                  value={formData.showId}
                  onChange={(e) => setFormData({ ...formData, showId: e.target.value })}
                  label="Show"
                >
                  {shows.map((show) => (
                    <MenuItem key={show.id} value={show.id}>
                      {show.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Assign To Role</InputLabel>
                <Select
                  value={formData.assignedToRole}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    assignedToRole: e.target.value as 'producer' | 'talent',
                    assignedToId: '' // Reset assignee when role changes
                  })}
                  label="Assign To Role"
                >
                  <MenuItem value="producer">Producer</MenuItem>
                  <MenuItem value="talent">Talent</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  label="Assignee"
                >
                  {filteredUsers.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>

              <DatePicker
                label="Due Date"
                value={formData.dueDate}
                onChange={(date) => setFormData({ ...formData, dueDate: date })}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
            </Stack>

            {adRequest && (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : adRequest ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}