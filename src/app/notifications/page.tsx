'use client'

import React, { useState } from 'react'
import {
  Box,
  Card,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Button,
  Chip,
  Checkbox,
  Divider,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UnreadIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  DoneAll as DoneAllIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material'
import { format, formatDistanceToNow } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/services/api'
import { useRouter } from 'next/navigation'

interface Notification {
  notificationId: string
  type: string
  title: string
  message: string
  read: boolean
  readAt: string | null
  priority: string
  data: any
  senderName: string
  senderRole: string
  createdAt: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null)
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null)

  // Fetch notifications
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', { type: filterType, unreadOnly: filterStatus === 'unread' }],
    queryFn: () => notificationsApi.list({ 
      type: filterType !== 'all' ? filterType : undefined,
      unreadOnly: filterStatus === 'unread'
    }),
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) => notificationsApi.markBatchAsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setSelectedNotifications([])
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (notificationIds: string[]) => notificationsApi.deleteBatch(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setSelectedNotifications([])
    },
  })

  const notifications = data?.notifications || []
  const filteredNotifications = notifications.filter((n: Notification) =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(filteredNotifications.map((n: Notification) => n.notificationId))
    }
  }

  const handleSelect = (notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    )
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      await notificationsApi.markAsRead(notification.notificationId)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    // Navigate based on notification type and data
    const { type, data } = notification
    
    switch (type) {
      case 'team_assignment':
      case 'campaign_update':
        if (data.campaignId) {
          router.push(`/campaigns/${data.campaignId}`)
        }
        break
      case 'show_assignment':
        if (data.showId) {
          router.push(`/shows/${data.showId}`)
        }
        break
      case 'episode_assignment':
        if (data.episodeId) {
          router.push(`/episodes/${data.episodeId}`)
        }
        break
      case 'client_assignment':
        if (data.clientId) {
          router.push(`/clients/${data.clientId}`)
        }
        break
    }
  }

  const handleMarkSelectedAsRead = () => {
    const unreadSelected = selectedNotifications.filter(id => {
      const notification = notifications.find((n: Notification) => n.notificationId === id)
      return notification && !notification.read
    })
    
    if (unreadSelected.length > 0) {
      markAsReadMutation.mutate(unreadSelected)
    }
  }

  const handleDeleteSelected = () => {
    if (selectedNotifications.length > 0 && confirm('Are you sure you want to delete the selected notifications?')) {
      deleteMutation.mutate(selectedNotifications)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'team_assignment':
      case 'role_assignment':
        return <PeopleIcon />
      case 'campaign_update':
        return <CampaignIcon />
      case 'show_assignment':
      case 'episode_assignment':
        return <AssignmentIcon />
      case 'deadline_reminder':
        return <ScheduleIcon />
      case 'approval_request':
        return <CheckCircleIcon />
      case 'system_alert':
        return <WarningIcon />
      default:
        return <InfoIcon />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'default'
    }
  }

  const notificationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'team_assignment', label: 'Team Assignments' },
    { value: 'campaign_update', label: 'Campaign Updates' },
    { value: 'show_assignment', label: 'Show Assignments' },
    { value: 'episode_assignment', label: 'Episode Assignments' },
    { value: 'client_assignment', label: 'Client Assignments' },
    { value: 'deadline_reminder', label: 'Deadline Reminders' },
    { value: 'system_alert', label: 'System Alerts' },
  ]

  if (error) {
    return (
      <DashboardLayout>
        <Alert severity="error">Failed to load notifications</Alert>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Notifications
          </Typography>
          {selectedNotifications.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<DoneAllIcon />}
                onClick={handleMarkSelectedAsRead}
                disabled={markAsReadMutation.isPending}
              >
                Mark as Read
              </Button>
              <Button
                startIcon={<DeleteSweepIcon />}
                onClick={handleDeleteSelected}
                color="error"
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </Box>
          )}
        </Box>

        <Card>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search notifications..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <IconButton onClick={(e) => setFilterAnchorEl(e.currentTarget)}>
              <FilterIcon />
            </IconButton>
            <IconButton onClick={(e) => setActionAnchorEl(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
          </Box>
          <Divider />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications found
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              <ListItem sx={{ backgroundColor: 'grey.100' }}>
                <Checkbox
                  checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                  indeterminate={selectedNotifications.length > 0 && selectedNotifications.length < filteredNotifications.length}
                  onChange={handleSelectAll}
                />
                <ListItemText
                  primary={
                    <Typography variant="caption" color="text.secondary">
                      {selectedNotifications.length > 0
                        ? `${selectedNotifications.length} selected`
                        : 'Select all'}
                    </Typography>
                  }
                />
              </ListItem>
              <Divider />

              {filteredNotifications.map((notification: Notification) => (
                <React.Fragment key={notification.notificationId}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <Checkbox
                      checked={selectedNotifications.includes(notification.notificationId)}
                      onChange={() => handleSelect(notification.notificationId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: notification.read ? 'grey.400' : 'primary.main' }}>
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      onClick={() => handleNotificationClick(notification)}
                      sx={{ cursor: 'pointer' }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}
                          >
                            {notification.title}
                          </Typography>
                          {notification.priority !== 'normal' && (
                            <Chip
                              label={notification.priority}
                              size="small"
                              color={getPriorityColor(notification.priority) as any}
                              sx={{ height: 20 }}
                            />
                          )}
                          {!notification.read && (
                            <Tooltip title="Unread">
                              <UnreadIcon color="primary" sx={{ fontSize: 16 }} />
                            </Tooltip>
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.primary"
                            sx={{ display: 'block' }}
                          >
                            {notification.message}
                          </Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            From {notification.senderName} • {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            {notification.readAt && ` • Read ${format(new Date(notification.readAt), 'MMM d, h:mm a')}`}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => {
                          if (confirm('Delete this notification?')) {
                            deleteMutation.mutate([notification.notificationId])
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </Card>
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Filter by Type</Typography>
        </MenuItem>
        {notificationTypes.map(type => (
          <MenuItem
            key={type.value}
            selected={filterType === type.value}
            onClick={() => {
              setFilterType(type.value)
              setFilterAnchorEl(null)
            }}
          >
            {type.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled>
          <Typography variant="subtitle2">Filter by Status</Typography>
        </MenuItem>
        <MenuItem
          selected={filterStatus === 'all'}
          onClick={() => {
            setFilterStatus('all')
            setFilterAnchorEl(null)
          }}
        >
          All Notifications
        </MenuItem>
        <MenuItem
          selected={filterStatus === 'unread'}
          onClick={() => {
            setFilterStatus('unread')
            setFilterAnchorEl(null)
          }}
        >
          Unread Only
        </MenuItem>
      </Menu>

      {/* Action Menu */}
      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={() => setActionAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            const unreadIds = notifications
              .filter((n: Notification) => !n.read)
              .map((n: Notification) => n.notificationId)
            
            if (unreadIds.length > 0) {
              markAsReadMutation.mutate(unreadIds)
            }
            setActionAnchorEl(null)
          }}
        >
          Mark All as Read
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (confirm('Delete all notifications?')) {
              const allIds = notifications.map((n: Notification) => n.notificationId)
              deleteMutation.mutate(allIds)
            }
            setActionAnchorEl(null)
          }}
        >
          Delete All
        </MenuItem>
      </Menu>
    </DashboardLayout>
  )
}