import React, { useState, useEffect } from 'react'
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  Button,
  Divider,
  CircularProgress,
  Chip,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
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
  createdAt: string
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  // Fetch notifications - optimized for cost efficiency
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', { limit: 10 }],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    // Removed automatic polling - notifications will refresh on user interaction
    // refetchInterval: 30000, // Removed for cost efficiency
    refetchOnWindowFocus: false, // Disable refetch on window focus
    staleTime: 10 * 60 * 1000, // 10 minutes - notifications don't change often
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) => notificationsApi.markBatchAsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setAnchorEl(null)
    },
  })

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      markAsReadMutation.mutate(notification.notificationId)
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
      default:
        // Just mark as read
    }

    handleClose()
  }

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications
      .filter((n: Notification) => !n.read)
      .map((n: Notification) => n.notificationId)
    
    if (unreadIds.length > 0) {
      markAllAsReadMutation.mutate(unreadIds)
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

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label="notifications"
      >
        <Badge badgeContent={unreadCount} color="error">
          {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </Box>
        <Divider />

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {notifications.map((notification: Notification) => (
              <React.Fragment key={notification.notificationId}>
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: notification.read ? 'grey.400' : 'primary.main' }}>
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
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
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              handleClose()
              router.push('/notifications')
            }}
          >
            View all notifications
          </Button>
        </Box>
      </Menu>
    </>
  )
}