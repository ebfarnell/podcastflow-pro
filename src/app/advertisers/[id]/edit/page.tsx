'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Cancel,
  Add,
  Edit,
  Delete,
  PersonAdd,
  CheckCircle,
  Schedule,
  Block,
  Email,
  Phone,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface AdvertiserFormData {
  name: string
  industry: string
  email: string
  phone: string
  website: string
  notes: string
  agencyId: string
  status: 'active' | 'inactive'
  address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
}

interface Contact {
  id?: string
  name: string
  title: string
  email: string
  phone: string
  isPrimary: boolean
  userId?: string
  userStatus?: 'active' | 'invited' | 'deactivated' | null
  userRole?: string
  inviteStatus?: string
  invitedAt?: string
  isNew?: boolean
  isEditing?: boolean
}

interface Agency {
  id: string
  name: string
}

export default function EditAdvertiserPage() {
  const params = useParams()
  const router = useRouter()
  const advertiserId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [formData, setFormData] = useState<AdvertiserFormData>({
    name: '',
    industry: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    agencyId: '',
    status: 'active',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    }
  })

  const [hasChanges, setHasChanges] = useState(false)

  // Fetch advertiser data, contacts, and agencies on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch advertiser data
        const advertiserResponse = await fetch(`/api/advertisers/${advertiserId}`)
        if (!advertiserResponse.ok) {
          throw new Error('Failed to fetch advertiser')
        }
        const advertiserData = await advertiserResponse.json()

        // Map the API response to form data
        setFormData({
          name: advertiserData.name || '',
          industry: advertiserData.industry || '',
          email: advertiserData.email || advertiserData.contactEmail || '',
          phone: advertiserData.phone || advertiserData.contactPhone || '',
          website: advertiserData.website || '',
          notes: advertiserData.notes || '',
          agencyId: advertiserData.agencyId || '',
          status: advertiserData.status === 'active' ? 'active' : 'inactive',
          address: {
            street: advertiserData.address?.street || '',
            city: advertiserData.address?.city || '',
            state: advertiserData.address?.state || '',
            zip: advertiserData.address?.zip || '',
            country: advertiserData.address?.country || 'USA'
          }
        })

        // Fetch contacts
        const contactsResponse = await fetch(`/api/contacts?advertiserId=${advertiserId}`)
        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json()
          setContacts(contactsData)
        }

        // Fetch agencies for dropdown
        const agenciesResponse = await fetch('/api/agencies')
        if (agenciesResponse.ok) {
          const agenciesData = await agenciesResponse.json()
          setAgencies(agenciesData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        alert('Failed to load advertiser data')
        router.push('/advertisers')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [advertiserId, router])

  const handleInputChange = (field: keyof AdvertiserFormData | string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '') as keyof typeof formData.address
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/advertisers/${advertiserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          industry: formData.industry,
          website: formData.website,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes,
          agencyId: formData.agencyId || null
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update advertiser')
      }

      // Contacts are now saved immediately when added/edited, no need to save them here

      alert('Advertiser updated successfully!')
      setHasChanges(false)
      router.push('/advertisers')
    } catch (error) {
      console.error('Error updating advertiser:', error)
      alert('Failed to update advertiser. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        router.push('/advertisers')
      }
    } else {
      router.push('/advertisers')
    }
  }

  const handleAddContact = () => {
    setEditingContact({
      name: '',
      title: '',
      email: '',
      phone: '',
      isPrimary: false,
      isNew: true,
      isEditing: true
    })
    setShowContactDialog(true)
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact({ ...contact, isEditing: true })
    setShowContactDialog(true)
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      setContacts(prev => prev.filter(c => c.id !== contactId))
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  const handleSaveContact = async () => {
    if (!editingContact?.name || !editingContact?.email) {
      alert('Name and email are required')
      return
    }

    try {
      if (editingContact.isNew) {
        // Immediately save new contact to database
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            advertiserId,
            name: editingContact.name,
            title: editingContact.title,
            email: editingContact.email,
            phone: editingContact.phone,
            isPrimary: editingContact.isPrimary
          })
        })

        if (!response.ok) {
          throw new Error('Failed to create contact')
        }

        const newContact = await response.json()
        setContacts(prev => [...prev, newContact])
      } else {
        // Update existing contact immediately
        const response = await fetch('/api/contacts', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contacts: [{
              id: editingContact.id,
              name: editingContact.name,
              title: editingContact.title,
              email: editingContact.email,
              phone: editingContact.phone,
              isPrimary: editingContact.isPrimary
            }]
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update contact')
        }

        setContacts(prev => prev.map(c => 
          c.id === editingContact.id ? editingContact : c
        ))
      }

      setShowContactDialog(false)
      setEditingContact(null)
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Failed to save contact. Please try again.')
    }
  }

  const handleInviteContact = async (contact: Contact) => {
    if (!contact.id || contact.isNew) {
      alert('Please save the contact first before sending an invitation')
      return
    }

    setSendingInvite(contact.id)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/invite`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      alert('Invitation sent successfully!')
      
      // Refresh contacts to get updated status
      const contactsResponse = await fetch(`/api/contacts?advertiserId=${advertiserId}`)
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        setContacts(contactsData)
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      alert(error.message || 'Failed to send invitation')
    } finally {
      setSendingInvite(null)
    }
  }

  const getUserStatusChip = (contact: Contact) => {
    if (!contact.userStatus) {
      return (
        <Tooltip title="No PodcastFlow account">
          <Button
            size="small"
            variant="outlined"
            startIcon={<PersonAdd />}
            onClick={() => handleInviteContact(contact)}
            disabled={sendingInvite === contact.id || contact.isNew}
          >
            {sendingInvite === contact.id ? 'Sending...' : 'Invite'}
          </Button>
        </Tooltip>
      )
    }

    switch (contact.userStatus) {
      case 'active':
        return (
          <Chip
            icon={<CheckCircle />}
            label="Active"
            color="success"
            size="small"
          />
        )
      case 'invited':
        return (
          <Chip
            icon={<Schedule />}
            label="Invited"
            color="warning"
            size="small"
          />
        )
      case 'deactivated':
        return (
          <Chip
            icon={<Block />}
            label="Deactivated"
            color="error"
            size="small"
          />
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Edit Advertiser
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update advertiser information and manage contacts
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/advertisers')}
          >
            Back to Advertisers
          </Button>
        </Box>

        {hasChanges && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You have unsaved changes. Don't forget to save your modifications.
          </Alert>
        )}

        {/* Basic Information */}
        <Paper sx={{ p: 4, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Industry</InputLabel>
                <Select
                  value={formData.industry}
                  label="Industry"
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                >
                  <MenuItem value="Technology">Technology</MenuItem>
                  <MenuItem value="Healthcare">Healthcare</MenuItem>
                  <MenuItem value="Finance">Finance</MenuItem>
                  <MenuItem value="Retail">Retail</MenuItem>
                  <MenuItem value="Manufacturing">Manufacturing</MenuItem>
                  <MenuItem value="Education">Education</MenuItem>
                  <MenuItem value="Entertainment">Entertainment</MenuItem>
                  <MenuItem value="Automotive">Automotive</MenuItem>
                  <MenuItem value="Real Estate">Real Estate</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://example.com"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="prospect">Prospect</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Primary Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Primary Phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Address Information
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                value={formData.address.street}
                onChange={(e) => handleInputChange('address.street', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.address.city}
                onChange={(e) => handleInputChange('address.city', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="State"
                value={formData.address.state}
                onChange={(e) => handleInputChange('address.state', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="ZIP Code"
                value={formData.address.zip}
                onChange={(e) => handleInputChange('address.zip', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Agency Partnership
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Agency</InputLabel>
                <Select
                  value={formData.agencyId}
                  label="Agency"
                  onChange={(e) => handleInputChange('agencyId', e.target.value)}
                >
                  <MenuItem value="">No Agency</MenuItem>
                  {agencies.map(agency => (
                    <MenuItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Contacts Section */}
        <Paper sx={{ p: 4, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Contacts ({contacts.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddContact}
            >
              Add Contact
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell align="center">Primary</TableCell>
                  <TableCell align="center">Account Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No contacts added yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact, index) => (
                    <TableRow key={contact.id || `new-${index}`}>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell>{contact.title || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Email fontSize="small" color="action" />
                          {contact.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Phone fontSize="small" color="action" />
                            {contact.phone}
                          </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="center">
                        {contact.isPrimary && (
                          <Chip label="Primary" color="primary" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {getUserStatusChip(contact)}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit />
                        </IconButton>
                        {contact.id && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteContact(contact.id!)}
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {/* Contact Dialog */}
      <Dialog
        open={showContactDialog}
        onClose={() => setShowContactDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingContact?.isNew ? 'Add New Contact' : 'Edit Contact'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={editingContact?.name || ''}
                onChange={(e) => setEditingContact(prev => prev ? { ...prev, name: e.target.value } : null)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={editingContact?.title || ''}
                onChange={(e) => setEditingContact(prev => prev ? { ...prev, title: e.target.value } : null)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editingContact?.email || ''}
                onChange={(e) => setEditingContact(prev => prev ? { ...prev, email: e.target.value } : null)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                value={editingContact?.phone || ''}
                onChange={(e) => setEditingContact(prev => prev ? { ...prev, phone: e.target.value } : null)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Primary Contact</InputLabel>
                <Select
                  value={editingContact?.isPrimary ? 'yes' : 'no'}
                  label="Primary Contact"
                  onChange={(e) => setEditingContact(prev => prev ? { ...prev, isPrimary: e.target.value === 'yes' } : null)}
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContactDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveContact}>
            Save Contact
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}