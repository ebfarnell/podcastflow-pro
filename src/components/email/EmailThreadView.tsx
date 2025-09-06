'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  IconButton
} from '@mui/material'
import {
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Campaign as CampaignIcon,
  AttachFile as AttachmentIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
  TouchApp as ClickIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

interface EmailDetail {
  id: string
  toEmail: string
  fromEmail: string
  subject: string
  status: string
  templateKey: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  bounceType: string | null
  bounceReason: string | null
  complainedAt: string | null
  createdAt: string
  seller: {
    name: string
    email: string
  } | null
  advertiser: string | null
  advertiserId: string | null
  agency: string | null
  agencyId: string | null
  campaign: string | null
  campaignId: string | null
  threadId: string | null
  conversationId: string | null
  body: {
    html: string | null
    text: string | null
    cc: string[]
    bcc: string[]
  } | null
  attachments: Array<{
    id: string
    originalName: string
    fileName: string
    fileSize: number
    mimeType: string
    downloadUrl: string
    createdAt: string
  }>
  metadata: Record<string, any>
}

interface EmailThreadViewProps {
  emailId: string
}

const getStatusColor = (status: string): 'default' | 'success' | 'error' | 'warning' | 'info' => {
  switch (status) {
    case 'sent':
      return 'info'
    case 'delivered':
      return 'success'
    case 'bounced':
      return 'error'
    case 'complained':
      return 'warning'
    default:
      return 'default'
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function EmailThreadView({ emailId }: EmailThreadViewProps) {
  // Fetch email details
  const { data: email, isLoading, error } = useQuery<EmailDetail>({
    queryKey: ['email-detail', emailId],
    queryFn: async () => {
      const response = await fetch(`/api/email/${emailId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch email details')
      }
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Box p={2}>
        <Typography color="text.secondary">Loading email details...</Typography>
      </Box>
    )
  }

  if (error || !email) {
    return (
      <Alert severity="error">
        Failed to load email details
      </Alert>
    )
  }

  const renderEmailBody = () => {
    if (!email.body) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No email body content available
        </Alert>
      )
    }

    if (email.body.html) {
      return (
        <Box
          sx={{
            mt: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            backgroundColor: 'background.paper',
            '& img': { maxWidth: '100%' },
            '& a': { color: 'primary.main' }
          }}
          dangerouslySetInnerHTML={{ __html: email.body.html }}
        />
      )
    }

    return (
      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {email.body.text || 'No content available'}
        </Typography>
      </Paper>
    )
  }

  return (
    <Stack spacing={3}>
      {/* Email Header */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {email.subject || '(No Subject)'}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip 
                label={email.status}
                color={getStatusColor(email.status)}
                size="small"
              />
              {email.templateKey && (
                <Chip 
                  label={email.templateKey}
                  variant="outlined"
                  size="small"
                />
              )}
              {email.openedAt && (
                <Chip 
                  icon={<OpenIcon />}
                  label="Opened"
                  color="success"
                  size="small"
                />
              )}
              {email.clickedAt && (
                <Chip 
                  icon={<ClickIcon />}
                  label="Clicked"
                  color="success"
                  size="small"
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">From</Typography>
            <Typography variant="body2">{email.fromEmail}</Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">To</Typography>
            <Typography variant="body2">{email.toEmail}</Typography>
          </Grid>

          {email.body?.cc && email.body.cc.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">CC</Typography>
              <Typography variant="body2">{email.body.cc.join(', ')}</Typography>
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">Sent</Typography>
            <Typography variant="body2">
              {email.sentAt ? format(new Date(email.sentAt), 'MMM d, yyyy h:mm a') : 'Not sent'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Business Context */}
      {(email.seller || email.advertiser || email.agency || email.campaign) && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Business Context</Typography>
          <Grid container spacing={2}>
            {email.seller && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Seller</Typography>
                    <Typography variant="body2">{email.seller.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {email.seller.email}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {email.advertiser && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Advertiser</Typography>
                    <Typography variant="body2">{email.advertiser}</Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {email.agency && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Agency</Typography>
                    <Typography variant="body2">{email.agency}</Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {email.campaign && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <CampaignIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Campaign</Typography>
                    <Typography variant="body2">{email.campaign}</Typography>
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Email Body */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>Email Content</Typography>
        {renderEmailBody()}
      </Box>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Attachments ({email.attachments.length})
          </Typography>
          <List>
            {email.attachments.map((attachment) => (
              <ListItem
                key={attachment.id}
                secondaryAction={
                  <Tooltip title="Download">
                    <IconButton
                      edge="end"
                      component="a"
                      href={attachment.downloadUrl}
                      download={attachment.originalName}
                      target="_blank"
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemIcon>
                  <AttachmentIcon />
                </ListItemIcon>
                <ListItemText
                  primary={attachment.originalName}
                  secondary={`${formatFileSize(attachment.fileSize)} • ${attachment.mimeType}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Bounce/Complaint Info */}
      {(email.bouncedAt || email.complainedAt) && (
        <Alert severity="warning">
          {email.bouncedAt && (
            <Box mb={1}>
              <Typography variant="subtitle2">Bounced</Typography>
              <Typography variant="body2">
                {format(new Date(email.bouncedAt), 'MMM d, yyyy h:mm a')}
                {email.bounceType && ` - Type: ${email.bounceType}`}
                {email.bounceReason && ` - Reason: ${email.bounceReason}`}
              </Typography>
            </Box>
          )}
          {email.complainedAt && (
            <Box>
              <Typography variant="subtitle2">Complaint Received</Typography>
              <Typography variant="body2">
                {format(new Date(email.complainedAt), 'MMM d, yyyy h:mm a')}
              </Typography>
            </Box>
          )}
        </Alert>
      )}
    </Stack>
  )
}