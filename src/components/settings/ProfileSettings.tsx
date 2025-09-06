import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Typography,
  Avatar,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material'
import { PhotoCamera } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '@/services/api'

export function ProfileSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    department: '',
    bio: '',
    timezone: 'America/New_York',
    language: 'en',
  })

  // Fetch profile data
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: userApi.getProfile,
  })

  // Update form data when profile loads
  useEffect(() => {
    if (profileData) {
      setFormData({
        name: profileData.name || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        title: profileData.title || '',
        department: profileData.department || '',
        bio: profileData.bio || '',
        timezone: profileData.timezone || 'America/New_York',
        language: profileData.language || 'en',
      })
    }
  }, [profileData])

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => userApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      setSuccess(true)
      setError(null)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update profile')
      setSuccess(false)
    },
  })

  const handleSave = async () => {
    setError(null)
    updateProfileMutation.mutate({
      name: formData.name,
      phone: formData.phone,
      title: formData.title,
      department: formData.department,
      bio: formData.bio,
      timezone: formData.timezone,
      language: formData.language,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Profile Settings
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Manage your personal information and preferences
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile updated successfully!
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar
            sx={{ width: 100, height: 100, mr: 3 }}
            src={profileData?.avatar || undefined}
          >
            {formData.name.split(' ').map(n => n[0]).join('')}
          </Avatar>
          <Box>
            <Button
              variant="outlined"
              component="label"
              startIcon={<PhotoCamera />}
            >
              Change Photo
              <input type="file" hidden accept="image/*" />
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              JPG, GIF or PNG. Max size of 5MB
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Full Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={formData.email}
              disabled
              helperText="Contact support to change your email"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Phone Number"
              fullWidth
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Job Title"
              fullWidth
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Marketing Manager"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Department"
              fullWidth
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Sales, Marketing, Production"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Timezone"
              select
              fullWidth
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="America/New_York">Eastern Time (US & Canada)</option>
              <option value="America/Chicago">Central Time (US & Canada)</option>
              <option value="America/Denver">Mountain Time (US & Canada)</option>
              <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Language"
              select
              fullWidth
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Bio"
              fullWidth
              multiline
              rows={4}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              helperText="A brief description about your role and experience"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outlined">
            Cancel
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}