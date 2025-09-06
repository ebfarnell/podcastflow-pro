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
import { Add, Search, Business } from '@mui/icons-material'
import { advertiserApi } from '@/services/api'
import { useCachedAdvertisers } from '@/hooks/useAgenciesAndAdvertisers'

interface Advertiser {
  id: string
  name: string
  industry?: string
  email?: string
  status?: string
  agency?: string
}

interface AdvertiserSelectorProps {
  value?: string | Advertiser
  onChange: (advertiser: Advertiser | null) => void
  error?: boolean
  helperText?: string
  label?: string
  required?: boolean
  disabled?: boolean
}

export function AdvertiserSelector({
  value,
  onChange,
  error,
  helperText,
  label = 'Client (Advertiser)',
  required = false,
  disabled = false,
}: AdvertiserSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newAdvertiser, setNewAdvertiser] = useState({
    name: '',
    email: '',
    industry: '',
    contactPerson: '',
  })

  // Fetch advertisers using the optimized hook
  const { data: advertisers = [], isLoading, error: queryError } = useCachedAdvertisers()

  // Debug logging
  console.log('AdvertiserSelector - isLoading:', isLoading);
  console.log('AdvertiserSelector - queryError:', queryError);
  console.log('AdvertiserSelector - advertisers:', advertisers);

  // Filter advertisers based on search text
  const filteredAdvertisers = advertisers.filter((advertiser: Advertiser) =>
    advertiser.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    advertiser.industry?.toLowerCase().includes(searchText.toLowerCase()) ||
    advertiser.email?.toLowerCase().includes(searchText.toLowerCase())
  )

  // Handle selection
  const handleSelect = (advertiser: Advertiser | null) => {
    onChange(advertiser)
    setOpen(false)
  }

  // Handle create new advertiser
  const handleCreateAdvertiser = async () => {
    try {
      const response = await advertiserApi.create(newAdvertiser)
      const createdAdvertiser = response.data
      onChange(createdAdvertiser)
      setCreateDialogOpen(false)
      setNewAdvertiser({ name: '', email: '', industry: '', contactPerson: '' })
      // Refetch advertisers list
      // queryClient.invalidateQueries(['advertisers'])
    } catch (error) {
      console.error('Failed to create advertiser:', error)
    }
  }

  // Get display value
  const getDisplayValue = () => {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value.name || ''
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
        placeholder="Click to search and select an advertiser"
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Select Advertiser</Typography>
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
            placeholder="Search advertisers..."
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
                <Typography>Loading advertisers...</Typography>
              </Grid>
            ) : error ? (
              <Grid item xs={12}>
                <Typography color="error">
                  {error.response?.status === 401 
                    ? 'Authentication required. Please log in to view advertisers.'
                    : `Error loading advertisers: ${error.message}`}
                </Typography>
              </Grid>
            ) : filteredAdvertisers.length === 0 ? (
              <Grid item xs={12}>
                <Typography color="text.secondary">
                  No advertisers found. {searchText && 'Try adjusting your search or '}
                  <Button
                    variant="text"
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ p: 0, textTransform: 'none' }}
                  >
                    create a new advertiser
                  </Button>
                </Typography>
              </Grid>
            ) : (
              filteredAdvertisers.map((advertiser: Advertiser) => (
                <Grid item xs={12} key={advertiser.id}>
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
                    onClick={() => handleSelect(advertiser)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Business sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {advertiser.name}
                      </Typography>
                      {advertiser.status && (
                        <Chip
                          label={advertiser.status}
                          size="small"
                          color={advertiser.status === 'active' ? 'success' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {advertiser.email && `${advertiser.email} • `}
                      {advertiser.industry && `${advertiser.industry}`}
                      {advertiser.agency && ` • Agency: ${advertiser.agency}`}
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

      {/* Create New Advertiser Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Advertiser</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Company Name"
                value={newAdvertiser.name}
                onChange={(e) => setNewAdvertiser({ ...newAdvertiser, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newAdvertiser.email}
                onChange={(e) => setNewAdvertiser({ ...newAdvertiser, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Person"
                value={newAdvertiser.contactPerson}
                onChange={(e) => setNewAdvertiser({ ...newAdvertiser, contactPerson: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Industry"
                value={newAdvertiser.industry}
                onChange={(e) => setNewAdvertiser({ ...newAdvertiser, industry: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="">Select Industry</option>
                <option value="technology">Technology</option>
                <option value="finance">Finance</option>
                <option value="healthcare">Healthcare</option>
                <option value="retail">Retail</option>
                <option value="education">Education</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateAdvertiser}
            variant="contained"
            disabled={!newAdvertiser.name}
          >
            Create Advertiser
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}