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
  Checkbox,
  FormControlLabel,
  FormGroup
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { CreativeRequest, CreativeAsset } from '@/types/workflow'
import { useAuth } from '@/lib/auth/client'

interface CreativeRequestDialogProps {
  open: boolean
  onClose: () => void
  creativeRequest?: CreativeRequest | null
  orderId?: string
  campaignId?: string
  onSuccess: () => void
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

const DEFAULT_ASSETS: CreativeAsset[] = [
  { type: 'script', required: true, description: 'Ad script or talking points' },
  { type: 'audio', required: false, description: 'Pre-recorded audio if applicable' },
  { type: 'artwork', required: false, description: 'Visual assets if needed' },
  { type: 'guidelines', required: true, description: 'Brand guidelines and requirements' }
]

export default function CreativeRequestDialog({
  open,
  onClose,
  creativeRequest,
  orderId,
  campaignId,
  onSuccess
}: CreativeRequestDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedToId: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: null as Date | null,
    requiredAssets: DEFAULT_ASSETS,
    status: creativeRequest?.status || 'pending'
  })

  useEffect(() => {
    if (creativeRequest) {
      setFormData({
        title: creativeRequest.title,
        description: creativeRequest.description || '',
        assignedToId: creativeRequest.assignedToId,
        priority: creativeRequest.priority,
        dueDate: creativeRequest.dueDate ? new Date(creativeRequest.dueDate) : null,
        requiredAssets: creativeRequest.requiredAssets || DEFAULT_ASSETS,
        status: creativeRequest.status
      })
    }

    fetchUsers()
  }, [creativeRequest])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?roles=sales')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleAssetChange = (index: number, field: keyof CreativeAsset, value: any) => {
    const newAssets = [...formData.requiredAssets]
    newAssets[index] = { ...newAssets[index], [field]: value }
    setFormData({ ...formData, requiredAssets: newAssets })
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
      if (!formData.assignedToId) {
        setError('Assignee is required')
        return
      }
      if (!orderId && !creativeRequest?.orderId) {
        setError('Order ID is required')
        return
      }
      if (!campaignId && !creativeRequest?.campaignId) {
        setError('Campaign ID is required')
        return
      }

      const payload = {
        ...formData,
        orderId: orderId || creativeRequest?.orderId,
        campaignId: campaignId || creativeRequest?.campaignId,
        dueDate: formData.dueDate?.toISOString()
      }

      const url = creativeRequest 
        ? `/api/creative-requests/${creativeRequest.id}`
        : '/api/creative-requests'
      
      const response = await fetch(url, {
        method: creativeRequest ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save creative request')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {creativeRequest ? 'Edit Creative Request' : 'Create Creative Request'}
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

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth required>
                <InputLabel>Assigned To</InputLabel>
                <Select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  label="Assigned To"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

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
            </Stack>

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

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Required Assets
              </Typography>
              <FormGroup>
                {formData.requiredAssets.map((asset, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={asset.required}
                          onChange={(e) => handleAssetChange(index, 'required', e.target.checked)}
                        />
                      }
                      label={asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
                    />
                    <TextField
                      size="small"
                      fullWidth
                      value={asset.description}
                      onChange={(e) => handleAssetChange(index, 'description', e.target.value)}
                      placeholder="Description"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ))}
              </FormGroup>
            </Box>

            {creativeRequest && (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="submitted">Submitted</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="revision_needed">Revision Needed</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : creativeRequest ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}