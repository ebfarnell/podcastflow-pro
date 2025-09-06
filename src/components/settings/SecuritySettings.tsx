import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
} from '@mui/material'
import {
  Lock as LockIcon,
  Key as KeyIcon,
  Smartphone as SmartphoneIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityApi } from '@/services/api'

interface SecuritySession {
  id: string
  device: string
  browser: string
  location: string
  lastActive: string
  isCurrent: boolean
}

interface SecuritySettings {
  twoFactorEnabled: boolean
  passwordLastChanged: string
  sessions: SecuritySession[]
  loginAlerts: boolean
  suspiciousActivityAlerts: boolean
}

export function SecuritySettings() {
  const queryClient = useQueryClient()
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [twoFactorDialog, setTwoFactorDialog] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [twoFactorForm, setTwoFactorForm] = useState({
    password: '',
    verificationCode: '',
  })

  // Fetch security settings and sessions separately
  const { data: securityData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['securitySettings'],
    queryFn: async () => {
      try {
        const response = await securityApi.getSettings()
        return response
      } catch (error) {
        console.error('Failed to fetch security settings:', error)
        throw error
      }
    },
  })
  
  // Fetch active sessions
  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/security/sessions', {
          credentials: 'include'
        })
        if (!response.ok) throw new Error('Failed to fetch sessions')
        return await response.json()
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
        return []
      }
    },
  })
  
  // Combine data
  const settings = React.useMemo(() => {
    if (!securityData) return null
    
    return {
      twoFactorEnabled: securityData.mfaRequired || false,
      passwordLastChanged: securityData.passwordPolicy?.passwordLastChanged || new Date().toISOString(),
      loginAlerts: securityData.auditSettings?.logSensitiveActions !== false,
      suspiciousActivityAlerts: securityData.auditSettings?.logSensitiveActions !== false,
      sessions: sessions || []
    } as SecuritySettings
  }, [securityData, sessions])
  
  const isLoading = isLoadingSettings || isLoadingSessions

  // Update password
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordForm) => {
      if (data.newPassword !== data.confirmPassword) {
        throw new Error('Passwords do not match')
      }
      if (data.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }
      return await securityApi.updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securitySettings'] })
      setSuccess('Password updated successfully!')
      setPasswordDialog(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update password')
    },
  })

  // Enable/disable two-factor authentication
  const toggleTwoFactorMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        // Generate QR code for 2FA setup
        const response = await securityApi.enable2FA()
        setQrCode(response.qrCode)
        return response
      } else {
        return await securityApi.disable2FA()
      }
    },
    onSuccess: (data, enabled) => {
      if (!enabled) {
        queryClient.invalidateQueries({ queryKey: ['securitySettings'] })
        setSuccess('Two-factor authentication disabled')
        setTimeout(() => setSuccess(null), 3000)
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update two-factor authentication')
    },
  })

  // Verify 2FA code
  const verify2FAMutation = useMutation({
    mutationFn: async (code: string) => {
      if (code.length !== 6) {
        throw new Error('Invalid verification code')
      }
      return await securityApi.verify2FA(code)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securitySettings'] })
      setSuccess('Two-factor authentication enabled successfully!')
      setTwoFactorDialog(false)
      setQrCode(null)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Invalid verification code')
    },
  })

  // Revoke session
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch('/api/security/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId })
      })
      if (!response.ok) throw new Error('Failed to revoke session')
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setSuccess('Session revoked successfully')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to revoke session')
    },
  })

  // Update security preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (prefs: { loginAlerts: boolean; suspiciousActivityAlerts: boolean }) => {
      return await securityApi.updatePreferences(prefs)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securitySettings'] })
      setSuccess('Security preferences updated')
      setTimeout(() => setSuccess(null), 3000)
    },
  })

  const handlePasswordUpdate = () => {
    updatePasswordMutation.mutate(passwordForm)
  }

  const handleToggle2FA = () => {
    if (settings?.twoFactorEnabled) {
      // Disable 2FA
      if (confirm('Are you sure you want to disable two-factor authentication?')) {
        toggleTwoFactorMutation.mutate(false)
      }
    } else {
      // Enable 2FA - show dialog
      setTwoFactorDialog(true)
      toggleTwoFactorMutation.mutate(true)
    }
  }

  const handleVerify2FA = () => {
    verify2FAMutation.mutate(twoFactorForm.verificationCode)
  }

  const formatLastActive = (date: string) => {
    const now = new Date()
    const lastActive = new Date(date)
    const diffInMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60)
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)} minutes ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`
    return `${Math.floor(diffInMinutes / 1440)} days ago`
  }

  const getPasswordStrength = (password: string): { strength: string; color: string } => {
    if (password.length < 8) return { strength: 'Weak', color: 'error' }
    if (password.length < 12) return { strength: 'Fair', color: 'warning' }
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      return { strength: 'Strong', color: 'success' }
    }
    return { strength: 'Good', color: 'info' }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            Loading...
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Security Settings
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Manage your account security and authentication preferences
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Password Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockIcon fontSize="small" />
              Password
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box>
                <Typography variant="body2">
                  Last changed: {new Date(settings?.passwordLastChanged || '').toLocaleDateString()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  We recommend changing your password every 90 days
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setPasswordDialog(true)}
              >
                Change Password
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Two-Factor Authentication */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartphoneIcon fontSize="small" />
              Two-Factor Authentication
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    Status:
                  </Typography>
                  {settings?.twoFactorEnabled ? (
                    <Chip
                      label="Enabled"
                      color="success"
                      size="small"
                      icon={<CheckCircleIcon />}
                    />
                  ) : (
                    <Chip
                      label="Disabled"
                      color="warning"
                      size="small"
                      icon={<WarningIcon />}
                    />
                  )}
                </Box>
                <Typography variant="caption" color="textSecondary">
                  Add an extra layer of security to your account
                </Typography>
              </Box>
              <Button
                variant={settings?.twoFactorEnabled ? 'outlined' : 'contained'}
                size="small"
                onClick={handleToggle2FA}
                color={settings?.twoFactorEnabled ? 'error' : 'primary'}
              >
                {settings?.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Security Alerts */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Security Alerts
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.loginAlerts || false}
                  onChange={(e) => updatePreferencesMutation.mutate({
                    loginAlerts: e.target.checked,
                    suspiciousActivityAlerts: settings?.suspiciousActivityAlerts || false,
                  })}
                />
              }
              label="Email me when a new device logs into my account"
              sx={{ display: 'block', mb: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.suspiciousActivityAlerts || false}
                  onChange={(e) => updatePreferencesMutation.mutate({
                    loginAlerts: settings?.loginAlerts || false,
                    suspiciousActivityAlerts: e.target.checked,
                  })}
                />
              }
              label="Alert me about suspicious activity"
              sx={{ display: 'block' }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Sessions
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Manage devices and browsers that are logged into your account
          </Typography>

          <List>
            {settings?.sessions.map((session, index) => (
              <div key={session.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {session.device}
                        {session.isCurrent && (
                          <Chip label="Current" color="primary" size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {session.browser} • {session.location}
                        <br />
                        Last active: {formatLastActive(session.lastActive)}
                      </>
                    }
                  />
                  {!session.isCurrent && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => revokeSessionMutation.mutate(session.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
                {index < settings.sessions.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Current Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="New Password"
              type={showNewPassword ? 'text' : 'password'}
              fullWidth
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      edge="end"
                    >
                      {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText={
                passwordForm.newPassword && (
                  <Chip
                    label={`Password strength: ${getPasswordStrength(passwordForm.newPassword).strength}`}
                    color={getPasswordStrength(passwordForm.newPassword).color as any}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )
              }
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              error={passwordForm.confirmPassword !== '' && passwordForm.newPassword !== passwordForm.confirmPassword}
              helperText={
                passwordForm.confirmPassword !== '' && passwordForm.newPassword !== passwordForm.confirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePasswordUpdate}
            disabled={
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmPassword ||
              passwordForm.newPassword !== passwordForm.confirmPassword ||
              updatePasswordMutation.isPending
            }
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Two-Factor Authentication Dialog */}
      <Dialog open={twoFactorDialog} onClose={() => setTwoFactorDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {qrCode ? (
              <>
                <Typography variant="body2" gutterBottom>
                  Scan this QR code with your authenticator app:
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <Box sx={{ p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                    {/* In real implementation, show actual QR code */}
                    <Box sx={{ width: 200, height: 200, bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      QR Code
                    </Box>
                  </Box>
                </Box>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 3 }}>
                  Or enter this code manually: ABCD-EFGH-IJKL-MNOP
                </Typography>
                <TextField
                  label="Verification Code"
                  fullWidth
                  value={twoFactorForm.verificationCode}
                  onChange={(e) => setTwoFactorForm({ ...twoFactorForm, verificationCode: e.target.value })}
                  placeholder="Enter 6-digit code"
                  inputProps={{ maxLength: 6 }}
                />
              </>
            ) : (
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={twoFactorForm.password}
                onChange={(e) => setTwoFactorForm({ ...twoFactorForm, password: e.target.value })}
                helperText="Enter your password to continue"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTwoFactorDialog(false)
            setQrCode(null)
          }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={qrCode ? handleVerify2FA : () => toggleTwoFactorMutation.mutate(true)}
            disabled={
              qrCode 
                ? twoFactorForm.verificationCode.length !== 6 || verify2FAMutation.isPending
                : !twoFactorForm.password || toggleTwoFactorMutation.isPending
            }
          >
            {qrCode ? 'Verify & Enable' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}