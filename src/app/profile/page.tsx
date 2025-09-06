'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { userApi } from '@/services/api'
import { 
  Person, 
  Security, 
  Notifications, 
  Save, 
  Edit, 
  Delete,
  Email,
  Phone,
  Business
} from '@mui/icons-material'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  organizationId: string
  phone?: string
  title?: string
  department?: string
  timezone?: string
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
  lastLoginAt?: string
  createdAt: string
}

interface PasswordChangeData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ProfilePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({})
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch current user profile
  const { data: user, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: userApi.getCurrentUser,
    onSuccess: (data) => {
      setProfileData(data)
    }
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => userApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setErrors({})
    },
    onError: (error: any) => {
      console.error('Profile update failed:', error)
    }
  })

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordChangeData) => userApi.changePassword(data),
    onSuccess: () => {
      setPasswordDialog(false)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setErrors({})
    },
    onError: (error: any) => {
      setErrors({ password: 'Failed to change password. Please check your current password.' })
    }
  })

  const handleInputChange = (field: string, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePasswordChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!profileData.name?.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!profileData.email?.trim()) {
      newErrors.email = 'Email is required'
    }
    if (profileData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      newErrors.email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required'
    }
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required'
    }
    if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters'
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveProfile = () => {
    if (!validateProfile()) return
    updateProfileMutation.mutate(profileData)
  }

  const handleChangePassword = () => {
    if (!validatePassword()) return
    changePasswordMutation.mutate(passwordData)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography>Loading profile...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            My Profile
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your account settings and preferences
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Profile Section */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Avatar
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    mx: 'auto', 
                    mb: 2,
                    bgcolor: 'primary.main',
                    fontSize: '2rem'
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {user?.name}
                </Typography>
                <Chip 
                  label={user?.role} 
                  color="primary" 
                  size="small"
                  sx={{ mb: 2, textTransform: 'capitalize' }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <Email sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  {user?.email}
                </Typography>
                {user?.phone && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <Phone sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    {user.phone}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block">
                  Member since {new Date(user?.createdAt || '').toLocaleDateString()}
                </Typography>
                {user?.lastLoginAt && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Main Content */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 0 }}>
                {/* Tab Navigation */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 3 }}>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Button
                      variant={activeTab === 'profile' ? 'contained' : 'text'}
                      onClick={() => setActiveTab('profile')}
                      startIcon={<Person />}
                      size="small"
                    >
                      Profile Info
                    </Button>
                    <Button
                      variant={activeTab === 'security' ? 'contained' : 'text'}
                      onClick={() => setActiveTab('security')}
                      startIcon={<Security />}
                      size="small"
                    >
                      Security
                    </Button>
                    <Button
                      variant={activeTab === 'notifications' ? 'contained' : 'text'}
                      onClick={() => setActiveTab('notifications')}
                      startIcon={<Notifications />}
                      size="small"
                    >
                      Notifications
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ p: 3 }}>
                  {/* Profile Info Tab */}
                  {activeTab === 'profile' && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 3 }}>
                        Profile Information
                      </Typography>
                      
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Full Name"
                            fullWidth
                            required
                            value={profileData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            error={!!errors.name}
                            helperText={errors.name}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Email"
                            fullWidth
                            required
                            value={profileData.email || ''}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            error={!!errors.email}
                            helperText={errors.email}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Phone"
                            fullWidth
                            value={profileData.phone || ''}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Job Title"
                            fullWidth
                            value={profileData.title || ''}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Department"
                            fullWidth
                            value={profileData.department || ''}
                            onChange={(e) => handleInputChange('department', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Timezone</InputLabel>
                            <Select
                              value={profileData.timezone || 'America/New_York'}
                              onChange={(e) => handleInputChange('timezone', e.target.value)}
                              label="Timezone"
                            >
                              <MenuItem value="America/New_York">Eastern Time</MenuItem>
                              <MenuItem value="America/Chicago">Central Time</MenuItem>
                              <MenuItem value="America/Denver">Mountain Time</MenuItem>
                              <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                              <MenuItem value="UTC">UTC</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>

                      {updateProfileMutation.isError && (
                        <Alert severity="error" sx={{ mt: 3 }}>
                          Failed to update profile. Please try again.
                        </Alert>
                      )}

                      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="contained"
                          startIcon={<Save />}
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                        >
                          Save Changes
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Security Tab */}
                  {activeTab === 'security' && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 3 }}>
                        Security Settings
                      </Typography>
                      
                      <List>
                        <ListItem>
                          <ListItemText
                            primary="Password"
                            secondary="Change your account password"
                          />
                          <ListItemSecondaryAction>
                            <Button
                              variant="outlined"
                              onClick={() => setPasswordDialog(true)}
                            >
                              Change Password
                            </Button>
                          </ListItemSecondaryAction>
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText
                            primary="Two-Factor Authentication"
                            secondary="Add an extra layer of security to your account"
                          />
                          <ListItemSecondaryAction>
                            <Switch disabled />
                          </ListItemSecondaryAction>
                        </ListItem>
                      </List>
                    </Box>
                  )}

                  {/* Notifications Tab */}
                  {activeTab === 'notifications' && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 3 }}>
                        Notification Preferences
                      </Typography>
                      
                      <List>
                        <ListItem>
                          <ListItemText
                            primary="Email Notifications"
                            secondary="Receive notifications via email"
                          />
                          <ListItemSecondaryAction>
                            <Switch
                              checked={profileData.emailNotifications ?? true}
                              onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText
                            primary="Push Notifications"
                            secondary="Receive browser push notifications"
                          />
                          <ListItemSecondaryAction>
                            <Switch
                              checked={profileData.pushNotifications ?? false}
                              onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                        <Divider />
                        <ListItem>
                          <ListItemText
                            primary="Marketing Emails"
                            secondary="Receive marketing and promotional emails"
                          />
                          <ListItemSecondaryAction>
                            <Switch
                              checked={profileData.marketingEmails ?? false}
                              onChange={(e) => handleInputChange('marketingEmails', e.target.checked)}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      </List>

                      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="contained"
                          startIcon={<Save />}
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                        >
                          Save Preferences
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Password Change Dialog */}
        <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Change Password</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label="Current Password"
                    type="password"
                    fullWidth
                    required
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                    error={!!errors.currentPassword}
                    helperText={errors.currentPassword}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    required
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                    error={!!errors.newPassword}
                    helperText={errors.newPassword || 'Must be at least 8 characters'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Confirm New Password"
                    type="password"
                    fullWidth
                    required
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword}
                  />
                </Grid>
              </Grid>

              {errors.password && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.password}
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
            >
              Change Password
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}