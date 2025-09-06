import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Avatar,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import PersonIcon from '@mui/icons-material/Person'

interface UserActivity {
  id: string
  name: string
  email: string
  role: string
  lastLoginAt: string | null
  createdAt: string
  isActive: boolean
}

interface UserActivityDialogProps {
  open: boolean
  onClose: () => void
}

export default function UserActivityDialog({ open, onClose }: UserActivityDialogProps) {
  const [users, setUsers] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUserActivity()
    }
  }, [open])

  const fetchUserActivity = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/security/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching user activity:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'master': return '#9c27b0'
      case 'admin': return '#2196f3'
      case 'sales': return '#4caf50'
      case 'producer': return '#ff9800'
      case 'talent': return '#00bcd4'
      case 'client': return '#607d8b'
      default: return '#9e9e9e'
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    // Sort by activity status first (active users first)
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    // Then by last login date
    if (a.lastLoginAt && b.lastLoginAt) {
      return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
    }
    return a.lastLoginAt ? -1 : 1
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">User Activity</Typography>
          <Box display="flex" gap={2}>
            <Typography variant="body2" color="text.secondary">
              Active: {users.filter(u => u.isActive).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inactive: {users.filter(u => !u.isActive).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total: {users.length}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell>Account Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: getRoleColor(user.role) }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{user.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        size="small"
                        sx={{ 
                          bgcolor: getRoleColor(user.role),
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                        variant={user.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? (
                        <Box>
                          <Typography variant="body2">
                            {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(user.lastLoginAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Never logged in
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}