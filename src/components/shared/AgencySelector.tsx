'use client'

import { useState, useEffect } from 'react'
import {
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  Box,
  Chip,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Add, Search, AccountBalance } from '@mui/icons-material'
import { agencyApi } from '@/services/api'
import { useCachedAgencies } from '@/hooks/useAgenciesAndAdvertisers'

interface Agency {
  id: string
  name: string
  contactPerson?: string
  email?: string
  status?: string
  rating?: number
}

interface AgencySelectorProps {
  value?: string | Agency
  onChange: (agency: Agency | null) => void
  error?: boolean
  helperText?: string
  label?: string
  required?: boolean
  disabled?: boolean
}

export function AgencySelector({
  value,
  onChange,
  error,
  helperText,
  label = 'Agency',
  required = false,
  disabled = false,
}: AgencySelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newAgency, setNewAgency] = useState({
    name: '',
    email: '',
    contactPerson: '',
    phone: '',
    website: '',
  })

  // Fetch agencies using the optimized hook
  const { data: agencies = [], isLoading, error: queryError } = useCachedAgencies()

  // Debug logging
  console.log('AgencySelector - isLoading:', isLoading);
  console.log('AgencySelector - queryError:', queryError);
  console.log('AgencySelector - agencies:', agencies);

  // Filter agencies based on search text
  const filteredAgencies = agencies.filter((agency: Agency) =>
    agency.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    agency.contactPerson?.toLowerCase().includes(searchText.toLowerCase()) ||
    agency.email?.toLowerCase().includes(searchText.toLowerCase())
  )

  // Handle selection
  const handleSelect = (agency: Agency | null) => {
    onChange(agency)
    setOpen(false)
  }

  // Handle create new agency
  const handleCreateAgency = async () => {
    try {
      const response = await agencyApi.create(newAgency)
      const createdAgency = response.data
      onChange(createdAgency)
      setCreateDialogOpen(false)
      setNewAgency({ name: '', email: '', contactPerson: '', phone: '', website: '' })
      // Refetch agencies list
      // queryClient.invalidateQueries(['agencies'])
    } catch (error) {
      console.error('Failed to create agency:', error)
    }
  }

  // Get display value
  const getDisplayValue = () => {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value.name || ''
  }

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'pending': return 'warning'
      case 'inactive': return 'error'
      default: return 'default'
    }
  }

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={getDisplayValue()}
        onClick={() => !disabled && setOpen(true)}
        error={error}
        helperText={helperText}
        required={required}
        disabled={disabled}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => !disabled && setOpen(true)} edge="end">
                <Search />
              </IconButton>
            </InputAdornment>
          ),
        }}
        placeholder="Click to search and select an agency"
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Select Agency</Typography>
            <Button
              startIcon={<Add />}
              variant="outlined"
              onClick={() => setCreateDialogOpen(true)}
            >
              Add New
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search agencies..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          
          <Grid container spacing={2}>
            {isLoading ? (
              <Grid item xs={12}>
                <Typography>Loading agencies...</Typography>
              </Grid>
            ) : error ? (
              <Grid item xs={12}>
                <Typography color="error">
                  {error.response?.status === 401 
                    ? 'Authentication required. Please log in to view agencies.'
                    : `Error loading agencies: ${error.message}`}
                </Typography>
              </Grid>
            ) : filteredAgencies.length === 0 ? (
              <Grid item xs={12}>
                <Typography color="text.secondary">
                  No agencies found. {searchText && 'Try adjusting your search or '}
                  <Button
                    variant="text"
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ p: 0, textTransform: 'none' }}
                  >
                    create a new agency
                  </Button>
                </Typography>
              </Grid>
            ) : (
              filteredAgencies.map((agency: Agency) => (
                <Grid item xs={12} key={agency.id}>
                  <Box
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => handleSelect(agency)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AccountBalance sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {agency.name}
                      </Typography>
                      {agency.status && (
                        <Chip
                          label={agency.status}
                          size="small"
                          color={getStatusColor(agency.status)}
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {agency.contactPerson && `Contact: ${agency.contactPerson}`}
                      {agency.email && ` • ${agency.email}`}
                      {agency.rating && ` • Rating: ${agency.rating}/5`}
                    </Typography>
                  </Box>
                </Grid>
              ))
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create New Agency Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Agency</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Agency Name"
                value={newAgency.name}
                onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Person"
                value={newAgency.contactPerson}
                onChange={(e) => setNewAgency({ ...newAgency, contactPerson: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newAgency.email}
                onChange={(e) => setNewAgency({ ...newAgency, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newAgency.phone}
                onChange={(e) => setNewAgency({ ...newAgency, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Website"
                value={newAgency.website}
                onChange={(e) => setNewAgency({ ...newAgency, website: e.target.value })}
                placeholder="https://..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateAgency}
            variant="contained"
            disabled={!newAgency.name}
          >
            Create Agency
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}