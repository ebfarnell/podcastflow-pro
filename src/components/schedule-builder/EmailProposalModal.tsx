'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert
} from '@mui/material'
import { Send as SendIcon, Close as CloseIcon } from '@mui/icons-material'
import { toast } from '@/lib/toast'

interface EmailProposalModalProps {
  open: boolean
  onClose: () => void
  proposalId: string
  campaignName: string
}

export function EmailProposalModal({
  open,
  onClose,
  proposalId,
  campaignName
}: EmailProposalModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setSending(true)
    setError('')

    try {
      const response = await fetch(`/api/proposals/${proposalId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          recipientName,
          message
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send email')
      }

      toast.success('Proposal sent successfully!')
      handleClose()
    } catch (error: any) {
      console.error('Send email error:', error)
      setError(error.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    if (!sending) {
      setRecipientEmail('')
      setRecipientName('')
      setMessage('')
      setError('')
      onClose()
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Email Proposal: {campaignName}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Recipient Email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            margin="normal"
            required
            error={!!error && error.includes('email')}
          />
          
          <TextField
            fullWidth
            label="Recipient Name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            margin="normal"
            placeholder="John Doe"
          />
          
          <TextField
            fullWidth
            label="Personal Message (Optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            margin="normal"
            multiline
            rows={4}
            placeholder="Add a personal message to include in the email..."
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={sending}
          startIcon={<CloseIcon />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={sending || !recipientEmail}
          startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {sending ? 'Sending...' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}