import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  Grid,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
} from '@mui/material'
import {
  Add as AddIcon,
  PlayCircle as PlayIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface CampaignAdCreativeProps {
  campaignId: string
}

export function CampaignAdCreative({ campaignId }: CampaignAdCreativeProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([])

  // Fetch creatives for this campaign
  const { data: creatives = [], isLoading, error } = useQuery({
    queryKey: ['campaign-creatives', campaignId],
    queryFn: async () => {
      const response = await api.get(`/creatives?campaignId=${campaignId}`)
      return response.data.creatives || []
    },
  })

  // Fetch all available creatives for linking
  const { data: availableCreatives = [] } = useQuery({
    queryKey: ['available-creatives'],
    queryFn: async () => {
      const response = await api.get('/creatives?status=active')
      return response.data.creatives || []
    },
    enabled: linkDialogOpen,
  })

  // Link creatives mutation
  const linkMutation = useMutation({
    mutationFn: async (creativeIds: string[]) => {
      // Track usage for each creative
      const promises = creativeIds.map((creativeId) =>
        api.post(`/creatives/${creativeId}/usage`, {
          entityType: 'campaign',
          entityId: campaignId,
          startDate: new Date().toISOString(),
        })
      )
      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-creatives', campaignId] })
      setLinkDialogOpen(false)
      setSelectedCreatives([])
    },
  })

  const handleCreateNew = () => {
    router.push('/post-sale?tab=creative&action=create')
  }

  const handleLinkExisting = () => {
    setLinkDialogOpen(true)
  }

  const handleToggleCreative = (creativeId: string) => {
    setSelectedCreatives((prev) =>
      prev.includes(creativeId)
        ? prev.filter((id) => id !== creativeId)
        : [...prev, creativeId]
    )
  }

  const handleLinkSelected = () => {
    if (selectedCreatives.length > 0) {
      linkMutation.mutate(selectedCreatives)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pre-roll':
        return 'primary'
      case 'mid-roll':
        return 'secondary'
      case 'post-roll':
        return 'info'
      case 'host-read':
        return 'success'
      default:
        return 'default'
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load creatives. Please try again.
      </Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Campaign Creatives</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            onClick={handleLinkExisting}
          >
            Link Existing
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
          >
            Create New
          </Button>
        </Box>
      </Box>

      {creatives.length === 0 ? (
        <Alert severity="info">
          No creatives linked to this campaign yet. Create a new creative or link existing ones from your library.
        </Alert>
      ) : (
        <Grid container spacing={3}>
        {creatives.map((creative) => (
          <Grid item xs={12} md={6} key={creative.id}>
            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {creative.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip
                      label={creative.type}
                      size="small"
                      color={getTypeColor(creative.type)}
                    />
                    <Chip
                      label={`${creative.duration}s`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={creative.status}
                      size="small"
                      color={creative.status === 'active' ? 'success' : 'default'}
                    />
                  </Box>
                </Box>
                <Box>
                  <IconButton 
                    size="small" 
                    onClick={() => router.push(`/creatives/${creative.id}`)}
                  >
                    <EditIcon />
                  </IconButton>
                </Box>
              </Box>

              {creative.script && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Script
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      bgcolor: 'grey.50',
                      p: 2,
                      borderRadius: 1,
                      maxHeight: 150,
                      overflow: 'auto',
                    }}
                  >
                    {creative.script}
                  </Typography>
                </Box>
              )}

              {creative.audioUrl && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<PlayIcon />}
                    variant="outlined"
                  >
                    Preview
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    variant="outlined"
                  >
                    Download
                  </Button>
                </Box>
              )}

              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
                Created {new Date(creative.createdAt).toLocaleDateString()}
              </Typography>
            </Card>
          </Grid>
        ))}
        </Grid>
      )}

      {/* Link Existing Creatives Dialog */}
      <Dialog 
        open={linkDialogOpen} 
        onClose={() => {
          setLinkDialogOpen(false)
          setSelectedCreatives([])
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Link Existing Creatives
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select creatives from your library to link to this campaign
          </Typography>
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {availableCreatives
              .filter((creative: any) => 
                // Don't show creatives already linked to this campaign
                creative.campaignId !== campaignId
              )
              .map((creative: any) => (
                <ListItem key={creative.id} disablePadding>
                  <ListItemButton onClick={() => handleToggleCreative(creative.id)}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedCreatives.includes(creative.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={creative.name}
                      secondary={
                        <Box>
                          <Chip 
                            label={creative.type} 
                            size="small" 
                            sx={{ mr: 1 }}
                            color={getTypeColor(creative.type) as any}
                          />
                          <Chip 
                            label={creative.format} 
                            size="small" 
                            variant="outlined"
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={`${creative.duration}s`} 
                            size="small" 
                            variant="outlined"
                          />
                          {creative.advertiser && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              {creative.advertiser.name}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
          
          {availableCreatives.filter((c: any) => c.campaignId !== campaignId).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary">
                No available creatives to link. Create new creatives first.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              {selectedCreatives.length} creative{selectedCreatives.length !== 1 ? 's' : ''} selected
            </Typography>
            <Box>
              <Button onClick={() => {
                setLinkDialogOpen(false)
                setSelectedCreatives([])
              }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleLinkSelected}
                disabled={selectedCreatives.length === 0 || linkMutation.isPending}
              >
                {linkMutation.isPending ? 'Linking...' : 'Link Selected'}
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  )
}