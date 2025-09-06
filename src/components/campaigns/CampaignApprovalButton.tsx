'use client'

import { useState } from 'react'
import { 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  TextField,
  Alert,
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import { 
  CheckCircle as CheckIcon,
  Assignment as ContractIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as OrderIcon,
  Campaign as CampaignIcon
} from '@mui/icons-material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Campaign } from '@/types/campaign'

interface CampaignApprovalButtonProps {
  campaign: Campaign
  disabled?: boolean
}

export function CampaignApprovalButton({ campaign, disabled }: CampaignApprovalButtonProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${campaign.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve campaign')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      
      // Close dialog and redirect to order
      setOpen(false)
      if (data.results?.order?.id) {
        router.push(`/orders/${data.results.order.id}`)
      }
    },
    onError: (error: Error) => {
      setError(error.message)
    }
  })

  const canApprove = campaign.probability === 100 && 
    campaign.status !== 'approved' && 
    campaign.status !== 'active' &&
    !disabled

  const handleApprove = () => {
    setError(null)
    approveMutation.mutate()
  }

  if (!canApprove) {
    return null
  }

  return (
    <>
      <Button
        variant="contained"
        color="success"
        startIcon={<CheckIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Approve Campaign
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Campaign</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Approving this campaign will:
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CampaignIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Move campaign from Pipeline to Orders"
                  secondary="Campaign status will change to 'approved'"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <OrderIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Create Order"
                  secondary="Generate order with all campaign details"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <ContractIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Generate Contract"
                  secondary="Create contract with payment terms"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <InvoiceIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Queue Initial Invoice"
                  secondary="Create draft invoice for billing"
                />
              </ListItem>
            </List>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Approval Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this approval..."
            disabled={approveMutation.isPending}
          />
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setOpen(false)}
            disabled={approveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            startIcon={approveMutation.isPending ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve Campaign'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}