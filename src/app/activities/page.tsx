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
  Avatar,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Campaign as CampaignIcon,
  Podcasts as ShowIcon,
  PlayCircle as EpisodeIcon,
  Business as ClientIcon,
  Assignment as AssignmentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { format, formatDistanceToNow } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery } from '@tanstack/react-query'
import { activitiesApi } from '@/services/api'

interface Activity {
  activityId: string
  type: string
  action: string
  entityType: string
  entityId: string
  entityName: string
  actorId: string
  actorName: string
  actorRole: string
  details: any
  previousValue?: any
  newValue?: any
  timestamp: string
  createdAt: string
}

export default function ActivitiesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterEntity, setFilterEntity] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Fetch activities - removed auto-refresh for cost efficiency
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activities', { type: filterType !== 'all' ? filterType : undefined }],
    queryFn: () => activitiesApi.list({ 
      type: filterType !== 'all' ? filterType : undefined,
      limit: 100
    }),
    // User can manually refresh if needed
    // refetchInterval: 10000, // Removed - was causing excessive API calls
  })

  const activities = data?.activities || []
  const filteredActivities = activities.filter((activity: Activity) => {
    const matchesSearch = 
      activity.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.actorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.type?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesEntity = filterEntity === 'all' || activity.entityType === filterEntity
    
    return matchesSearch && matchesEntity
  })

  const getActivityIcon = (activity: Activity) => {
    switch (activity.entityType?.toLowerCase()) {
      case 'campaign':
        return <CampaignIcon />
      case 'show':
        return <ShowIcon />
      case 'episode':
        return <EpisodeIcon />
      case 'client':
        return <ClientIcon />
      case 'user':
        return <PersonIcon />
      default:
        switch (activity.type) {
          case 'role_assignment':
          case 'team_assignment':
            return <AssignmentIcon />
          case 'permission_granted':
          case 'permission_revoked':
            return <SecurityIcon />
          case 'settings_updated':
            return <SettingsIcon />
          default:
            return <AssignmentIcon />
        }
    }
  }

  const getActivityColor = (activity: Activity) => {
    switch (activity.action?.toLowerCase()) {
      case 'created':
      case 'added':
      case 'granted':
        return 'success.main'
      case 'deleted':
      case 'removed':
      case 'revoked':
        return 'error.main'
      case 'updated':
      case 'changed':
      case 'assigned':
        return 'primary.main'
      default:
        return 'grey.600'
    }
  }

  const formatActivityDescription = (activity: Activity) => {
    const { type, action, entityType, entityName, details } = activity
    
    // Build a human-readable description
    let description = `${action} ${entityType} "${entityName}"`
    
    // Add specific details based on activity type
    if (type === 'team_assignment' && details?.teamRole) {
      description += ` as ${details.teamRole}`
    } else if (type === 'role_assignment' && details?.newRole) {
      description += ` to ${details.newRole}`
    } else if (type === 'status_changed' && activity.newValue) {
      description += ` from ${activity.previousValue} to ${activity.newValue}`
    } else if (type === 'permission_granted' && details?.permission) {
      description += ` permission: ${details.permission}`
    }
    
    return description
  }

  const handleShowDetails = (activity: Activity) => {
    setSelectedActivity(activity)
    setDetailsOpen(true)
  }

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'user_created', label: 'User Created' },
    { value: 'user_updated', label: 'User Updated' },
    { value: 'user_deleted', label: 'User Deleted' },
    { value: 'role_assignment', label: 'Role Assignments' },
    { value: 'team_assignment', label: 'Team Assignments' },
    { value: 'campaign_created', label: 'Campaign Created' },
    { value: 'campaign_updated', label: 'Campaign Updated' },
    { value: 'show_created', label: 'Show Created' },
    { value: 'episode_created', label: 'Episode Created' },
    { value: 'client_created', label: 'Client Created' },
    { value: 'permission_granted', label: 'Permissions Granted' },
    { value: 'permission_revoked', label: 'Permissions Revoked' },
  ]

  const entityTypes = [
    { value: 'all', label: 'All Entities' },
    { value: 'user', label: 'Users' },
    { value: 'campaign', label: 'Campaigns' },
    { value: 'show', label: 'Shows' },
    { value: 'episode', label: 'Episodes' },
    { value: 'client', label: 'Clients' },
    { value: 'role', label: 'Roles' },
  ]

  if (error) {
    return (
      <DashboardLayout>
        <Alert severity="error">Failed to load activities</Alert>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Activity Feed
          </Typography>
          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Box>

        <Card>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search activities..."
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
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Activity Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Activity Type"
              >
                {activityTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                label="Entity Type"
              >
                {entityTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Divider />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : filteredActivities.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No activities found
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {filteredActivities.map((activity: Activity, index: number) => (
                <React.Fragment key={activity.activityId}>
                  <ListItem
                    button
                    onClick={() => handleShowDetails(activity)}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getActivityColor(activity) }}>
                        {getActivityIcon(activity)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {activity.actorName}
                          </Typography>
                          <Chip
                            label={activity.actorRole}
                            size="small"
                            sx={{ height: 20 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {formatActivityDescription(activity)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          {' • '}
                          {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {index < filteredActivities.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Card>
      </Box>

      {/* Activity Details Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Activity Details
        </DialogTitle>
        <DialogContent>
          {selectedActivity && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Actor
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {selectedActivity.actorName} ({selectedActivity.actorRole})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {selectedActivity.actorId}
                </Typography>
              </Box>

              <Typography variant="subtitle2" gutterBottom>
                Action
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {selectedActivity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedActivity.action}
                </Typography>
              </Box>

              {selectedActivity.entityType && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Entity
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      {selectedActivity.entityType}: {selectedActivity.entityName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {selectedActivity.entityId}
                    </Typography>
                  </Box>
                </>
              )}

              {selectedActivity.previousValue && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Previous Value
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedActivity.previousValue, null, 2)}
                    </Typography>
                  </Box>
                </>
              )}

              {selectedActivity.newValue && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    New Value
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedActivity.newValue, null, 2)}
                    </Typography>
                  </Box>
                </>
              )}

              {selectedActivity.details && Object.keys(selectedActivity.details).length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Additional Details
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedActivity.details, null, 2)}
                    </Typography>
                  </Box>
                </>
              )}

              <Typography variant="subtitle2" gutterBottom>
                Timestamp
              </Typography>
              <Typography variant="body2">
                {format(new Date(selectedActivity.timestamp), 'MMMM d, yyyy h:mm:ss a')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}